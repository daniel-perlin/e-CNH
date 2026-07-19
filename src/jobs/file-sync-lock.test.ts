import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { FileSyncLock } from './file-sync-lock.js';

describe('FileSyncLock', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map(async (dir) => {
        await rm(dir, { force: true, recursive: true });
      })
    );
  });

  it('adquire e libera o lock', async () => {
    const lockPath = await createTempLockPath();
    const lock = new FileSyncLock({ lockPath });

    const handle = await lock.tentarAdquirir();
    assert.ok(handle !== null);
    await handle.liberar();

    const segundo = await lock.tentarAdquirir();
    assert.ok(segundo !== null);
    await segundo.liberar();
  });

  it('retorna null quando o lock já está ocupado', async () => {
    const lockPath = await createTempLockPath();
    const lockA = new FileSyncLock({ lockPath });
    const lockB = new FileSyncLock({ lockPath });

    const handleA = await lockA.tentarAdquirir();
    assert.ok(handleA !== null);

    const handleB = await lockB.tentarAdquirir();
    assert.equal(handleB, null);

    await handleA.liberar();

    const handleC = await lockB.tentarAdquirir();
    assert.ok(handleC !== null);
    await handleC.liberar();
  });

  async function createTempLockPath(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'ecnh-lock-'));
    dirs.push(dir);
    return join(dir, 'agenda-sync.lock');
  }
});
