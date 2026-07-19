import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ConfigurationError } from '../client/errors.js';

import {
  paraEntradaSincronizacao,
  resolveEnabledSyncProfessionals,
  resolveEntradasSincronizacao
} from './sync-professionals.js';

describe('resolveEnabledSyncProfessionals', () => {
  it('inclui profissional habilitado com NAME, CPF e PASSWORD', () => {
    const profissionais = resolveEnabledSyncProfessionals({
      ECNH_USER_1_ENABLED: 'true',
      ECNH_USER_1_NAME: 'Profissional Alpha',
      ECNH_USER_1_CPF: '111.111.111-11',
      ECNH_USER_1_PASSWORD: 'senha-alpha'
    });

    assert.equal(profissionais.length, 1);
    assert.deepEqual(profissionais[0], {
      cpf: '111.111.111-11',
      identificadorSeguro: 'ECNH_USER_1',
      nome: 'Profissional Alpha',
      senha: 'senha-alpha'
    });
  });

  it('ignora profissional desabilitado', () => {
    const profissionais = resolveEnabledSyncProfessionals({
      ECNH_USER_1_ENABLED: 'false',
      ECNH_USER_1_NAME: 'Ignorado',
      ECNH_USER_1_CPF: '111.111.111-11',
      ECNH_USER_1_PASSWORD: 'senha',
      ECNH_USER_2_ENABLED: 'true',
      ECNH_USER_2_NAME: 'Profissional Beta',
      ECNH_USER_2_CPF: '222.222.222-22',
      ECNH_USER_2_PASSWORD: 'senha-beta'
    });

    assert.equal(profissionais.length, 1);
    assert.equal(profissionais[0]?.identificadorSeguro, 'ECNH_USER_2');
    assert.equal(profissionais[0]?.nome, 'Profissional Beta');
  });

  it('falha quando ENABLED=true sem configuração obrigatória', () => {
    assert.throws(
      () =>
        resolveEnabledSyncProfessionals({
          ECNH_USER_1_ENABLED: 'true',
          ECNH_USER_1_CPF: '111.111.111-11',
          ECNH_USER_1_PASSWORD: 'senha'
        }),
      (error: unknown) =>
        error instanceof ConfigurationError &&
        error.message.includes('ECNH_USER_1_NAME') &&
        !error.message.includes('111.111.111-11')
    );

    assert.throws(
      () => resolveEnabledSyncProfessionals({}),
      (error: unknown) =>
        error instanceof ConfigurationError &&
        error.message.includes('Nenhum profissional habilitado')
    );
  });

  it('retorna múltiplos profissionais habilitados na ordem dos índices', () => {
    const profissionais = resolveEnabledSyncProfessionals({
      ECNH_USER_1_ENABLED: 'true',
      ECNH_USER_1_NAME: 'Alpha',
      ECNH_USER_1_CPF: '111.111.111-11',
      ECNH_USER_1_PASSWORD: 'a',
      ECNH_USER_3_ENABLED: 'true',
      ECNH_USER_3_NAME: 'Gamma',
      ECNH_USER_3_CPF: '333.333.333-33',
      ECNH_USER_3_PASSWORD: 'c',
      ECNH_USER_2_ENABLED: 'true',
      ECNH_USER_2_NAME: 'Beta',
      ECNH_USER_2_CPF: '222.222.222-22',
      ECNH_USER_2_PASSWORD: 'b'
    });

    assert.deepEqual(
      profissionais.map((item) => item.identificadorSeguro),
      ['ECNH_USER_1', 'ECNH_USER_2', 'ECNH_USER_3']
    );
    assert.deepEqual(
      profissionais.map((item) => item.nome),
      ['Alpha', 'Beta', 'Gamma']
    );
  });
});

describe('paraEntradaSincronizacao / resolveEntradasSincronizacao', () => {
  it('mapeia para EntradaSincronizacaoProfissional sem expor o .env ao serviço', () => {
    const entrada = paraEntradaSincronizacao({
      cpf: '111.111.111-11',
      identificadorSeguro: 'ECNH_USER_1',
      nome: 'Profissional Alpha',
      senha: 'senha-alpha'
    });

    assert.deepEqual(entrada, {
      cpf: '111.111.111-11',
      identificadorSeguro: 'ECNH_USER_1',
      password: 'senha-alpha',
      profissional: 'Profissional Alpha'
    });

    const entradas = resolveEntradasSincronizacao({
      ECNH_USER_1_ENABLED: 'true',
      ECNH_USER_1_NAME: 'Profissional Alpha',
      ECNH_USER_1_CPF: '111.111.111-11',
      ECNH_USER_1_PASSWORD: 'senha-alpha'
    });

    assert.equal(entradas.length, 1);
    assert.equal(entradas[0]?.profissional, 'Profissional Alpha');
  });
});
