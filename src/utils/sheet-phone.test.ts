import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatPhoneForSheet } from './sheet-phone.js';

describe('formatPhoneForSheet', () => {
  it('projeta celular com DDD 11 apenas em dígitos', () => {
    assert.equal(formatPhoneForSheet('(11) 999751104'), '11999751104');
    assert.equal(formatPhoneForSheet('(11) 958706067'), '11958706067');
  });

  it('preserva DDD diferente de 11', () => {
    assert.equal(formatPhoneForSheet('(21) 998765432'), '21998765432');
  });

  it('assume DDD 11 quando o celular vem sem DDD', () => {
    assert.equal(formatPhoneForSheet('998765432'), '11998765432');
  });

  it('descarta fixo e mantém apenas o celular da lista', () => {
    assert.equal(formatPhoneForSheet('39513081 / (11) 999751104'), '11999751104');
    assert.equal(formatPhoneForSheet('58333483 / (11) 947974958'), '11947974958');
  });

  it('une múltiplos celulares com separador operacional', () => {
    assert.equal(
      formatPhoneForSheet('(11) 999751104 / (21) 998765432'),
      '11999751104 / 21998765432'
    );
  });

  it('retorna vazio quando não há celular (placeholder fica a cargo do mapper)', () => {
    assert.equal(formatPhoneForSheet(''), '');
    assert.equal(formatPhoneForSheet('   '), '');
    assert.equal(formatPhoneForSheet(undefined), '');
    assert.equal(formatPhoneForSheet(null), '');
    assert.equal(formatPhoneForSheet('NÃO INFORMADO'), '');
    assert.equal(formatPhoneForSheet('39513081'), '');
    assert.equal(formatPhoneForSheet('58333483 / 39911697'), '');
  });
});
