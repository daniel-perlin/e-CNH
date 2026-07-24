/**
 * Configuração da camada de persistência relacional da aplicação.
 * Independente do Google Sheets (destino operacional paralelo).
 */
export type DatabaseDialect = 'sqlite' | 'postgres';

export interface DatabaseConfig {
  /** Quando false, o sync não abre conexão e usa NoOp nos repositórios. */
  enabled: boolean;
  dialect: DatabaseDialect;
  /** Caminho do arquivo SQLite (local). */
  sqlitePath?: string;
  /** Connection string Postgres (Railway). */
  databaseUrl?: string;
}

const SQLITE_PATH_PADRAO = '.data/ecnh.sqlite';

/**
 * Resolve a config a partir do ambiente.
 *
 * Precedência:
 * 1. `DATABASE_PERSISTENCE_ENABLED=false` → desligado
 * 2. `DATABASE_URL` postgres → Postgres
 * 3. SQLite em `DATABASE_SQLITE_PATH` ou padrão `.data/ecnh.sqlite`
 */
export function resolveDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env
): DatabaseConfig {
  const flag = env.DATABASE_PERSISTENCE_ENABLED?.trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'off' || flag === 'no') {
    return { enabled: false, dialect: 'sqlite' };
  }

  const databaseUrl = env.DATABASE_URL?.trim();
  if (
    databaseUrl !== undefined &&
    databaseUrl.length > 0 &&
    (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))
  ) {
    return { enabled: true, dialect: 'postgres', databaseUrl };
  }

  const sqlitePath = env.DATABASE_SQLITE_PATH?.trim() || SQLITE_PATH_PADRAO;
  return { enabled: true, dialect: 'sqlite', sqlitePath };
}
