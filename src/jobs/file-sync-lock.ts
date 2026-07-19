import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';

import lockfile from 'proper-lockfile';

import type { SyncLock, SyncLockHandle } from './sync-lock.js';

export interface FileSyncLockOptions {
  /** Caminho do arquivo de lock (ex.: `.data/agenda-sync.lock`). */
  lockPath: string;
  /**
   * Tempo em ms após o qual um lock órfão é considerado stale.
   * Default: 2 horas (cobre syncs longas multi-profissional).
   */
  staleMs?: number;
}

/**
 * Implementação de `SyncLock` baseada em arquivo (`proper-lockfile`).
 * Assume um host ou volume compartilhado (limitação do MVP).
 */
export class FileSyncLock implements SyncLock {
  private readonly lockPath: string;
  private readonly staleMs: number;

  public constructor(options: FileSyncLockOptions) {
    this.lockPath = options.lockPath;
    this.staleMs = options.staleMs ?? 2 * 60 * 60 * 1000;
  }

  public async tentarAdquirir(): Promise<SyncLockHandle | null> {
    await this.ensureLockFileExists();

    try {
      const release = await lockfile.lock(this.lockPath, {
        realpath: false,
        retries: 0,
        stale: this.staleMs
      });

      return {
        liberar: async (): Promise<void> => {
          await release();
        }
      };
    } catch (error: unknown) {
      if (isLockBusyError(error)) {
        return null;
      }
      throw error;
    }
  }

  private async ensureLockFileExists(): Promise<void> {
    await mkdir(dirname(this.lockPath), { recursive: true });
    const handle = await open(this.lockPath, 'a');
    await handle.close();
  }
}

function isLockBusyError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const code = 'code' in error ? String(error.code) : '';
  const message = 'message' in error ? String(error.message) : '';
  return (
    code === 'ELOCKED' ||
    message.includes('already being held') ||
    message.includes('Lock file is already being held')
  );
}
