import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { parseAgendaHtml } from './agenda-parser.js';

const fixturesDirectory = join(process.cwd(), 'fixtures/agenda');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDirectory, name), 'utf8');
}

describe('parseAgendaHtml', () => {
  it('extrai itens da table#agenda sem depender de classes de apresentação', () => {
    const result = parseAgendaHtml(loadFixture('resultado-com-itens.html'), {
      dataConsulta: '13/07/2026'
    });

    assert.equal(result.sucesso, true);
    assert.equal(result.motivoFalha, undefined);
    assert.ok(result.agenda);
    assert.equal(result.agenda.dataConsulta, '13/07/2026');
    assert.equal(result.agenda.itens.length, 2);

    const primeiro = result.agenda.itens[0];
    assert.ok(primeiro);
    assert.equal(primeiro.horario, '08:00');
    assert.equal(primeiro.paciente.cpf, '000.000.000-00');
    assert.equal(primeiro.paciente.nome, 'PACIENTE FIXTURE UM');
    assert.equal(primeiro.paciente.telefone, '(11) 90000-0001');
    assert.equal(primeiro.paciente.email, 'paciente1@example.test');
    assert.equal(primeiro.tipoProcesso, 'Primeira Habilitação');
    assert.equal(primeiro.categoria, 'B');
    assert.equal(primeiro.statusExameMedico, 'Apto');
    assert.equal(primeiro.statusExamePsicologico, 'Pendente');
  });

  it('retorna agenda vazia quando table#agenda não possui linhas de dados', () => {
    const result = parseAgendaHtml(loadFixture('resultado-vazio.html'), {
      dataConsulta: '14/07/2026'
    });

    assert.equal(result.sucesso, true);
    assert.ok(result.agenda);
    assert.equal(result.agenda.itens.length, 0);
    assert.equal(result.agenda.dataConsulta, '14/07/2026');
  });

  it('falha de forma tipada quando table#agenda está ausente', () => {
    const result = parseAgendaHtml(loadFixture('sem-tabela-agenda.html'));

    assert.equal(result.sucesso, false);
    assert.equal(result.motivoFalha, 'html-sem-tabela-agenda');
    assert.equal(result.agenda, undefined);
  });

  it('falha quando cabeçalhos obrigatórios estão ausentes', () => {
    const result = parseAgendaHtml(loadFixture('cabecalhos-incompletos.html'));

    assert.equal(result.sucesso, false);
    assert.equal(result.motivoFalha, 'cabecalhos-obrigatorios-ausentes');
  });

  it('resolve colunas pelo texto do th mesmo com ordem visual diferente', () => {
    const result = parseAgendaHtml(loadFixture('colunas-reordenadas.html'));

    assert.equal(result.sucesso, true);
    assert.ok(result.agenda);
    assert.equal(result.agenda.itens.length, 1);

    const item = result.agenda.itens[0];
    assert.ok(item);
    assert.equal(item.horario, '14:15');
    assert.equal(item.paciente.nome, 'PACIENTE ORDEM ALTERNATIVA');
    assert.equal(item.paciente.cpf, '222.222.222-22');
    assert.equal(item.paciente.email, 'ordem@example.test');
    assert.equal(item.paciente.telefone, '(11) 90000-0003');
    assert.equal(item.tipoProcesso, 'Mudança de Categoria');
    assert.equal(item.categoria, 'A');
    assert.equal(item.statusExameMedico, 'Pendente');
    assert.equal(item.statusExamePsicologico, 'Apto');
  });

  it('omite dataConsulta quando o contexto não a informa', () => {
    const result = parseAgendaHtml(loadFixture('resultado-vazio.html'));

    assert.equal(result.sucesso, true);
    assert.ok(result.agenda);
    assert.equal(result.agenda.dataConsulta, undefined);
  });

  it('converte NÃO INFORMADO do portal em ausência no domínio', () => {
    const result = parseAgendaHtml(loadFixture('campos-nao-informado.html'), {
      dataConsulta: '25/07/2026'
    });

    assert.equal(result.sucesso, true);
    assert.ok(result.agenda);
    assert.equal(result.agenda.itens.length, 1);

    const item = result.agenda.itens[0];
    assert.ok(item);
    assert.equal(item.paciente.cpf, '333.333.333-33');
    assert.equal(item.paciente.nome, 'PACIENTE SEM CONTATO');
    assert.equal(item.paciente.telefone, undefined);
    assert.equal(item.paciente.email, undefined);
    assert.equal(item.categoria, undefined);
    assert.equal(item.tipoProcesso, 'Renovação');
    assert.equal(item.horario, '10:00');
  });
});
