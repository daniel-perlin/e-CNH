import { ConfigurationError } from '../client/errors.js';
import { NOME_ABA_AGENDA_PADRAO } from '../repositories/agenda-sheet-headers.js';

export interface GoogleSheetsConfig {
  credentialsPath: string;
  sheetName: string;
  spreadsheetId: string;
}

/**
 * Lê a configuração de Google Sheets na fronteira de ambiente.
 * Não carrega o conteúdo do JSON da Service Account.
 */
export function resolveGoogleSheetsConfig(
  env: NodeJS.ProcessEnv = process.env
): GoogleSheetsConfig {
  const spreadsheetId = env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (spreadsheetId === undefined || spreadsheetId.length === 0) {
    throw new ConfigurationError(
      'Defina GOOGLE_SHEETS_SPREADSHEET_ID no arquivo .env antes de usar a persistência Sheets.'
    );
  }

  const credentialsPath =
    env.GOOGLE_SHEETS_CREDENTIALS_PATH?.trim() ||
    env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (credentialsPath === undefined || credentialsPath.length === 0) {
    throw new ConfigurationError(
      'Defina GOOGLE_SHEETS_CREDENTIALS_PATH ou GOOGLE_APPLICATION_CREDENTIALS apontando para o JSON da Service Account.'
    );
  }

  const sheetName = env.GOOGLE_SHEETS_SHEET_NAME?.trim() || NOME_ABA_AGENDA_PADRAO;

  return {
    credentialsPath,
    sheetName,
    spreadsheetId
  };
}
