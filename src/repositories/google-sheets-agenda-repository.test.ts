import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Agenda } from '../models/agenda.js';

import { GoogleSheetsAgendaRepository } from './google-sheets-agenda-repository.js';
import { InMemoryGoogleSheetsValues } from './in-memory-google-sheets-values.js';

function agendaFixture(dataConsulta: string, horario: string, nome: string): Agenda {
  return {
    dataConsulta,
    itens: [
      {
        horario,
        paciente: { nome, cpf: '000.000.000-00' },
        categoria: 'B',
        tipoProcesso: 'Primeira Habilitação'
      }
    ]
  };
}

describe('GoogleSheetsAgendaRepository', () => {
  it('grava agenda e permite leitura pelo par data/profissional', async () => {
    const sheets = new InMemoryGoogleSheetsValues();
    const repository = new GoogleSheetsAgendaRepository({ sheets });

    const resultado = await repository.salvarAgenda(
      agendaFixture('13/07/2026', '08:00', 'PACIENTE A'),
      { profissional: 'Profissional Alpha' }
    );

    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.linhasGravadas, 1);
    assert.equal(resultado.linhasRemovidas, 0);

    const lida = await repository.listarPorData('13/07/2026', {
      profissional: 'Profissional Alpha'
    });
    assert.ok(lida);
    assert.equal(lida.itens.length, 1);
    assert.equal(lida.itens[0]?.paciente.nome, 'PACIENTE A');
  });

  it('substitui apenas linhas do mesmo dataConsulta e profissional', async () => {
    const sheets = new InMemoryGoogleSheetsValues();
    const repository = new GoogleSheetsAgendaRepository({ sheets });

    await repository.salvarAgenda(agendaFixture('13/07/2026', '08:00', 'PACIENTE ANTIGO'), {
      profissional: 'Profissional Alpha'
    });
    await repository.salvarAgenda(agendaFixture('13/07/2026', '09:00', 'PACIENTE BETA'), {
      profissional: 'Profissional Beta'
    });
    await repository.salvarAgenda(agendaFixture('14/07/2026', '10:00', 'PACIENTE OUTRO DIA'), {
      profissional: 'Profissional Alpha'
    });

    const substituicao = await repository.salvarAgenda(
      agendaFixture('13/07/2026', '11:00', 'PACIENTE NOVO'),
      { profissional: 'Profissional Alpha' }
    );

    assert.equal(substituicao.sucesso, true);
    assert.equal(substituicao.linhasRemovidas, 1);
    assert.equal(substituicao.linhasGravadas, 1);

    const alpha13 = await repository.listarPorData('13/07/2026', {
      profissional: 'Profissional Alpha'
    });
    assert.equal(alpha13?.itens[0]?.paciente.nome, 'PACIENTE NOVO');
    assert.equal(alpha13?.itens[0]?.horario, '11:00');

    const beta13 = await repository.listarPorData('13/07/2026', {
      profissional: 'Profissional Beta'
    });
    assert.equal(beta13?.itens[0]?.paciente.nome, 'PACIENTE BETA');

    const alpha14 = await repository.listarPorData('14/07/2026', {
      profissional: 'Profissional Alpha'
    });
    assert.equal(alpha14?.itens[0]?.paciente.nome, 'PACIENTE OUTRO DIA');
  });

  it('agenda vazia remove linhas do par data/profissional', async () => {
    const sheets = new InMemoryGoogleSheetsValues();
    const repository = new GoogleSheetsAgendaRepository({ sheets });

    await repository.salvarAgenda(agendaFixture('13/07/2026', '08:00', 'PACIENTE A'), {
      profissional: 'Profissional Alpha'
    });

    const resultado = await repository.salvarAgenda(
      { dataConsulta: '13/07/2026', itens: [] },
      { profissional: 'Profissional Alpha' }
    );

    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.linhasGravadas, 0);
    assert.equal(resultado.linhasRemovidas, 1);

    const lida = await repository.listarPorData('13/07/2026', {
      profissional: 'Profissional Alpha'
    });
    assert.equal(lida, null);
  });

  it('rejeita contexto sem profissional e agenda sem data', async () => {
    const sheets = new InMemoryGoogleSheetsValues();
    const repository = new GoogleSheetsAgendaRepository({ sheets });

    const semProfissional = await repository.salvarAgenda(
      agendaFixture('13/07/2026', '08:00', 'PACIENTE A'),
      { profissional: '   ' }
    );
    assert.equal(semProfissional.sucesso, false);
    assert.equal(semProfissional.motivoFalha, 'contexto-incompleto');

    const semData = await repository.salvarAgenda(
      { itens: [{ paciente: { nome: 'X' } }] },
      { profissional: 'Profissional Alpha' }
    );
    assert.equal(semData.sucesso, false);
    assert.equal(semData.motivoFalha, 'data-consulta-ausente');
  });
});
