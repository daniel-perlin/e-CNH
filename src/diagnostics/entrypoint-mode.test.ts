import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveEntrypointMode } from './entrypoint-mode.js';

describe('resolveEntrypointMode', () => {
  it('usa agenda-sync por padrão (comportamento de produção)', () => {
    assert.equal(resolveEntrypointMode({}), 'agenda-sync');
    assert.equal(resolveEntrypointMode({ RUN_CONNECTIVITY_PROBE: '' }), 'agenda-sync');
    assert.equal(resolveEntrypointMode({ RUN_CONNECTIVITY_PROBE: '   ' }), 'agenda-sync');
    assert.equal(resolveEntrypointMode({ RUN_CONNECTIVITY_PROBE: 'false' }), 'agenda-sync');
    assert.equal(resolveEntrypointMode({ RUN_CONNECTIVITY_PROBE: '0' }), 'agenda-sync');
    assert.equal(resolveEntrypointMode({ RUN_CONNECTIVITY_PROBE: 'no' }), 'agenda-sync');
  });

  it('ativa connectivity-probe com valores truthy explícitos', () => {
    assert.equal(resolveEntrypointMode({ RUN_CONNECTIVITY_PROBE: 'true' }), 'connectivity-probe');
    assert.equal(resolveEntrypointMode({ RUN_CONNECTIVITY_PROBE: 'TRUE' }), 'connectivity-probe');
    assert.equal(resolveEntrypointMode({ RUN_CONNECTIVITY_PROBE: '1' }), 'connectivity-probe');
    assert.equal(resolveEntrypointMode({ RUN_CONNECTIVITY_PROBE: 'yes' }), 'connectivity-probe');
    assert.equal(resolveEntrypointMode({ RUN_CONNECTIVITY_PROBE: 'on' }), 'connectivity-probe');
    assert.equal(resolveEntrypointMode({ RUN_CONNECTIVITY_PROBE: ' On ' }), 'connectivity-probe');
  });
});
