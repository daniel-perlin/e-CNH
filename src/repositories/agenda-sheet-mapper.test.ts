import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Agenda } from '../models/agenda.js';

import {
  CABECALHOS_ABA_AGENDA,
  CABECALHOS_ABA_AGENDA_OFICIAL_V8,
  indiceCabecalhoAgenda,
  INDICE_COLUNA_TECNICA_CPF,
  resolverIndiceColunaTecnicaCpf
} from './agenda-sheet-headers.js';
import { AgendaSheetMapper } from './agenda-sheet-mapper.js';

describe('AgendaSheetMapper', () => {
  const mapper = new AgendaSheetMapper();
  const timestampFixo = '19/07/2026 12:00';

  it('expõe o cabeçalho canônico na ordem fixa (10 colunas)', () => {
    assert.deepEqual(mapper.cabecalho(), [...CABECALHOS_ABA_AGENDA]);
    assert.equal(mapper.cabecalho()[indiceCabecalhoAgenda('UNIDADE')], 'UNIDADE');
    assert.equal(
      mapper.cabecalho()[indiceCabecalhoAgenda('AGENDAMENTO DO DETRAN')],
      'AGENDAMENTO DO DETRAN'
    );
    assert.equal(mapper.cabecalho()[indiceCabecalhoAgenda('EMAIL')], 'EMAIL');
    assert.equal(
      mapper.cabecalho()[indiceCabecalhoAgenda('Tipo de Processo')],
      'Tipo de Processo'
    );
    assert.equal(mapper.cabecalho()[indiceCabecalhoAgenda('Categoria')], 'Categoria');
    assert.equal(mapper.cabecalho().at(-1), 'DATA DE INCLUSÃO');
    assert.equal(mapper.cabecalho().length, 10);
  });

  it('converte agenda tipada em linhas com Tipo de Processo e Categoria, sem CPF/status', () => {
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
      'Primeira Habilitação',
      'B',
      'Psicólogo: GABRIELA MOURA',
      timestampFixo
    ]);
    assert.equal(linhas[0]?.includes('000.000.000-00'), false);
    assert.equal(linhas[0]?.includes('Apto'), false);
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

    const indicePaciente = indiceCabecalhoAgenda('PACIENTE');
    const indiceProfissional = indiceCabecalhoAgenda('PROFISSIONAL');

    const comPerfil = mapper.agendaParaLinhas(agenda, {
      profissional: 'Italo Facella',
      perfilId: 'medico',
      unidadeOperacional: 'LIMÃO',
      dataInclusao: timestampFixo
    });
    assert.equal(comPerfil[0]?.[indicePaciente], 'Antônio');
    assert.equal(comPerfil[0]?.[indiceProfissional], 'Médico: ITALO FACELLA');

    const semPerfil = mapper.agendaParaLinhas(agenda, {
      profissional: 'Médico: ITALO FACELLA',
      unidadeOperacional: 'LIMÃO',
      dataInclusao: timestampFixo
    });
    assert.equal(semPerfil[0]?.[indiceProfissional], 'Médico: ITALO FACELLA');
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
    assert.equal(linhas[0]?.[indiceCabecalhoAgenda('EMAIL')], 'paciente@example.test');
    assert.equal(linhas[0]?.[indiceCabecalhoAgenda('TELEFONE')], '(11) 900000001');
    assert.equal(linhas[0]?.[indiceCabecalhoAgenda('UNIDADE')], 'VILA CARRÃO');
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
        'Primeira Habilitação',
        'B',
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
    assert.equal(registros[0]?.item.tipoProcesso, 'Primeira Habilitação');
    assert.equal(registros[0]?.item.categoria, 'B');
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
        'Mudança de Categoria',
        'A',
        'Profissional Teste',
        timestampFixo
      ]
    ];

    const registros = mapper.linhasParaRegistros(linhas, [...CABECALHOS_ABA_AGENDA]);
    assert.equal(registros[0]?.unidadeOperacional, 'CAPÃO REDONDO');
    assert.equal(registros[0]?.item.horario, '14:15');
    assert.equal(registros[0]?.item.tipoProcesso, 'Mudança de Categoria');
    assert.equal(registros[0]?.item.categoria, 'A');
    assert.equal(registros[0]?.item.paciente.cpf, undefined);
    assert.equal(registros[0]?.rowIndex, 0);
  });

  it('lê layout oficial V8 (8 colunas) sem Tipo/Categoria', () => {
    const linhas = [
      [
        'LIMÃO',
        '15/07/2026',
        '14:15',
        'PACIENTE V8',
        '',
        '',
        'Profissional Teste',
        timestampFixo
      ]
    ];

    const registros = mapper.linhasParaRegistros(linhas, [...CABECALHOS_ABA_AGENDA_OFICIAL_V8]);
    assert.equal(registros.length, 1);
    assert.equal(registros[0]?.item.paciente.nome, 'PACIENTE V8');
    assert.equal(registros[0]?.item.tipoProcesso, undefined);
    assert.equal(registros[0]?.item.categoria, undefined);
    assert.equal(resolverIndiceColunaTecnicaCpf([...CABECALHOS_ABA_AGENDA_OFICIAL_V8]), 8);
    assert.equal(resolverIndiceColunaTecnicaCpf([...CABECALHOS_ABA_AGENDA]), 10);
    assert.equal(INDICE_COLUNA_TECNICA_CPF, 10);
  });

  it('preserva rowIndex original mesmo com linha vazia ignorada no meio', () => {
    const linhas = [
      [
        'LIMÃO',
        '21/07/2026',
        '08:00',
        'PACIENTE A',
        '',
        '',
        '',
        '',
        'Profissional A',
        timestampFixo
      ],
      ['', '', '', '', '', '', '', '', '', ''],
      [
        'LIMÃO',
        '22/07/2026',
        '09:00',
        'PACIENTE B',
        '',
        '',
        '',
        '',
        'Profissional B',
        timestampFixo
      ]
    ];

    const registros = mapper.linhasParaRegistros(linhas, [...CABECALHOS_ABA_AGENDA]);
    assert.equal(registros.length, 2);
    assert.equal(registros[0]?.item.paciente.nome, 'PACIENTE A');
    assert.equal(registros[0]?.rowIndex, 0);
    assert.equal(registros[1]?.item.paciente.nome, 'PACIENTE B');
    assert.equal(registros[1]?.rowIndex, 2);
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
      'Tipo de Processo',
      'Categoria',
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
        'Renovação',
        'AB',
        timestampFixo
      ]
    ];

    const registros = mapper.linhasParaRegistros(linhas, cabecalhos);
    assert.equal(registros.length, 1);
    assert.equal(registros[0]?.item.horario, '14:15');
    assert.equal(registros[0]?.dataConsulta, '15/07/2026');
    assert.equal(registros[0]?.unidadeOperacional, 'LIMÃO');
    assert.equal(registros[0]?.item.tipoProcesso, 'Renovação');
    assert.equal(registros[0]?.item.categoria, 'AB');
    assert.equal(registros[0]?.dataInclusao, timestampFixo);
  });
});
