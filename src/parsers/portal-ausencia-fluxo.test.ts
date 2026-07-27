/**
 * Fluxo fronteira portal → domínio → merge/SQLite/Sheets.
 * Garante que "NÃO INFORMADO" não vaza além do parser.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';

import type { AppDatabase } from '../db/client.js';
import { openAppDatabase } from '../db/client.js';
import { pessoasSqlite } from '../db/schema/index.js';
import { parseAgendaHtml } from '../parsers/agenda-parser.js';
import {
  CABECALHOS_ABA_AGENDA,
  indiceCabecalhoAgenda,
  INDICE_COLUNA_TECNICA_CPF
} from '../repositories/agenda-sheet-headers.js';
import { DrizzlePessoaRepository } from '../repositories/drizzle-pessoa-repository.js';
import {
  GoogleSheetsAgendaRepository,
  mesclarItemPortalEmRegistroAtivo
} from '../repositories/google-sheets-agenda-repository.js';
import { InMemoryGoogleSheetsValues } from '../repositories/in-memory-google-sheets-values.js';
import { pessoasDaAgenda } from '../repositories/pessoa-from-agenda.js';
import { SHEET_PLACEHOLDER } from '../utils/sheet-optional-field.js';

const fixturesDirectory = path.join(process.cwd(), 'fixtures/agenda');
const HOJE_FIXO = new Date('2026-07-20T15:00:00.000Z');
const RANGE_LEITURA = "'Agenda'!A:Z";

describe('fluxo ausência portal (NÃO INFORMADO → undefined)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecnh-portal-ausencia-'));
  const sqlitePath = path.join(dir, 'teste.sqlite');
  let appDb: AppDatabase;
  let pessoaRepo: DrizzlePessoaRepository;

  before(async () => {
    appDb = await openAppDatabase({
      enabled: true,
      dialect: 'sqlite',
      sqlitePath
    });
    pessoaRepo = new DrizzlePessoaRepository(appDb);
  });

  after(async () => {
    await appDb.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('parser → ItemAgenda → SQLite → Sheets sem literal NÃO INFORMADO', async () => {
    const html = fs.readFileSync(
      path.join(fixturesDirectory, 'campos-nao-informado.html'),
      'utf8'
    );
    const parseResult = parseAgendaHtml(html, { dataConsulta: '25/07/2026' });
    assert.equal(parseResult.sucesso, true);
    assert.ok(parseResult.agenda);

    const item = parseResult.agenda.itens[0];
    assert.ok(item);
    assert.equal(item.paciente.telefone, undefined);
    assert.equal(item.paciente.email, undefined);
    assert.equal(item.categoria, undefined);
    assert.equal(JSON.stringify(item).includes('NÃO INFORMADO'), false);
    assert.equal(JSON.stringify(item).includes('não informado'), false);

    const pessoas = pessoasDaAgenda(parseResult.agenda);
    assert.equal(pessoas.length, 1);
    assert.equal(pessoas[0]?.telefone, undefined);
    assert.equal(pessoas[0]?.email, undefined);

    const upsert = await pessoaRepo.upsertMuitos(pessoas);
    assert.equal(upsert.sucesso, true);
    assert.equal(upsert.inseridas, 1);

    const rows = await appDb.sqlite!.db
      .select()
      .from(pessoasSqlite)
      .where(eq(pessoasSqlite.cpf, '33333333333'));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.telefone, null);
    assert.equal(rows[0]?.email, null);
    assert.notEqual(rows[0]?.telefone, 'NÃO INFORMADO');
    assert.notEqual(rows[0]?.email, 'não informado');

    const sheets = new InMemoryGoogleSheetsValues();
    const repository = new GoogleSheetsAgendaRepository({ sheets, agora: HOJE_FIXO });
    const salvar = await repository.salvarAgenda(parseResult.agenda, {
      profissional: 'Profissional Alpha',
      unidadeOperacional: 'LIMÃO',
      perfilId: 'psicologo'
    });
    assert.equal(salvar.sucesso, true);

    const matriz = await sheets.getValues(RANGE_LEITURA);
    assert.ok(matriz.length >= 2);
    const linha = matriz[1];
    assert.ok(linha);
    assert.equal(linha[indiceCabecalhoAgenda('TELEFONE')], SHEET_PLACEHOLDER);
    assert.equal(linha[indiceCabecalhoAgenda('EMAIL')], SHEET_PLACEHOLDER);
    assert.equal(linha[indiceCabecalhoAgenda('Categoria')], SHEET_PLACEHOLDER);
    assert.equal(linha.join('|').includes('NÃO INFORMADO'), false);
  });

  it('merge preserva telefone/e-mail/categoria existentes quando portal omite (pós-normalização)', () => {
    const mesclado = mesclarItemPortalEmRegistroAtivo(
      {
        dataConsulta: '21/07/2026',
        dataInclusao: '15/07/2026 08:00',
        profissional: 'Psicólogo: PROFISSIONAL ALPHA',
        unidadeOperacional: 'LIMÃO',
        rowIndex: 0,
        item: {
          horario: '08:00',
          paciente: {
            nome: 'Paciente',
            cpf: '000.000.000-00',
            telefone: '(11) 900000001',
            email: 'existente@example.test'
          },
          tipoProcesso: 'Renovação',
          categoria: 'B'
        }
      },
      {
        horario: '14:00',
        paciente: {
          nome: 'Paciente',
          cpf: '000.000.000-00'
        },
        tipoProcesso: 'Renovação'
      }
    );

    assert.equal(mesclado.alterouProjecao, false);
    assert.equal(mesclado.registro.item.paciente.telefone, '(11) 900000001');
    assert.equal(mesclado.registro.item.paciente.email, 'existente@example.test');
    assert.equal(mesclado.registro.item.categoria, 'B');
  });

  it('merge atualiza nome quando o completo do portal difere do da planilha', () => {
    const mesclado = mesclarItemPortalEmRegistroAtivo(
      {
        dataConsulta: '21/07/2026',
        dataInclusao: '15/07/2026 08:00',
        profissional: 'Psicólogo: PROFISSIONAL ALPHA',
        unidadeOperacional: 'LIMÃO',
        rowIndex: 0,
        item: {
          horario: '08:00',
          paciente: {
            nome: 'Jose',
            cpf: '000.000.000-00'
          },
          tipoProcesso: 'Renovação'
        }
      },
      {
        horario: '08:00',
        paciente: {
          nome: 'Jose da Silva',
          cpf: '000.000.000-00'
        },
        tipoProcesso: 'Renovação'
      }
    );

    assert.equal(mesclado.alterouProjecao, true);
    assert.deepEqual(mesclado.camposAtualizados, ['nome']);
    assert.equal(mesclado.registro.item.paciente.nome, 'Jose da Silva');
  });

  it('dedupe por CPF + noop quando portal só traz ausência já projetada', async () => {
    let updates = 0;
    const base = new InMemoryGoogleSheetsValues();
    const sheets: InMemoryGoogleSheetsValues = Object.assign(base, {
      updateValues: async (range: string, values: string[][]): Promise<void> => {
        updates += 1;
        return InMemoryGoogleSheetsValues.prototype.updateValues.call(base, range, values);
      }
    });

    await sheets.updateValues(RANGE_LEITURA, [
      [...CABECALHOS_ABA_AGENDA],
      [
        'LIMÃO',
        '21/07/2026',
        '10:00',
        'PACIENTE SEM CONTATO',
        SHEET_PLACEHOLDER,
        SHEET_PLACEHOLDER,
        'Renovação',
        SHEET_PLACEHOLDER,
        'Psicólogo: PROFISSIONAL ALPHA',
        '15/07/2026 08:00',
        '333.333.333-33'
      ]
    ]);
    const updatesAposSeed = updates;

    const html = fs.readFileSync(
      path.join(fixturesDirectory, 'campos-nao-informado.html'),
      'utf8'
    );
    const parseResult = parseAgendaHtml(html, { dataConsulta: '25/07/2026' });
    assert.ok(parseResult.agenda);

    const repository = new GoogleSheetsAgendaRepository({ sheets, agora: HOJE_FIXO });
    const resultado = await repository.salvarAgenda(parseResult.agenda, {
      profissional: 'Profissional Alpha',
      unidadeOperacional: 'LIMÃO',
      perfilId: 'psicologo'
    });

    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.linhasGravadas, 0);
    assert.equal(resultado.linhasRemovidas, 0);
    assert.equal(updates, updatesAposSeed);

    const matriz = await sheets.getValues(RANGE_LEITURA);
    assert.equal(matriz.length, 2);
    assert.equal(matriz[1]?.[INDICE_COLUNA_TECNICA_CPF], '333.333.333-33');
  });
});
