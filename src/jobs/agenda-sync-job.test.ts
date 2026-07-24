import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  AgendaSyncService,
  EntradaSincronizacaoProfissional,
  ResultadoSincronizacao
} from '../services/agenda-sync-service.js';

import { AgendaSyncJob } from './agenda-sync-job.js';
import type { SyncLock, SyncLockHandle } from './sync-lock.js';

describe('AgendaSyncJob', () => {
  const entrada: EntradaSincronizacaoProfissional = {
    cpf: '000.000.000-00',
    identificadorSeguro: 'ECNH_USER_1',
    password: 'segredo',
    profissional: 'Teste',
    unidadeOperacional: 'LIMÃO'
  };

  it('executa a sincronização quando o lock é adquirido', async () => {
    const sincronizacao: ResultadoSincronizacao = {
      profissionais: [
        {
          datas: [],
          identificadorSeguro: 'ECNH_USER_1',
          logoutExecutado: true,
          sucesso: true
        }
      ],
      sucessoGeral: true,
      sucessos: 1,
      falhas: 0,
      duracaoTotalMs: 10,
      falhasPorMotivo: {}
    };

    let liberado = false;
    const lock: SyncLock = {
      tentarAdquirir: async (): Promise<SyncLockHandle> => ({
        liberar: async (): Promise<void> => {
          liberado = true;
        }
      })
    };

    let chamado = false;
    const service = {
      sincronizarProfissionais: async (): Promise<ResultadoSincronizacao> => {
        chamado = true;
        return sincronizacao;
      }
    } as Pick<AgendaSyncService, 'sincronizarProfissionais'> as AgendaSyncService;

    const job = new AgendaSyncJob({
      entradas: [entrada],
      lock,
      service
    });

    const resultado = await job.executar();
    assert.equal(resultado.status, 'executado');
    if (resultado.status === 'executado') {
      assert.equal(resultado.sincronizacao.sucessoGeral, true);
    }
    assert.equal(chamado, true);
    assert.equal(liberado, true);
  });

  it('retorna ignorado_por_lock sem chamar o serviço', async () => {
    const lock: SyncLock = {
      tentarAdquirir: async (): Promise<null> => null
    };

    let chamado = false;
    const service = {
      sincronizarProfissionais: async (): Promise<ResultadoSincronizacao> => {
        chamado = true;
        return {
          profissionais: [],
          sucessoGeral: true,
          sucessos: 0,
          falhas: 0,
          duracaoTotalMs: 0,
          falhasPorMotivo: {}
        };
      }
    } as Pick<AgendaSyncService, 'sincronizarProfissionais'> as AgendaSyncService;

    const job = new AgendaSyncJob({
      entradas: [entrada],
      lock,
      service
    });

    const resultado = await job.executar();
    assert.deepEqual(resultado, { status: 'ignorado_por_lock' });
    assert.equal(chamado, false);
  });

  it('libera o lock mesmo quando a sincronização falha', async () => {
    let liberado = false;
    const lock: SyncLock = {
      tentarAdquirir: async (): Promise<SyncLockHandle> => ({
        liberar: async (): Promise<void> => {
          liberado = true;
        }
      })
    };

    const service = {
      sincronizarProfissionais: async (): Promise<ResultadoSincronizacao> => {
        throw new Error('falha simulada');
      }
    } as Pick<AgendaSyncService, 'sincronizarProfissionais'> as AgendaSyncService;

    const job = new AgendaSyncJob({
      entradas: [entrada],
      lock,
      service
    });

    await assert.rejects(async () => job.executar(), /falha simulada/);
    assert.equal(liberado, true);
  });
});
