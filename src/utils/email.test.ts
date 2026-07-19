import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeEmail } from './email.js';

describe('normalizeEmail', () => {
  it('mantém e-mail já minúsculo', () => {
    assert.equal(normalizeEmail('paciente@example.test'), 'paciente@example.test');
  });

  it('converte e-mail em maiúsculas', () => {
    assert.equal(normalizeEmail('PACIENTE@EXAMPLE.TEST'), 'paciente@example.test');
  });

  it('converte e-mail misto', () => {
    assert.equal(normalizeEmail('PaCiEnTe@ExAmPlE.TeSt'), 'paciente@example.test');
  });

  it('remove espaços no início e no fim', () => {
    assert.equal(normalizeEmail('  paciente@example.test  '), 'paciente@example.test');
  });

  it('combina trim e lowercase', () => {
    assert.equal(normalizeEmail('  PACIENTE@Example.TEST  '), 'paciente@example.test');
  });

  it('string vazia permanece vazia', () => {
    assert.equal(normalizeEmail(''), '');
  });

  it('apenas espaços resulta em string vazia', () => {
    assert.equal(normalizeEmail('   '), '');
  });
});
