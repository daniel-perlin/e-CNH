import type { PessoaRepository, ResultadoUpsertPessoas } from './pessoa-repository.js';

/** Implementação no-op quando a persistência relacional está desligada ou falhou ao abrir. */
export class NoOpPessoaRepository implements PessoaRepository {
  public async upsertMuitos(): Promise<ResultadoUpsertPessoas> {
    return { sucesso: true, inseridas: 0, atualizadas: 0, ignoradas: 0 };
  }
}
