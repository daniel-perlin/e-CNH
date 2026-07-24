import 'dotenv/config';

import pino from 'pino';

import { criarAgendaSyncRuntime } from '../composition/agenda-sync-runtime.js';
import { AgendaSyncJob } from '../jobs/agenda-sync-job.js';
import type { StructuredLogger } from '../types/logger.js';

import { codigoSaidaSincronizacao, formatarResumoSincronizacao } from './sync-agenda-resumo.js';

/**
 * Ponto de entrada sob demanda da sincronização (Fase 006/007 / Railway Cron).
 * Compõe runtime + job com lock global, imprime resumo sem PII e encerra o processo.
 *
 * `process.exit` é intencional: agentes HTTP com keep-alive podem manter o event loop
 * vivo após o sync; no Cron efêmero o processo deve terminar para liberar o próximo tick.
 */
async function main(): Promise<void> {
  const logger = createSyncLogger();
  const runtime = await criarAgendaSyncRuntime({ logger });

  let exitCode = 0;
  try {
    const job = new AgendaSyncJob({
      entradas: runtime.entradas,
      lock: runtime.lock,
      logger,
      service: runtime.service
    });

    console.log(
      `Iniciando sincronização de ${runtime.entradas.length} profissional(is) habilitado(s)...`
    );

    const resultado = await job.executar();

    if (resultado.status === 'ignorado_por_lock') {
      console.error(
        'Sincronização ignorada: outra execução já está em andamento (lock ocupado).'
      );
      exitCode = 1;
      return;
    }

    console.log(formatarResumoSincronizacao(resultado.sincronizacao));

    // Falha parcial não derruba o Cron no Railway; só falha total (0 sucessos).
    exitCode = codigoSaidaSincronizacao(resultado.sincronizacao);
  } finally {
    await runtime.close();
  }

  process.exit(exitCode);
}

/** Emite warn/error (ex.: cabeçalho incompatível); omite info/debug no console do sync manual. */
function createSyncLogger(): StructuredLogger {
  return pino({
    level: 'warn',
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

void main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`Sincronização da agenda falhou: ${message}`);
  process.exit(1);
});
