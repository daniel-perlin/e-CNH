import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CABECALHOS_ABA_AGENDA,
  CABECALHOS_ABA_AGENDA_OFICIAL_V10_TIPO_ANTES_PROFISSIONAL,
  CABECALHOS_ABA_AGENDA_OFICIAL_V8,
  diagnosticarDiferencaCabecalho,
  indiceCabecalhoAgenda,
  INDICE_COLUNA_TECNICA_CPF,
  normalizeTextoCabecalho,
  prefixoCabecalhoCompativel,
  repararCabecalhoUnidadeSubstituidaPorValor,
  resolverAliasCabecalho,
  resolverIndiceColunaTecnicaCpf
} from './agenda-sheet-headers.js';

describe('normalizeTextoCabecalho', () => {
  it('colapsa quebras de linha e espaços múltiplos', () => {
    assert.equal(
      normalizeTextoCabecalho('AGENDAMENTO\nDO DETRAN'),
      'agendamento do detran'
    );
    assert.equal(
      normalizeTextoCabecalho('AGENDAMENTO \r\n  DO\tDETRAN  '),
      'agendamento do detran'
    );
  });

  it('trata maiúsculas e Title Case como equivalentes', () => {
    assert.equal(normalizeTextoCabecalho('PROFISSIONAL'), 'profissional');
    assert.equal(normalizeTextoCabecalho('Profissional'), 'profissional');
    assert.equal(
      normalizeTextoCabecalho('PROFISSIONAL'),
      normalizeTextoCabecalho('Profissional')
    );
    assert.equal(
      normalizeTextoCabecalho('DATA DE INCLUSÃO'),
      normalizeTextoCabecalho('Data de inclusão')
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

  it('reconhece PROFISSIONAL independentemente do case', () => {
    assert.equal(resolverAliasCabecalho('PROFISSIONAL'), 'PROFISSIONAL');
    assert.equal(resolverAliasCabecalho('Profissional'), 'PROFISSIONAL');
    assert.equal(resolverAliasCabecalho('profissional'), 'PROFISSIONAL');
  });
});

describe('índices derivados do layout oficial', () => {
  it('deriva índices e CPF técnico do canônico atual', () => {
    assert.equal(CABECALHOS_ABA_AGENDA.length, 10);
    assert.equal(CABECALHOS_ABA_AGENDA_OFICIAL_V8.length, 8);
    assert.equal(indiceCabecalhoAgenda('EMAIL'), 5);
    assert.equal(indiceCabecalhoAgenda('PROFISSIONAL'), 6);
    assert.equal(indiceCabecalhoAgenda('Tipo de Processo'), 7);
    assert.equal(indiceCabecalhoAgenda('Categoria'), 8);
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
    assert.equal(
      resolverIndiceColunaTecnicaCpf([
        ...CABECALHOS_ABA_AGENDA_OFICIAL_V10_TIPO_ANTES_PROFISSIONAL
      ]),
      10
    );
    assert.equal(resolverIndiceColunaTecnicaCpf(undefined), 10);
  });

  it('aceita layout canônico com Profissional (Title Case) e coluna CPF extra', () => {
    const cabecalhoProducao = [
      'UNIDADE',
      'AGENDAMENTO DO DETRAN',
      'HORÁRIO',
      'PACIENTE',
      'TELEFONE',
      'EMAIL',
      'Profissional',
      'Tipo de Processo',
      'Categoria',
      'DATA DE INCLUSÃO',
      'CPF'
    ];
    assert.equal(prefixoCabecalhoCompativel(cabecalhoProducao, [...CABECALHOS_ABA_AGENDA]), true);
    assert.equal(resolverIndiceColunaTecnicaCpf(cabecalhoProducao), 10);
  });

  it('aceita layout 10 colunas anterior (Tipo/Categoria antes de PROFISSIONAL)', () => {
    assert.equal(
      prefixoCabecalhoCompativel(
        [...CABECALHOS_ABA_AGENDA_OFICIAL_V10_TIPO_ANTES_PROFISSIONAL, 'CPF'],
        [...CABECALHOS_ABA_AGENDA_OFICIAL_V10_TIPO_ANTES_PROFISSIONAL]
      ),
      true
    );
  });
});

describe('diagnosticarDiferencaCabecalho', () => {
  it('lista faltando e extras em relação ao canônico', () => {
    const encontrado = [
      'CAPÃO REDONDO',
      'AGENDAMENTO DO DETRAN',
      'HORÁRIO',
      'PACIENTE',
      'TELEFONE',
      'EMAIL',
      'PROFISSIONAL',
      'Tipo de Processo',
      'Categoria',
      'DATA DE INCLUSÃO',
      'CPF'
    ];
    const { colunasFaltando, colunasExtras } = diagnosticarDiferencaCabecalho(
      encontrado,
      [...CABECALHOS_ABA_AGENDA]
    );
    assert.deepEqual(colunasFaltando, ['UNIDADE']);
    assert.deepEqual(colunasExtras, ['CAPÃO REDONDO', 'CPF']);
  });
});

describe('repararCabecalhoUnidadeSubstituidaPorValor', () => {
  it('restaura A1 quando o restante bate com o canônico 10', () => {
    const bruto = [
      'CAPÃO REDONDO',
      'AGENDAMENTO DO DETRAN',
      'HORÁRIO',
      'PACIENTE',
      'TELEFONE',
      'EMAIL',
      'PROFISSIONAL',
      'Tipo de Processo',
      'Categoria',
      'DATA DE INCLUSÃO',
      'CPF'
    ];
    const reparado = repararCabecalhoUnidadeSubstituidaPorValor(bruto);
    assert.ok(reparado);
    assert.equal(reparado[0], 'UNIDADE');
    assert.equal(reparado[1], 'AGENDAMENTO DO DETRAN');
    assert.equal(prefixoCabecalhoCompativel(reparado, [...CABECALHOS_ABA_AGENDA]), true);
  });

  it('restaura A1 no layout 10 anterior (Tipo antes de PROFISSIONAL)', () => {
    const bruto = [
      'CAPÃO REDONDO',
      ...CABECALHOS_ABA_AGENDA_OFICIAL_V10_TIPO_ANTES_PROFISSIONAL.slice(1),
      'CPF'
    ];
    const reparado = repararCabecalhoUnidadeSubstituidaPorValor(bruto);
    assert.ok(reparado);
    assert.equal(reparado[0], 'UNIDADE');
    assert.equal(
      prefixoCabecalhoCompativel(reparado, [
        ...CABECALHOS_ABA_AGENDA_OFICIAL_V10_TIPO_ANTES_PROFISSIONAL
      ]),
      true
    );
  });

  it('restaura A1 no layout V8', () => {
    const bruto = [
      'LIMÃO',
      ...CABECALHOS_ABA_AGENDA_OFICIAL_V8.slice(1)
    ];
    const reparado = repararCabecalhoUnidadeSubstituidaPorValor(bruto);
    assert.ok(reparado);
    assert.equal(reparado[0], 'UNIDADE');
    assert.equal(prefixoCabecalhoCompativel(reparado, [...CABECALHOS_ABA_AGENDA_OFICIAL_V8]), true);
  });

  it('não repara quando outra coluna diverge', () => {
    const bruto = [
      'CAPÃO REDONDO',
      'COLUNA ERRADA',
      'HORÁRIO',
      'PACIENTE',
      'TELEFONE',
      'EMAIL',
      'PROFISSIONAL',
      'Tipo de Processo',
      'Categoria',
      'DATA DE INCLUSÃO'
    ];
    assert.equal(repararCabecalhoUnidadeSubstituidaPorValor(bruto), undefined);
  });

  it('não altera cabeçalho já correto', () => {
    assert.equal(
      repararCabecalhoUnidadeSubstituidaPorValor([...CABECALHOS_ABA_AGENDA]),
      undefined
    );
  });
});
