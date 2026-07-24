import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ConfigurationError } from '../client/errors.js';

import { resolveGoogleSheetsConfig } from './google-sheets-config.js';

describe('resolveGoogleSheetsConfig', () => {
  it('prioriza GOOGLE_SERVICE_ACCOUNT_JSON sobre path', () => {
    const config = resolveGoogleSheetsConfig({
      GOOGLE_SHEETS_SPREADSHEET_ID: 'sheet-id',
      GOOGLE_SERVICE_ACCOUNT_JSON: '{"client_email":"sa@example.test","private_key":"x"}',
      GOOGLE_SHEETS_CREDENTIALS_PATH: './secrets/ignored.json'
    });

    assert.equal(config.spreadsheetId, 'sheet-id');
    assert.equal(config.sheetName, 'Agenda');
    assert.equal(config.maxAttempts, 5);
    assert.equal(config.credentials.kind, 'json');
    if (config.credentials.kind === 'json') {
      assert.equal(config.credentials.credentials.client_email, 'sa@example.test');
    }
  });

  it('aceita path via GOOGLE_SHEETS_CREDENTIALS_PATH', () => {
    const config = resolveGoogleSheetsConfig({
      GOOGLE_SHEETS_SPREADSHEET_ID: 'sheet-id',
      GOOGLE_SHEETS_CREDENTIALS_PATH: './secrets/google-service-account.json'
    });

    assert.deepEqual(config.credentials, {
      kind: 'path',
      path: './secrets/google-service-account.json'
    });
  });

  it('rejeita JSON inválido', () => {
    assert.throws(
      () =>
        resolveGoogleSheetsConfig({
          GOOGLE_SHEETS_SPREADSHEET_ID: 'sheet-id',
          GOOGLE_SERVICE_ACCOUNT_JSON: '{nao-json'
        }),
      ConfigurationError
    );
  });

  it('aceita GOOGLE_SHEETS_MAX_ATTEMPTS válido e rejeita inválido', () => {
    const config = resolveGoogleSheetsConfig({
      GOOGLE_SHEETS_SPREADSHEET_ID: 'sheet-id',
      GOOGLE_SHEETS_CREDENTIALS_PATH: './secrets/google-service-account.json',
      GOOGLE_SHEETS_MAX_ATTEMPTS: '8'
    });
    assert.equal(config.maxAttempts, 8);

    assert.throws(
      () =>
        resolveGoogleSheetsConfig({
          GOOGLE_SHEETS_SPREADSHEET_ID: 'sheet-id',
          GOOGLE_SHEETS_CREDENTIALS_PATH: './secrets/x.json',
          GOOGLE_SHEETS_MAX_ATTEMPTS: '0'
        }),
      ConfigurationError
    );
  });

  it('exige spreadsheet id e alguma fonte de credencial', () => {
    assert.throws(() => resolveGoogleSheetsConfig({}), ConfigurationError);
    assert.throws(
      () => resolveGoogleSheetsConfig({ GOOGLE_SHEETS_SPREADSHEET_ID: 'x' }),
      ConfigurationError
    );
  });
});
