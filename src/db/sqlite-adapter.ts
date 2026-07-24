import fs from 'node:fs';
import path from 'node:path';

import type { StructuredLogger } from '../types/logger.js';

import type { AppDatabase } from './client.js';
import { ensurePessoasSchemaSqlite } from './ensure-schema.js';
import * as schemaSqlite from './schema/pessoas.sqlite.js';

/**
 * Adapter SQLite — carregado apenas via import dinâmico.
 * Assim o bundle/runtime Postgres (Railway) não exige `better-sqlite3` nativo.
 */
export async function openSqliteAppDatabase(
  sqlitePath: string,
  logger?: StructuredLogger
): Promise<AppDatabase> {
  try {
    const sqliteModule = await import('better-sqlite3');
    const Database = sqliteModule.default;
    const { drizzle } = await import('drizzle-orm/better-sqlite3');

    fs.mkdirSync(path.dirname(path.resolve(sqlitePath)), { recursive: true });
    const raw = new Database(sqlitePath);
    raw.pragma('journal_mode = WAL');
    ensurePessoasSchemaSqlite(raw);
    const db = drizzle(raw, { schema: schemaSqlite });

    logger?.warn(
      { event: 'database.opened', dialect: 'sqlite', sqlitePath },
      'Camada de persistência aberta (SQLite)'
    );

    return {
      dialect: 'sqlite',
      sqlite: {
        db: db as unknown as import('./client.js').SqliteDb,
        raw
      },
      async close() {
        raw.close();
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Driver SQLite (better-sqlite3) indisponível. Use DATABASE_URL (Postgres) no Railway ou instale better-sqlite3 localmente. Detalhe: ${message}`
    );
  }
}
