import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import type { AxiosRequestConfig, AxiosResponse } from 'axios';

import { AuthTransport } from './auth-transport.js';
import { ECNHAuthenticationProtocol } from './ecnh-auth-protocol.js';

const fixturesDirectory = join(process.cwd(), 'fixtures/portal');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDirectory, name), 'utf8');
}

function asResponse(data: string): AxiosResponse<string> {
  return {
    config: {},
    data,
    headers: {},
    status: 200,
    statusText: 'OK'
  } as AxiosResponse<string>;
}

type RequestHandler = (config: AxiosRequestConfig) => Promise<AxiosResponse<string>>;

function createFakeTransport(handler: RequestHandler): AuthTransport {
  return {
    hasCookie: async () => true,
    request: handler,
    resolveUrl: (path: string) => `https://portal.test${path.startsWith('/') ? path : `/${path}`}`
  } as unknown as AuthTransport;
}

function parseBody(data: unknown): URLSearchParams {
  return new URLSearchParams(typeof data === 'string' ? data : '');
}

describe('ECNHAuthenticationProtocol — B010 sessão existente', () => {
  const credentials = { cpf: '00000000000', password: 'senha-teste' };
  const protocol = new ECNHAuthenticationProtocol();

  it('reenvia autenticar com forceLogout=true e classifica B012', async () => {
    const postsAutenticar: URLSearchParams[] = [];
    const transport = createFakeTransport(async (config) => {
      const method = (config.method ?? 'GET').toUpperCase();
      if (method === 'GET') {
        return asResponse(loadFixture('login-form.html'));
      }
      const body = parseBody(config.data);
      if (body.get('method') === 'iniciarLoginAgenda') {
        return asResponse(loadFixture('login-form.html'));
      }
      if (body.get('method') === 'autenticar') {
        postsAutenticar.push(body);
        if (body.get('forceLogout') === 'true') {
          return asResponse(loadFixture('autenticado-psicologo.html'));
        }
        return asResponse(loadFixture('pos-autenticar-open-dialog-new-session.html'));
      }
      throw new Error(`Requisição inesperada: ${method} ${String(config.url)}`);
    });

    const result = await protocol.login(credentials, transport);

    assert.equal(result.status, 'sucesso');
    if (result.status === 'sucesso') {
      assert.equal(result.perfil.id, 'psicologo');
    }
    assert.equal(postsAutenticar.length, 2);
    assert.equal(postsAutenticar[0]?.get('forceLogout'), 'false');
    assert.equal(postsAutenticar[1]?.get('forceLogout'), 'true');
    assert.equal(postsAutenticar[1]?.get('codigo'), credentials.cpf);
    assert.equal(postsAutenticar[1]?.get('senha'), credentials.password);
    assert.equal(postsAutenticar[1]?.get('method'), 'autenticar');
  });

  it('após forceLogout, segue B011 quando openDialogChoice aparece', async () => {
    const sequence: string[] = [];
    const transport = createFakeTransport(async (config) => {
      const method = (config.method ?? 'GET').toUpperCase();
      const url = String(config.url ?? '');
      if (method === 'GET' && url.includes('method=iniciarLogin')) {
        sequence.push('GET_iniciarLogin');
        return asResponse(loadFixture('login-form.html'));
      }
      if (method === 'GET' && url.includes('method=openChoice')) {
        sequence.push('GET_openChoice');
        return asResponse(loadFixture('open-choice-unidades.html'));
      }
      const body = parseBody(config.data);
      if (body.get('method') === 'iniciarLoginAgenda') {
        sequence.push('POST_iniciarLoginAgenda');
        return asResponse(loadFixture('login-form.html'));
      }
      if (body.get('method') === 'autenticar') {
        if (body.get('forceLogout') === 'true') {
          sequence.push('POST_forceLogout');
          return asResponse(loadFixture('pos-autenticar-open-dialog-choice.html'));
        }
        if (body.get('idUnidTransito') === '18') {
          sequence.push('POST_autenticar_unidade');
          return asResponse(loadFixture('autenticado-medico.html'));
        }
        sequence.push('POST_autenticar');
        return asResponse(loadFixture('pos-autenticar-open-dialog-new-session.html'));
      }
      throw new Error(`Requisição inesperada: ${method} ${url}`);
    });

    const result = await protocol.login(credentials, transport, {
      unidadeDesejada: { label: 'CIR-SAO PAULO' }
    });

    assert.equal(result.status, 'sucesso');
    if (result.status === 'sucesso') {
      assert.equal(result.perfil.id, 'medico');
    }
    assert.deepEqual(sequence, [
      'GET_iniciarLogin',
      'POST_iniciarLoginAgenda',
      'POST_autenticar',
      'POST_forceLogout',
      'GET_openChoice',
      'POST_autenticar_unidade'
    ]);
  });

  it('falha tipada se openDialogNewSession persistir após forceLogout', async () => {
    const transport = createFakeTransport(async (config) => {
      const method = (config.method ?? 'GET').toUpperCase();
      if (method === 'GET') {
        return asResponse(loadFixture('login-form.html'));
      }
      const body = parseBody(config.data);
      if (body.get('method') === 'iniciarLoginAgenda') {
        return asResponse(loadFixture('login-form.html'));
      }
      if (body.get('method') === 'autenticar') {
        return asResponse(loadFixture('pos-autenticar-open-dialog-new-session.html'));
      }
      throw new Error(`Requisição inesperada: ${method} ${String(config.url)}`);
    });

    const result = await protocol.login(credentials, transport);
    if (result.status !== 'erro_desconhecido') {
      assert.fail(`esperado erro_desconhecido, recebeu ${result.status}`);
    }
    assert.match(result.message, /forceLogout=true/i);
  });

  it('não dispara forceLogout quando o HTML já autentica (caminho feliz)', async () => {
    let autenticarCount = 0;
    const transport = createFakeTransport(async (config) => {
      const method = (config.method ?? 'GET').toUpperCase();
      if (method === 'GET') {
        return asResponse(loadFixture('login-form.html'));
      }
      const body = parseBody(config.data);
      if (body.get('method') === 'iniciarLoginAgenda') {
        return asResponse(loadFixture('login-form.html'));
      }
      if (body.get('method') === 'autenticar') {
        autenticarCount += 1;
        assert.equal(body.get('forceLogout'), 'false');
        return asResponse(loadFixture('autenticado-psicologo.html'));
      }
      throw new Error(`Requisição inesperada: ${method} ${String(config.url)}`);
    });

    const result = await protocol.login(credentials, transport);
    assert.equal(result.status, 'sucesso');
    assert.equal(autenticarCount, 1);
  });
});
