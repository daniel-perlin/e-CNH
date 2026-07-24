/**
 * Schema Drizzle — tabela `pessoas` (SQLite).
 * Espelho Postgres em `pessoas.pg.ts` para o mesmo contrato lógico.
 */
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Origem padrão das pessoas capturadas pelo sync do produto. */
export const ORIGEM_PROJETO_ECNH = 'Projeto e-CNH';

export const pessoasSqlite = sqliteTable('pessoas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cpf: text('cpf').notNull().unique(),
  nome: text('nome'),
  email: text('email'),
  telefone: text('telefone'),
  origem: text('origem').notNull().default(ORIGEM_PROJETO_ECNH),
  /** Preparado para soft-delete futuro; sync atual não altera após insert. */
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
  primeiraSincronizacao: text('primeira_sincronizacao').notNull(),
  ultimaSincronizacao: text('ultima_sincronizacao').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export type PessoaSqliteRow = typeof pessoasSqlite.$inferSelect;
