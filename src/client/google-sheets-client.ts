import type { GoogleSheetsCredentialsSource } from '../config/google-sheets-config.js';
import type { StructuredLogger } from '../types/logger.js';

import {
  DEFAULT_SHEETS_RETRY_POLICY,
  calcularEsperaRetryMs,
  isTransientSheetsError,
  motivoRetrySheets,
  serializarErroSheets,
  type SheetsRetryPolicy
} from './google-sheets-retry.js';

/**
 * Porta mínima de valores de planilha.
 * Isola `googleapis` do repositório para testes sem rede.
 */
export interface GoogleSheetsValuesPort {
  clearValues(range: string): Promise<void>;
  getValues(range: string): Promise<string[][]>;
  updateValues(range: string, values: string[][]): Promise<void>;
}

export interface GoogleSheetsClientOptions {
  /**
   * Credenciais da Service Account.
   * Aceita path (local) ou JSON inline (Railway / secrets).
   * Compatível: `credentialsPath` sozinho equivale a `{ kind: 'path', path }`.
   */
  credentials: GoogleSheetsCredentialsSource;
  /** Logger estruturado para retries (opcional). */
  logger?: StructuredLogger;
  /** Política de retry (defaults de produção). */
  retry?: Partial<SheetsRetryPolicy>;
  /** ID da planilha (não a URL). */
  spreadsheetId: string;
  /** Injetável em testes (substitui `setTimeout`). */
  sleep?: (ms: number) => Promise<void>;
}

/** @deprecated Preferir `credentials: { kind: 'path', path }`. */
export interface GoogleSheetsClientLegacyOptions {
  credentialsPath: string;
  spreadsheetId: string;
}

/**
 * Cliente fino sobre Sheets API v4 (somente operações de valores usadas na Fase 005).
 * Retry com backoff exponencial fica centralizado aqui — repositórios não duplicam a lógica.
 */
export class GoogleSheetsClient implements GoogleSheetsValuesPort {
  private readonly credentials: GoogleSheetsCredentialsSource;
  private readonly logger: StructuredLogger | undefined;
  private readonly retryPolicy: SheetsRetryPolicy;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly spreadsheetId: string;
  private valuesApi: SheetsValuesApi | undefined;

  public constructor(options: GoogleSheetsClientOptions | GoogleSheetsClientLegacyOptions) {
    this.credentials = normalizeCredentials(options);
    this.spreadsheetId = options.spreadsheetId;
    this.logger = 'logger' in options ? options.logger : undefined;
    this.sleep =
      'sleep' in options && options.sleep !== undefined
        ? options.sleep
        : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const retryOverrides = 'retry' in options ? options.retry : undefined;
    this.retryPolicy = {
      ...DEFAULT_SHEETS_RETRY_POLICY,
      ...retryOverrides
    };
  }

  public async getValues(range: string): Promise<string[][]> {
    return this.withRetry('getValues', async () => {
      const api = await this.getValuesApi();
      const response = await api.get({
        spreadsheetId: this.spreadsheetId,
        range
      });
      const values = response.data.values;
      if (values === undefined || values === null) {
        return [];
      }
      return values.map((row) => row.map((cell) => (cell == null ? '' : String(cell))));
    });
  }

  public async updateValues(range: string, values: string[][]): Promise<void> {
    await this.withRetry('updateValues', async () => {
      const api = await this.getValuesApi();
      await api.update({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: { values }
      });
    });
  }

  public async clearValues(range: string): Promise<void> {
    await this.withRetry('clearValues', async () => {
      const api = await this.getValuesApi();
      await api.clear({
        spreadsheetId: this.spreadsheetId,
        range,
        requestBody: {}
      });
    });
  }

  /**
   * Lê metadados básicos da planilha (descoberta/validação).
   * Não expõe conteúdo de células.
   */
  public async obterMetadados(): Promise<GoogleSheetsSpreadsheetMetadata> {
    return this.withRetry('obterMetadados', async () => {
      const { google } = await import('googleapis');
      const auth = new google.auth.GoogleAuth({
        ...this.authOptions(),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      const sheets = google.sheets({ version: 'v4', auth });
      const response = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'spreadsheetId,properties.title,sheets.properties.title,sheets.properties.sheetId'
      });

      const title = response.data.properties?.title ?? '';
      const sheetTitles =
        response.data.sheets
          ?.map((sheet) => sheet.properties?.title)
          .filter((value): value is string => typeof value === 'string' && value.length > 0) ??
        [];

      return {
        sheetTitles,
        spreadsheetIdPresent: typeof response.data.spreadsheetId === 'string',
        titleLength: title.length
      };
    });
  }

  private async withRetry<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const maxAttempts = this.retryPolicy.maxAttempts;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const startedAt = Date.now();
      try {
        const result = await fn();
        const durationMs = Date.now() - startedAt;
        if (attempt > 1) {
          this.logger?.warn(
            {
              event: 'agenda.sheets.retry.completed',
              operation,
              attempt,
              maxAttempts,
              durationMs,
              retriesUsed: attempt - 1
            },
            'Operação Google Sheets concluída após retry'
          );
        }
        return result;
      } catch (error) {
        lastError = error;
        const durationMs = Date.now() - startedAt;
        const transient = isTransientSheetsError(error);
        const hasMoreAttempts = attempt < maxAttempts;

        if (!transient || !hasMoreAttempts) {
          this.logger?.error(
            {
              event: 'agenda.sheets.retry.failed',
              operation,
              attempt,
              maxAttempts,
              durationMs,
              retryable: transient,
              reason: motivoRetrySheets(error),
              error: serializarErroSheets(error)
            },
            transient
              ? 'Retry Google Sheets esgotado'
              : 'Erro permanente Google Sheets (sem retry)'
          );
          throw error;
        }

        const waitMs = calcularEsperaRetryMs(attempt, error, this.retryPolicy);
        this.logger?.warn(
          {
            event: 'agenda.sheets.retry.started',
            operation,
            attempt,
            maxAttempts,
            durationMs,
            reason: motivoRetrySheets(error),
            error: serializarErroSheets(error)
          },
          'Falha transitória Google Sheets; iniciando retry'
        );
        this.logger?.warn(
          {
            event: 'agenda.sheets.retry.waiting',
            operation,
            attempt,
            maxAttempts,
            waitMs,
            nextAttempt: attempt + 1,
            reason: motivoRetrySheets(error)
          },
          'Aguardando backoff antes do próximo retry Google Sheets'
        );
        await this.sleep(waitMs);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async getValuesApi(): Promise<SheetsValuesApi> {
    if (this.valuesApi !== undefined) {
      return this.valuesApi;
    }

    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      ...this.authOptions(),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    this.valuesApi = sheets.spreadsheets.values;
    return this.valuesApi;
  }

  private authOptions(): { keyFile: string } | { credentials: Record<string, unknown> } {
    if (this.credentials.kind === 'path') {
      return { keyFile: this.credentials.path };
    }
    return { credentials: this.credentials.credentials };
  }
}

function normalizeCredentials(
  options: GoogleSheetsClientOptions | GoogleSheetsClientLegacyOptions
): GoogleSheetsCredentialsSource {
  if ('credentials' in options) {
    return options.credentials;
  }
  return { kind: 'path', path: options.credentialsPath };
}

export interface GoogleSheetsSpreadsheetMetadata {
  sheetTitles: string[];
  spreadsheetIdPresent: boolean;
  titleLength: number;
}

interface SheetsValuesApi {
  clear: (params: {
    range: string;
    requestBody: Record<string, never>;
    spreadsheetId: string;
  }) => Promise<unknown>;
  get: (params: {
    range: string;
    spreadsheetId: string;
  }) => Promise<{ data: { values?: unknown[][] | null } }>;
  update: (params: {
    range: string;
    requestBody: { values: string[][] };
    spreadsheetId: string;
    valueInputOption: 'RAW';
  }) => Promise<unknown>;
}
