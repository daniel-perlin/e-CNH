import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatPatientNameForSheet } from './sheet-patient-name.js';

describe('formatPatientNameForSheet', () => {
  it('converte nome em maiúsculas para Title Case', () => {
    assert.equal(formatPatientNameForSheet('JOSE EDSON RODRIGUES'), 'Jose Edson Rodrigues');
    assert.equal(formatPatientNameForSheet('PACIENTE FIXTURE UM'), 'Paciente Fixture Um');
  });

  it('mantém partículas em minúsculas', () => {
    assert.equal(formatPatientNameForSheet('JOSE DA SILVA'), 'Jose da Silva');
    assert.equal(formatPatientNameForSheet('MARIA DE SOUZA DOS SANTOS'), 'Maria de Souza dos Santos');
    assert.equal(formatPatientNameForSheet('ANA DAS NEVES E SILVA'), 'Ana das Neves e Silva');
    assert.equal(formatPatientNameForSheet('JOAO DO NASCIMENTO'), 'Joao do Nascimento');
  });

  it('preserva acentos no Title Case', () => {
    assert.equal(formatPatientNameForSheet('ANTÔNIO CARLOS SILVA'), 'Antônio Carlos Silva');
    assert.equal(formatPatientNameForSheet('ÍNGRID SOUZA'), 'Íngrid Souza');
  });

  it('colapsa espaços extras e trata vazio', () => {
    assert.equal(formatPatientNameForSheet('  JOSE   DA   SILVA  '), 'Jose da Silva');
    assert.equal(formatPatientNameForSheet(''), '');
    assert.equal(formatPatientNameForSheet('   '), '');
    assert.equal(formatPatientNameForSheet(undefined), '');
    assert.equal(formatPatientNameForSheet(null), '');
  });
});
