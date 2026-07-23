import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classificarFalhaAutenticacaoHtml } from '../client/classificar-falha-login.js';
import type { LoginResult } from '../types/auth.js';
import type { ProfissionalParaSincronizacao } from '../config/sync-professionals.js';
import {
  CredentialRefreshService,
  formatarResumoAuditoriaCredenciais,
  formatarResumoCredenciais,
  type CredentialRefreshPortalClient
} from './credential-refresh-service.js';
import type { ProfissionalParaCredencial } from '../config/credential-audit-scope.js';

function profissional(
  parcial: Partial<ProfissionalParaSincronizacao> &
    Pick<ProfissionalParaSincronizacao, 'identificadorSeguro' | 'nome'>
): ProfissionalParaSincronizacao {
  return {
    cpf: parcial.cpf ?? '111.111.111-11',
    identificadorSeguro: parcial.identificadorSeguro,
    nome: parcial.nome,
    senha: parcial.senha ?? 'antiga',
    unidadeOperacional: parcial.unidadeOperacional ?? 'LIMÃO',
    perfilEsperado: parcial.perfilEsperado,
    unidadeDesejada: parcial.unidadeDesejada
  };
}

function loggerSilencioso() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined
  };
}

describe('classificarFalhaAutenticacaoHtml', () => {
  it('classifica formulário de login remanescente como senha_invalida', () => {
    const html = '<form name="LoginActionForm"></form>';
    assert.equal(classificarFalhaAutenticacaoHtml(html).status, 'senha_invalida');
  });

  it('não trata openDialogNewSession como senha inválida', () => {
    const html =
      '<script>openDialogNewSession("x","y","false");</script><form name="LoginActionForm"></form>';
    assert.equal(classificarFalhaAutenticacaoHtml(html).status, 'erro_desconhecido');
  });
});

describe('CredentialRefreshService', () => {
  it('mantém credencial quando o login atual sucede', async () => {
    const client: CredentialRefreshPortalClient = {
      login: async () => ({
        status: 'sucesso',
        session: { authenticatedAt: new Date(), perfilId: 'psicologo' }
      }),
      logout: async () => undefined
    };
    let persistiu = false;
    const service = new CredentialRefreshService({
      candidatas: [{ nome: 'A', cpf: '111.111.111-11', senha: 'nova' }],
      createClient: () => client,
      logger: loggerSilencioso(),
      profissionais: [profissional({ identificadorSeguro: 'ECNH_USER_1', nome: 'A' })],
      store: {
        atualizarCredencialUsuario: () => {
          persistiu = true;
        }
      }
    });

    const resultado = await service.executar();
    assert.equal(resultado.mantidas, 1);
    assert.equal(resultado.atualizadas, 0);
    assert.equal(persistiu, false);
  });

  it('não tenta candidata em timeout / portal indisponível', async () => {
    for (const status of ['timeout', 'portal_indisponivel', 'erro_sistema'] as const) {
      let logins = 0;
      const client: CredentialRefreshPortalClient = {
        login: async () => {
          logins += 1;
          return { status, message: 'x' } satisfies LoginResult;
        },
        logout: async () => undefined
      };
      const service = new CredentialRefreshService({
        candidatas: [{ nome: 'A', cpf: '111.111.111-11', senha: 'nova' }],
        createClient: () => client,
        logger: loggerSilencioso(),
        profissionais: [profissional({ identificadorSeguro: 'ECNH_USER_1', nome: 'A' })],
        store: { atualizarCredencialUsuario: () => undefined }
      });
      const resultado = await service.executar();
      assert.equal(resultado.falharam, 1);
      assert.equal(logins, 1, status);
    }
  });

  it('atualiza e persiste quando candidata autentica após senha_invalida', async () => {
    let etapa = 0;
    const client: CredentialRefreshPortalClient = {
      login: async (_cpf, password) => {
        etapa += 1;
        if (etapa === 1) {
          assert.equal(password, 'antiga');
          return { status: 'senha_invalida', message: 'rejeitada' };
        }
        assert.equal(password, 'Nova@123');
        return {
          status: 'sucesso',
          session: { authenticatedAt: new Date(), perfilId: 'medico' }
        };
      },
      logout: async () => undefined
    };
    const persistidos: Array<{ indice: number; cpf: string; senha: string }> = [];
    const service = new CredentialRefreshService({
      candidatas: [{ nome: 'Bruno', cpf: '101.931.366-86', senha: 'Nova@123' }],
      createClient: () => client,
      logger: loggerSilencioso(),
      profissionais: [
        profissional({
          identificadorSeguro: 'ECNH_USER_7',
          nome: 'Bruno',
          cpf: '101.931.366-86',
          senha: 'antiga'
        })
      ],
      store: {
        atualizarCredencialUsuario: (p) => {
          persistidos.push(p);
        }
      }
    });

    const resultado = await service.executar();
    assert.equal(resultado.atualizadas, 1);
    assert.equal(persistidos[0]?.indice, 7);
    assert.equal(persistidos[0]?.senha, 'Nova@123');
  });

  it('falha sem loop quando candidata também é rejeitada', async () => {
    let logins = 0;
    const client: CredentialRefreshPortalClient = {
      login: async () => {
        logins += 1;
        return { status: 'senha_invalida', message: 'rejeitada' };
      },
      logout: async () => undefined
    };
    const service = new CredentialRefreshService({
      candidatas: [{ nome: 'X', cpf: '111.111.111-11', senha: 'outra' }],
      createClient: () => client,
      logger: loggerSilencioso(),
      profissionais: [profissional({ identificadorSeguro: 'ECNH_USER_1', nome: 'X' })],
      store: { atualizarCredencialUsuario: () => assert.fail('não deve persistir') }
    });
    const resultado = await service.executar();
    assert.equal(resultado.falharam, 1);
    assert.equal(logins, 2);
  });

  it('formata resumo de auditoria sem expor CPF/senha', () => {
    const texto = formatarResumoCredenciais({
      processados: 4,
      mantidas: 2,
      atualizadas: 1,
      semCandidata: 0,
      falharamNovamente: 1,
      portalIndisponivel: 0,
      timeout: 0,
      errosInternos: 0,
      falharam: 1,
      profissionais: [
        {
          identificadorSeguro: 'ECNH_USER_1',
          nome: 'Aline',
          status: 'mantida',
          habilitado: true
        },
        {
          identificadorSeguro: 'ECNH_USER_2',
          nome: 'Bruno',
          status: 'atualizada',
          camposAtualizados: 'senha',
          habilitado: true
        },
        {
          identificadorSeguro: 'ECNH_USER_3',
          nome: 'Caio',
          status: 'falhou',
          motivo: 'Candidata falhou com status senha_invalida.',
          categoriaFalha: 'falhou_novamente',
          habilitado: true
        },
        {
          identificadorSeguro: 'ECNH_USER_4',
          nome: 'Diana',
          status: 'mantida',
          habilitado: true
        }
      ]
    });
    assert.match(texto, /REFRESH DE CREDENCIAIS/);
    assert.match(texto, /Profissionais processados: 04/);
    assert.match(texto, /Mantidos: 02/);
    assert.match(texto, /Atualizados: 01/);
    assert.match(texto, /Falharam novamente: 01/);
    assert.match(texto, /- Bruno \(senha\)/);
    assert.match(texto, /- Caio \(Candidata falhou/);
    assert.doesNotMatch(texto, /\d{3}\.\d{3}\.\d{3}-\d{2}/);
  });

  it('audita desabilitados sem alterar regra de retry e formata resumo', async () => {
    let etapa = 0;
    const client: CredentialRefreshPortalClient = {
      login: async (_cpf, password) => {
        etapa += 1;
        if (etapa === 1) {
          assert.equal(password, 'antiga');
          return { status: 'senha_invalida', message: 'rejeitada' };
        }
        return {
          status: 'sucesso',
          session: { authenticatedAt: new Date(), perfilId: 'psicologo' }
        };
      },
      logout: async () => undefined
    };

    const desabilitado: ProfissionalParaCredencial = {
      cpf: '228.107.688-11',
      habilitado: false,
      identificadorSeguro: 'ECNH_USER_10',
      nome: 'Priscila',
      senha: 'antiga',
      unidadeOperacional: 'CAPÃO REDONDO'
    };

    let persistiuEnabled = false;
    const service = new CredentialRefreshService({
      candidatas: [{ nome: 'Priscila', cpf: '228.107.688-11', senha: '@Pl197325' }],
      createClient: () => client,
      logger: loggerSilencioso(),
      profissionais: [],
      store: {
        atualizarCredencialUsuario: (p) => {
          assert.equal(p.indice, 10);
          persistiuEnabled = true;
        }
      }
    });

    const resultado = await service.executarAuditoria([desabilitado]);
    assert.equal(resultado.atualizadas, 1);
    assert.equal(resultado.desabilitadosValidados, 1);
    assert.equal(resultado.autenticaram, 1);
    assert.equal(persistiuEnabled, true);
    assert.equal(resultado.profissionais[0]?.habilitado, false);

    const texto = formatarResumoAuditoriaCredenciais(resultado);
    assert.match(texto, /AUDITORIA DE CREDENCIAIS/);
    assert.match(texto, /Desabilitados validados: 01/);
    assert.match(texto, /Priscila \(senha\) \[desabilitado\]/);
  });
});
