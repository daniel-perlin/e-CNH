import type {
  AgendaSyncService,
  EntradaSincronizacaoProfissional,
  ResultadoSincronizacao
} from '../services/agenda-sync-service.js';
import type { StructuredLogger } from '../types/logger.js';

import type { SyncLock } from './sync-lock.js';

/** Resultado tipado do job (sem PII). */
export type ResultadoAgendaSyncJob =
  | { status: 'ignorado_por_lock' }
  | { status: 'executado'; sincronizacao: ResultadoSincronizacao };

export interface AgendaSyncJobOptions {
  entradas: EntradaSincronizacaoProfissional[];
  lock: SyncLock;
  logger?: StructuredLogger;
  service: AgendaSyncService;
}

/**
 * Job fino da Fase 007: lock → `AgendaSyncService` → unlock.
 * Não contém lógica de login, parsing ou persistência.
 */
export class AgendaSyncJob {
  private readonly entradas: EntradaSincronizacaoProfissional[];
  private readonly lock: SyncLock;
  private readonly logger: StructuredLogger | undefined;
  private readonly service: AgendaSyncService;

  public constructor(options: AgendaSyncJobOptions) {
    this.lock = options.lock;
    this.service = options.service;
    this.entradas = options.entradas;
    this.logger = options.logger;
  }

  public async executar(): Promise<ResultadoAgendaSyncJob> {
    const handle = await this.lock.tentarAdquirir();
    if (handle === null) {
      this.logger?.warn(
        { event: 'agenda.sync.job.skipped_lock' },
        'Sincronização ignorada: lock ocupado'
      );
      return { status: 'ignorado_por_lock' };
    }

    this.logger?.warn(
      {
        event: 'agenda.sync.job.started',
        profissionais: this.entradas.length
      },
      'Sincronização do job iniciada'
    );

    try {
      const sincronizacao = await this.service.sincronizarProfissionais(this.entradas);
      this.logger?.warn(
        {
          event: 'agenda.sync.job.finished',
          sucessoGeral: sincronizacao.sucessoGeral,
          profissionais: sincronizacao.profissionais.length
        },
        'Sincronização do job finalizada'
      );
      return { status: 'executado', sincronizacao };
    } finally {
      await handle.liberar();
    }
  }
}
