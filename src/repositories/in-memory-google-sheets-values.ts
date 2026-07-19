import type { GoogleSheetsValuesPort } from '../client/google-sheets-client.js';

/**
 * Planilha em memória para testes do repositório sem rede.
 */
export class InMemoryGoogleSheetsValues implements GoogleSheetsValuesPort {
  private values: string[][] = [];

  public async getValues(range: string): Promise<string[][]> {
    void range;
    return this.values.map((row) => [...row]);
  }

  public async updateValues(range: string, values: string[][]): Promise<void> {
    void range;
    this.values = values.map((row) => [...row]);
  }

  public async clearValues(range: string): Promise<void> {
    void range;
    this.values = [];
  }

  public snapshot(): string[][] {
    return this.values.map((row) => [...row]);
  }
}
