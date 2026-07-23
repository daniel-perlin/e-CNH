import type { Agenda, ItemAgenda, Paciente } from '../models/agenda.js';
import { normalizeEmail } from '../utils/email.js';
import { normalizePhone } from '../utils/phone.js';

import {
  CABECALHOS_ABA_AGENDA,
  resolverAliasCabecalho,
  type CabecalhoAbaAgenda,
  type ColunaAgendaLeitura
} from './agenda-sheet-headers.js';

/** Contexto mínimo exigido pela persistência na planilha. */
export interface ContextoLinhaAgenda {
  /** Nome do profissional gravado na coluna PROFISSIONAL. */
  profissional: string;
  /**
   * Nome operacional da unidade (coluna UNIDADE).
   * Origem: profissional sincronizado, não o HTML da agenda.
   */
  unidadeOperacional: string;
  /**
   * Data da primeira inclusão do paciente ativo (`DD/MM/YYYY HH:mm`).
   * Em linhas novas: timestamp da execução; em linhas existentes ativas: valor preservado.
   */
  dataInclusao: string;
}

/** Uma linha lógica da aba Agenda (domínio + contexto de persistência). */
export interface LinhaAgendaPersistida {
  dataConsulta: string;
  item: ItemAgenda;
  profissional: string;
  /** Nome operacional; ausente em planilhas legadas sem a coluna Unidade. */
  unidadeOperacional?: string;
  /** Valor da coluna operacional; ausente em planilhas legadas. */
  dataInclusao?: string;
}

/**
 * Converte modelos de domínio em linhas da planilha (e o inverso).
 * Camada pura: sem I/O, sem googleapis, sem regras de negócio.
 * Projeta apenas `CABECALHOS_ABA_AGENDA` — demais campos do domínio são omitidos na escrita.
 */
export class AgendaSheetMapper {
  /**
   * Gera a linha de cabeçalho canônica (única fonte: `CABECALHOS_ABA_AGENDA`).
   */
  public cabecalho(): string[] {
    return [...CABECALHOS_ABA_AGENDA];
  }

  /**
   * Converte uma agenda tipada em linhas de dados (sem cabeçalho).
   * Agenda vazia produz zero linhas. CPF e metadados de exame não são gravados.
   */
  public agendaParaLinhas(agenda: Agenda, contexto: ContextoLinhaAgenda): string[][] {
    const profissional = contexto.profissional.trim();
    const unidadeOperacional = contexto.unidadeOperacional.trim();
    const dataConsulta = agenda.dataConsulta?.trim() ?? '';
    const dataInclusao = contexto.dataInclusao;

    return agenda.itens.map((item) =>
      this.itemParaLinha(item, profissional, unidadeOperacional, dataConsulta, dataInclusao)
    );
  }

  /**
   * Interpreta linhas de dados (sem cabeçalho) usando o cabeçalho informado.
   * Células vazias viram propriedades omitidas no domínio.
   * Aceita aliases de layouts anteriores; CPF legado entra no domínio se presente.
   */
  public linhasParaRegistros(
    linhas: readonly (readonly string[])[],
    cabecalhos: readonly string[]
  ): LinhaAgendaPersistida[] {
    const indices = this.mapearIndices(cabecalhos);
    const registros: LinhaAgendaPersistida[] = [];

    for (const linha of linhas) {
      const profissional = this.celula(linha, indices, 'PROFISSIONAL');
      const dataConsulta = this.celula(linha, indices, 'AGENDAMENTO DO DETRAN');
      if (profissional === undefined || dataConsulta === undefined) {
        continue;
      }

      const dataInclusao = this.celula(linha, indices, 'DATA DE INCLUSÃO');
      const unidadeOperacional = this.celula(linha, indices, 'UNIDADE');
      const registro: LinhaAgendaPersistida = {
        dataConsulta,
        profissional,
        item: this.linhaParaItem(linha, indices)
      };
      if (dataInclusao !== undefined) {
        registro.dataInclusao = dataInclusao;
      }
      if (unidadeOperacional !== undefined) {
        registro.unidadeOperacional = unidadeOperacional;
      }
      registros.push(registro);
    }

    return registros;
  }

  /**
   * Agrupa registros de um mesmo profissional/data em um `Agenda`.
   */
  public registrosParaAgenda(
    registros: readonly LinhaAgendaPersistida[],
    dataConsulta: string,
    profissional: string
  ): Agenda {
    const itens = registros
      .filter(
        (registro) =>
          registro.dataConsulta === dataConsulta && registro.profissional === profissional
      )
      .map((registro) => registro.item);

    return { dataConsulta, itens };
  }

  private itemParaLinha(
    item: ItemAgenda,
    profissional: string,
    unidadeOperacional: string,
    dataConsulta: string,
    dataInclusao: string
  ): string[] {
    return [
      unidadeOperacional,
      dataConsulta,
      item.horario ?? '',
      item.paciente.nome ?? '',
      normalizePhone(item.paciente.telefone ?? ''),
      normalizeEmail(item.paciente.email ?? ''),
      profissional,
      dataInclusao
    ];
  }

  private linhaParaItem(
    linha: readonly string[],
    indices: ReadonlyMap<ColunaAgendaLeitura, number>
  ): ItemAgenda {
    const paciente: Paciente = {};
    const cpf = this.celula(linha, indices, 'CPF');
    const nome = this.celula(linha, indices, 'PACIENTE');
    const telefone = this.celula(linha, indices, 'TELEFONE');
    const email = this.celula(linha, indices, 'EMAIL');

    if (cpf !== undefined) {
      paciente.cpf = cpf;
    }
    if (nome !== undefined) {
      paciente.nome = nome;
    }
    if (telefone !== undefined) {
      paciente.telefone = telefone;
    }
    if (email !== undefined) {
      paciente.email = email;
    }

    const item: ItemAgenda = { paciente };
    const horario = this.celula(linha, indices, 'HORÁRIO');

    if (horario !== undefined) {
      item.horario = horario;
    }

    return item;
  }

  private mapearIndices(
    cabecalhos: readonly string[]
  ): ReadonlyMap<ColunaAgendaLeitura, number> {
    const indices = new Map<ColunaAgendaLeitura, number>();
    for (let index = 0; index < cabecalhos.length; index += 1) {
      const titulo = cabecalhos[index];
      if (titulo === undefined) {
        continue;
      }
      const canonico = resolverAliasCabecalho(titulo);
      if (canonico !== undefined && !indices.has(canonico)) {
        indices.set(canonico, index);
      }
    }
    return indices;
  }

  private celula(
    linha: readonly string[],
    indices: ReadonlyMap<ColunaAgendaLeitura, number>,
    cabecalho: ColunaAgendaLeitura
  ): string | undefined {
    const index = indices.get(cabecalho);
    if (index === undefined) {
      return undefined;
    }
    const valor = linha[index]?.trim();
    if (valor === undefined || valor.length === 0) {
      return undefined;
    }
    return valor;
  }
}

/** Reexport para consumidores que tipam pelo cabeçalho canônico. */
export type { CabecalhoAbaAgenda };
