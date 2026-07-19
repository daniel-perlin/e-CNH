import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Agenda } from '../models/agenda.js';

import { CABECALHOS_ABA_AGENDA } from './agenda-sheet-headers.js';
import { AgendaSheetMapper } from './agenda-sheet-mapper.js';

describe('AgendaSheetMapper', () => {
  const mapper = new AgendaSheetMapper();

  it('expõe o cabeçalho canônico na ordem fixa', () => {
    assert.deepEqual(mapper.cabecalho(), [...CABECALHOS_ABA_AGENDA]);
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

    const linhas = mapper.agendaParaLinhas(agenda, { profissional: 'Profissional Teste' });
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
      'Pendente'
    ]);
  });

  it('agenda vazia produz zero linhas', () => {
    const linhas = mapper.agendaParaLinhas(
      { dataConsulta: '14/07/2026', itens: [] },
      { profissional: 'Profissional Teste' }
    );
    assert.equal(linhas.length, 0);
  });

  it('normaliza e-mail (trim + lowercase) na persistência sem alterar outros campos', () => {
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
          },
          tipoProcesso: 'Primeira Habilitação',
          categoria: 'B'
        }
      ]
    };

    const linhas = mapper.agendaParaLinhas(agenda, { profissional: 'Profissional Teste' });
    assert.equal(linhas[0]?.[6], 'paciente@example.test');
    assert.equal(linhas[0]?.[3], '000.000.000-00');
    assert.equal(linhas[0]?.[4], 'PACIENTE FIXTURE UM');
    assert.equal(linhas[0]?.[5], '(11) 900000001');
  });

  it('normaliza telefone na persistência sem alterar o domínio dos demais campos', () => {
    const agenda: Agenda = {
      dataConsulta: '13/07/2026',
      itens: [
        {
          horario: '09:00',
          paciente: {
            cpf: '000.000.000-00',
            nome: 'PACIENTE FIXTURE DOIS',
            telefone: '00000000 / 991354797 / (11) 9479-08238',
            email: 'dois@example.test'
          }
        }
      ]
    };

    const linhas = mapper.agendaParaLinhas(agenda, { profissional: 'Profissional Teste' });
    assert.equal(linhas[0]?.[5], '(11) 991354797 / (11) 947908238');
    assert.equal(linhas[0]?.[4], 'PACIENTE FIXTURE DOIS');
    assert.equal(linhas[0]?.[6], 'dois@example.test');
  });

  it('reconstrói registros e agenda a partir de linhas', () => {
    const linhas = [
      [
        'Profissional Teste',
        '13/07/2026',
        '08:00',
        '000.000.000-00',
        'PACIENTE FIXTURE UM',
        '',
        '',
        'Primeira Habilitação',
        'B',
        'Apto',
        'Pendente'
      ],
      [
        'Outro Profissional',
        '13/07/2026',
        '09:00',
        '111.111.111-11',
        'PACIENTE OUTRO',
        '',
        '',
        '',
        '',
        '',
        ''
      ]
    ];

    const registros = mapper.linhasParaRegistros(linhas, mapper.cabecalho());
    assert.equal(registros.length, 2);

    const agenda = mapper.registrosParaAgenda(registros, '13/07/2026', 'Profissional Teste');
    assert.equal(agenda.itens.length, 1);
    assert.equal(agenda.itens[0]?.paciente.nome, 'PACIENTE FIXTURE UM');
    assert.equal(agenda.itens[0]?.paciente.telefone, undefined);
    assert.equal(agenda.itens[0]?.horario, '08:00');
  });

  it('liga colunas pelo texto do cabeçalho mesmo com ordem diferente', () => {
    const cabecalhos = [
      'Hora',
      'Nome',
      'Profissional',
      'Data',
      'CPF',
      'Telefone',
      'E-mail',
      'Tipo de Processo',
      'Categoria',
      'Status do Exame Médico',
      'Status do Exame Psicológico'
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
        ''
      ]
    ];

    const registros = mapper.linhasParaRegistros(linhas, cabecalhos);
    assert.equal(registros.length, 1);
    assert.equal(registros[0]?.item.horario, '14:15');
    assert.equal(registros[0]?.item.paciente.nome, 'PACIENTE ORDEM ALTERNATIVA');
    assert.equal(registros[0]?.profissional, 'Profissional Teste');
  });
});
