import type { Agenda, ItemAgenda } from '../models/agenda.js';
import type { GoogleSheetsValuesPort } from '../client/google-sheets-client.js';
import type { StructuredLogger } from '../types/logger.js';
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
  CABECALHOS_ABA_AGENDA_LEGADO,
  FAIXA_COLUNAS_LEITURA_ABA_AGENDA,
  INDICE_COLUNA_TECNICA_CPF,
  NOME_ABA_AGENDA_PADRAO,
  normalizeTextoCabecalho,
  ULTIMA_COLUNA_PERSISTENCIA_ABA_AGENDA
} from './agenda-sheet-headers.js';
import { AgendaSheetMapper, type LinhaAgendaPersistida } from './agenda-sheet-mapper.js';

/** Divergência pontual entre cabeçalho encontrado e uma variante esperada. */
export interface DivergenciaCabecalhoAgenda {
  /** Índice 0-based da primeira coluna divergente (ou faltante). */
  indice: number;
  esperado: string;
  encontrado: string;
}

export interface GoogleSheetsAgendaRepositoryOptions {
  mapper?: AgendaSheetMapper;
  sheetName?: string;
  sheets: GoogleSheetsValuesPort;
  /**
   * Instante de referência do “hoje” (fuso America/Sao_Paulo).
   * Destinado a testes; em produção usa `new Date()`.
   */
  agora?: Date;
  /** Logger opcional para diagnóstico de cabeçalho incompatível (sem PII). */
  logger?: StructuredLogger;
}

/**
 * Persistência da agenda em Google Sheets.
 * Cadastro de pacientes ativos: mantém apenas agendamento DETRAN ≥ hoje;
 * chave de negócio / deduplicação: CPF normalizado (B004/B005) — inalterada.
 * A projeção operacional (`CABECALHOS_ABA_AGENDA`) não exibe CPF.
 */
export class GoogleSheetsAgendaRepository implements AgendaRepository {
  private readonly mapper: AgendaSheetMapper;
  private readonly sheetName: string;
  private readonly sheets: GoogleSheetsValuesPort;
  private readonly agora: Date | undefined;
  private readonly logger: StructuredLogger | undefined;

  public constructor(options: GoogleSheetsAgendaRepositoryOptions) {
    this.sheets = options.sheets;
    this.mapper = options.mapper ?? new AgendaSheetMapper();
    this.sheetName = options.sheetName?.trim() || NOME_ABA_AGENDA_PADRAO;
    this.agora = options.agora;
    this.logger = options.logger;
  }

  public async salvarAgenda(
    agenda: Agenda,
    contexto: ContextoPersistenciaAgenda
  ): Promise<ResultadoPersistenciaAgenda> {
    const profissional = contexto.profissional?.trim() ?? '';
    if (profissional.length === 0) {
      return { sucesso: false, motivoFalha: 'contexto-incompleto' };
    }

    const unidadeOperacional = contexto.unidadeOperacional?.trim() ?? '';
    if (unidadeOperacional.length === 0) {
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
        this.registrarCabecalhoIncompativel(cabecalhoAtual);
        return { sucesso: false, motivoFalha: 'cabecalho-incompativel' };
      }

      const cabecalho = this.mapper.cabecalho();
      const registrosExistentes =
        cabecalhoAtual === undefined
          ? []
          : this.hidratarCpfTecnico(
              this.mapper.linhasParaRegistros(corpo, cabecalhoAtual),
              corpo
            );

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
        const unidadePreservada = registro.unidadeOperacional?.trim() ?? '';
        const unidadeLinha =
          unidadePreservada.length > 0
            ? unidadePreservada
            : registro.profissional === profissional
              ? unidadeOperacional
              : '';
        const linha = this.projetarLinhaComCpfTecnico(
          registro.item,
          registro.dataConsulta,
          registro.profissional,
          unidadeLinha,
          registro.dataInclusao ?? ''
        );
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

          const linha = this.projetarLinhaComCpfTecnico(
            item,
            dataConsulta,
            profissional,
            unidadeOperacional,
            dataInclusao
          );
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

    const corpo = matriz.slice(1);
    const registros = this.hidratarCpfTecnico(
      this.mapper.linhasParaRegistros(corpo, cabecalho),
      corpo
    );
    const agenda = this.mapper.registrosParaAgenda(registros, data, profissional);
    if (agenda.itens.length === 0) {
      return null;
    }
    return agenda;
  }

  /**
   * Projeção oficial (8 colunas) + CPF técnico na coluna seguinte (fora do contrato visual).
   */
  private projetarLinhaComCpfTecnico(
    item: ItemAgenda,
    dataConsulta: string,
    profissional: string,
    unidadeOperacional: string,
    dataInclusao: string
  ): string[] | undefined {
    const linha = this.mapper.agendaParaLinhas(
      { dataConsulta, itens: [item] },
      { profissional, unidadeOperacional, dataInclusao }
    )[0];
    if (linha === undefined) {
      return undefined;
    }
    const projetada = [...linha];
    while (projetada.length < INDICE_COLUNA_TECNICA_CPF) {
      projetada.push('');
    }
    projetada[INDICE_COLUNA_TECNICA_CPF] = item.paciente.cpf?.trim() ?? '';
    return projetada;
  }

  /**
   * Reinjeta CPF da coluna técnica (ou mantém o CPF legado já mapeado) no domínio.
   */
  private hidratarCpfTecnico(
    registros: LinhaAgendaPersistida[],
    corpo: readonly (readonly string[])[]
  ): LinhaAgendaPersistida[] {
    return registros.map((registro, index) => {
      if (registro.item.paciente.cpf !== undefined) {
        return registro;
      }
      const cpfTecnico = corpo[index]?.[INDICE_COLUNA_TECNICA_CPF]?.trim() ?? '';
      if (cpfTecnico.length === 0) {
        return registro;
      }
      return {
        ...registro,
        item: {
          ...registro.item,
          paciente: { ...registro.item.paciente, cpf: cpfTecnico }
        }
      };
    });
  }

  private async lerMatriz(): Promise<string[][]> {
    return this.sheets.getValues(this.rangeLeitura());
  }

  private async reescreverAba(valores: string[][]): Promise<void> {
    await this.sheets.clearValues(this.rangeLeitura());
    if (valores.length === 0) {
      return;
    }
    await this.sheets.updateValues(this.rangeEscrita(valores), valores);
  }

  private rangeLeitura(): string {
    return `'${this.escapeSheetName(this.sheetName)}'!${FAIXA_COLUNAS_LEITURA_ABA_AGENDA}`;
  }

  private rangeEscrita(valores: string[][]): string {
    const ultimaLinha = Math.max(valores.length, 1);
    return `'${this.escapeSheetName(this.sheetName)}'!A1:${ULTIMA_COLUNA_PERSISTENCIA_ABA_AGENDA}${ultimaLinha}`;
  }

  private escapeSheetName(name: string): string {
    return name.replaceAll("'", "''");
  }

  private cabecalhoCompativel(cabecalho: readonly string[]): boolean {
    return this.variantesCabecalhoAceitas().some((esperado) =>
      this.cabecalhosIguais(cabecalho, esperado)
    );
  }

  private variantesCabecalhoAceitas(): readonly string[][] {
    const legado = [...CABECALHOS_ABA_AGENDA_LEGADO];
    const legadoSemUnidade = CABECALHOS_ABA_AGENDA_LEGADO.filter(
      (titulo) => titulo !== 'Unidade'
    );

    return [
      [...CABECALHOS_ABA_AGENDA],
      legado,
      this.substituirCabecalho(legado, 'Data de Agendamento', CABECALHO_DATA_AGENDAMENTO_LEGADO),
      this.substituirCabecalho(legado, 'Data de inclusão', CABECALHO_DATA_INCLUSAO_LEGADO),
      this.substituirCabecalho(
        this.substituirCabecalho(legado, 'Data de Agendamento', CABECALHO_DATA_AGENDAMENTO_LEGADO),
        'Data de inclusão',
        CABECALHO_DATA_INCLUSAO_LEGADO
      ),
      legadoSemUnidade,
      this.substituirCabecalho(
        legadoSemUnidade,
        'Data de Agendamento',
        CABECALHO_DATA_AGENDAMENTO_LEGADO
      ),
      this.substituirCabecalho(legadoSemUnidade, 'Data de inclusão', CABECALHO_DATA_INCLUSAO_LEGADO),
      this.substituirCabecalho(
        this.substituirCabecalho(
          legadoSemUnidade,
          'Data de Agendamento',
          CABECALHO_DATA_AGENDAMENTO_LEGADO
        ),
        'Data de inclusão',
        CABECALHO_DATA_INCLUSAO_LEGADO
      ),
      legadoSemUnidade.slice(0, -1),
      this.substituirCabecalho(
        [...legadoSemUnidade.slice(0, -1)],
        'Data de Agendamento',
        CABECALHO_DATA_AGENDAMENTO_LEGADO
      )
    ];
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
    return esperado.every(
      (titulo, index) =>
        normalizeTextoCabecalho(atual[index] ?? '') === normalizeTextoCabecalho(titulo)
    );
  }

  /**
   * Localiza a primeira coluna divergente em relação a uma variante esperada
   * (após normalização de whitespace).
   */
  private primeiraDivergenciaCabecalho(
    atual: readonly string[],
    esperado: readonly string[]
  ): DivergenciaCabecalhoAgenda | undefined {
    const limite = Math.max(atual.length, esperado.length);
    for (let indice = 0; indice < limite; indice += 1) {
      const valorEsperado = esperado[indice];
      const valorEncontrado = atual[indice];
      if (valorEsperado === undefined) {
        // Colunas extras após o prefixo aceito não invalidam o layout.
        return undefined;
      }
      const encontrado = valorEncontrado ?? '';
      if (normalizeTextoCabecalho(encontrado) !== normalizeTextoCabecalho(valorEsperado)) {
        return {
          indice,
          esperado: valorEsperado,
          encontrado
        };
      }
    }
    return undefined;
  }

  private registrarCabecalhoIncompativel(encontrado: readonly string[]): void {
    const referencia = [...CABECALHOS_ABA_AGENDA];
    let divergencia = this.primeiraDivergenciaCabecalho(encontrado, referencia);

    if (divergencia === undefined) {
      for (const variante of this.variantesCabecalhoAceitas()) {
        const candidata = this.primeiraDivergenciaCabecalho(encontrado, variante);
        if (candidata !== undefined) {
          divergencia = candidata;
          break;
        }
      }
    }

    this.logger?.warn(
      {
        event: 'agenda.sheets.cabecalho_incompativel',
        motivoFalha: 'cabecalho-incompativel',
        cabecalhoEsperado: referencia,
        cabecalhoEncontrado: [...encontrado],
        colunaDivergente: divergencia
          ? {
              indice: divergencia.indice,
              posicao: divergencia.indice + 1,
              esperado: divergencia.esperado,
              encontrado: divergencia.encontrado
            }
          : undefined
      },
      'Cabeçalho da aba Agenda incompatível com o layout aceito'
    );
  }
}
