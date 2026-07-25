import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CABECALHOS_ABA_AGENDA,
  CABECALHOS_ABA_AGENDA_OFICIAL_V8,
  indiceCabecalhoAgenda,
  INDICE_COLUNA_TECNICA_CPF,
  normalizeTextoCabecalho,
  resolverAliasCabecalho,
  resolverIndiceColunaTecnicaCpf
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

  it('reconhece Tipo de Processo e Categoria', () => {
    assert.equal(resolverAliasCabecalho('Tipo de Processo'), 'Tipo de Processo');
    assert.equal(resolverAliasCabecalho('Categoria'), 'Categoria');
  });
});

describe('índices derivados do layout oficial', () => {
  it('deriva índices e CPF técnico do canônico atual', () => {
    assert.equal(CABECALHOS_ABA_AGENDA.length, 10);
    assert.equal(CABECALHOS_ABA_AGENDA_OFICIAL_V8.length, 8);
    assert.equal(indiceCabecalhoAgenda('EMAIL'), 5);
    assert.equal(indiceCabecalhoAgenda('Tipo de Processo'), 6);
    assert.equal(indiceCabecalhoAgenda('Categoria'), 7);
    assert.equal(indiceCabecalhoAgenda('PROFISSIONAL'), 8);
    assert.equal(INDICE_COLUNA_TECNICA_CPF, 10);
  });

  it('resolve CPF técnico conforme layout lido (V8 vs canônico)', () => {
    assert.equal(resolverIndiceColunaTecnicaCpf([...CABECALHOS_ABA_AGENDA_OFICIAL_V8]), 8);
    assert.equal(
      resolverIndiceColunaTecnicaCpf([
        'UNIDADE',
        'AGENDAMENTO\nDO DETRAN',
        'HORÁRIO',
        'PACIENTE',
        'TELEFONE',
        'EMAIL',
        'PROFISSIONAL',
        'DATA DE INCLUSÃO'
      ]),
      8
    );
    assert.equal(resolverIndiceColunaTecnicaCpf([...CABECALHOS_ABA_AGENDA]), 10);
    assert.equal(resolverIndiceColunaTecnicaCpf(undefined), 10);
  });
});
