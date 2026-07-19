import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  htmlContemMarcadorAutenticado,
  parsePerfilProfissionalId,
  perfilMedico,
  perfilPsicologo,
  resolverPerfilNoHtml
} from './perfil-profissional-portal.js';

describe('perfil-profissional-portal', () => {
  it('resolve psicólogo pelo marcador histórico', () => {
    const html = `<h1>${perfilPsicologo.marcadorAutenticado}</h1>`;
    const perfil = resolverPerfilNoHtml(html);
    assert.equal(perfil?.id, 'psicologo');
    assert.equal(perfil?.methodConsultarAgenda, 'consultarAgendaPsicologo');
  });

  it('resolve médico pelo marcador homologado', () => {
    const html = `<title>${perfilMedico.marcadorAutenticado}</title>`;
    const perfil = resolverPerfilNoHtml(html);
    assert.equal(perfil?.id, 'medico');
    assert.equal(perfil?.methodConsultarAgenda, 'consultarAgendaMedico');
  });

  it('prefere psicólogo quando ambos os marcadores existem', () => {
    const html = `${perfilPsicologo.marcadorAutenticado} ${perfilMedico.marcadorAutenticado}`;
    assert.equal(resolverPerfilNoHtml(html)?.id, 'psicologo');
  });

  it('retorna undefined sem marcador conhecido', () => {
    assert.equal(resolverPerfilNoHtml('<html>login</html>'), undefined);
    assert.equal(htmlContemMarcadorAutenticado('<html>login</html>'), false);
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
