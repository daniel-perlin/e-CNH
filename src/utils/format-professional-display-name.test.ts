import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatProfessionalDisplayName,
  rotuloTipoProfissional
} from './format-professional-display-name.js';

describe('formatProfessionalDisplayName', () => {
  it('formata psicólogo com primeiro e segundo nome em caixa alta', () => {
    assert.equal(
      formatProfessionalDisplayName('Gabriela Moura Gomes dos Santos', 'psicologo'),
      'Psicólogo: GABRIELA MOURA'
    );
    assert.equal(
      formatProfessionalDisplayName('Isis Isadora Moraes Soares', 'psicologo'),
      'Psicólogo: ISIS ISADORA'
    );
  });

  it('formata médico com acentos preservados', () => {
    assert.equal(
      formatProfessionalDisplayName('Italo Facella', 'medico'),
      'Médico: ITALO FACELLA'
    );
    assert.equal(
      formatProfessionalDisplayName('José Antônio Braga', 'medico'),
      'Médico: JOSÉ ANTÔNIO'
    );
  });

  it('usa os dois primeiros tokens quando há só dois nomes', () => {
    assert.equal(
      formatProfessionalDisplayName('Gabrielle Rayelle', 'psicologo'),
      'Psicólogo: GABRIELLE RAYELLE'
    );
  });

  it('usa apenas o primeiro token quando o nome tem um único elemento', () => {
    assert.equal(formatProfessionalDisplayName('Maria', 'psicologo'), 'Psicólogo: MARIA');
  });

  it('expõe rótulos de tipo sem heurística', () => {
    assert.equal(rotuloTipoProfissional('psicologo'), 'Psicólogo');
    assert.equal(rotuloTipoProfissional('medico'), 'Médico');
  });
});
