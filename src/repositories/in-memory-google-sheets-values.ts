import type { GoogleSheetsValuesPort } from '../client/google-sheets-client.js';

/**
 * Planilha em memória para testes do repositório sem rede.
 * `clearValues` respeita intervalos de linhas (`A2:I5`) ou limpa tudo (`A:Z`).
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
    const linhas = extrairIntervaloLinhas(range);
    if (linhas === undefined) {
      this.values = [];
      return;
    }

    for (let linha = linhas.inicio; linha <= linhas.fim; linha += 1) {
      const indice = linha - 1;
      if (indice >= 0 && indice < this.values.length) {
        this.values[indice] = [];
      }
    }

    while (
      this.values.length > 0 &&
      (this.values[this.values.length - 1]?.every((celula) => celula.trim() === '') ?? true)
    ) {
      this.values.pop();
    }
  }

  public snapshot(): string[][] {
    return this.values.map((row) => [...row]);
  }
}

/** Extrai linhas 1-based de ranges A1 (`A2:I10`) ou retorna undefined para limpeza total (`A:Z`). */
function extrairIntervaloLinhas(range: string): { inicio: number; fim: number } | undefined {
  const semPlanilha = range.includes('!') ? (range.split('!').pop() ?? range) : range;
  const match = /^[A-Za-z]+(\d+):[A-Za-z]+(\d+)$/.exec(semPlanilha.trim());
  if (match === null) {
    return undefined;
  }
  const inicio = Number(match[1]);
  const fim = Number(match[2]);
  if (!Number.isInteger(inicio) || !Number.isInteger(fim) || inicio < 1 || fim < inicio) {
    return undefined;
  }
  return { inicio, fim };
}
