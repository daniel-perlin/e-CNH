import { ECNHClient } from '../client/ecnh-client.js';
import { ConfigurationError } from '../client/errors.js';
import { GoogleSheetsClient } from '../client/google-sheets-client.js';
import { resolveAgendaSyncLockPath } from '../config/agenda-sync-job-config.js';
import { resolveDatabaseConfig } from '../config/database-config.js';
import { resolveGoogleSheetsConfig } from '../config/google-sheets-config.js';
import { resolveEntradasSincronizacao } from '../config/sync-professionals.js';
import { openAppDatabase, type AppDatabase } from '../db/client.js';
import { FileSyncLock } from '../jobs/file-sync-lock.js';
import type { SyncLock } from '../jobs/sync-lock.js';
import { parseAgendaHtml } from '../parsers/agenda-parser.js';
import { DrizzlePessoaRepository } from '../repositories/drizzle-pessoa-repository.js';
import { GoogleSheetsAgendaRepository } from '../repositories/google-sheets-agenda-repository.js';
import { NoOpPessoaRepository } from '../repositories/noop-pessoa-repository.js';
import type { PessoaRepository } from '../repositories/pessoa-repository.js';
import {
  AgendaSyncService,
  type EntradaSincronizacaoProfissional
} from '../services/agenda-sync-service.js';
import type { StructuredLogger } from '../types/logger.js';

export interface AgendaSyncRuntime {
  entradas: EntradaSincronizacaoProfissional[];
  lock: SyncLock;
  service: AgendaSyncService;
  /** Fecha a conexão do banco (no-op se não abriu). */
  close(): Promise<void>;
}

export interface CriarAgendaSyncRuntimeOptions {
  env?: NodeJS.ProcessEnv;
  logger?: StructuredLogger;
  /** Override do lock (testes). */
  lock?: SyncLock;
}

/**
 * Wiring compartilhado entre `sync:agenda` e `job:agenda`.
 * Não contém regra de sincronização.
 *
 * Destinos independentes dos objetos de domínio:
 * - `AgendaRepository` → Google Sheets (operacional)
 * - `PessoaRepository` → banco (histórico; best-effort)
 */
export async function criarAgendaSyncRuntime(
  options: CriarAgendaSyncRuntimeOptions = {}
): Promise<AgendaSyncRuntime> {
  const env = options.env ?? process.env;
  const baseUrl = env.ECNH_BASE_URL?.trim();
  if (baseUrl === undefined || baseUrl.length === 0) {
    throw new ConfigurationError(
      'Defina ECNH_BASE_URL no ambiente (Railway Variables ou .env) antes de executar a sincronização.'
    );
  }

  const entradas = resolveEntradasSincronizacao(env);
  const sheetsConfig = resolveGoogleSheetsConfig(env);
  const sheets = new GoogleSheetsClient({
    credentials: sheetsConfig.credentials,
    spreadsheetId: sheetsConfig.spreadsheetId,
    logger: options.logger,
    retry: { maxAttempts: sheetsConfig.maxAttempts }
  });
  const agendaRepository = new GoogleSheetsAgendaRepository({
    sheets,
    sheetName: sheetsConfig.sheetName,
    logger: options.logger
  });

  const { pessoaRepository, appDatabase } = await criarPessoaRepository(env, options.logger);

  const logger = options.logger;
  const service = new AgendaSyncService({
    agendaRepository,
    pessoaRepository,
    client: (entrada) =>
      new ECNHClient({
        baseUrl,
        logger,
        perfilEsperado: entrada.perfilEsperado,
        unidadeDesejada: entrada.unidadeDesejada
      }),
    logger,
    parseAgendaHtml
  });

  const lock =
    options.lock ??
    new FileSyncLock({
      lockPath: resolveAgendaSyncLockPath(env)
    });

  return {
    entradas,
    lock,
    service,
    async close() {
      if (appDatabase !== undefined) {
        await appDatabase.close();
      }
    }
  };
}

async function criarPessoaRepository(
  env: NodeJS.ProcessEnv,
  logger?: StructuredLogger
): Promise<{ pessoaRepository: PessoaRepository; appDatabase?: AppDatabase }> {
  const dbConfig = resolveDatabaseConfig(env);
  if (!dbConfig.enabled) {
    logger?.warn(
      { event: 'database.disabled' },
      'Persistência relacional desabilitada; apenas Google Sheets'
    );
    return { pessoaRepository: new NoOpPessoaRepository() };
  }

  try {
    const appDatabase = await openAppDatabase(dbConfig, logger);
    if (dbConfig.dialect === 'sqlite') {
      logger?.warn(
        {
          event: 'database.sqlite.ephemeral_warning',
          dialect: 'sqlite',
          sqlitePath: dbConfig.sqlitePath
        },
        'SQLite ativo: em Cron efêmero sem volume o histórico não persiste entre execuções; use DATABASE_URL (Postgres) no Railway'
      );
    }
    return {
      pessoaRepository: new DrizzlePessoaRepository(appDatabase),
      appDatabase
    };
  } catch (error) {
    logger?.warn(
      {
        event: 'database.open.failed',
        dialect: dbConfig.dialect,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { message: String(error) }
      },
      'Falha ao abrir banco; sync seguirá só com Google Sheets'
    );
    return { pessoaRepository: new NoOpPessoaRepository() };
  }
}
