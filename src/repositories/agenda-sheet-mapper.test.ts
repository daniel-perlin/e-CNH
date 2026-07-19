import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Agenda } from '../models/agenda.js';

import { CABECALHOS_ABA_AGENDA } from './agenda-sheet-headers.js';
import { AgendaSheetMapper } from './agenda-sheet-mapper.js';

describe('AgendaSheetMapper', () => {
  const mapper = new AgendaSheetMapper();
  const timestampFixo = '19/07/2026 12:00';

  it('expõe o cabeçalho canônico na ordem fixa', () => {
    assert.deepEqual(mapper.cabecalho(), [...CABECALHOS_ABA_AGENDA]);
    assert.equal(mapper.cabecalho()[1], 'Data de Agendamento');
    assert.equal(mapper.cabecalho().at(-1), 'Data de inclusão');
  });

  it('converte agenda tipada em linhas sem cabeçalho', () => {
    const agenda: Agenda = {
      dataConsulta: '13/07/2026',
      itens: [
        {
          horario: '08:00',
          paciente: {
            cpf: '000.000.000-00',
            nome: 'PACIENTE FIXTURE UM',
            telefone: '(11) 90000-0001',
            email: 'paciente1@example.test'
          },
          tipoProcesso: 'Primeira Habilitação',
          categoria: 'B',
          statusExameMedico: 'Apto',
          statusExamePsicologico: 'Pendente'
        }
      ]
    };

    const linhas = mapper.agendaParaLinhas(agenda, {
      profissional: 'Profissional Teste',
      dataInclusao: timestampFixo
    });
    assert.equal(linhas.length, 1);
    assert.deepEqual(linhas[0], [
      'Profissional Teste',
      '13/07/2026',
      '08:00',
      '000.000.000-00',
      'PACIENTE FIXTURE UM',
      '(11) 900000001',
      'paciente1@example.test',
      'Primeira Habilitação',
      'B',
      'Apto',
      'Pendente',
      timestampFixo
    ]);
  });

  it('agenda vazia produz zero linhas', () => {
    const linhas = mapper.agendaParaLinhas(
      { dataConsulta: '14/07/2026', itens: [] },
      { profissional: 'Profissional Teste', dataInclusao: timestampFixo }
    );
    assert.equal(linhas.length, 0);
  });

  it('normaliza e-mail e telefone na persistência', () => {
    const agenda: Agenda = {
      dataConsulta: '13/07/2026',
      itens: [
        {
          horario: '08:00',
          paciente: {
            cpf: '000.000.000-00',
            nome: 'PACIENTE FIXTURE UM',
            telefone: '(11) 90000-0001',
            email: '  PaCiEnTe@Example.TEST  '
          }
        }
      ]
    };

    const linhas = mapper.agendaParaLinhas(agenda, {
      profissional: 'Profissional Teste',
      dataInclusao: timestampFixo
    });
    assert.equal(linhas[0]?.[6], 'paciente@example.test');
    assert.equal(linhas[0]?.[5], '(11) 900000001');
  });

  it('aceita cabeçalhos legados Data e Última sincronização', () => {
    const cabecalhos = [
      'Profissional',
      'Data',
      'Hora',
      'CPF',
      'Nome',
      'Telefone',
      'E-mail',
      'Tipo de Processo',
      'Categoria',
      'Status do Exame Médico',
      'Status do Exame Psicológico',
      'Última sincronização'
    ];
    const linhas = [
      [
        'Profissional Teste',
        '13/07/2026',
        '08:00',
        '000.000.000-00',
        'PACIENTE LEGADO',
        '',
        '',
        '',
        '',
        '',
        '',
        '01/01/2026 10:00'
      ]
    ];

    const registros = mapper.linhasParaRegistros(linhas, cabecalhos);
    assert.equal(registros[0]?.dataConsulta, '13/07/2026');
    assert.equal(registros[0]?.dataInclusao, '01/01/2026 10:00');
  });

  it('liga colunas pelo texto do cabeçalho mesmo com ordem diferente', () => {
    const cabecalhos = [
      'Hora',
      'Nome',
      'Profissional',
      'Data de Agendamento',
      'CPF',
      'Telefone',
      'E-mail',
      'Tipo de Processo',
      'Categoria',
      'Status do Exame Médico',
      'Status do Exame Psicológico',
      'Data de inclusão'
    ];
    const linhas = [
      [
        '14:15',
        'PACIENTE ORDEM ALTERNATIVA',
        'Profissional Teste',
        '15/07/2026',
        '222.222.222-22',
        '',
        '',
        '',
        'B',
        '',
        '',
        timestampFixo
      ]
    ];

    const registros = mapper.linhasParaRegistros(linhas, cabecalhos);
    assert.equal(registros.length, 1);
    assert.equal(registros[0]?.item.horario, '14:15');
    assert.equal(registros[0]?.dataConsulta, '15/07/2026');
    assert.equal(registros[0]?.dataInclusao, timestampFixo);
  });
});
