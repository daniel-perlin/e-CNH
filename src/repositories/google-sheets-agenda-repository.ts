import type { Agenda } from '../models/agenda.js';
import type { GoogleSheetsValuesPort } from '../client/google-sheets-client.js';

import type {
  AgendaRepository,
  ContextoPersistenciaAgenda,
  ResultadoPersistenciaAgenda
} from './agenda-repository.js';
import { CABECALHOS_ABA_AGENDA, NOME_ABA_AGENDA_PADRAO } from './agenda-sheet-headers.js';
import { AgendaSheetMapper } from './agenda-sheet-mapper.js';

export interface GoogleSheetsAgendaRepositoryOptions {
  mapper?: AgendaSheetMapper;
  sheetName?: string;
  sheets: GoogleSheetsValuesPort;
}

/**
 * Persistência da agenda em Google Sheets.
 * Delega conversão de domínio ao `AgendaSheetMapper` e I/O ao port de valores.
 */
export class GoogleSheetsAgendaRepository implements AgendaRepository {
  private readonly mapper: AgendaSheetMapper;
  private readonly sheetName: string;
  private readonly sheets: GoogleSheetsValuesPort;

  public constructor(options: GoogleSheetsAgendaRepositoryOptions) {
    this.sheets = options.sheets;
    this.mapper = options.mapper ?? new AgendaSheetMapper();
    this.sheetName = options.sheetName?.trim() || NOME_ABA_AGENDA_PADRAO;
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

      const preservados = registrosExistentes.filter(
        (registro) =>
          !(registro.dataConsulta === dataConsulta && registro.profissional === profissional)
      );
      const linhasRemovidas = registrosExistentes.length - preservados.length;

      const novasLinhas = this.mapper.agendaParaLinhas(agenda, { profissional });
      const linhasPreservadas: string[][] = [];
      for (const registro of preservados) {
        const linha = this.mapper.agendaParaLinhas(
          { dataConsulta: registro.dataConsulta, itens: [registro.item] },
          { profissional: registro.profissional }
        )[0];
        if (linha !== undefined) {
          linhasPreservadas.push(linha);
        }
      }

      const valoresFinais = [cabecalho, ...linhasPreservadas, ...novasLinhas];
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
    return `'${this.escapeSheetName(this.sheetName)}'!A:K`;
  }

  private rangeEscrita(valores: string[][]): string {
    const ultimaLinha = Math.max(valores.length, 1);
    return `'${this.escapeSheetName(this.sheetName)}'!A1:K${ultimaLinha}`;
  }

  private escapeSheetName(name: string): string {
    return name.replaceAll("'", "''");
  }

  private cabecalhoCompativel(cabecalho: readonly string[]): boolean {
    if (cabecalho.length < CABECALHOS_ABA_AGENDA.length) {
      return false;
    }
    return CABECALHOS_ABA_AGENDA.every((esperado, index) => cabecalho[index]?.trim() === esperado);
  }
}
