import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Agenda } from '../models/agenda.js';

import { GoogleSheetsAgendaRepository } from './google-sheets-agenda-repository.js';
import { InMemoryGoogleSheetsValues } from './in-memory-google-sheets-values.js';

/** 20/07/2026 15:00 UTC = 12:00 em America/Sao_Paulo. */
const HOJE_FIXO = new Date('2026-07-20T15:00:00.000Z');

function agendaFixture(
  dataConsulta: string,
  horario: string,
  nome: string,
  cpf: string
): Agenda {
  return {
    dataConsulta,
    itens: [
      {
        horario,
        paciente: { nome, cpf },
        categoria: 'B',
        tipoProcesso: 'Primeira Habilitação'
      }
    ]
  };
}

function criarRepositorio(sheets = new InMemoryGoogleSheetsValues()) {
  return {
    sheets,
    repository: new GoogleSheetsAgendaRepository({ sheets, agora: HOJE_FIXO })
  };
}

describe('GoogleSheetsAgendaRepository', () => {
  it('agendamento anterior a hoje é removido', async () => {
    const { sheets, repository } = criarRepositorio();

    await sheets.updateValues("'Agenda'!A:L", [
      [
        'Profissional',
        'Data de Agendamento',
        'Hora',
        'CPF',
        'Nome',
        'Telefone',
        'E-mail',
        'Tipo de Processo',
        'Categoria',
        'Status do Exame Médico',
        'Status do Exame Psicológico',
        'Data de inclusão'
      ],
      [
        'Profissional Alpha',
        '19/07/2026',
        '08:00',
        '000.000.000-00',
        'PACIENTE PASSADO',
        '',
        '',
        '',
        'B',
        '',
        '',
        '19/07/2026 10:00'
      ]
    ]);

    const resultado = await repository.salvarAgenda(
      { dataConsulta: '21/07/2026', itens: [] },
      { profissional: 'Profissional Alpha' }
    );

    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.linhasRemovidas, 1);
    const matriz = await sheets.getValues("'Agenda'!A:L");
    assert.equal(matriz.length, 1);
  });

  it('agendamento de hoje é mantido', async () => {
    const { sheets, repository } = criarRepositorio();

    const resultado = await repository.salvarAgenda(
      agendaFixture('20/07/2026', '08:00', 'PACIENTE HOJE', '111.111.111-11'),
      { profissional: 'Profissional Alpha' }
    );

    assert.equal(resultado.linhasGravadas, 1);
    const matriz = await sheets.getValues("'Agenda'!A:L");
    assert.equal(matriz.length, 2);
    assert.equal(matriz[1]?.[1], '20/07/2026');
  });

  it('agendamento futuro é mantido', async () => {
    const { sheets, repository } = criarRepositorio();

    const resultado = await repository.salvarAgenda(
      agendaFixture('21/07/2026', '09:00', 'PACIENTE FUTURO', '222.222.222-22'),
      { profissional: 'Profissional Alpha' }
    );

    assert.equal(resultado.linhasGravadas, 1);
    const matriz = await sheets.getValues("'Agenda'!A:L");
    assert.equal(matriz[1]?.[1], '21/07/2026');
  });

  it('paciente removido e retornando meses depois recebe nova linha e nova Data de inclusão', async () => {
    const sheets = new InMemoryGoogleSheetsValues();
    const repositoryJulho = new GoogleSheetsAgendaRepository({
      sheets,
      agora: new Date('2026-07-20T15:00:00.000Z')
    });

    await repositoryJulho.salvarAgenda(
      agendaFixture('20/07/2026', '08:00', 'PACIENTE RECORRENTE', '333.333.333-33'),
      { profissional: 'Profissional Alpha' }
    );
    const matrizJulho = await sheets.getValues("'Agenda'!A:L");
    const dataInclusaoOriginal = matrizJulho[1]?.[11];
    assert.ok(dataInclusaoOriginal);

    // Avança o calendário: agendamento antigo fica no passado e é removido
    const repositoryOutubro = new GoogleSheetsAgendaRepository({
      sheets,
      agora: new Date('2026-10-01T15:00:00.000Z')
    });
    const limpeza = await repositoryOutubro.salvarAgenda(
      { dataConsulta: '05/10/2026', itens: [] },
      { profissional: 'Profissional Alpha' }
    );
    assert.equal(limpeza.linhasRemovidas, 1);

    const reinclusao = await repositoryOutubro.salvarAgenda(
      agendaFixture('05/10/2026', '10:00', 'PACIENTE RECORRENTE', '333.333.333-33'),
      { profissional: 'Profissional Alpha' }
    );
    assert.equal(reinclusao.linhasGravadas, 1);

    const matriz = await sheets.getValues("'Agenda'!A:L");
    assert.equal(matriz.length, 2);
    assert.equal(matriz[1]?.[1], '05/10/2026');
    assert.notEqual(matriz[1]?.[11], dataInclusaoOriginal);
    assert.match(matriz[1]?.[11] ?? '', /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });

  it('CPF impede duplicidade enquanto o paciente permanece ativo', async () => {
    const { sheets, repository } = criarRepositorio();

    await repository.salvarAgenda(
      agendaFixture('20/07/2026', '08:00', 'PACIENTE ORIGINAL', '000.000.000-00'),
      { profissional: 'Profissional Alpha' }
    );
    const matrizInicial = await sheets.getValues("'Agenda'!A:L");
    const dataInclusao = matrizInicial[1]?.[11];

    const segunda = await repository.salvarAgenda(
      agendaFixture('25/07/2026', '11:00', 'PACIENTE RENOMEADO', '00000000000'),
      { profissional: 'Profissional Beta' }
    );

    assert.equal(segunda.linhasGravadas, 0);
    const matriz = await sheets.getValues("'Agenda'!A:L");
    assert.equal(matriz.length, 2);
    assert.equal(matriz[1]?.[4], 'PACIENTE ORIGINAL');
    assert.equal(matriz[1]?.[11], dataInclusao);
  });

  it('pacientes diferentes continuam sendo inseridos normalmente', async () => {
    const { sheets, repository } = criarRepositorio();

    await repository.salvarAgenda(
      agendaFixture('20/07/2026', '08:00', 'PACIENTE A', '000.000.000-00'),
      { profissional: 'Profissional Alpha' }
    );
    const segundo = await repository.salvarAgenda(
      agendaFixture('21/07/2026', '09:00', 'PACIENTE B', '111.111.111-11'),
      { profissional: 'Profissional Alpha' }
    );

    assert.equal(segundo.linhasGravadas, 1);
    const matriz = await sheets.getValues("'Agenda'!A:L");
    assert.equal(matriz.length, 3);
  });

  it('não grava agendamento passado vindo do portal', async () => {
    const { sheets, repository } = criarRepositorio();

    const resultado = await repository.salvarAgenda(
      agendaFixture('19/07/2026', '08:00', 'PACIENTE PASSADO', '000.000.000-00'),
      { profissional: 'Profissional Alpha' }
    );

    assert.equal(resultado.linhasGravadas, 0);
    const matriz = await sheets.getValues("'Agenda'!A:L");
    assert.equal(matriz.length, 1);
  });

  it('rejeita contexto sem profissional e agenda sem data', async () => {
    const { repository } = criarRepositorio();

    const semProfissional = await repository.salvarAgenda(
      agendaFixture('20/07/2026', '08:00', 'PACIENTE A', '000.000.000-00'),
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
