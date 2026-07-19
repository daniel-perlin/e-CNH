import { ECNHClient } from '../client/ecnh-client.js';
import { ConfigurationError } from '../client/errors.js';
import { GoogleSheetsClient } from '../client/google-sheets-client.js';
import { resolveAgendaSyncLockPath } from '../config/agenda-sync-job-config.js';
import { resolveGoogleSheetsConfig } from '../config/google-sheets-config.js';
import { resolveEntradasSincronizacao } from '../config/sync-professionals.js';
import { FileSyncLock } from '../jobs/file-sync-lock.js';
import type { SyncLock } from '../jobs/sync-lock.js';
import { parseAgendaHtml } from '../parsers/agenda-parser.js';
import { GoogleSheetsAgendaRepository } from '../repositories/google-sheets-agenda-repository.js';
import {
  AgendaSyncService,
  type EntradaSincronizacaoProfissional
} from '../services/agenda-sync-service.js';
import type { StructuredLogger } from '../types/logger.js';

export interface AgendaSyncRuntime {
  entradas: EntradaSincronizacaoProfissional[];
  lock: SyncLock;
  service: AgendaSyncService;
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
 */
export function criarAgendaSyncRuntime(
  options: CriarAgendaSyncRuntimeOptions = {}
): AgendaSyncRuntime {
  const env = options.env ?? process.env;
  const baseUrl = env.ECNH_BASE_URL?.trim();
  if (baseUrl === undefined || baseUrl.length === 0) {
    throw new ConfigurationError(
      'Defina ECNH_BASE_URL no arquivo .env antes de executar a sincronização.'
    );
  }

  const entradas = resolveEntradasSincronizacao(env);
  const sheetsConfig = resolveGoogleSheetsConfig(env);
  const sheets = new GoogleSheetsClient({
    credentialsPath: sheetsConfig.credentialsPath,
    spreadsheetId: sheetsConfig.spreadsheetId
  });
  const agendaRepository = new GoogleSheetsAgendaRepository({
    sheets,
    sheetName: sheetsConfig.sheetName
  });

  const logger = options.logger;
  const service = new AgendaSyncService({
    agendaRepository,
    client: () =>
      new ECNHClient({
        baseUrl,
        logger
      }),
    logger,
    parseAgendaHtml
  });

  const lock =
    options.lock ??
    new FileSyncLock({
      lockPath: resolveAgendaSyncLockPath(env)
    });

  return { entradas, lock, service };
}
