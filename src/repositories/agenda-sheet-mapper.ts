import type { PerfilProfissionalId } from '../client/perfil-profissional-portal.js';
import type { Agenda, ItemAgenda, Paciente } from '../models/agenda.js';
import { formatProfessionalDisplayName } from '../utils/format-professional-display-name.js';
import { normalizeEmail } from '../utils/email.js';
import {
  formatOptionalFieldForSheet,
  parseOptionalFieldFromSheet
} from '../utils/sheet-optional-field.js';
import { formatPatientNameForSheet } from '../utils/sheet-patient-name.js';
import { formatPhoneForSheet } from '../utils/sheet-phone.js';

import {
  CABECALHOS_ABA_AGENDA,
  resolverAliasCabecalho,
  type CabecalhoAbaAgenda,
  type ColunaAgendaLeitura
} from './agenda-sheet-headers.js';

/** Contexto mínimo exigido pela persistência na planilha. */
export interface ContextoLinhaAgenda {
  /**
   * Nome do profissional.
   * Com `perfilId`: nome completo da config (será formatado na escrita).
   * Sem `perfilId`: valor já projetado na planilha (regravação de linha existente).
   */
  profissional: string;
  /**
   * Perfil de domínio para prefixar a coluna PROFISSIONAL.
   * Omitido ao reprojetar linhas já persistidas.
   */
  perfilId?: PerfilProfissionalId;
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
  /**
   * Índice 0-based da linha em `corpo`/`linhas` original (antes de skips do parser).
   * Necessário para hidratar o CPF técnico sem dessincronizar após linhas ignoradas.
   */
  rowIndex: number;
}

/**
 * Converte modelos de domínio em linhas da planilha (e o inverso).
 * Camada pura: sem I/O, sem googleapis, sem regras de negócio.
 * Projeta apenas `CABECALHOS_ABA_AGENDA` — CPF e status de exames ficam fora da escrita visual.
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
   * Agenda vazia produz zero linhas. CPF e status de exames não são gravados.
   */
  public agendaParaLinhas(agenda: Agenda, contexto: ContextoLinhaAgenda): string[][] {
    const profissionalBruto = contexto.profissional.trim();
    const profissional =
      contexto.perfilId !== undefined
        ? formatProfessionalDisplayName(profissionalBruto, contexto.perfilId)
        : profissionalBruto;
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

    for (let rowIndex = 0; rowIndex < linhas.length; rowIndex += 1) {
      const linha = linhas[rowIndex];
      if (linha === undefined) {
        continue;
      }
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
        rowIndex,
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
    const valores: Record<CabecalhoAbaAgenda, string> = {
      UNIDADE: unidadeOperacional,
      'AGENDAMENTO DO DETRAN': dataConsulta,
      HORÁRIO: item.horario ?? '',
      PACIENTE: formatPatientNameForSheet(item.paciente.nome ?? ''),
      TELEFONE: formatOptionalFieldForSheet(formatPhoneForSheet(item.paciente.telefone ?? '')),
      EMAIL: formatOptionalFieldForSheet(normalizeEmail(item.paciente.email ?? '')),
      'Tipo de Processo': item.tipoProcesso?.trim() ?? '',
      Categoria: formatOptionalFieldForSheet(item.categoria?.trim() ?? ''),
      PROFISSIONAL: profissional,
      'DATA DE INCLUSÃO': dataInclusao
    };

    return CABECALHOS_ABA_AGENDA.map((titulo) => valores[titulo]);
  }

  private linhaParaItem(
    linha: readonly string[],
    indices: ReadonlyMap<ColunaAgendaLeitura, number>
  ): ItemAgenda {
    const paciente: Paciente = {};
    const cpf = this.celula(linha, indices, 'CPF');
    const nome = this.celula(linha, indices, 'PACIENTE');
    const telefone = parseOptionalFieldFromSheet(this.celula(linha, indices, 'TELEFONE'));
    const email = parseOptionalFieldFromSheet(this.celula(linha, indices, 'EMAIL'));

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
    const tipoProcesso = this.celula(linha, indices, 'Tipo de Processo');
    const categoria = parseOptionalFieldFromSheet(this.celula(linha, indices, 'Categoria'));

    if (horario !== undefined) {
      item.horario = horario;
    }
    if (tipoProcesso !== undefined) {
      item.tipoProcesso = tipoProcesso;
    }
    if (categoria !== undefined) {
      item.categoria = categoria;
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
