/**
 * Porta de persistência de pessoas (histórico permanente).
 * Independente de Google Sheets; consumidores usam apenas esta interface.
 */
export interface PessoaParaPersistencia {
  /** CPF já normalizado (11 dígitos) ou bruto — a implementação normaliza. */
  cpf: string;
  nome?: string;
  email?: string;
  telefone?: string;
}

export interface ResultadoUpsertPessoas {
  atualizadas: number;
  ignoradas: number;
  inseridas: number;
  sucesso: boolean;
}

export interface PessoaRepository {
  /**
   * Insere ou atualiza pessoas por CPF.
   * Nunca remove registros. `ultima_sincronizacao` sempre atualiza no match.
   */
  upsertMuitos(pessoas: PessoaParaPersistencia[]): Promise<ResultadoUpsertPessoas>;
}
