import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mascararCpf } from './cpf-mask.js';

describe('mascararCpf', () => {
  it('mascara preservando apenas os 2 últimos dígitos', () => {
    assert.equal(mascararCpf('440.234.858-70'), '***.***.***-70');
    assert.equal(mascararCpf('44023485870'), '***.***.***-70');
  });

  it('retorna placeholder para CPF inválido', () => {
    assert.equal(mascararCpf('123'), '***');
  });
});
