import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { DatabaseConfig, DatabaseDialect } from '../config/database-config.js';
import type { StructuredLogger } from '../types/logger.js';

import { ensurePessoasSchemaPostgres, ensurePessoasSchemaSqlite } from './ensure-schema.js';
import * as schemaPg from './schema/pessoas.pg.js';
import * as schemaSqlite from './schema/pessoas.sqlite.js';

export type SqliteDb = BetterSQLite3Database<typeof schemaSqlite>;
export type PostgresDb = PostgresJsDatabase<typeof schemaPg>;
type SqliteRaw = InstanceType<typeof Database>;

/**
 * Handle da camada de persistência da aplicação.
 * Novos repositórios (profissional, agendamento, sync_run) compartilham este client.
 */
export interface AppDatabase {
  dialect: DatabaseDialect;
  sqlite?: { db: SqliteDb; raw: SqliteRaw };
  postgres?: { db: PostgresDb; sql: ReturnType<typeof postgres> };
  close(): Promise<void>;
}

/**
 * Abre a conexão conforme a config e garante o schema mínimo.
 * Em falha, lança — o wiring deve capturar e cair para NoOp.
 */
export async function openAppDatabase(
  config: DatabaseConfig,
  logger?: StructuredLogger
): Promise<AppDatabase> {
  if (!config.enabled) {
    throw new Error('Persistência relacional desabilitada');
  }

  if (config.dialect === 'postgres') {
    const url = config.databaseUrl;
    if (url === undefined || url.length === 0) {
      throw new Error('DATABASE_URL ausente para dialeto postgres');
    }
    const sql = postgres(url, { max: 1, idle_timeout: 5, connect_timeout: 10 });
    const db = drizzlePostgres(sql, { schema: schemaPg });
    await ensurePessoasSchemaPostgres(sql as never);
    logger?.warn(
      { event: 'database.opened', dialect: 'postgres' },
      'Camada de persistência aberta (PostgreSQL)'
    );
    return {
      dialect: 'postgres',
      postgres: { db, sql },
      async close() {
        await sql.end({ timeout: 5 });
      }
    };
  }

  const sqlitePath = config.sqlitePath ?? '.data/ecnh.sqlite';
  fs.mkdirSync(path.dirname(path.resolve(sqlitePath)), { recursive: true });
  const raw = new Database(sqlitePath);
  raw.pragma('journal_mode = WAL');
  ensurePessoasSchemaSqlite(raw);
  const db = drizzleSqlite(raw, { schema: schemaSqlite });
  logger?.warn(
    { event: 'database.opened', dialect: 'sqlite', sqlitePath },
    'Camada de persistência aberta (SQLite)'
  );
  return {
    dialect: 'sqlite',
    sqlite: { db, raw },
    async close() {
      raw.close();
    }
  };
}
