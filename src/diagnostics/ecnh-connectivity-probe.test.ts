import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runEcnhConnectivityProbe } from './ecnh-connectivity-probe.js';

describe('runEcnhConnectivityProbe', () => {
  it('falha com exitCode 1 quando ECNH_BASE_URL está ausente', async () => {
    const resultado = await runEcnhConnectivityProbe({
      env: {},
      printToConsole: false
    });
    assert.equal(resultado.ok, false);
    assert.equal(resultado.exitCode, 1);
    assert.equal(resultado.absoluteUrl, '');
  });

  it('falha com exitCode 1 quando baseUrl é só espaços', async () => {
    const resultado = await runEcnhConnectivityProbe({
      baseUrl: '   ',
      printToConsole: false
    });
    assert.equal(resultado.exitCode, 1);
  });
});
