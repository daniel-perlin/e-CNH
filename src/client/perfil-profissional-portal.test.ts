import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  htmlContemMarcadorAutenticado,
  parsePerfilProfissionalId,
  resolverPerfilNoHtml
} from './perfil-profissional-portal.js';

const fixturesDirectory = join(process.cwd(), 'fixtures/portal');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDirectory, name), 'utf8');
}

describe('perfil-profissional-portal', () => {
  it('resolve psicólogo pela fixture autenticada', () => {
    const html = loadFixture('autenticado-psicologo.html');
    const perfil = resolverPerfilNoHtml(html);
    assert.equal(perfil?.id, 'psicologo');
    assert.equal(perfil?.methodConsultarAgenda, 'consultarAgendaPsicologo');
    assert.equal(htmlContemMarcadorAutenticado(html), true);
  });

  it('resolve médico pela fixture autenticada', () => {
    const html = loadFixture('autenticado-medico.html');
    const perfil = resolverPerfilNoHtml(html);
    assert.equal(perfil?.id, 'medico');
    assert.equal(perfil?.methodConsultarAgenda, 'consultarAgendaMedico');
    assert.equal(htmlContemMarcadorAutenticado(html), true);
  });

  it('prefere psicólogo quando ambos os marcadores existem', () => {
    const html = `${loadFixture('autenticado-psicologo.html')}\n${loadFixture('autenticado-medico.html')}`;
    assert.equal(resolverPerfilNoHtml(html)?.id, 'psicologo');
  });

  it('não resolve perfil em fixtures de login ou escolha de unidade', () => {
    assert.equal(resolverPerfilNoHtml(loadFixture('login-form.html')), undefined);
    assert.equal(
      resolverPerfilNoHtml(loadFixture('pos-autenticar-open-dialog-choice.html')),
      undefined
    );
    assert.equal(
      resolverPerfilNoHtml(loadFixture('open-choice-unidades.html')),
      undefined
    );
    assert.equal(htmlContemMarcadorAutenticado(loadFixture('login-form.html')), false);
  });

  it('parseia PROFILE/ROLE com e sem acento', () => {
    assert.equal(parsePerfilProfissionalId('psicologo'), 'psicologo');
    assert.equal(parsePerfilProfissionalId('Psicologo'), 'psicologo');
    assert.equal(parsePerfilProfissionalId('Médico'), 'medico');
    assert.equal(parsePerfilProfissionalId('medico'), 'medico');
    assert.equal(parsePerfilProfissionalId(''), undefined);
    assert.equal(parsePerfilProfissionalId('outro'), undefined);
  });
});
