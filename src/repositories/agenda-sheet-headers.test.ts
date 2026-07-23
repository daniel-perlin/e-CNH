import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  normalizeTextoCabecalho,
  resolverAliasCabecalho
} from './agenda-sheet-headers.js';

describe('normalizeTextoCabecalho', () => {
  it('colapsa quebras de linha e espaços múltiplos', () => {
    assert.equal(
      normalizeTextoCabecalho('AGENDAMENTO\nDO DETRAN'),
      'AGENDAMENTO DO DETRAN'
    );
    assert.equal(
      normalizeTextoCabecalho('AGENDAMENTO \r\n  DO\tDETRAN  '),
      'AGENDAMENTO DO DETRAN'
    );
  });
});

describe('resolverAliasCabecalho', () => {
  it('reconhece título oficial com formatação de whitespace', () => {
    assert.equal(
      resolverAliasCabecalho('AGENDAMENTO\nDO DETRAN'),
      'AGENDAMENTO DO DETRAN'
    );
    assert.equal(resolverAliasCabecalho('  Data de Agendamento  '), 'AGENDAMENTO DO DETRAN');
  });
});
