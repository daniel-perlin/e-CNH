import type { Agenda } from '../models/agenda.js';
import type { GoogleSheetsValuesPort } from '../client/google-sheets-client.js';
import { isDataAgendamentoAtiva } from '../utils/agenda-date.js';
import { normalizeCpfKey } from '../utils/cpf.js';
import { formatSyncTimestamp } from '../utils/sync-timestamp.js';

import type {
  AgendaRepository,
  ContextoPersistenciaAgenda,
  ResultadoPersistenciaAgenda
} from './agenda-repository.js';
import {
  CABECALHO_DATA_AGENDAMENTO_LEGADO,
  CABECALHO_DATA_INCLUSAO_LEGADO,
  CABECALHOS_ABA_AGENDA,
  NOME_ABA_AGENDA_PADRAO
} from './agenda-sheet-headers.js';
import { AgendaSheetMapper, type LinhaAgendaPersistida } from './agenda-sheet-mapper.js';

export interface GoogleSheetsAgendaRepositoryOptions {
  mapper?: AgendaSheetMapper;
  sheetName?: string;
  sheets: GoogleSheetsValuesPort;
  /**
   * Instante de referência do “hoje” (fuso America/Sao_Paulo).
   * Destinado a testes; em produção usa `new Date()`.
   */
  agora?: Date;
}

/**
 * Persistência da agenda em Google Sheets.
 * Cadastro de pacientes ativos: mantém apenas Data de Agendamento ≥ hoje;
 * CPF normalizado é a chave única enquanto o paciente permanece ativo.
 */
export class GoogleSheetsAgendaRepository implements AgendaRepository {
  private readonly mapper: AgendaSheetMapper;
  private readonly sheetName: string;
  private readonly sheets: GoogleSheetsValuesPort;
  private readonly agora: Date | undefined;

  public constructor(options: GoogleSheetsAgendaRepositoryOptions) {
    this.sheets = options.sheets;
    this.mapper = options.mapper ?? new AgendaSheetMapper();
    this.sheetName = options.sheetName?.trim() || NOME_ABA_AGENDA_PADRAO;
    this.agora = options.agora;
  }

  public async salvarAgenda(
    agenda: Agenda,
    contexto: ContextoPersistenciaAgenda
  ): Promise<ResultadoPersistenciaAgenda> {
    const profissional = contexto.profissional?.trim() ?? '';
    if (profissional.length === 0) {
      return { sucesso: false, motivoFalha: 'contexto-incompleto' };
    }

    const dataConsulta = agenda.dataConsulta?.trim() ?? '';
    if (dataConsulta.length === 0) {
      return { sucesso: false, motivoFalha: 'data-consulta-ausente' };
    }

    try {
      const referencia = this.agora ?? new Date();
      const matriz = await this.lerMatriz();
      const cabecalhoAtual = matriz[0];
      const corpo = matriz.length > 0 ? matriz.slice(1) : [];

      if (cabecalhoAtual !== undefined && !this.cabecalhoCompativel(cabecalhoAtual)) {
        return { sucesso: false, motivoFalha: 'cabecalho-incompativel' };
      }

      const cabecalho = this.mapper.cabecalho();
      const registrosExistentes =
        cabecalhoAtual === undefined
          ? []
          : this.mapper.linhasParaRegistros(corpo, cabecalhoAtual);

      const ativos: LinhaAgendaPersistida[] = [];
      let linhasRemovidas = 0;
      for (const registro of registrosExistentes) {
        if (isDataAgendamentoAtiva(registro.dataConsulta, referencia)) {
          ativos.push(registro);
        } else {
          linhasRemovidas += 1;
        }
      }

      const cpfsAtivos = new Set<string>();
      for (const registro of ativos) {
        const chave = normalizeCpfKey(registro.item.paciente.cpf ?? '');
        if (chave !== undefined) {
          cpfsAtivos.add(chave);
        }
      }

      const linhasAtivas: string[][] = [];
      for (const registro of ativos) {
        const linha = this.mapper.agendaParaLinhas(
          { dataConsulta: registro.dataConsulta, itens: [registro.item] },
          {
            profissional: registro.profissional,
            dataInclusao: registro.dataInclusao ?? ''
          }
        )[0];
        if (linha !== undefined) {
          linhasAtivas.push(linha);
        }
      }

      const dataInclusao = formatSyncTimestamp(referencia);
      const novasLinhas: string[][] = [];

      if (isDataAgendamentoAtiva(dataConsulta, referencia)) {
        for (const item of agenda.itens) {
          const chave = normalizeCpfKey(item.paciente.cpf ?? '');
          if (chave !== undefined && cpfsAtivos.has(chave)) {
            continue;
          }

          const linha = this.mapper.agendaParaLinhas(
            { dataConsulta, itens: [item] },
            { profissional, dataInclusao }
          )[0];
          if (linha === undefined) {
            continue;
          }

          novasLinhas.push(linha);
          if (chave !== undefined) {
            cpfsAtivos.add(chave);
          }
        }
      }

      const valoresFinais = [cabecalho, ...linhasAtivas, ...novasLinhas];
      await this.reescreverAba(valoresFinais);

      return {
        sucesso: true,
        linhasGravadas: novasLinhas.length,
        linhasRemovidas
      };
    } catch {
      return { sucesso: false, motivoFalha: 'erro-infraestrutura' };
    }
  }

  public async listarPorData(
    dataConsulta: string,
    contexto: ContextoPersistenciaAgenda
  ): Promise<Agenda | null> {
    const profissional = contexto.profissional?.trim() ?? '';
    const data = dataConsulta.trim();
    if (profissional.length === 0 || data.length === 0) {
      return null;
    }

    const matriz = await this.lerMatriz();
    if (matriz.length === 0) {
      return null;
    }

    const cabecalho = matriz[0];
    if (cabecalho === undefined || !this.cabecalhoCompativel(cabecalho)) {
      return null;
    }

    const registros = this.mapper.linhasParaRegistros(matriz.slice(1), cabecalho);
    const agenda = this.mapper.registrosParaAgenda(registros, data, profissional);
    if (agenda.itens.length === 0) {
      return null;
    }
    return agenda;
  }

  private async lerMatriz(): Promise<string[][]> {
    return this.sheets.getValues(this.rangeCompleto());
  }

  private async reescreverAba(valores: string[][]): Promise<void> {
    await this.sheets.clearValues(this.rangeCompleto());
    if (valores.length === 0) {
      return;
    }
    await this.sheets.updateValues(this.rangeEscrita(valores), valores);
  }

  private rangeCompleto(): string {
    return `'${this.escapeSheetName(this.sheetName)}'!A:L`;
  }

  private rangeEscrita(valores: string[][]): string {
    const ultimaLinha = Math.max(valores.length, 1);
    return `'${this.escapeSheetName(this.sheetName)}'!A1:L${ultimaLinha}`;
  }

  private escapeSheetName(name: string): string {
    return name.replaceAll("'", "''");
  }

  private cabecalhoCompativel(cabecalho: readonly string[]): boolean {
    const variantes: readonly string[][] = [
      [...CABECALHOS_ABA_AGENDA],
      this.substituirCabecalho(
        [...CABECALHOS_ABA_AGENDA],
        'Data de Agendamento',
        CABECALHO_DATA_AGENDAMENTO_LEGADO
      ),
      this.substituirCabecalho(
        [...CABECALHOS_ABA_AGENDA],
        'Data de inclusão',
        CABECALHO_DATA_INCLUSAO_LEGADO
      ),
      this.substituirCabecalho(
        this.substituirCabecalho(
          [...CABECALHOS_ABA_AGENDA],
          'Data de Agendamento',
          CABECALHO_DATA_AGENDAMENTO_LEGADO
        ),
        'Data de inclusão',
        CABECALHO_DATA_INCLUSAO_LEGADO
      ),
      CABECALHOS_ABA_AGENDA.slice(0, -1),
      this.substituirCabecalho(
        [...CABECALHOS_ABA_AGENDA.slice(0, -1)],
        'Data de Agendamento',
        CABECALHO_DATA_AGENDAMENTO_LEGADO
      )
    ];

    return variantes.some((esperado) => this.cabecalhosIguais(cabecalho, esperado));
  }

  private substituirCabecalho(
    cabecalhos: string[],
    atual: string,
    novo: string
  ): string[] {
    return cabecalhos.map((titulo) => (titulo === atual ? novo : titulo));
  }

  private cabecalhosIguais(
    atual: readonly string[],
    esperado: readonly string[]
  ): boolean {
    if (atual.length < esperado.length) {
      return false;
    }
    return esperado.every((titulo, index) => atual[index]?.trim() === titulo);
  }
}
