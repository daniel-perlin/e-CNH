import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatSyncTimestamp, TIMEZONE_SINCRONIZACAO } from './sync-timestamp.js';

describe('formatSyncTimestamp', () => {
  it('formata no padrão DD/MM/YYYY HH:mm', () => {
    // 2026-07-19T15:04:05.000Z = 12:04 em America/Sao_Paulo (UTC-3)
    const formatado = formatSyncTimestamp(new Date('2026-07-19T15:04:05.000Z'));
    assert.equal(formatado, '19/07/2026 12:04');
  });

  it('usa o fuso America/Sao_Paulo', () => {
    assert.equal(TIMEZONE_SINCRONIZACAO, 'America/Sao_Paulo');
    const formatado = formatSyncTimestamp(new Date('2026-01-15T02:30:00.000Z'));
    assert.equal(formatado, '14/01/2026 23:30');
  });

  it('zero-pad em dia, mês e componentes de hora', () => {
    const formatado = formatSyncTimestamp(new Date('2026-03-05T12:08:09.000Z'));
    assert.equal(formatado, '05/03/2026 09:08');
  });
});
