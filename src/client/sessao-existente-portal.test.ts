import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  extrairAutenticadoCyberarkDeOpenDialogNewSession,
  htmlRequerEncerramentoSessaoExistente
} from './sessao-existente-portal.js';

const fixturesDirectory = join(process.cwd(), 'fixtures/portal');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDirectory, name), 'utf8');
}

describe('sessao-existente-portal', () => {
  it('detecta openDialogNewSession na fixture pós-autenticar e ignora demais fixtures', () => {
    assert.equal(
      htmlRequerEncerramentoSessaoExistente(
        loadFixture('pos-autenticar-open-dialog-new-session.html')
      ),
      true
    );
    assert.equal(htmlRequerEncerramentoSessaoExistente(loadFixture('login-form.html')), false);
    assert.equal(
      htmlRequerEncerramentoSessaoExistente(
        loadFixture('pos-autenticar-open-dialog-choice.html')
      ),
      false
    );
    assert.equal(
      htmlRequerEncerramentoSessaoExistente(loadFixture('open-choice-unidades.html')),
      false
    );
    assert.equal(
      htmlRequerEncerramentoSessaoExistente(loadFixture('autenticado-medico.html')),
      false
    );
    assert.equal(
      htmlRequerEncerramentoSessaoExistente(loadFixture('autenticado-psicologo.html')),
      false
    );
  });

  it('extrai autenticadoCyberark do terceiro argumento de openDialogNewSession', () => {
    assert.equal(
      extrairAutenticadoCyberarkDeOpenDialogNewSession(
        loadFixture('pos-autenticar-open-dialog-new-session.html')
      ),
      'false'
    );
    assert.equal(
      extrairAutenticadoCyberarkDeOpenDialogNewSession(
        `openDialogNewSession('x', 'y', 'true');`
      ),
      'true'
    );
    assert.equal(extrairAutenticadoCyberarkDeOpenDialogNewSession('<html></html>'), 'false');
  });
});
