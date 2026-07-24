import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ResultadoSincronizacao } from '../services/agenda-sync-service.js';

import { codigoSaidaSincronizacao, formatarResumoSincronizacao } from './sync-agenda-resumo.js';

describe('formatarResumoSincronizacao', () => {
  it('produz resumo sem CPF nem senha e inclui métricas agregadas', () => {
    const resultado: ResultadoSincronizacao = {
      sucessoGeral: false,
      sucessos: 0,
      falhas: 1,
      duracaoTotalMs: 12_500,
      falhasPorMotivo: { 'persistencia:erro-infraestrutura': 1 },
      profissionais: [
        {
          identificadorSeguro: 'ECNH_USER_1',
          loginStatus: 'sucesso',
          logoutExecutado: true,
          sucesso: false,
          datas: [
            {
              dataConsulta: '13/07/2026',
              sucesso: true,
              itensExtraidos: 2,
              linhasGravadas: 2,
              linhasRemovidas: 0
            },
            {
              dataConsulta: '14/07/2026',
              sucesso: false,
              motivoFalhaPersistencia: 'erro-infraestrutura'
            }
          ]
        }
      ]
    };

    const texto = formatarResumoSincronizacao(resultado);

    assert.match(texto, /Profissionais processados: 1/);
    assert.match(texto, /Sucesso: 0/);
    assert.match(texto, /Falhas: 1/);
    assert.match(texto, /Sucesso geral: não/);
    assert.match(texto, /Tempo total:/);
    assert.match(texto, /persistencia:erro-infraestrutura: 1/);
    assert.match(texto, /ECNH_USER_1/);
    assert.match(texto, /14\/07\/2026: falha \(erro-infraestrutura\)/);
    assert.equal(texto.includes('000.000.000-00'), false);
    assert.equal(texto.includes('senha'), false);
  });
});

describe('codigoSaidaSincronizacao', () => {
  it('retorna 0 em sucesso parcial', () => {
    const resultado: ResultadoSincronizacao = {
      sucessoGeral: false,
      sucessos: 2,
      falhas: 1,
      duracaoTotalMs: 100,
      falhasPorMotivo: { 'persistencia:erro-infraestrutura': 1 },
      profissionais: [
        { identificadorSeguro: 'A', datas: [], logoutExecutado: true, sucesso: true },
        { identificadorSeguro: 'B', datas: [], logoutExecutado: true, sucesso: true },
        { identificadorSeguro: 'C', datas: [], logoutExecutado: true, sucesso: false }
      ]
    };
    assert.equal(codigoSaidaSincronizacao(resultado), 0);
  });

  it('retorna 1 quando todos falharam', () => {
    const resultado: ResultadoSincronizacao = {
      sucessoGeral: false,
      sucessos: 0,
      falhas: 1,
      duracaoTotalMs: 100,
      falhasPorMotivo: { 'login:senha_invalida': 1 },
      profissionais: [
        { identificadorSeguro: 'A', datas: [], logoutExecutado: true, sucesso: false }
      ]
    };
    assert.equal(codigoSaidaSincronizacao(resultado), 1);
  });
});
