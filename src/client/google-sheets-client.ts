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
  /** Caminho absoluto ou relativo do JSON da Service Account. */
  credentialsPath: string;
  /** ID da planilha (não a URL). */
  spreadsheetId: string;
}

/**
 * Cliente fino sobre Sheets API v4 (somente operações de valores usadas na Fase 005).
 */
export class GoogleSheetsClient implements GoogleSheetsValuesPort {
  private readonly credentialsPath: string;
  private readonly spreadsheetId: string;
  private valuesApi: SheetsValuesApi | undefined;

  public constructor(options: GoogleSheetsClientOptions) {
    this.credentialsPath = options.credentialsPath;
    this.spreadsheetId = options.spreadsheetId;
  }

  public async getValues(range: string): Promise<string[][]> {
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
  }

  public async updateValues(range: string, values: string[][]): Promise<void> {
    const api = await this.getValuesApi();
    await api.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values }
    });
  }

  public async clearValues(range: string): Promise<void> {
    const api = await this.getValuesApi();
    await api.clear({
      spreadsheetId: this.spreadsheetId,
      range,
      requestBody: {}
    });
  }

  /**
   * Lê metadados básicos da planilha (descoberta/validação).
   * Não expõe conteúdo de células.
   */
  public async obterMetadados(): Promise<GoogleSheetsSpreadsheetMetadata> {
    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      keyFile: this.credentialsPath,
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
  }

  private async getValuesApi(): Promise<SheetsValuesApi> {
    if (this.valuesApi !== undefined) {
      return this.valuesApi;
    }

    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      keyFile: this.credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    this.valuesApi = sheets.spreadsheets.values;
    return this.valuesApi;
  }
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
