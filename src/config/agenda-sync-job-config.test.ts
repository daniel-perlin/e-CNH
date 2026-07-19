import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ConfigurationError } from '../client/errors.js';

import {
  resolveAgendaSyncJobConfig,
  resolveAgendaSyncLockPath
} from './agenda-sync-job-config.js';

describe('resolveAgendaSyncJobConfig', () => {
  it('exige AGENDA_SYNC_CRON', () => {
    assert.throws(
      () => resolveAgendaSyncJobConfig({}),
      (error: unknown) =>
        error instanceof ConfigurationError &&
        error.message.includes('AGENDA_SYNC_CRON')
    );
  });

  it('rejeita expressão cron inválida', () => {
    assert.throws(
      () =>
        resolveAgendaSyncJobConfig({
          AGENDA_SYNC_CRON: 'nao-e-cron'
        }),
      (error: unknown) =>
        error instanceof ConfigurationError && error.message.includes('inválida')
    );
  });

  it('resolve cron, timezone e lock path', () => {
    const config = resolveAgendaSyncJobConfig({
      AGENDA_SYNC_CRON: '0 */6 * * *',
      AGENDA_SYNC_TZ: 'America/Manaus',
      AGENDA_SYNC_LOCK_PATH: '/tmp/custom.lock'
    });

    assert.deepEqual(config, {
      cronExpression: '0 */6 * * *',
      lockPath: '/tmp/custom.lock',
      timezone: 'America/Manaus'
    });
  });

  it('usa defaults de timezone e lock path', () => {
    const config = resolveAgendaSyncJobConfig({
      AGENDA_SYNC_CRON: '30 8 * * *'
    });

    assert.equal(config.timezone, 'America/Sao_Paulo');
    assert.equal(config.lockPath, '.data/agenda-sync.lock');
  });
});

describe('resolveAgendaSyncLockPath', () => {
  it('usa default quando ausente', () => {
    assert.equal(resolveAgendaSyncLockPath({}), '.data/agenda-sync.lock');
  });

  it('respeita override', () => {
    assert.equal(
      resolveAgendaSyncLockPath({ AGENDA_SYNC_LOCK_PATH: './locks/x.lock' }),
      './locks/x.lock'
    );
  });
});
