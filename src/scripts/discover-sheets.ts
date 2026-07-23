import 'dotenv/config';

import { mkdir, writeFile } from 'node:fs/promises';

import { GoogleSheetsClient } from '../client/google-sheets-client.js';
import { ConfigurationError } from '../client/errors.js';
import { resolveGoogleSheetsConfig } from '../config/google-sheets-config.js';
import { NOME_ABA_AGENDA_PADRAO } from '../repositories/agenda-sheet-headers.js';

const EVIDENCE_DIRECTORY = 'docs/evidencias';

/**
 * Descoberta controlada: autentica via Service Account e inventaria abas (sem células).
 */
async function main(): Promise<void> {
  const startedAt = new Date();
  const config = resolveGoogleSheetsConfig();
  const client = new GoogleSheetsClient({
    credentials: config.credentials,
    spreadsheetId: config.spreadsheetId
  });

  const metadata = await client.obterMetadados();
  const hasAgendaSheet = metadata.sheetTitles.includes(config.sheetName);
  const approved =
    metadata.spreadsheetIdPresent &&
    metadata.titleLength > 0 &&
    metadata.sheetTitles.length > 0;

  const evidencePath = await saveEvidence({
    approved,
    finishedAt: new Date().toISOString(),
    kind: 'descoberta-conexao-google-sheets',
    nodeVersion: process.version,
    phase: '005',
    schemaVersion: 1,
    startedAt: startedAt.toISOString(),
    steps: {
      connection: {
        hasConfiguredSheetName: hasAgendaSheet,
        sheetCount: metadata.sheetTitles.length,
        spreadsheetIdPresent: metadata.spreadsheetIdPresent,
        titleLength: metadata.titleLength
      },
      config: {
        credentialsPathConfigured: true,
        sheetName: config.sheetName || NOME_ABA_AGENDA_PADRAO,
        spreadsheetIdConfigured: true
      }
    },
    summary: {
      note: approved
        ? 'Conexão Service Account confirmada; metadados da planilha lidos sem registrar conteúdo de células.'
        : 'Conexão ou metadados insuficientes para descoberta.'
    }
  });

  console.log(
    JSON.stringify(
      {
        approved,
        evidencePath,
        hasAgendaSheet,
        sheetCount: metadata.sheetTitles.length
      },
      null,
      2
    )
  );

  if (!approved) {
    process.exitCode = 1;
  }
}

async function saveEvidence(evidence: Record<string, unknown>): Promise<string> {
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
  const startedAt =
    typeof evidence.startedAt === 'string' ? evidence.startedAt : new Date().toISOString();
  const timestamp = startedAt.replaceAll(':', '-').replaceAll('.', '-');
  const path = `${EVIDENCE_DIRECTORY}/005-descoberta-conexao-sheets-${timestamp}.json`;
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return path;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  if (error instanceof ConfigurationError) {
    console.error(`Descoberta Sheets bloqueada por configuração: ${message}`);
  } else {
    console.error(`Descoberta Sheets falhou: ${message}`);
  }
  process.exitCode = 1;
});
