import cron, { type ScheduledTask } from 'node-cron';

import type { StructuredLogger } from '../types/logger.js';

import type { AgendaSyncJob } from './agenda-sync-job.js';

export interface AgendaSyncSchedulerOptions {
  /** Expressão cron (5 ou 6 campos). */
  cronExpression: string;
  job: AgendaSyncJob;
  logger?: StructuredLogger;
  /** IANA timezone (ex.: America/Sao_Paulo). */
  timezone: string;
}

/**
 * Agenda ticks do cron e dispara `AgendaSyncJob`.
 * Não monta client, parser nem repositório.
 */
export class AgendaSyncScheduler {
  private readonly cronExpression: string;
  private readonly job: AgendaSyncJob;
  private readonly logger: StructuredLogger | undefined;
  private readonly timezone: string;
  private task: ScheduledTask | undefined;
  private emExecucao = false;

  public constructor(options: AgendaSyncSchedulerOptions) {
    this.cronExpression = options.cronExpression;
    this.job = options.job;
    this.logger = options.logger;
    this.timezone = options.timezone;
  }

  public iniciar(): void {
    if (this.task !== undefined) {
      return;
    }

    if (!cron.validate(this.cronExpression)) {
      throw new Error(`Expressão cron inválida: ${this.cronExpression}`);
    }

    this.task = cron.schedule(
      this.cronExpression,
      () => {
        void this.dispararTick();
      },
      { timezone: this.timezone }
    );

    this.logger?.info(
      {
        event: 'agenda.sync.scheduler.started',
        cron: this.cronExpression,
        timezone: this.timezone
      },
      'Scheduler de sincronização iniciado'
    );
  }

  public parar(): void {
    this.task?.stop();
    this.task = undefined;
    this.logger?.info(
      { event: 'agenda.sync.scheduler.stopped' },
      'Scheduler de sincronização parado'
    );
  }

  private async dispararTick(): Promise<void> {
    if (this.emExecucao) {
      this.logger?.warn(
        { event: 'agenda.sync.scheduler.tick_skipped_inflight' },
        'Tick ignorado: execução anterior ainda em andamento no mesmo processo'
      );
      return;
    }

    this.emExecucao = true;
    try {
      this.logger?.info(
        { event: 'agenda.sync.scheduler.tick' },
        'Tick do scheduler disparado'
      );
      await this.job.executar();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'erro desconhecido';
      this.logger?.error(
        { event: 'agenda.sync.scheduler.tick_failed', erro: message },
        'Falha no tick do scheduler'
      );
    } finally {
      this.emExecucao = false;
    }
  }
}
