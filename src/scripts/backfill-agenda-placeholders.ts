import 'dotenv/config';

import { GoogleSheetsClient } from '../client/google-sheets-client.js';
import { ConfigurationError } from '../client/errors.js';
import { resolveGoogleSheetsConfig } from '../config/google-sheets-config.js';
import { GoogleSheetsAgendaRepository } from '../repositories/google-sheets-agenda-repository.js';

/**
 * Reescreve a aba Agenda com a projeção visual atual do mapper
 * (placeholders `(não informado)`, normalizações de telefone/e-mail).
 *
 * Não acessa o portal, não altera merge/noop/SQLite e não remove pacientes.
 */
async function main(): Promise<void> {
  const config = resolveGoogleSheetsConfig();
  const client = new GoogleSheetsClient({
    credentials: config.credentials,
    spreadsheetId: config.spreadsheetId,
    retry: { maxAttempts: config.maxAttempts }
  });
  const repository = new GoogleSheetsAgendaRepository({
    sheets: client,
    sheetName: config.sheetName
  });

  const resultado = await repository.reescreverProjecaoVisual();

  console.log(
    JSON.stringify(
      {
        sucesso: resultado.sucesso,
        linhasLidas: resultado.linhasLidas,
        linhasReescritas: resultado.linhasReescritas,
        motivoFalha: resultado.motivoFalha ?? null
      },
      null,
      2
    )
  );

  if (!resultado.sucesso) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  if (error instanceof ConfigurationError) {
    console.error(`Backfill de placeholders bloqueado por configuração: ${message}`);
  } else {
    console.error(`Backfill de placeholders falhou: ${message}`);
  }
  process.exitCode = 1;
});
