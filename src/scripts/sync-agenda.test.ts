import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ResultadoSincronizacao } from '../services/agenda-sync-service.js';

import { formatarResumoSincronizacao } from './sync-agenda-resumo.js';

describe('formatarResumoSincronizacao', () => {
  it('produz resumo sem CPF nem senha', () => {
    const resultado: ResultadoSincronizacao = {
      sucessoGeral: false,
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

    assert.match(texto, /Sucesso geral: não/);
    assert.match(texto, /ECNH_USER_1/);
    assert.match(texto, /14\/07\/2026: falha \(erro-infraestrutura\)/);
    assert.equal(texto.includes('000.000.000-00'), false);
    assert.equal(texto.includes('senha'), false);
  });
});
