import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatCpfForPortal, normalizeCpfKey } from './cpf.js';

describe('normalizeCpfKey', () => {
  it('extrai 11 dígitos de CPF formatado', () => {
    assert.equal(normalizeCpfKey('000.000.000-00'), '00000000000');
  });

  it('aceita CPF só com dígitos', () => {
    assert.equal(normalizeCpfKey('11111111111'), '11111111111');
  });

  it('considera o mesmo CPF com e sem máscara como a mesma chave', () => {
    assert.equal(normalizeCpfKey('123.456.789-09'), normalizeCpfKey('12345678909'));
  });

  it('rejeita CPF com quantidade inválida de dígitos', () => {
    assert.equal(normalizeCpfKey('123'), undefined);
    assert.equal(normalizeCpfKey(''), undefined);
    assert.equal(normalizeCpfKey('   '), undefined);
  });
});

describe('formatCpfForPortal', () => {
  it('formata 11 dígitos no padrão do portal', () => {
    assert.equal(formatCpfForPortal('00000000000'), '000.000.000-00');
  });
});
