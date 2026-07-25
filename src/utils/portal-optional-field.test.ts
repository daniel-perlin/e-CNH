import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseOptionalPortalField } from './portal-optional-field.js';

describe('parseOptionalPortalField', () => {
  it('converte ausência e NÃO INFORMADO em undefined', () => {
    assert.equal(parseOptionalPortalField(undefined), undefined);
    assert.equal(parseOptionalPortalField(null), undefined);
    assert.equal(parseOptionalPortalField(''), undefined);
    assert.equal(parseOptionalPortalField('   '), undefined);
    assert.equal(parseOptionalPortalField('NÃO INFORMADO'), undefined);
    assert.equal(parseOptionalPortalField('não informado'), undefined);
    assert.equal(parseOptionalPortalField('Nao Informado'), undefined);
  });

  it('preserva valores reais exatamente iguais', () => {
    assert.equal(parseOptionalPortalField('B'), 'B');
    assert.equal(parseOptionalPortalField('(11) 900000001'), '(11) 900000001');
    assert.equal(parseOptionalPortalField('paciente@example.test'), 'paciente@example.test');
    assert.equal(parseOptionalPortalField('  AB  '), '  AB  ');
  });
});
