import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatOptionalFieldForSheet,
  parseOptionalFieldFromSheet,
  SHEET_PLACEHOLDER
} from './sheet-optional-field.js';

describe('formatOptionalFieldForSheet', () => {
  it('converte ausência e NÃO INFORMADO no placeholder visual', () => {
    assert.equal(formatOptionalFieldForSheet(undefined), SHEET_PLACEHOLDER);
    assert.equal(formatOptionalFieldForSheet(null), SHEET_PLACEHOLDER);
    assert.equal(formatOptionalFieldForSheet(''), SHEET_PLACEHOLDER);
    assert.equal(formatOptionalFieldForSheet('   '), SHEET_PLACEHOLDER);
    assert.equal(formatOptionalFieldForSheet('NÃO INFORMADO'), SHEET_PLACEHOLDER);
    assert.equal(formatOptionalFieldForSheet('não informado'), SHEET_PLACEHOLDER);
    assert.equal(formatOptionalFieldForSheet('Nao Informado'), SHEET_PLACEHOLDER);
  });

  it('mantém valor real exatamente como recebido', () => {
    assert.equal(formatOptionalFieldForSheet('B'), 'B');
    assert.equal(formatOptionalFieldForSheet('(11) 900000001'), '(11) 900000001');
    assert.equal(formatOptionalFieldForSheet('paciente@example.test'), 'paciente@example.test');
  });
});

describe('parseOptionalFieldFromSheet', () => {
  it('converte placeholder e NÃO INFORMADO em undefined', () => {
    assert.equal(parseOptionalFieldFromSheet(SHEET_PLACEHOLDER), undefined);
    assert.equal(parseOptionalFieldFromSheet('não informado'), undefined);
    assert.equal(parseOptionalFieldFromSheet('NÃO INFORMADO'), undefined);
    assert.equal(parseOptionalFieldFromSheet(''), undefined);
    assert.equal(parseOptionalFieldFromSheet('   '), undefined);
    assert.equal(parseOptionalFieldFromSheet(undefined), undefined);
    assert.equal(parseOptionalFieldFromSheet(null), undefined);
  });

  it('mantém valores reais trimados', () => {
    assert.equal(parseOptionalFieldFromSheet('B'), 'B');
    assert.equal(parseOptionalFieldFromSheet('  AB  '), 'AB');
    assert.equal(parseOptionalFieldFromSheet('(11) 900000001'), '(11) 900000001');
  });
});
