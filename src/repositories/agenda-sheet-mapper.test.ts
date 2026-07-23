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
    assert.equal(mapper.cabecalho()[0], 'UNIDADE');
    assert.equal(mapper.cabecalho()[1], 'AGENDAMENTO DO DETRAN');
    assert.equal(mapper.cabecalho()[2], 'HORÁRIO');
    assert.equal(mapper.cabecalho()[3], 'PACIENTE');
    assert.equal(mapper.cabecalho().at(-1), 'DATA DE INCLUSÃO');
    assert.equal(mapper.cabecalho().length, 8);
  });

  it('converte agenda tipada em linhas sem cabeçalho e sem CPF/metadados', () => {
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
      profissional: 'Gabriela Moura Gomes dos Santos',
      perfilId: 'psicologo',
      unidadeOperacional: 'LIMÃO',
      dataInclusao: timestampFixo
    });
    assert.equal(linhas.length, 1);
    assert.deepEqual(linhas[0], [
      'LIMÃO',
      '13/07/2026',
      '08:00',
      'Paciente',
      '(11) 900000001',
      'paciente1@example.test',
      'Psicólogo: GABRIELA MOURA',
      timestampFixo
    ]);
    assert.equal(linhas[0]?.includes('000.000.000-00'), false);
  });

  it('formata médico na coluna PROFISSIONAL sem alterar a leitura pass-through', () => {
    const agenda: Agenda = {
      dataConsulta: '13/07/2026',
      itens: [
        {
          horario: '09:00',
          paciente: { nome: 'ANTÔNIO CARLOS SILVA' }
        }
      ]
    };

    const comPerfil = mapper.agendaParaLinhas(agenda, {
      profissional: 'Italo Facella',
      perfilId: 'medico',
      unidadeOperacional: 'LIMÃO',
      dataInclusao: timestampFixo
    });
    assert.equal(comPerfil[0]?.[3], 'Antônio');
    assert.equal(comPerfil[0]?.[6], 'Médico: ITALO FACELLA');

    const semPerfil = mapper.agendaParaLinhas(agenda, {
      profissional: 'Médico: ITALO FACELLA',
      unidadeOperacional: 'LIMÃO',
      dataInclusao: timestampFixo
    });
    assert.equal(semPerfil[0]?.[6], 'Médico: ITALO FACELLA');
  });

  it('agenda vazia produz zero linhas', () => {
    const linhas = mapper.agendaParaLinhas(
      { dataConsulta: '14/07/2026', itens: [] },
      {
        profissional: 'Profissional Teste',
        unidadeOperacional: 'LIMÃO',
        dataInclusao: timestampFixo
      }
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
      unidadeOperacional: 'VILA CARRÃO',
      dataInclusao: timestampFixo
    });
    assert.equal(linhas[0]?.[5], 'paciente@example.test');
    assert.equal(linhas[0]?.[4], '(11) 900000001');
    assert.equal(linhas[0]?.[0], 'VILA CARRÃO');
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
    assert.equal(registros[0]?.unidadeOperacional, undefined);
    assert.equal(registros[0]?.item.paciente.cpf, '000.000.000-00');
    assert.equal(registros[0]?.item.paciente.nome, 'PACIENTE LEGADO');
  });

  it('lê e preserva a coluna UNIDADE no layout oficial', () => {
    const linhas = [
      [
        'CAPÃO REDONDO',
        '15/07/2026',
        '14:15',
        'PACIENTE UNIDADE',
        '',
        '',
        'Profissional Teste',
        timestampFixo
      ]
    ];

    const registros = mapper.linhasParaRegistros(linhas, [...CABECALHOS_ABA_AGENDA]);
    assert.equal(registros[0]?.unidadeOperacional, 'CAPÃO REDONDO');
    assert.equal(registros[0]?.item.horario, '14:15');
    assert.equal(registros[0]?.item.paciente.cpf, undefined);
  });

  it('liga colunas pelo texto do cabeçalho mesmo com ordem diferente', () => {
    const cabecalhos = [
      'HORÁRIO',
      'PACIENTE',
      'PROFISSIONAL',
      'UNIDADE',
      'AGENDAMENTO DO DETRAN',
      'TELEFONE',
      'EMAIL',
      'DATA DE INCLUSÃO'
    ];
    const linhas = [
      [
        '14:15',
        'PACIENTE ORDEM ALTERNATIVA',
        'Profissional Teste',
        'LIMÃO',
        '15/07/2026',
        '',
        '',
        timestampFixo
      ]
    ];

    const registros = mapper.linhasParaRegistros(linhas, cabecalhos);
    assert.equal(registros.length, 1);
    assert.equal(registros[0]?.item.horario, '14:15');
    assert.equal(registros[0]?.dataConsulta, '15/07/2026');
    assert.equal(registros[0]?.unidadeOperacional, 'LIMÃO');
    assert.equal(registros[0]?.dataInclusao, timestampFixo);
  });
});
