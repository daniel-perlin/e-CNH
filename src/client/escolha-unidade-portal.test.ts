import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  extrairAutenticadoCyberarkDeOpenDialogChoice,
  htmlContemFormularioEscolhaUnidade,
  htmlRequerEscolhaUnidade,
  parseOpcoesUnidadeTransito,
  resolverUnidadeConfigurada,
  unidadeDesejadaDefinida
} from './escolha-unidade-portal.js';

const fixturesDirectory = join(process.cwd(), 'fixtures/portal');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDirectory, name), 'utf8');
}

describe('escolha-unidade-portal', () => {
  it('detecta openDialogChoice na fixture pós-autenticar e ignora demais fixtures', () => {
    assert.equal(
      htmlRequerEscolhaUnidade(loadFixture('pos-autenticar-open-dialog-choice.html')),
      true
    );
    assert.equal(htmlRequerEscolhaUnidade(loadFixture('login-form.html')), false);
    assert.equal(htmlRequerEscolhaUnidade(loadFixture('open-choice-unidades.html')), false);
    assert.equal(htmlRequerEscolhaUnidade(loadFixture('autenticado-medico.html')), false);
    assert.equal(htmlRequerEscolhaUnidade(loadFixture('autenticado-psicologo.html')), false);
  });

  it('extrai autenticadoCyberark de openDialogChoice na fixture', () => {
    assert.equal(
      extrairAutenticadoCyberarkDeOpenDialogChoice(
        loadFixture('pos-autenticar-open-dialog-choice.html')
      ),
      'false'
    );
    assert.equal(
      extrairAutenticadoCyberarkDeOpenDialogChoice(`openDialogChoice("true", 'x', 'y');`),
      'true'
    );
    assert.equal(
      extrairAutenticadoCyberarkDeOpenDialogChoice(loadFixture('login-form.html')),
      'false'
    );
  });

  it('reconhece formulário openChoice na fixture de unidades', () => {
    assert.equal(
      htmlContemFormularioEscolhaUnidade(loadFixture('open-choice-unidades.html')),
      true
    );
    assert.equal(
      htmlContemFormularioEscolhaUnidade(
        loadFixture('pos-autenticar-open-dialog-choice.html')
      ),
      false
    );
    assert.equal(
      htmlContemFormularioEscolhaUnidade(loadFixture('login-form.html')),
      false
    );
  });

  it('parseia opções de idUnidTransito ignorando value vazio', () => {
    const opcoes = parseOpcoesUnidadeTransito(loadFixture('open-choice-unidades.html'));
    assert.deepEqual(opcoes, [
      { label: 'CIR-SAO PAULO', value: '18' },
      { label: 'POUPATEMPO CANINDE', value: '781' }
    ]);
  });

  it('resolve por label normalizado', () => {
    const opcoes = parseOpcoesUnidadeTransito(loadFixture('open-choice-unidades.html'));
    const ok = resolverUnidadeConfigurada(opcoes, { label: '  cir-sao paulo  ' });
    assert.equal(ok.status, 'ok');
    if (ok.status === 'ok') {
      assert.equal(ok.opcao.value, '18');
    }
  });

  it('resolve por id com precedência sobre label', () => {
    const opcoes = parseOpcoesUnidadeTransito(loadFixture('open-choice-unidades.html'));
    const ok = resolverUnidadeConfigurada(opcoes, {
      idUnidTransito: '781',
      label: 'CIR-SAO PAULO'
    });
    assert.equal(ok.status, 'ok');
    if (ok.status === 'ok') {
      assert.equal(ok.opcao.value, '781');
    }
  });

  it('falha sem config quando o diálogo exige unidade', () => {
    const opcoes = parseOpcoesUnidadeTransito(loadFixture('open-choice-unidades.html'));
    const erro = resolverUnidadeConfigurada(opcoes, undefined);
    assert.equal(erro.status, 'erro');
    if (erro.status === 'erro') {
      assert.match(erro.motivo, /UNIDADE\/UNID_TRANSITO/);
    }
    assert.equal(unidadeDesejadaDefinida(undefined), false);
    assert.equal(unidadeDesejadaDefinida({ label: 'CIR-SAO PAULO' }), true);
  });

  it('falha com unidade inexistente', () => {
    const opcoes = parseOpcoesUnidadeTransito(loadFixture('open-choice-unidades.html'));
    const porLabel = resolverUnidadeConfigurada(opcoes, { label: 'UNIDADE X' });
    assert.equal(porLabel.status, 'erro');
    const porId = resolverUnidadeConfigurada(opcoes, { idUnidTransito: '999' });
    assert.equal(porId.status, 'erro');
  });

  it('falha com formulário sem opções', () => {
    const erro = resolverUnidadeConfigurada([], { label: 'CIR-SAO PAULO' });
    assert.equal(erro.status, 'erro');
  });
});
