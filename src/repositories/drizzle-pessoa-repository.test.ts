import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';

import type { AppDatabase } from '../db/client.js';
import { openAppDatabase } from '../db/client.js';
import { pessoasSqlite } from '../db/schema/index.js';
import { ORIGEM_PROJETO_ECNH } from '../db/schema/pessoas.sqlite.js';

import { DrizzlePessoaRepository } from './drizzle-pessoa-repository.js';

describe('DrizzlePessoaRepository (SQLite)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecnh-pessoas-'));
  const sqlitePath = path.join(dir, 'teste.sqlite');
  let appDb: AppDatabase;
  let repo: DrizzlePessoaRepository;

  before(async () => {
    appDb = await openAppDatabase({
      enabled: true,
      dialect: 'sqlite',
      sqlitePath
    });
    repo = new DrizzlePessoaRepository(appDb);
  });

  after(async () => {
    await appDb.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('insere pessoa nova com origem e ativo', async () => {
    const resultado = await repo.upsertMuitos([
      {
        cpf: '123.456.789-09',
        nome: 'PACIENTE A',
        email: 'a@example.com',
        telefone: '11999990000'
      }
    ]);
    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.inseridas, 1);
    assert.equal(resultado.atualizadas, 0);

    const rows = await appDb.sqlite!.db.select().from(pessoasSqlite);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.cpf, '12345678909');
    assert.equal(rows[0]?.origem, ORIGEM_PROJETO_ECNH);
    assert.equal(rows[0]?.ativo, true);
    assert.ok(rows[0]?.primeiraSincronizacao);
    assert.equal(rows[0]?.primeiraSincronizacao, rows[0]?.ultimaSincronizacao);
  });

  it('atualiza dados e ultima_sincronizacao sem duplicar nem apagar', async () => {
    await new Promise((r) => setTimeout(r, 5));
    const resultado = await repo.upsertMuitos([
      {
        cpf: '12345678909',
        nome: 'PACIENTE A RENOMEADO',
        email: 'novo@example.com'
      }
    ]);
    assert.equal(resultado.inseridas, 0);
    assert.equal(resultado.atualizadas, 1);

    const rows = await appDb.sqlite!.db
      .select()
      .from(pessoasSqlite)
      .where(eq(pessoasSqlite.cpf, '12345678909'));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.nome, 'PACIENTE A RENOMEADO');
    assert.equal(rows[0]?.email, 'novo@example.com');
    assert.equal(rows[0]?.telefone, '11999990000');
    assert.notEqual(rows[0]?.primeiraSincronizacao, rows[0]?.ultimaSincronizacao);
    assert.equal(rows[0]?.origem, ORIGEM_PROJETO_ECNH);
    assert.equal(rows[0]?.ativo, true);
  });

  it('ignora CPF inválido e não remove existentes', async () => {
    const resultado = await repo.upsertMuitos([{ cpf: '123', nome: 'X' }]);
    assert.equal(resultado.ignoradas, 1);
    assert.equal(resultado.inseridas, 0);

    const rows = await appDb.sqlite!.db.select().from(pessoasSqlite);
    assert.equal(rows.length, 1);
  });
});
