import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveAgendaSyncJobConfig } from '../config/agenda-sync-job-config.js';
import { AgendaSyncJob } from '../jobs/agenda-sync-job.js';
import { AgendaSyncScheduler } from '../jobs/agenda-sync-scheduler.js';
import { FileSyncLock } from '../jobs/file-sync-lock.js';
import type {
  AgendaSyncService,
  ResultadoSincronizacao
} from '../services/agenda-sync-service.js';

/**
 * Validação local da Fase 007 (lock + job + scheduler), sem portal e sem PII.
 * Uso: npx tsx src/scripts/validate-agenda-job.ts
 */
async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const lockDir = join(tmpdir(), `ecnh-007-validacao-${Date.now()}`);
  const lockPath = join(lockDir, 'agenda-sync.lock');
  await mkdir(lockDir, { recursive: true });

  const lock = new FileSyncLock({ lockPath });
  const handleA = await lock.tentarAdquirir();
  if (handleA === null) {
    throw new Error('Falha: primeiro adquirir deveria ter sucesso');
  }
  const handleB = await lock.tentarAdquirir();
  const lockBusyOk = handleB === null;
  await handleA.liberar();

  const sincronizacaoFake: ResultadoSincronizacao = {
    profissionais: [
      {
        datas: [],
        identificadorSeguro: 'ECNH_USER_1',
        logoutExecutado: true,
        sucesso: true
      }
    ],
    sucessoGeral: true
  };

  let chamadasServico = 0;
  const service = {
    sincronizarProfissionais: async (): Promise<ResultadoSincronizacao> => {
      chamadasServico += 1;
      return sincronizacaoFake;
    }
  } as Pick<AgendaSyncService, 'sincronizarProfissionais'> as AgendaSyncService;

  const lockOcupado = new FileSyncLock({ lockPath });
  const holder = await lockOcupado.tentarAdquirir();
  if (holder === null) {
    throw new Error('Falha: holder deveria adquirir');
  }

  const jobComLockOcupado = new AgendaSyncJob({
    entradas: [
      {
        cpf: '000.000.000-00',
        identificadorSeguro: 'ECNH_USER_1',
        password: 'x',
        profissional: 'Validacao',
        unidadeOperacional: 'LIMÃO'
      }
    ],
    lock: new FileSyncLock({ lockPath }),
    service
  });
  const ignorado = await jobComLockOcupado.executar();
  await holder.liberar();

  const jobLivre = new AgendaSyncJob({
    entradas: [
      {
        cpf: '000.000.000-00',
        identificadorSeguro: 'ECNH_USER_1',
        password: 'x',
        profissional: 'Validacao',
        unidadeOperacional: 'LIMÃO'
      }
    ],
    lock: new FileSyncLock({ lockPath }),
    service
  });
  const executado = await jobLivre.executar();

  const config = resolveAgendaSyncJobConfig({
    AGENDA_SYNC_CRON: '0 */6 * * *',
    AGENDA_SYNC_TZ: 'America/Sao_Paulo',
    AGENDA_SYNC_LOCK_PATH: lockPath
  });

  let tickDisparado = false;
  const jobTick = new AgendaSyncJob({
    entradas: [
      {
        cpf: '000.000.000-00',
        identificadorSeguro: 'ECNH_USER_1',
        password: 'x',
        profissional: 'Validacao',
        unidadeOperacional: 'LIMÃO'
      }
    ],
    lock: new FileSyncLock({ lockPath }),
    service: {
      sincronizarProfissionais: async (): Promise<ResultadoSincronizacao> => {
        tickDisparado = true;
        return sincronizacaoFake;
      }
    } as Pick<AgendaSyncService, 'sincronizarProfissionais'> as AgendaSyncService
  });

  const scheduler = new AgendaSyncScheduler({
    cronExpression: '* * * * * *',
    job: jobTick,
    timezone: config.timezone
  });
  scheduler.iniciar();
  await delay(1500);
  scheduler.parar();

  const finishedAt = new Date().toISOString();
  const approved =
    lockBusyOk &&
    ignorado.status === 'ignorado_por_lock' &&
    executado.status === 'executado' &&
    chamadasServico === 1 &&
    tickDisparado &&
    config.cronExpression === '0 */6 * * *';

  const evidencia = {
    approved,
    finishedAt,
    kind: 'validacao-agendamento-automatico',
    nodeVersion: process.version,
    phase: '007',
    schemaVersion: 1,
    startedAt,
    steps: {
      configResolved: {
        cronExpression: config.cronExpression,
        timezone: config.timezone
      },
      fileLockBusyReturnsNull: lockBusyOk,
      jobExecutadoAposLiberar: executado.status === 'executado',
      jobIgnoradoComLockOcupado: ignorado.status === 'ignorado_por_lock',
      schedulerTickDisparado: tickDisparado,
      servicoChamadoApenasQuandoLivre: chamadasServico === 1
    },
    note: 'Validação local de lock global, AgendaSyncJob e AgendaSyncScheduler sem portal, Sheets, CPF real, senha ou cookies.'
  };

  const outDir = join(process.cwd(), 'docs', 'evidencias');
  await mkdir(outDir, { recursive: true });
  const stamp = finishedAt.replace(/[:.]/g, '-');
  const outPath = join(outDir, `007-validacao-agendamento-${stamp}.json`);
  await writeFile(outPath, `${JSON.stringify(evidencia, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({ approved, outPath }, null, 2));
  if (!approved) {
    process.exitCode = 1;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`Validação da Fase 007 falhou: ${message}`);
  process.exit(1);
});
