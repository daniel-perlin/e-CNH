import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatPatientName } from './format-patient-name.js';

describe('formatPatientName', () => {
  it('extrai o primeiro nome de nome composto em caixa alta', () => {
    assert.equal(formatPatientName('JOSE EDSON RODRIGUES DA SILVA'), 'Jose');
    assert.equal(formatPatientName('LEANDRO AUGUSTO DE OLIVEIRA'), 'Leandro');
    assert.equal(formatPatientName('MIRIA MASSAE YAMANIHA MAEDA'), 'Miria');
    assert.equal(formatPatientName('BARBARA LUCIA DE PAIVA MARTINS'), 'Barbara');
  });

  it('aceita nome simples', () => {
    assert.equal(formatPatientName('MARIA'), 'Maria');
    assert.equal(formatPatientName('maria'), 'Maria');
  });

  it('preserva acentos no Title Case', () => {
    assert.equal(formatPatientName('ANTÔNIO CARLOS'), 'Antônio');
    assert.equal(formatPatientName('ÍNGRID SOUZA'), 'Íngrid');
    assert.equal(formatPatientName('josé silva'), 'José');
  });

  it('ignora espaços extras', () => {
    assert.equal(formatPatientName('  JOSE   EDSON  '), 'Jose');
  });

  it('retorna vazio para entrada vazia', () => {
    assert.equal(formatPatientName(''), '');
    assert.equal(formatPatientName('   '), '');
  });
});
