/**
 * Schema Drizzle — tabela `pessoas` (PostgreSQL).
 * Mesmo contrato lógico de `pessoas.sqlite.ts`.
 */
import { boolean, bigserial, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { ORIGEM_PROJETO_ECNH } from './pessoas.sqlite.js';

export const pessoasPostgres = pgTable('pessoas', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  cpf: text('cpf').notNull().unique(),
  nome: text('nome'),
  email: text('email'),
  telefone: text('telefone'),
  origem: text('origem').notNull().default(ORIGEM_PROJETO_ECNH),
  ativo: boolean('ativo').notNull().default(true),
  primeiraSincronizacao: timestamp('primeira_sincronizacao', {
    withTimezone: true,
    mode: 'date'
  }).notNull(),
  ultimaSincronizacao: timestamp('ultima_sincronizacao', {
    withTimezone: true,
    mode: 'date'
  }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull()
});

export type PessoaPostgresRow = typeof pessoasPostgres.$inferSelect;
