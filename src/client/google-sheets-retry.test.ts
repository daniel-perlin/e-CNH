import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_SHEETS_RETRY_POLICY,
  calcularEsperaRetryMs,
  extrairRetryAfterMs,
  extrairStatusHttpSheets,
  isTransientSheetsError,
  motivoRetrySheets
} from './google-sheets-retry.js';

describe('google-sheets-retry', () => {
  it('classifica 429 e quota como transitórios', () => {
    const erro = Object.assign(new Error('Quota exceeded for Write requests per minute per user'), {
      code: 429,
      response: { status: 429 }
    });
    assert.equal(isTransientSheetsError(erro), true);
    assert.equal(motivoRetrySheets(erro), 'quota_or_rate_limit');
  });

  it('classifica 503 como transitório', () => {
    const erro = Object.assign(new Error('backendError'), {
      response: { status: 503 }
    });
    assert.equal(isTransientSheetsError(erro), true);
  });

  it('não faz retry em 401/403/404', () => {
    assert.equal(
      isTransientSheetsError(
        Object.assign(new Error('Unauthorized'), { response: { status: 401 } })
      ),
      false
    );
    assert.equal(
      isTransientSheetsError(
        Object.assign(new Error('Permission denied'), { response: { status: 403 } })
      ),
      false
    );
    assert.equal(
      isTransientSheetsError(
        Object.assign(new Error('Requested entity was not found'), {
          response: { status: 404 }
        })
      ),
      false
    );
  });

  it('não faz retry em range inválido', () => {
    assert.equal(
      isTransientSheetsError(new Error('Unable to parse range: Agenda!A1')),
      false
    );
  });

  it('calcula backoff 2s, 4s, 8s, 16s', () => {
    assert.equal(calcularEsperaRetryMs(1, new Error('x')), 2_000);
    assert.equal(calcularEsperaRetryMs(2, new Error('x')), 4_000);
    assert.equal(calcularEsperaRetryMs(3, new Error('x')), 8_000);
    assert.equal(calcularEsperaRetryMs(4, new Error('x')), 16_000);
  });

  it('prioriza Retry-After em segundos', () => {
    const erro = {
      response: { headers: { 'retry-after': '7' }, status: 429 }
    };
    assert.equal(extrairStatusHttpSheets(erro), 429);
    assert.equal(extrairRetryAfterMs(erro), 7_000);
    assert.equal(calcularEsperaRetryMs(1, erro, DEFAULT_SHEETS_RETRY_POLICY), 7_000);
  });
});
