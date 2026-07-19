import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizePhone } from './phone.js';

describe('normalizePhone', () => {
  it('descarta telefone composto por um único dígito repetido', () => {
    assert.equal(normalizePhone('00000000'), '');
    assert.equal(normalizePhone('11111111'), '');
    assert.equal(normalizePhone('999999999'), '');
    assert.equal(normalizePhone('(00) 0000-0000'), '');
  });

  it('adiciona DDD 11 a celular com exatamente 9 dígitos iniciados em 9', () => {
    assert.equal(normalizePhone('991354797'), '(11) 991354797');
  });

  it('adiciona DDD 11 mesmo com hífen ou espaços no celular de 9 dígitos', () => {
    assert.equal(normalizePhone('99135-4797'), '(11) 991354797');
    assert.equal(normalizePhone(' 991 354 797 '), '(11) 991354797');
  });

  it('não adiciona DDD quando não há exatamente 9 dígitos iniciados em 9', () => {
    assert.equal(normalizePhone('39911697'), '39911697');
    assert.equal(normalizePhone('891354797'), '891354797');
    assert.equal(normalizePhone('(11) 991354797'), '(11) 991354797');
  });

  it('remove hífens', () => {
    assert.equal(normalizePhone('(11) 9479-08238'), '(11) 947908238');
    assert.equal(normalizePhone('3991-1697'), '39911697');
  });

  it('remove espaços extras', () => {
    assert.equal(normalizePhone('  (11)  9479-08238  '), '(11) 947908238');
  });

  it('normaliza múltiplos telefones separados por barra', () => {
    assert.equal(
      normalizePhone('991354797 / (11) 9479-08238'),
      '(11) 991354797 / (11) 947908238'
    );
  });

  it('omite telefones descartados na lista múltipla', () => {
    assert.equal(normalizePhone('00000000 / 991354797'), '(11) 991354797');
    assert.equal(normalizePhone('11111111 / 00000000'), '');
    assert.equal(normalizePhone('3991-1697 / 999999999 / 991354797'), '39911697 / (11) 991354797');
  });

  it('string vazia permanece vazia', () => {
    assert.equal(normalizePhone(''), '');
    assert.equal(normalizePhone('   '), '');
  });
});
