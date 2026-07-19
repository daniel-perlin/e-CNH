import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  listarClinicasMapeadas,
  resolveNomeUnidadeOperacional
} from './unidade-operacional.js';

describe('resolveNomeUnidadeOperacional', () => {
  it('traduz as clínicas conhecidas para nomes operacionais', () => {
    assert.equal(resolveNomeUnidadeOperacional('Talento Limão/Zona Norte'), 'LIMÃO');
    assert.equal(resolveNomeUnidadeOperacional('Capão Redondo/Zona Sul'), 'CAPÃO REDONDO');
    assert.equal(resolveNomeUnidadeOperacional('Clínica Carrão/Zona Leste'), 'VILA CARRÃO');
  });

  it('aceita variação de espaços e capitalização', () => {
    assert.equal(
      resolveNomeUnidadeOperacional('  talento limão/zona norte  '),
      'LIMÃO'
    );
  });

  it('rejeita clínica vazia ou desconhecida', () => {
    assert.throws(() => resolveNomeUnidadeOperacional(''), /CLINIC vazio/);
    assert.throws(() => resolveNomeUnidadeOperacional('   '), /CLINIC vazio/);
    assert.throws(
      () => resolveNomeUnidadeOperacional('Unidade Desconhecida'),
      /sem mapeamento operacional/
    );
  });

  it('expõe a lista de clínicas mapeadas para extensão', () => {
    assert.ok(listarClinicasMapeadas().includes('Talento Limão/Zona Norte'));
    assert.equal(listarClinicasMapeadas().length, 3);
  });
});
