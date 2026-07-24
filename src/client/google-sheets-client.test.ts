import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { StructuredLogger } from '../types/logger.js';

import { GoogleSheetsClient } from './google-sheets-client.js';

describe('GoogleSheetsClient retry', () => {
  it('reexecuta updateValues após 429 e conclui', async () => {
    const events: string[] = [];
    const sleeps: number[] = [];
    let calls = 0;

    const client = new GoogleSheetsClient({
      credentials: { kind: 'path', path: '/tmp/unused.json' },
      spreadsheetId: 'sheet-id',
      retry: { maxAttempts: 3, backoffBaseMs: 10, maxWaitMs: 1_000 },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: (bindings: object) => {
          events.push(String((bindings as { event?: string }).event));
        },
        error: (bindings: object) => {
          events.push(String((bindings as { event?: string }).event));
        }
      } satisfies StructuredLogger
    });

    (client as unknown as { getValuesApi: () => Promise<unknown> }).getValuesApi = async () => ({
      update: async () => {
        calls += 1;
        if (calls < 3) {
          throw Object.assign(new Error('Quota exceeded for Write requests per minute per user'), {
            response: { status: 429 }
          });
        }
        return {};
      },
      get: async () => ({ data: { values: [] } }),
      clear: async () => ({})
    });

    await client.updateValues('Agenda!A1:B2', [
      ['a', 'b'],
      ['c', 'd']
    ]);

    assert.equal(calls, 3);
    assert.deepEqual(sleeps, [10, 20]);
    assert.ok(events.includes('agenda.sheets.retry.started'));
    assert.ok(events.includes('agenda.sheets.retry.waiting'));
    assert.ok(events.includes('agenda.sheets.retry.completed'));
  });

  it('não faz retry em erro permanente 403', async () => {
    let calls = 0;
    const events: string[] = [];
    const client = new GoogleSheetsClient({
      credentials: { kind: 'path', path: '/tmp/unused.json' },
      spreadsheetId: 'sheet-id',
      retry: { maxAttempts: 5, backoffBaseMs: 10 },
      sleep: async () => undefined,
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: (bindings: object) => {
          events.push(String((bindings as { event?: string }).event));
        }
      }
    });

    (client as unknown as { getValuesApi: () => Promise<unknown> }).getValuesApi = async () => ({
      update: async () => {
        calls += 1;
        throw Object.assign(new Error('The caller does not have permission'), {
          response: { status: 403 }
        });
      },
      get: async () => ({ data: { values: [] } }),
      clear: async () => ({})
    });

    await assert.rejects(() => client.updateValues('Agenda!A1', [['x']]));
    assert.equal(calls, 1);
    assert.ok(events.includes('agenda.sheets.retry.failed'));
  });
});
