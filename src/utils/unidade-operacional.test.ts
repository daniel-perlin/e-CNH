import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  listarClinicasMapeadas,
  normalizarChaveClinica,
  resolveNomeUnidadeOperacional
} from './unidade-operacional.js';

describe('normalizarChaveClinica', () => {
  it('remove acentos, barras e unifica espaços/capitalização', () => {
    assert.equal(
      normalizarChaveClinica(' TALENTO LIMÃO/ZONA NORTE '),
      'talento limao zona norte'
    );
    assert.equal(
      normalizarChaveClinica('Capão-Redondo/Zona Sul'),
      'capao redondo zona sul'
    );
  });
});

describe('resolveNomeUnidadeOperacional', () => {
  it('traduz as clínicas canônicas para nomes operacionais', () => {
    assert.equal(resolveNomeUnidadeOperacional('Talento Limão/Zona Norte'), 'LIMÃO');
    assert.equal(resolveNomeUnidadeOperacional('Capão Redondo/Zona Sul'), 'CAPÃO REDONDO');
    assert.equal(resolveNomeUnidadeOperacional('Clínica Carrão/Zona Leste'), 'VILA CARRÃO');
  });

  it('aceita variações naturais de Talento Limão', () => {
    for (const variante of [
      'Talento Limão/Zona Norte',
      'Talento Limao Zona Norte',
      'talento limao zona norte',
      ' TALENTO LIMÃO/ZONA NORTE '
    ]) {
      assert.equal(resolveNomeUnidadeOperacional(variante), 'LIMÃO', variante);
    }
  });

  it('aceita variações naturais de Capão Redondo', () => {
    for (const variante of [
      'Capão Redondo/Zona Sul',
      'Capao Redondo Zona Sul',
      'CAPAO REDONDO ZONA SUL'
    ]) {
      assert.equal(resolveNomeUnidadeOperacional(variante), 'CAPÃO REDONDO', variante);
    }
  });

  it('aceita variações naturais de Clínica Carrão', () => {
    for (const variante of [
      'Clínica Carrão/Zona Leste',
      'Clinica Carrao Zona Leste',
      'clinica carrao zona leste'
    ]) {
      assert.equal(resolveNomeUnidadeOperacional(variante), 'VILA CARRÃO', variante);
    }
  });

  it('rejeita clínica vazia ou desconhecida após normalização', () => {
    assert.throws(() => resolveNomeUnidadeOperacional(''), /CLINIC vazio/);
    assert.throws(() => resolveNomeUnidadeOperacional('   '), /CLINIC vazio/);
    assert.throws(
      () => resolveNomeUnidadeOperacional('Unidade Desconhecida'),
      /não possui unidade operacional cadastrada/
    );
  });

  it('expõe a lista de clínicas mapeadas para extensão', () => {
    assert.ok(listarClinicasMapeadas().includes('Talento Limão/Zona Norte'));
    assert.equal(listarClinicasMapeadas().length, 3);
  });
});
