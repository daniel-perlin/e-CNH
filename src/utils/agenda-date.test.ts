import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isDataAgendamentoAtiva,
  obterDataCalendarioSaoPaulo,
  parseDataAgendamento
} from './agenda-date.js';

describe('parseDataAgendamento', () => {
  it('interpreta DD/MM/YYYY', () => {
    assert.deepEqual(parseDataAgendamento('20/07/2026'), {
      day: 20,
      month: 7,
      year: 2026
    });
  });

  it('rejeita formato inválido e data civil impossível', () => {
    assert.equal(parseDataAgendamento('2026-07-20'), undefined);
    assert.equal(parseDataAgendamento('31/02/2026'), undefined);
    assert.equal(parseDataAgendamento(''), undefined);
  });
});

describe('isDataAgendamentoAtiva', () => {
  // 20/07/2026 15:00 UTC = 12:00 em America/Sao_Paulo
  const hoje = new Date('2026-07-20T15:00:00.000Z');

  it('remove agendamento anterior a hoje', () => {
    assert.equal(isDataAgendamentoAtiva('19/07/2026', hoje), false);
  });

  it('mantém agendamento de hoje', () => {
    assert.equal(isDataAgendamentoAtiva('20/07/2026', hoje), true);
  });

  it('mantém agendamento futuro', () => {
    assert.equal(isDataAgendamentoAtiva('21/07/2026', hoje), true);
  });

  it('não compara como texto (ordem lexicográfica inválida)', () => {
    // Se fosse textual, "9/07/2026" vs "20/07/2026" seria ambíguo; usamos sempre DD/MM/YYYY.
    assert.equal(isDataAgendamentoAtiva('09/07/2026', hoje), false);
    assert.equal(isDataAgendamentoAtiva('30/06/2026', hoje), false);
  });
});

describe('obterDataCalendarioSaoPaulo', () => {
  it('respeita o fuso America/Sao_Paulo', () => {
    // 21/07/2026 02:00 UTC = 20/07/2026 23:00 em São Paulo
    assert.deepEqual(obterDataCalendarioSaoPaulo(new Date('2026-07-21T02:00:00.000Z')), {
      day: 20,
      month: 7,
      year: 2026
    });
  });
});
