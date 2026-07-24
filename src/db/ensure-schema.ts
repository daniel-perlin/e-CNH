/**
 * Garante a tabela `pessoas` no SQLite (idempotente).
 * Futuras tabelas da aplicação entram em funções irmãs neste módulo.
 */
export function ensurePessoasSchemaSqlite(raw: { exec: (sql: string) => unknown }): void {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS pessoas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cpf TEXT NOT NULL UNIQUE,
      nome TEXT,
      email TEXT,
      telefone TEXT,
      origem TEXT NOT NULL DEFAULT 'Projeto e-CNH',
      ativo INTEGER NOT NULL DEFAULT 1,
      primeira_sincronizacao TEXT NOT NULL,
      ultima_sincronizacao TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS pessoas_cpf_uidx ON pessoas (cpf);
  `);
}

/** Garante a tabela `pessoas` no PostgreSQL (idempotente). */
export async function ensurePessoasSchemaPostgres(
  // Tag template do pacote `postgres` (tipagem excessivamente estreita para DDL).
  sql: (strings: TemplateStringsArray, ...values: never[]) => PromiseLike<unknown>
): Promise<void> {
  await (sql as (strings: TemplateStringsArray, ...values: unknown[]) => PromiseLike<unknown>)`
    CREATE TABLE IF NOT EXISTS pessoas (
      id BIGSERIAL PRIMARY KEY,
      cpf TEXT NOT NULL UNIQUE,
      nome TEXT,
      email TEXT,
      telefone TEXT,
      origem TEXT NOT NULL DEFAULT 'Projeto e-CNH',
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      primeira_sincronizacao TIMESTAMPTZ NOT NULL,
      ultima_sincronizacao TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `;
  await (sql as (strings: TemplateStringsArray, ...values: unknown[]) => PromiseLike<unknown>)`
    CREATE UNIQUE INDEX IF NOT EXISTS pessoas_cpf_uidx ON pessoas (cpf)
  `;
}
