import * as cheerio from 'cheerio';

import {
  Agenda,
  ContextoExtracaoAgenda,
  ItemAgenda,
  Paciente,
  ResultadoExtracaoAgenda
} from '../models/agenda.js';
import { parseOptionalPortalField } from '../utils/portal-optional-field.js';

const AGENDA_TABLE_SELECTOR = 'table#agenda';
const RESULT_LEGEND = 'Resultado';

/** Cabeçalhos confirmados na evidência 004; ligação por texto do `th`, não por índice fixo. */
const HEADER = {
  categoria: 'Categoria',
  cpf: 'CPF',
  email: 'E-mail',
  hora: 'Hora',
  nome: 'Nome',
  statusExameMedico: 'Status do Exame Médico',
  statusExamePsicologico: 'Status do Exame Psicológico',
  telefone: 'Telefone',
  tipoProcesso: 'Tipo de Processo'
} as const;

const REQUIRED_HEADERS: readonly string[] = [
  HEADER.hora,
  HEADER.cpf,
  HEADER.nome,
  HEADER.telefone,
  HEADER.email,
  HEADER.tipoProcesso,
  HEADER.categoria,
  HEADER.statusExameMedico,
  HEADER.statusExamePsicologico
];

type CheerioRoot = ReturnType<typeof cheerio.load>;
type CheerioSelection = ReturnType<CheerioRoot>;

/**
 * Converte o HTML bruto da consulta de agenda em modelos de domínio.
 *
 * Seletores prioritários (evidência Fase 004):
 * 1. `table#agenda`
 * 2. fallback: fieldset com legend `Resultado` + tabela cujos `th` batem pelos textos
 *
 * Colunas são resolvidas pelo texto do cabeçalho, não por posição visual.
 */
export function parseAgendaHtml(
  html: string,
  contexto: ContextoExtracaoAgenda = {}
): ResultadoExtracaoAgenda {
  const $ = cheerio.load(html);
  const table = locateAgendaTable($);

  if (table === undefined) {
    return { motivoFalha: 'html-sem-tabela-agenda', sucesso: false };
  }

  const columnIndexByHeader = mapHeaderIndexes($, table);
  const missingRequired = REQUIRED_HEADERS.filter(
    (header) => columnIndexByHeader.get(header) === undefined
  );

  if (missingRequired.length > 0) {
    return { motivoFalha: 'cabecalhos-obrigatorios-ausentes', sucesso: false };
  }

  const itens: ItemAgenda[] = [];
  const dataRows = table
    .find('tr')
    .toArray()
    .filter((row) => $(row).find('th').length === 0 && $(row).find('td').length > 0);

  for (const row of dataRows) {
    const cells = $(row).find('td');
    if (cells.length === 0) {
      continue;
    }

    const item = rowToItemAgenda($, cells, columnIndexByHeader);
    if (item !== undefined) {
      itens.push(item);
    }
  }

  const agenda: Agenda = {
    itens,
    ...(contexto.dataConsulta !== undefined && contexto.dataConsulta.trim().length > 0
      ? { dataConsulta: contexto.dataConsulta.trim() }
      : {})
  };

  return { agenda, sucesso: true };
}

function locateAgendaTable($: CheerioRoot): CheerioSelection | undefined {
  const byId = $(AGENDA_TABLE_SELECTOR).first();
  if (byId.length > 0) {
    return byId;
  }

  const byLegend = $('legend')
    .filter((_index, element) => normalizeText($(element).text()) === RESULT_LEGEND)
    .first()
    .parent('fieldset')
    .find('table')
    .filter((_index, element) => tableHasAgendaHeaders($, $(element)))
    .first();

  return byLegend.length > 0 ? byLegend : undefined;
}

function tableHasAgendaHeaders($: CheerioRoot, table: CheerioSelection): boolean {
  const headers = readHeaderTexts($, table);
  return (
    headers.includes(HEADER.hora) &&
    headers.includes(HEADER.cpf) &&
    headers.includes(HEADER.nome)
  );
}

function readHeaderTexts($: CheerioRoot, table: CheerioSelection): string[] {
  return table
    .find('tr')
    .first()
    .find('th')
    .map((_index, element) => normalizeText($(element).text()))
    .get()
    .filter((text) => text.length > 0);
}

function mapHeaderIndexes(
  $: CheerioRoot,
  table: CheerioSelection
): Map<string, number> {
  const map = new Map<string, number>();
  table
    .find('tr')
    .first()
    .find('th')
    .each((index, element) => {
      const text = normalizeText($(element).text());
      if (text.length > 0 && !map.has(text)) {
        map.set(text, index);
      }
    });
  return map;
}

function rowToItemAgenda(
  $: CheerioRoot,
  cells: CheerioSelection,
  columnIndexByHeader: Map<string, number>
): ItemAgenda | undefined {
  const horario = cellByHeader($, cells, columnIndexByHeader, HEADER.hora);
  const nome = cellByHeader($, cells, columnIndexByHeader, HEADER.nome);
  const cpf = cellByHeader($, cells, columnIndexByHeader, HEADER.cpf);
  const telefone = cellByHeader($, cells, columnIndexByHeader, HEADER.telefone);
  const email = cellByHeader($, cells, columnIndexByHeader, HEADER.email);
  const tipoProcesso = cellByHeader($, cells, columnIndexByHeader, HEADER.tipoProcesso);
  const categoria = cellByHeader($, cells, columnIndexByHeader, HEADER.categoria);
  const statusExameMedico = cellByHeader(
    $,
    cells,
    columnIndexByHeader,
    HEADER.statusExameMedico
  );
  const statusExamePsicologico = cellByHeader(
    $,
    cells,
    columnIndexByHeader,
    HEADER.statusExamePsicologico
  );

  const paciente: Paciente = {
    ...(cpf !== undefined ? { cpf } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(nome !== undefined ? { nome } : {}),
    ...(telefone !== undefined ? { telefone } : {})
  };

  const itemVazio =
    Object.keys(paciente).length === 0 &&
    horario === undefined &&
    tipoProcesso === undefined &&
    categoria === undefined &&
    statusExameMedico === undefined &&
    statusExamePsicologico === undefined;

  if (itemVazio) {
    return undefined;
  }

  return {
    paciente,
    ...(categoria !== undefined ? { categoria } : {}),
    ...(horario !== undefined ? { horario } : {}),
    ...(statusExameMedico !== undefined ? { statusExameMedico } : {}),
    ...(statusExamePsicologico !== undefined ? { statusExamePsicologico } : {}),
    ...(tipoProcesso !== undefined ? { tipoProcesso } : {})
  };
}

function cellByHeader(
  $: CheerioRoot,
  cells: CheerioSelection,
  columnIndexByHeader: Map<string, number>,
  header: string
): string | undefined {
  const index = columnIndexByHeader.get(header);
  if (index === undefined) {
    return undefined;
  }

  const text = normalizeText(cells.eq(index).text());
  return parseOptionalPortalField(text.length > 0 ? text : undefined);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
