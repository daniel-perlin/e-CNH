import 'dotenv/config';

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

import * as cheerio from 'cheerio';

import { ECNHClient } from '../client/ecnh-client.js';
import { ConfigurationError } from '../client/errors.js';
import {
  listEnabledLoginCredentials,
  resolveLoginCredentials
} from '../config/login-credentials.js';

type CheerioRoot = ReturnType<typeof cheerio.load>;
type CheerioSelection = ReturnType<CheerioRoot>;

const AUTHENTICATED_PAGE_MARKER = 'Imprimir Agenda Diária do Psicólogo';
const EVIDENCE_DIRECTORY = 'docs/evidencias';
const RESULT_LEGEND = 'Resultado';

/**
 * Descoberta estrutural do HTML de resultado da agenda (Fase 004).
 * Não interpreta domínio nem grava valores pessoais — apenas metadados e formas.
 */
async function main(): Promise<void> {
  const baseUrl = process.env.ECNH_BASE_URL;
  if (baseUrl === undefined || baseUrl.trim().length === 0) {
    throw new ConfigurationError(
      'Defina ECNH_BASE_URL no arquivo .env antes de executar a descoberta.'
    );
  }

  const credentials =
    listEnabledLoginCredentials().find((item) => item.source.length > 0) ??
    resolveLoginCredentials();

  const startedAt = new Date();
  const client = new ECNHClient({
    baseUrl,
    logger: createQuietLogger()
  });

  const loginResult = await client.login(credentials.cpf, credentials.password);
  if (loginResult.status !== 'sucesso') {
    await saveEvidence({
      approved: false,
      credentialsSource: credentials.source,
      finishedAt: new Date().toISOString(),
      kind: 'descoberta-html-agenda',
      loginStatus: loginResult.status,
      nodeVersion: process.version,
      phase: '004',
      schemaVersion: 1,
      startedAt: startedAt.toISOString(),
      summary: { note: 'Login não confirmado; descoberta abortada.' }
    });
    throw new ConfigurationError(`Login não confirmado: ${loginResult.status}`);
  }

  const datesAvailable = client.listarDatasAgendamento();
  const datesToProbe = datesAvailable.slice(0, Math.min(3, datesAvailable.length));

  const consultations: ConsultationDiscovery[] = [];
  for (const data of datesToProbe) {
    const html = await client.obterHtmlAgenda({ data, dataReferencia: data });
    consultations.push({
      bodyBytes: Buffer.byteLength(html, 'latin1'),
      bodySha256: sha256(html),
      dataKind: 'date',
      inventory: inventoryAgendaHtml(html)
    });
  }

  await client.logout();

  const approved =
    consultations.length > 0 &&
    consultations.every(
      (item) =>
        item.inventory.authenticatedMarkerPresent &&
        item.inventory.legendResultadoPresent &&
        item.inventory.resultTable !== undefined
    );

  const evidencePath = await saveEvidence({
    approved,
    credentialsSource: credentials.source,
    finishedAt: new Date().toISOString(),
    kind: 'descoberta-html-agenda',
    loginStatus: 'sucesso',
    nodeVersion: process.version,
    phase: '004',
    schemaVersion: 1,
    startedAt: startedAt.toISOString(),
    steps: {
      consultations,
      datesAvailableCount: datesAvailable.length,
      datesProbedCount: datesToProbe.length,
      logoutCompleted: true
    },
    summary: {
      note: approved
        ? 'HTML de resultado inventariado com tabela associada ao legend Resultado.'
        : 'Descoberta incompleta: sinais estruturais esperados ausentes.'
    }
  });

  console.log(
    JSON.stringify(
      {
        approved,
        consultations: consultations.length,
        datesAvailable: datesAvailable.length,
        evidencePath,
        resultTables: consultations.map((item) => ({
          columnCount: item.inventory.resultTable?.columns.length ?? 0,
          dataRowCount: item.inventory.resultTable?.dataRowCount ?? 0,
          headerMatchStrategy: item.inventory.resultTable?.headerMatchStrategy,
          selectorCandidates: item.inventory.resultTable?.selectorCandidates
        }))
      },
      null,
      2
    )
  );

  if (!approved) {
    process.exitCode = 1;
  }
}

interface ConsultationDiscovery {
  bodyBytes: number;
  bodySha256: string;
  dataKind: 'date';
  inventory: HtmlInventory;
}

interface HtmlInventory {
  authenticatedMarkerPresent: boolean;
  fieldsetResultado: FieldsetInventory | undefined;
  forms: FormSummary[];
  legendResultadoPresent: boolean;
  loginFormPresent: boolean;
  methodValues: string[];
  resultTable: ResultTableInventory | undefined;
  tableSummaries: TableSummary[];
}

interface FieldsetInventory {
  childTableCount: number;
  hasId: boolean;
  hasName: boolean;
  id: string;
  legendText: string;
  name: string;
}

interface FormSummary {
  id: string;
  methodInputs: string[];
  name: string;
}

interface TableSummary {
  captionText: string;
  classNames: string[];
  columnHeaderTexts: string[];
  dataRowCount: number;
  hasId: boolean;
  hasName: boolean;
  id: string;
  name: string;
  nestedInFieldsetLegend: string;
  role: string;
  summaryAttr: string;
  totalRowCount: number;
}

interface ResultTableInventory {
  columns: ColumnInventory[];
  dataRowCount: number;
  emptyCellCountsByHeader: Record<string, number>;
  headerMatchStrategy: 'th-text' | 'absent';
  headerRowPresent: boolean;
  rowCellCounts: number[];
  selectorCandidates: SelectorCandidate[];
  valueKindsByHeader: Record<string, string[]>;
}

interface ColumnInventory {
  headerText: string;
  thAttributes: AttributeInventory;
}

interface AttributeInventory {
  classPresent: boolean;
  idPresent: boolean;
  namePresent: boolean;
  otherAttributeNames: string[];
}

interface SelectorCandidate {
  rationale: string;
  robustness: 'high' | 'medium' | 'low';
  selector: string;
}

function inventoryAgendaHtml(html: string): HtmlInventory {
  const $ = cheerio.load(html);
  const legends = $('legend')
    .map((_index, element) => normalizeText($(element).text()))
    .get();

  const fieldsetResultado = inventoryResultFieldset($);
  const tableSummaries = inventoryTables($);
  const resultTable = inventoryResultTable($, fieldsetResultado);

  const methodValues = $('input[name="method"]')
    .map((_index, element) => ($(element).attr('value') ?? '').trim())
    .get()
    .filter((value) => value.length > 0);

  const forms = $('form')
    .map((_index, element) => {
      const form = $(element);
      const methodInputs = form
        .find('input[name="method"]')
        .map((_i, input) => ($(input).attr('value') ?? '').trim())
        .get()
        .filter((value) => value.length > 0);
      return {
        id: (form.attr('id') ?? '').trim(),
        methodInputs: [...new Set(methodInputs)],
        name: (form.attr('name') ?? '').trim()
      };
    })
    .get();

  return {
    authenticatedMarkerPresent: html.includes(AUTHENTICATED_PAGE_MARKER),
    fieldsetResultado,
    forms,
    legendResultadoPresent: legends.includes(RESULT_LEGEND),
    loginFormPresent: html.includes('LoginActionForm'),
    methodValues: [...new Set(methodValues)],
    resultTable,
    tableSummaries
  };
}

function inventoryResultFieldset($: CheerioRoot): FieldsetInventory | undefined {
  const legend = $('legend')
    .filter((_index, element) => normalizeText($(element).text()) === RESULT_LEGEND)
    .first();

  if (legend.length === 0) {
    return undefined;
  }

  const fieldset = legend.parent('fieldset');
  if (fieldset.length === 0) {
    return undefined;
  }

  return {
    childTableCount: fieldset.find('table').length,
    hasId: Boolean((fieldset.attr('id') ?? '').trim()),
    hasName: Boolean((fieldset.attr('name') ?? '').trim()),
    id: (fieldset.attr('id') ?? '').trim(),
    legendText: RESULT_LEGEND,
    name: (fieldset.attr('name') ?? '').trim()
  };
}

function inventoryTables($: CheerioRoot): TableSummary[] {
  return $('table')
    .map((_index, element) => {
      const table = $(element);
      const enclosingLegend = table
        .closest('fieldset')
        .find('legend')
        .first();
      const headerTexts = table
        .find('tr')
        .first()
        .find('th')
        .map((_i, th) => normalizeText($(th).text()))
        .get()
        .filter((text) => text.length > 0);

      const rows = table.find('tr');
      const dataRowCount = rows
        .toArray()
        .filter((row) => $(row).find('th').length === 0 && $(row).find('td').length > 0).length;

      return {
        captionText: normalizeText(table.find('caption').first().text()),
        classNames: splitClassNames(table.attr('class')),
        columnHeaderTexts: headerTexts,
        dataRowCount,
        hasId: Boolean((table.attr('id') ?? '').trim()),
        hasName: Boolean((table.attr('name') ?? '').trim()),
        id: (table.attr('id') ?? '').trim(),
        name: (table.attr('name') ?? '').trim(),
        nestedInFieldsetLegend: normalizeText(enclosingLegend.text()),
        role: (table.attr('role') ?? '').trim(),
        summaryAttr: (table.attr('summary') ?? '').trim(),
        totalRowCount: rows.length
      };
    })
    .get();
}

function inventoryResultTable(
  $: CheerioRoot,
  fieldset: FieldsetInventory | undefined
): ResultTableInventory | undefined {
  const table = locateResultTable($);
  if (table === undefined) {
    return undefined;
  }

  const headerCells = table.find('tr').first().find('th');
  const columns: ColumnInventory[] = headerCells
    .map((_index, element) => {
      const th = $(element);
      return {
        headerText: normalizeText(th.text()),
        thAttributes: {
          classPresent: Boolean((th.attr('class') ?? '').trim()),
          idPresent: Boolean((th.attr('id') ?? '').trim()),
          namePresent: Boolean((th.attr('name') ?? '').trim()),
          otherAttributeNames: Object.keys(element.attribs ?? {}).filter(
            (name) => !['class', 'id', 'name'].includes(name)
          )
        }
      };
    })
    .get()
    .filter((column) => column.headerText.length > 0);

  const dataRows = table
    .find('tr')
    .toArray()
    .filter((row) => $(row).find('th').length === 0 && $(row).find('td').length > 0);

  const valueKindsByHeader: Record<string, string[]> = {};
  const emptyCellCounts: Record<string, number> = {};
  for (const column of columns) {
    valueKindsByHeader[column.headerText] = [];
    emptyCellCounts[column.headerText] = 0;
  }

  const rowCellCounts: number[] = [];
  for (const row of dataRows) {
    const cells = $(row).find('td');
    rowCellCounts.push(cells.length);
    columns.forEach((column, columnIndex) => {
      const cell = cells.eq(columnIndex);
      const text = normalizeText(cell.text());
      if (text.length === 0) {
        emptyCellCounts[column.headerText] += 1;
      }
      const kind = classifyValueKind(column.headerText, text);
      const kinds = valueKindsByHeader[column.headerText] ?? [];
      if (!kinds.includes(kind)) {
        kinds.push(kind);
        valueKindsByHeader[column.headerText] = kinds;
      }
    });
  }

  const selectorCandidates: SelectorCandidate[] = [
    {
      rationale: 'Fieldset identificado pelo legend textual Resultado, depois a tabela filha.',
      robustness: 'high',
      selector: 'fieldset:has(> legend):contains-equivalent(Resultado) > table'
    },
    {
      rationale:
        'Tabela cujo primeiro tr contém th com textos de cabeçalho confirmados (Hora, CPF, Nome...).',
      robustness: 'high',
      selector: 'table:has(th) matched-by-header-texts'
    }
  ];

  if (fieldset?.hasId) {
    selectorCandidates.unshift({
      rationale: 'Fieldset com id estável, se confirmado na evidência.',
      robustness: 'high',
      selector: `fieldset#${fieldset.id} table`
    });
  }

  const tableElement = table.get(0);
  const tableId = tableElement === undefined ? '' : (table.attr('id') ?? '').trim();
  if (tableId.length > 0) {
    selectorCandidates.unshift({
      rationale: 'Id direto na tabela de resultado.',
      robustness: 'high',
      selector: `table#${tableId}`
    });
  }

  return {
    columns,
    dataRowCount: dataRows.length,
    emptyCellCountsByHeader: emptyCellCounts,
    headerMatchStrategy: columns.length > 0 ? 'th-text' : 'absent',
    headerRowPresent: headerCells.length > 0,
    rowCellCounts,
    selectorCandidates,
    valueKindsByHeader
  };
}

function locateResultTable($: CheerioRoot): CheerioSelection | undefined {
  const byLegend = $('legend')
    .filter((_index, element) => normalizeText($(element).text()) === RESULT_LEGEND)
    .first()
    .parent('fieldset')
    .find('table')
    .filter((_index, element) => {
      const headers = $(element)
        .find('tr')
        .first()
        .find('th')
        .map((_i, th) => normalizeText($(th).text()))
        .get();
      return headers.includes('Hora') && headers.includes('CPF') && headers.includes('Nome');
    })
    .first();

  if (byLegend.length > 0) {
    return byLegend;
  }

  const byHeaders = $('table')
    .filter((_index, element) => {
      const headers = $(element)
        .find('tr')
        .first()
        .find('th')
        .map((_i, th) => normalizeText($(th).text()))
        .get();
      return headers.includes('Hora') && headers.includes('CPF') && headers.includes('Nome');
    })
    .first();

  return byHeaders.length > 0 ? byHeaders : undefined;
}

function classifyValueKind(headerText: string, value: string): string {
  if (value.length === 0) {
    return 'empty';
  }

  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(value)) {
    return 'time';
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    return 'date-slash';
  }

  if (/@/.test(value)) {
    return 'email-shaped';
  }

  const digits = value.replace(/\D/g, '');
  if (headerText === 'CPF' || digits.length === 11) {
    return 'cpf-shaped';
  }

  if (headerText === 'Telefone' || (digits.length >= 10 && digits.length <= 13)) {
    return 'phone-shaped';
  }

  if (value.length <= 40) {
    return 'short-text';
  }

  return 'long-text';
}

function splitClassNames(value: string | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return value
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'latin1').digest('hex');
}

function createQuietLogger() {
  const noop = (): void => undefined;
  return { debug: noop, error: noop, info: noop, warn: noop };
}

async function saveEvidence(evidence: Record<string, unknown>): Promise<string> {
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
  const startedAt =
    typeof evidence.startedAt === 'string' ? evidence.startedAt : new Date().toISOString();
  const timestamp = startedAt.replaceAll(':', '-').replaceAll('.', '-');
  const path = `${EVIDENCE_DIRECTORY}/004-descoberta-html-${timestamp}.json`;
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return path;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`Descoberta do HTML da agenda falhou: ${message}`);
  process.exitCode = 1;
});
