import 'dotenv/config';

import { criarAgendaSyncRuntime } from '../composition/agenda-sync-runtime.js';
import { AgendaSyncJob } from '../jobs/agenda-sync-job.js';
import type { StructuredLogger } from '../types/logger.js';

import { formatarResumoSincronizacao } from './sync-agenda-resumo.js';

/**
 * Ponto de entrada sob demanda da sincronização (Fase 006/007).
 * Compõe runtime + job com lock global e imprime resumo sem PII.
 */
async function main(): Promise<void> {
  const runtime = criarAgendaSyncRuntime({
    logger: createQuietLogger()
  });

  const job = new AgendaSyncJob({
    entradas: runtime.entradas,
    lock: runtime.lock,
    logger: createQuietLogger(),
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
    process.exitCode = 1;
    return;
  }

  console.log(formatarResumoSincronizacao(resultado.sincronizacao));

  if (!resultado.sincronizacao.sucessoGeral) {
    process.exitCode = 1;
  }
}

function createQuietLogger(): StructuredLogger {
  const noop = (): void => undefined;
  return { debug: noop, error: noop, info: noop, warn: noop };
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`Sincronização da agenda falhou: ${message}`);
  process.exitCode = 1;
});
