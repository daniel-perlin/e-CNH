/**
 * Porta de exclusão mútua para sincronizações (Fase 007).
 * Não conhece AgendaSyncService nem cron.
 */
export interface SyncLockHandle {
  liberar(): Promise<void>;
}

export interface SyncLock {
  /**
   * Tenta adquirir o lock sem esperar.
   * Retorna `null` quando outro processo já detém o lock.
   */
  tentarAdquirir(): Promise<SyncLockHandle | null>;
}
