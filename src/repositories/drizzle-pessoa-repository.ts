import { eq } from 'drizzle-orm';

import type { AppDatabase } from '../db/client.js';
import { ORIGEM_PROJETO_ECNH, pessoasPostgres, pessoasSqlite } from '../db/schema/index.js';
import { normalizeCpfKey } from '../utils/cpf.js';

import type {
  PessoaParaPersistencia,
  PessoaRepository,
  ResultadoUpsertPessoas
} from './pessoa-repository.js';

function agoraIso(): string {
  return new Date().toISOString();
}

/**
 * Persistência de pessoas via Drizzle (SQLite ou PostgreSQL).
 * Sem DELETE. Soft-flag `ativo` e `origem` não são alterados em updates do sync.
 */
export class DrizzlePessoaRepository implements PessoaRepository {
  public constructor(private readonly appDb: AppDatabase) {}

  public async upsertMuitos(
    pessoas: PessoaParaPersistencia[]
  ): Promise<ResultadoUpsertPessoas> {
    let inseridas = 0;
    let atualizadas = 0;
    let ignoradas = 0;

    const vistos = new Set<string>();

    for (const pessoa of pessoas) {
      const cpf = normalizeCpfKey(pessoa.cpf);
      if (cpf === undefined) {
        ignoradas += 1;
        continue;
      }
      if (vistos.has(cpf)) {
        ignoradas += 1;
        continue;
      }
      vistos.add(cpf);

      const resultado = await this.upsertUma({
        cpf,
        nome: emptyToUndefined(pessoa.nome),
        email: emptyToUndefined(pessoa.email),
        telefone: emptyToUndefined(pessoa.telefone)
      });
      if (resultado === 'inserida') {
        inseridas += 1;
      } else {
        atualizadas += 1;
      }
    }

    return { sucesso: true, inseridas, atualizadas, ignoradas };
  }

  private async upsertUma(pessoa: {
    cpf: string;
    nome?: string;
    email?: string;
    telefone?: string;
  }): Promise<'inserida' | 'atualizada'> {
    const agora = agoraIso();

    if (this.appDb.dialect === 'sqlite' && this.appDb.sqlite !== undefined) {
      const { db } = this.appDb.sqlite;
      const existente = await db
        .select({
          id: pessoasSqlite.id,
          nome: pessoasSqlite.nome,
          email: pessoasSqlite.email,
          telefone: pessoasSqlite.telefone
        })
        .from(pessoasSqlite)
        .where(eq(pessoasSqlite.cpf, pessoa.cpf))
        .limit(1);

      const atual = existente[0];
      if (atual === undefined) {
        await db.insert(pessoasSqlite).values({
          cpf: pessoa.cpf,
          nome: pessoa.nome ?? null,
          email: pessoa.email ?? null,
          telefone: pessoa.telefone ?? null,
          origem: ORIGEM_PROJETO_ECNH,
          ativo: true,
          primeiraSincronizacao: agora,
          ultimaSincronizacao: agora,
          createdAt: agora,
          updatedAt: agora
        });
        return 'inserida';
      }

      await db
        .update(pessoasSqlite)
        .set({
          nome: pessoa.nome ?? atual.nome,
          email: pessoa.email ?? atual.email,
          telefone: pessoa.telefone ?? atual.telefone,
          ultimaSincronizacao: agora,
          updatedAt: agora
        })
        .where(eq(pessoasSqlite.cpf, pessoa.cpf));
      return 'atualizada';
    }

    if (this.appDb.dialect === 'postgres' && this.appDb.postgres !== undefined) {
      const { db } = this.appDb.postgres;
      const agoraDate = new Date(agora);
      const existente = await db
        .select({
          id: pessoasPostgres.id,
          nome: pessoasPostgres.nome,
          email: pessoasPostgres.email,
          telefone: pessoasPostgres.telefone
        })
        .from(pessoasPostgres)
        .where(eq(pessoasPostgres.cpf, pessoa.cpf))
        .limit(1);

      const atual = existente[0];
      if (atual === undefined) {
        await db.insert(pessoasPostgres).values({
          cpf: pessoa.cpf,
          nome: pessoa.nome ?? null,
          email: pessoa.email ?? null,
          telefone: pessoa.telefone ?? null,
          origem: ORIGEM_PROJETO_ECNH,
          ativo: true,
          primeiraSincronizacao: agoraDate,
          ultimaSincronizacao: agoraDate,
          createdAt: agoraDate,
          updatedAt: agoraDate
        });
        return 'inserida';
      }

      await db
        .update(pessoasPostgres)
        .set({
          nome: pessoa.nome ?? atual.nome,
          email: pessoa.email ?? atual.email,
          telefone: pessoa.telefone ?? atual.telefone,
          ultimaSincronizacao: agoraDate,
          updatedAt: agoraDate
        })
        .where(eq(pessoasPostgres.cpf, pessoa.cpf));
      return 'atualizada';
    }

    throw new Error('AppDatabase sem dialeto conectado');
  }
}

function emptyToUndefined(valor: string | undefined): string | undefined {
  const trimmed = valor?.trim();
  if (trimmed === undefined || trimmed.length === 0) {
    return undefined;
  }
  return trimmed;
}
