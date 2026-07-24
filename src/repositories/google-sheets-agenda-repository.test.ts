import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Agenda } from '../models/agenda.js';

import { GoogleSheetsAgendaRepository } from './google-sheets-agenda-repository.js';
import { InMemoryGoogleSheetsValues } from './in-memory-google-sheets-values.js';

/** 20/07/2026 15:00 UTC = 12:00 em America/Sao_Paulo. */
const HOJE_FIXO = new Date('2026-07-20T15:00:00.000Z');

/** Índices do layout oficial (CABECALHOS_ABA_AGENDA). */
const COL = {
  unidade: 0,
  dataAgendamento: 1,
  paciente: 3,
  profissional: 6,
  dataInclusao: 7
} as const;

const RANGE_LEITURA = "'Agenda'!A:Z";

function agendaFixture(
  dataConsulta: string,
  horario: string,
  nome: string,
  cpf: string,
  telefone = ''
): Agenda {
  return {
    dataConsulta,
    itens: [
      {
        horario,
        paciente: { nome, cpf, ...(telefone.length > 0 ? { telefone } : {}) },
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

    await sheets.updateValues(RANGE_LEITURA, [
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
      { profissional: 'Profissional Alpha', unidadeOperacional: 'LIMÃO', perfilId: 'psicologo' }
    );

    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.linhasRemovidas, 1);
    const matriz = await sheets.getValues(RANGE_LEITURA);
    assert.equal(matriz.length, 1);
    assert.deepEqual(matriz[0], [
      'UNIDADE',
      'AGENDAMENTO DO DETRAN',
      'HORÁRIO',
      'PACIENTE',
      'TELEFONE',
      'EMAIL',
      'PROFISSIONAL',
      'DATA DE INCLUSÃO'
    ]);
  });

  it('agendamento de hoje é removido', async () => {
    const { sheets, repository } = criarRepositorio();

    const resultado = await repository.salvarAgenda(
      agendaFixture('20/07/2026', '08:00', 'PACIENTE HOJE', '111.111.111-11'),
      { profissional: 'Profissional Alpha', unidadeOperacional: 'LIMÃO', perfilId: 'psicologo' }
    );

    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.linhasGravadas, 0);
    const matriz = await sheets.getValues(RANGE_LEITURA);
    // Apenas cabeçalho (ou planilha vazia se nunca houve escrita)
    assert.ok(matriz.length <= 1);
  });

  it('agendamento futuro é mantido', async () => {
    const { sheets, repository } = criarRepositorio();

    const resultado = await repository.salvarAgenda(
      agendaFixture('21/07/2026', '09:00', 'PACIENTE FUTURO', '222.222.222-22'),
      { profissional: 'Profissional Alpha', unidadeOperacional: 'LIMÃO', perfilId: 'psicologo' }
    );

    assert.equal(resultado.linhasGravadas, 1);
    const matriz = await sheets.getValues(RANGE_LEITURA);
    assert.equal(matriz[1]?.[COL.dataAgendamento], '21/07/2026');
  });

  it('paciente removido e retornando meses depois recebe nova linha e nova DATA DE INCLUSÃO', async () => {
    const sheets = new InMemoryGoogleSheetsValues();
    const repositoryJulho = new GoogleSheetsAgendaRepository({
      sheets,
      agora: new Date('2026-07-20T15:00:00.000Z')
    });

    await repositoryJulho.salvarAgenda(
      agendaFixture('21/07/2026', '08:00', 'PACIENTE RECORRENTE', '333.333.333-33'),
      { profissional: 'Profissional Alpha', unidadeOperacional: 'LIMÃO', perfilId: 'psicologo' }
    );
    const matrizJulho = await sheets.getValues(RANGE_LEITURA);
    const dataInclusaoOriginal = matrizJulho[1]?.[COL.dataInclusao];
    assert.ok(dataInclusaoOriginal);

    const repositoryOutubro = new GoogleSheetsAgendaRepository({
      sheets,
      agora: new Date('2026-10-01T15:00:00.000Z')
    });
    const limpeza = await repositoryOutubro.salvarAgenda(
      { dataConsulta: '05/10/2026', itens: [] },
      { profissional: 'Profissional Alpha', unidadeOperacional: 'LIMÃO', perfilId: 'psicologo' }
    );
    assert.equal(limpeza.linhasRemovidas, 1);

    const reinclusao = await repositoryOutubro.salvarAgenda(
      agendaFixture('05/10/2026', '10:00', 'PACIENTE RECORRENTE', '333.333.333-33'),
      { profissional: 'Profissional Alpha', unidadeOperacional: 'LIMÃO', perfilId: 'psicologo' }
    );
    assert.equal(reinclusao.linhasGravadas, 1);

    const matriz = await sheets.getValues(RANGE_LEITURA);
    assert.equal(matriz.length, 2);
    assert.equal(matriz[1]?.[COL.dataAgendamento], '05/10/2026');
    assert.notEqual(matriz[1]?.[COL.dataInclusao], dataInclusaoOriginal);
    assert.match(matriz[1]?.[COL.dataInclusao] ?? '', /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });

  it('CPF legado na planilha impede duplicidade enquanto o paciente permanece ativo', async () => {
    const { sheets, repository } = criarRepositorio();

    await sheets.updateValues(RANGE_LEITURA, [
      [
        'Profissional',
        'Unidade',
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
        'LIMÃO',
        '25/07/2026',
        '08:00',
        '000.000.000-00',
        'PACIENTE ORIGINAL',
        '',
        '',
        '',
        'B',
        '',
        '',
        '19/07/2026 10:00'
      ]
    ]);

    const segunda = await repository.salvarAgenda(
      agendaFixture('25/07/2026', '11:00', 'PACIENTE RENOMEADO', '00000000000'),
      { profissional: 'Profissional Beta', unidadeOperacional: 'CAPÃO REDONDO', perfilId: 'psicologo' }
    );

    assert.equal(segunda.linhasGravadas, 0);
    const matriz = await sheets.getValues(RANGE_LEITURA);
    assert.equal(matriz.length, 2);
    assert.equal(matriz[0]?.[COL.unidade], 'UNIDADE');
    assert.equal(matriz[1]?.[COL.paciente], 'Paciente');
    assert.equal(matriz[1]?.[COL.unidade], 'LIMÃO');
  });

  it('CPF impede duplicidade enquanto o paciente permanece ativo (projeção sem coluna CPF)', async () => {
    const { sheets, repository } = criarRepositorio();

    await repository.salvarAgenda(
      agendaFixture('21/07/2026', '08:00', 'PACIENTE ORIGINAL', '000.000.000-00'),
      { profissional: 'Profissional Alpha', unidadeOperacional: 'LIMÃO', perfilId: 'psicologo' }
    );
    const matrizInicial = await sheets.getValues(RANGE_LEITURA);
    const dataInclusao = matrizInicial[1]?.[COL.dataInclusao];
    assert.equal(matrizInicial[0]?.length, 8);
    assert.equal(matrizInicial[1]?.[COL.paciente], 'Paciente');
    assert.equal(matrizInicial[1]?.[COL.profissional], 'Psicólogo: PROFISSIONAL ALPHA');
    // CPF técnico fora do contrato visual (coluna após as 8 oficiais)
    assert.equal(matrizInicial[1]?.[8], '000.000.000-00');

    const segunda = await repository.salvarAgenda(
      agendaFixture('25/07/2026', '11:00', 'PACIENTE RENOMEADO', '00000000000'),
      { profissional: 'Profissional Beta', unidadeOperacional: 'CAPÃO REDONDO', perfilId: 'psicologo' }
    );

    assert.equal(segunda.linhasGravadas, 0);
    const matriz = await sheets.getValues(RANGE_LEITURA);
    assert.equal(matriz.length, 2);
    assert.equal(matriz[1]?.[COL.paciente], 'Paciente');
    assert.equal(matriz[1]?.[COL.unidade], 'LIMÃO');
    assert.equal(matriz[1]?.[COL.dataInclusao], dataInclusao);
  });

  it('preenche UNIDADE em paciente já ativo quando a coluna estava vazia (legado)', async () => {
    const { sheets, repository } = criarRepositorio();

    await sheets.updateValues(RANGE_LEITURA, [
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
        '25/07/2026',
        '08:00',
        '000.000.000-00',
        'PACIENTE LEGADO',
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
      agendaFixture('25/07/2026', '09:00', 'PACIENTE LEGADO', '000.000.000-00'),
      { profissional: 'Profissional Alpha', unidadeOperacional: 'LIMÃO', perfilId: 'psicologo' }
    );

    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.linhasGravadas, 0);
    const matriz = await sheets.getValues(RANGE_LEITURA);
    assert.equal(matriz[0]?.[COL.unidade], 'UNIDADE');
    assert.equal(matriz[1]?.[COL.unidade], 'LIMÃO');
    assert.equal(matriz[1]?.[COL.paciente], 'Paciente');
  });

  it('pacientes diferentes continuam sendo inseridos normalmente', async () => {
    const { sheets, repository } = criarRepositorio();

    await repository.salvarAgenda(
      agendaFixture('22/07/2026', '08:00', 'PACIENTE A', '000.000.000-00'),
      { profissional: 'Profissional Alpha', unidadeOperacional: 'LIMÃO', perfilId: 'psicologo' }
    );
    const segundo = await repository.salvarAgenda(
      agendaFixture('21/07/2026', '09:00', 'PACIENTE B', '111.111.111-11'),
      { profissional: 'Profissional Alpha', unidadeOperacional: 'LIMÃO', perfilId: 'psicologo' }
    );

    assert.equal(segundo.linhasGravadas, 1);
    const matriz = await sheets.getValues(RANGE_LEITURA);
    assert.equal(matriz.length, 3);
  });

  it('não grava agendamento passado vindo do portal', async () => {
    const { sheets, repository } = criarRepositorio();

    const resultado = await repository.salvarAgenda(
      agendaFixture('19/07/2026', '08:00', 'PACIENTE PASSADO', '000.000.000-00'),
      { profissional: 'Profissional Alpha', unidadeOperacional: 'LIMÃO', perfilId: 'psicologo' }
    );

    assert.equal(resultado.linhasGravadas, 0);
    const matriz = await sheets.getValues(RANGE_LEITURA);
    assert.equal(matriz.length, 1);
  });

  it('rejeita contexto sem profissional, sem unidade ou agenda sem data', async () => {
    const { repository } = criarRepositorio();

    const semProfissional = await repository.salvarAgenda(
      agendaFixture('20/07/2026', '08:00', 'PACIENTE A', '000.000.000-00'),
      { profissional: '   ', unidadeOperacional: 'LIMÃO', perfilId: 'psicologo' }
    );
    assert.equal(semProfissional.sucesso, false);
    assert.equal(semProfissional.motivoFalha, 'contexto-incompleto');

    const semUnidade = await repository.salvarAgenda(
      agendaFixture('20/07/2026', '08:00', 'PACIENTE A', '000.000.000-00'),
      { profissional: 'Profissional Alpha', unidadeOperacional: '   ', perfilId: 'psicologo' }
    );
    assert.equal(semUnidade.sucesso, false);
    assert.equal(semUnidade.motivoFalha, 'contexto-incompleto');

    const semData = await repository.salvarAgenda(
      { itens: [{ paciente: { nome: 'X' } }] },
      { profissional: 'Profissional Alpha', unidadeOperacional: 'LIMÃO', perfilId: 'psicologo' }
    );
    assert.equal(semData.sucesso, false);
    assert.equal(semData.motivoFalha, 'data-consulta-ausente');
  });

  it('aceita cabeçalho oficial com quebra de linha e espaços extras no título', async () => {
    const { sheets, repository } = criarRepositorio();

    await sheets.updateValues(RANGE_LEITURA, [
      [
        'UNIDADE',
        'AGENDAMENTO\nDO DETRAN',
        'HORÁRIO',
        'PACIENTE',
        'TELEFONE',
        'EMAIL',
        'PROFISSIONAL',
        'DATA DE INCLUSÃO'
      ]
    ]);

    const resultado = await repository.salvarAgenda(
      agendaFixture('21/07/2026', '08:00', 'PACIENTE WRAP', '444.444.444-44'),
      { profissional: 'Profissional Alpha', unidadeOperacional: 'LIMÃO', perfilId: 'psicologo' }
    );

    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.linhasGravadas, 1);
    const matriz = await sheets.getValues(RANGE_LEITURA);
    assert.equal(matriz[0]?.[COL.dataAgendamento], 'AGENDAMENTO DO DETRAN');
    assert.equal(matriz[1]?.[COL.dataAgendamento], '21/07/2026');
  });

  it('registra diagnóstico ao rejeitar cabeçalho semanticamente incompatível', async () => {
    const warnings: object[] = [];
    const sheets = new InMemoryGoogleSheetsValues();
    const repository = new GoogleSheetsAgendaRepository({
      sheets,
      agora: HOJE_FIXO,
      logger: {
        debug: () => undefined,
        info: () => undefined,
        error: () => undefined,
        warn: (bindings: object) => {
          warnings.push(bindings);
        }
      }
    });

    await sheets.updateValues(RANGE_LEITURA, [
      [
        'UNIDADE',
        'COLUNA ERRADA',
        'HORÁRIO',
        'PACIENTE',
        'TELEFONE',
        'EMAIL',
        'PROFISSIONAL',
        'DATA DE INCLUSÃO'
      ]
    ]);

    const resultado = await repository.salvarAgenda(
      agendaFixture('21/07/2026', '08:00', 'PACIENTE X', '555.555.555-55'),
      { profissional: 'Profissional Alpha', unidadeOperacional: 'LIMÃO', perfilId: 'psicologo' }
    );

    assert.equal(resultado.sucesso, false);
    assert.equal(resultado.motivoFalha, 'cabecalho-incompativel');
    const diagnostico = warnings.find(
      (item) => (item as { event?: string }).event === 'agenda.sheets.cabecalho_incompativel'
    ) as
      | {
          event: string;
          cabecalhoEsperado: string[];
          cabecalhoEncontrado: string[];
          colunaDivergente: { indice: number; esperado: string; encontrado: string };
        }
      | undefined;
    assert.ok(diagnostico, 'esperado evento agenda.sheets.cabecalho_incompativel');
    assert.equal(diagnostico.cabecalhoEsperado[1], 'AGENDAMENTO DO DETRAN');
    assert.equal(diagnostico.cabecalhoEncontrado[1], 'COLUNA ERRADA');
    assert.equal(diagnostico.colunaDivergente.indice, 1);
    assert.equal(diagnostico.colunaDivergente.esperado, 'AGENDAMENTO DO DETRAN');
    assert.equal(diagnostico.colunaDivergente.encontrado, 'COLUNA ERRADA');
  });

  it('omite rewrite quando não há linhas novas nem remoções (noop)', async () => {
    let updates = 0;
    let clears = 0;
    const base = new InMemoryGoogleSheetsValues();
    const sheets: InMemoryGoogleSheetsValues = Object.assign(base, {
      updateValues: async (range: string, values: string[][]): Promise<void> => {
        updates += 1;
        return InMemoryGoogleSheetsValues.prototype.updateValues.call(base, range, values);
      },
      clearValues: async (range: string): Promise<void> => {
        clears += 1;
        return InMemoryGoogleSheetsValues.prototype.clearValues.call(base, range);
      }
    });

    const repository = new GoogleSheetsAgendaRepository({
      sheets,
      agora: HOJE_FIXO
    });

    const primeira = await repository.salvarAgenda(
      agendaFixture('21/07/2026', '08:00', 'PACIENTE X', '555.555.555-55'),
      { profissional: 'Profissional Alpha', unidadeOperacional: 'LIMÃO', perfilId: 'psicologo' }
    );
    assert.equal(primeira.sucesso, true);
    assert.equal(primeira.linhasGravadas, 1);
    const updatesAposPrimeira = updates;

    const segunda = await repository.salvarAgenda(
      agendaFixture('21/07/2026', '08:00', 'PACIENTE X', '555.555.555-55'),
      { profissional: 'Profissional Alpha', unidadeOperacional: 'LIMÃO', perfilId: 'psicologo' }
    );
    assert.equal(segunda.sucesso, true);
    assert.equal(segunda.linhasGravadas, 0);
    assert.equal(segunda.linhasRemovidas, 0);
    assert.equal(updates, updatesAposPrimeira);
    assert.equal(clears, 0);
  });

  it('com linha vazia no meio, CPF técnico de A e B não se desloca e existentes não viram novos', async () => {
    const sheets = new InMemoryGoogleSheetsValues();
    const repository = new GoogleSheetsAgendaRepository({ sheets, agora: HOJE_FIXO });
    const dataInclusaoA = '15/07/2026 08:00';
    const dataInclusaoB = '16/07/2026 09:00';

    await sheets.updateValues(RANGE_LEITURA, [
      [
        'UNIDADE',
        'AGENDAMENTO DO DETRAN',
        'HORÁRIO',
        'PACIENTE',
        'TELEFONE',
        'EMAIL',
        'PROFISSIONAL',
        'DATA DE INCLUSÃO'
      ],
      [
        'LIMÃO',
        '21/07/2026',
        '08:00',
        'Paciente',
        '',
        '',
        'Psicólogo: PROFISSIONAL ALPHA',
        dataInclusaoA,
        '111.111.111-11'
      ],
      ['', '', '', '', '', '', '', ''],
      [
        'LIMÃO',
        '22/07/2026',
        '09:00',
        'Paciente',
        '',
        '',
        'Psicólogo: PROFISSIONAL ALPHA',
        dataInclusaoB,
        '222.222.222-22'
      ]
    ]);

    const resultado = await repository.salvarAgenda(
      {
        dataConsulta: '21/07/2026',
        itens: [
          {
            horario: '08:00',
            paciente: { nome: 'PACIENTE A', cpf: '111.111.111-11' }
          },
          {
            horario: '09:00',
            paciente: { nome: 'PACIENTE B', cpf: '222.222.222-22' }
          }
        ]
      },
      {
        profissional: 'Profissional Alpha',
        unidadeOperacional: 'LIMÃO',
        perfilId: 'psicologo'
      }
    );

    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.linhasGravadas, 0);

    const matriz = await sheets.getValues(RANGE_LEITURA);
    const linhasDados = matriz.slice(1).filter((row) => (row[6] ?? '').trim().length > 0);
    assert.equal(linhasDados.length, 2);

    const linhaA = linhasDados.find((row) => row[8] === '111.111.111-11');
    const linhaB = linhasDados.find((row) => row[8] === '222.222.222-22');
    assert.ok(linhaA);
    assert.ok(linhaB);
    assert.equal(linhaA[COL.dataInclusao], dataInclusaoA);
    assert.equal(linhaB[COL.dataInclusao], dataInclusaoB);
    assert.notEqual(linhaA[COL.dataInclusao], linhaB[COL.dataInclusao]);
  });
});
