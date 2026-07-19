import 'dotenv/config';

import pino from 'pino';

import { resolveAgendaSyncJobConfig } from '../config/agenda-sync-job-config.js';
import { criarAgendaSyncRuntime } from '../composition/agenda-sync-runtime.js';
import { AgendaSyncJob } from '../jobs/agenda-sync-job.js';
import { AgendaSyncScheduler } from '../jobs/agenda-sync-scheduler.js';
import type { StructuredLogger } from '../types/logger.js';

/**
 * Daemon de agendamento automático (Fase 007).
 * Mantém o processo vivo e dispara `AgendaSyncJob` conforme `AGENDA_SYNC_CRON`.
 */
async function main(): Promise<void> {
  const config = resolveAgendaSyncJobConfig();
  const logger = createDaemonLogger();

  const runtime = criarAgendaSyncRuntime({ logger });
  const job = new AgendaSyncJob({
    entradas: runtime.entradas,
    lock: runtime.lock,
    logger,
    service: runtime.service
  });

  const scheduler = new AgendaSyncScheduler({
    cronExpression: config.cronExpression,
    job,
    logger,
    timezone: config.timezone
  });

  scheduler.iniciar();

  logger.info(
    {
      event: 'agenda.sync.daemon.ready',
      cron: config.cronExpression,
      timezone: config.timezone,
      lockPath: config.lockPath,
      profissionais: runtime.entradas.length
    },
    'Daemon de sincronização pronto'
  );

  const encerrar = (): void => {
    logger.info({ event: 'agenda.sync.daemon.shutdown' }, 'Encerrando daemon');
    scheduler.parar();
    process.exit(0);
  };

  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
}

function createDaemonLogger(): StructuredLogger {
  return pino({
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: [
        'cpf',
        'password',
        'headers.cookie',
        'headers.authorization',
        'err.config.headers'
      ],
      remove: true
    }
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`Daemon de sincronização falhou ao iniciar: ${message}`);
  process.exit(1);
});
