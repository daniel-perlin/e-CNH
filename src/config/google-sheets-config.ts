import { ConfigurationError } from '../client/errors.js';
import { NOME_ABA_AGENDA_PADRAO } from '../repositories/agenda-sheet-headers.js';

/**
 * Credenciais da Service Account para Google Sheets.
 * Path (local) ou JSON inline (ex.: variável secreta no Railway).
 */
export type GoogleSheetsCredentialsSource =
  | { kind: 'path'; path: string }
  | { kind: 'json'; credentials: Record<string, unknown> };

export interface GoogleSheetsConfig {
  credentials: GoogleSheetsCredentialsSource;
  sheetName: string;
  spreadsheetId: string;
}

/**
 * Lê a configuração de Google Sheets na fronteira de ambiente.
 * Precedência: `GOOGLE_SERVICE_ACCOUNT_JSON` → path (`GOOGLE_SHEETS_CREDENTIALS_PATH`
 * ou `GOOGLE_APPLICATION_CREDENTIALS`).
 */
export function resolveGoogleSheetsConfig(
  env: NodeJS.ProcessEnv = process.env
): GoogleSheetsConfig {
  const spreadsheetId = env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (spreadsheetId === undefined || spreadsheetId.length === 0) {
    throw new ConfigurationError(
      'Defina GOOGLE_SHEETS_SPREADSHEET_ID no ambiente (Railway Variables ou .env) antes de usar a persistência Sheets.'
    );
  }

  const credentials = resolveCredentialsSource(env);
  const sheetName = env.GOOGLE_SHEETS_SHEET_NAME?.trim() || NOME_ABA_AGENDA_PADRAO;

  return {
    credentials,
    sheetName,
    spreadsheetId
  };
}

function resolveCredentialsSource(
  env: NodeJS.ProcessEnv
): GoogleSheetsCredentialsSource {
  const inlineJson = env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (inlineJson !== undefined && inlineJson.length > 0) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(inlineJson);
    } catch {
      throw new ConfigurationError(
        'GOOGLE_SERVICE_ACCOUNT_JSON não é um JSON válido da Service Account.'
      );
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ConfigurationError(
        'GOOGLE_SERVICE_ACCOUNT_JSON deve ser um objeto JSON da Service Account.'
      );
    }
    return { kind: 'json', credentials: parsed as Record<string, unknown> };
  }

  const credentialsPath =
    env.GOOGLE_SHEETS_CREDENTIALS_PATH?.trim() ||
    env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (credentialsPath === undefined || credentialsPath.length === 0) {
    throw new ConfigurationError(
      'Defina GOOGLE_SERVICE_ACCOUNT_JSON, ou GOOGLE_SHEETS_CREDENTIALS_PATH / GOOGLE_APPLICATION_CREDENTIALS apontando para o JSON da Service Account.'
    );
  }

  return { kind: 'path', path: credentialsPath };
}
