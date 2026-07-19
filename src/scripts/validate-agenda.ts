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

const AUTHENTICATED_PAGE_MARKER = 'Imprimir Agenda Diária do Psicólogo';
const EVIDENCE_DIRECTORY = 'docs/evidencias';
const EXPECTED_RESULT_HEADERS = [
  'Hora',
  'CPF',
  'Nome',
  'Telefone',
  'E-mail',
  'Tipo de Processo',
  'Categoria',
  'Status do Exame Médico',
  'Status do Exame Psicológico'
] as const;

interface AgendaValidationEvidence {
  approved: boolean;
  credentialsSource: string;
  finishedAt: string;
  kind: 'validacao-navegacao-agenda';
  loginStatus: string;
  nodeVersion: string;
  phase: '003B';
  schemaVersion: 1;
  startedAt: string;
  steps: {
    consultation?: {
      bodyBytes: number;
      bodySha256: string;
      data: string;
      dataReferencia: string;
      structuralSignals: StructuralSignals;
    };
    datesAvailable: string[];
    logoutCompleted: boolean;
  };
  summary: {
    note: string;
  };
}

interface StructuralSignals {
  authenticatedMarkerPresent: boolean;
  expectedHeadersPresent: boolean;
  legendResultadoPresent: boolean;
  loginFormPresent: boolean;
  methodValues: string[];
  missingHeaders: string[];
  tableCount: number;
  thTexts: string[];
}

async function main(): Promise<void> {
  const baseUrl = process.env.ECNH_BASE_URL;
  if (baseUrl === undefined || baseUrl.trim().length === 0) {
    throw new ConfigurationError(
      'Defina ECNH_BASE_URL no arquivo .env antes de executar a validação.'
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
    const evidencePath = await saveEvidence({
      approved: false,
      credentialsSource: credentials.source,
      finishedAt: new Date().toISOString(),
      kind: 'validacao-navegacao-agenda',
      loginStatus: loginResult.status,
      nodeVersion: process.version,
      phase: '003B',
      schemaVersion: 1,
      startedAt: startedAt.toISOString(),
      steps: {
        datesAvailable: [],
        logoutCompleted: false
      },
      summary: {
        note: 'Login não confirmado; a consulta de agenda não foi executada.'
      }
    });
    console.log(JSON.stringify({ approved: false, evidencePath, loginStatus: loginResult.status }, null, 2));
    process.exitCode = 1;
    return;
  }

  const datesAvailable = client.listarDatasAgendamento();
  let approved = false;
  let consultation: AgendaValidationEvidence['steps']['consultation'];
  let logoutCompleted = false;

  try {
    if (datesAvailable.length === 0) {
      throw new ConfigurationError(
        'Nenhuma data de agendamento disponível no HTML pós-login para validar a consulta.'
      );
    }

    const data = datesAvailable[0];
    const dataReferencia = data;
    const agendaHtml = await client.obterHtmlAgenda({ data, dataReferencia });
    const structuralSignals = inspectAgendaHtml(agendaHtml);
    const body = Buffer.from(agendaHtml, 'latin1');

    consultation = {
      bodyBytes: body.length,
      bodySha256: createHash('sha256').update(body).digest('hex'),
      data,
      dataReferencia,
      structuralSignals
    };

    approved =
      structuralSignals.authenticatedMarkerPresent &&
      !structuralSignals.loginFormPresent &&
      structuralSignals.legendResultadoPresent &&
      structuralSignals.expectedHeadersPresent &&
      structuralSignals.methodValues.includes('agendaMedico');
  } finally {
    await client.logout();
    logoutCompleted = true;
  }

  const evidencePath = await saveEvidence({
    approved,
    credentialsSource: credentials.source,
    finishedAt: new Date().toISOString(),
    kind: 'validacao-navegacao-agenda',
    loginStatus: 'sucesso',
    nodeVersion: process.version,
    phase: '003B',
    schemaVersion: 1,
    startedAt: startedAt.toISOString(),
    steps: {
      consultation,
      datesAvailable: datesAvailable.map(() => '[DATE]'),
      logoutCompleted
    },
    summary: {
      note: approved
        ? 'Navegação autenticada reproduzida: HTML de resultado da agenda obtido com sinais estruturais confirmados.'
        : 'Consulta executada, mas os sinais estruturais do HTML de resultado não foram confirmados.'
    }
  });

  console.log(
    JSON.stringify(
      {
        approved,
        dateCount: datesAvailable.length,
        evidencePath,
        legendResultadoPresent: consultation?.structuralSignals.legendResultadoPresent,
        methodValues: consultation?.structuralSignals.methodValues
      },
      null,
      2
    )
  );

  if (!approved) {
    process.exitCode = 1;
  }
}

function inspectAgendaHtml(html: string): StructuralSignals {
  const $ = cheerio.load(html);
  const thTexts = $('th')
    .map((_index, element) => normalizeText($(element).text()))
    .get()
    .filter((text) => text.length > 0)
    .filter((text, index, array) => array.indexOf(text) === index);

  const missingHeaders = EXPECTED_RESULT_HEADERS.filter(
    (header) => !thTexts.includes(header)
  );

  const methodValues = $('input[name="method"]')
    .map((_index, element) => ($(element).attr('value') ?? '').trim())
    .get()
    .filter((value) => value.length > 0);

  const legends = $('legend')
    .map((_index, element) => normalizeText($(element).text()))
    .get();

  return {
    authenticatedMarkerPresent: html.includes(AUTHENTICATED_PAGE_MARKER),
    expectedHeadersPresent: missingHeaders.length === 0,
    legendResultadoPresent: legends.includes('Resultado'),
    loginFormPresent: html.includes('LoginActionForm'),
    methodValues: [...new Set(methodValues)],
    missingHeaders: [...missingHeaders],
    tableCount: $('table').length,
    thTexts: thTexts.slice(0, 20)
  };
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function createQuietLogger() {
  const noop = (): void => undefined;
  return { debug: noop, error: noop, info: noop, warn: noop };
}

async function saveEvidence(evidence: AgendaValidationEvidence): Promise<string> {
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
  const timestamp = evidence.startedAt.replaceAll(':', '-').replaceAll('.', '-');
  const path = `${EVIDENCE_DIRECTORY}/003b-validacao-navegacao-${timestamp}.json`;
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return path;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`Validação da navegação autenticada falhou: ${message}`);
  process.exitCode = 1;
});
