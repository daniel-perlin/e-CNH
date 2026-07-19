import { ConfigurationError } from '../client/errors.js';
import cron from 'node-cron';

export interface AgendaSyncJobConfig {
  cronExpression: string;
  lockPath: string;
  timezone: string;
}

const LOCK_PATH_PADRAO = '.data/agenda-sync.lock';
const TIMEZONE_PADRAO = 'America/Sao_Paulo';

/**
 * Lê a configuração do agendamento automático na fronteira de ambiente.
 */
export function resolveAgendaSyncJobConfig(
  env: NodeJS.ProcessEnv = process.env
): AgendaSyncJobConfig {
  const cronExpression = env.AGENDA_SYNC_CRON?.trim();
  if (cronExpression === undefined || cronExpression.length === 0) {
    throw new ConfigurationError(
      'Defina AGENDA_SYNC_CRON no arquivo .env antes de iniciar o agendamento automático.'
    );
  }

  if (!cron.validate(cronExpression)) {
    throw new ConfigurationError(
      `AGENDA_SYNC_CRON inválida: "${cronExpression}". Use uma expressão cron de 5 ou 6 campos.`
    );
  }

  const timezone = env.AGENDA_SYNC_TZ?.trim() || TIMEZONE_PADRAO;
  const lockPath = env.AGENDA_SYNC_LOCK_PATH?.trim() || LOCK_PATH_PADRAO;

  return {
    cronExpression,
    lockPath,
    timezone
  };
}

/** Resolve apenas o caminho do lock (útil para `sync:agenda` sem exigir cron). */
export function resolveAgendaSyncLockPath(
  env: NodeJS.ProcessEnv = process.env
): string {
  return env.AGENDA_SYNC_LOCK_PATH?.trim() || LOCK_PATH_PADRAO;
}
