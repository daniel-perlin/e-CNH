import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ConfigurationError } from '../client/errors.js';

import {
  paraEntradaSincronizacao,
  resolveEnabledSyncProfessionals,
  resolveEntradasSincronizacao
} from './sync-professionals.js';

const CLINIC_LIMAO = 'Talento Limão/Zona Norte';
const CLINIC_CAPAO = 'Capão Redondo/Zona Sul';
const CLINIC_CARRAO = 'Clínica Carrão/Zona Leste';

describe('resolveEnabledSyncProfessionals', () => {
  it('inclui profissional habilitado com NAME, CPF, PASSWORD e CLINIC', () => {
    const profissionais = resolveEnabledSyncProfessionals({
      ECNH_USER_1_ENABLED: 'true',
      ECNH_USER_1_NAME: 'Profissional Alpha',
      ECNH_USER_1_CPF: '111.111.111-11',
      ECNH_USER_1_PASSWORD: 'senha-alpha',
      ECNH_USER_1_CLINIC: CLINIC_LIMAO
    });

    assert.equal(profissionais.length, 1);
    assert.deepEqual(profissionais[0], {
      cpf: '111.111.111-11',
      identificadorSeguro: 'ECNH_USER_1',
      nome: 'Profissional Alpha',
      senha: 'senha-alpha',
      unidadeOperacional: 'LIMÃO'
    });
  });

  it('ignora profissional desabilitado', () => {
    const profissionais = resolveEnabledSyncProfessionals({
      ECNH_USER_1_ENABLED: 'false',
      ECNH_USER_1_NAME: 'Ignorado',
      ECNH_USER_1_CPF: '111.111.111-11',
      ECNH_USER_1_PASSWORD: 'senha',
      ECNH_USER_1_CLINIC: CLINIC_LIMAO,
      ECNH_USER_2_ENABLED: 'true',
      ECNH_USER_2_NAME: 'Profissional Beta',
      ECNH_USER_2_CPF: '222.222.222-22',
      ECNH_USER_2_PASSWORD: 'senha-beta',
      ECNH_USER_2_CLINIC: CLINIC_CAPAO
    });

    assert.equal(profissionais.length, 1);
    assert.equal(profissionais[0]?.identificadorSeguro, 'ECNH_USER_2');
    assert.equal(profissionais[0]?.nome, 'Profissional Beta');
    assert.equal(profissionais[0]?.unidadeOperacional, 'CAPÃO REDONDO');
  });

  it('mapeia PROFILE ou ROLE opcional para perfilEsperado', () => {
    const comProfile = resolveEnabledSyncProfessionals({
      ECNH_USER_1_ENABLED: 'true',
      ECNH_USER_1_NAME: 'Alpha',
      ECNH_USER_1_CPF: '111.111.111-11',
      ECNH_USER_1_PASSWORD: 'a',
      ECNH_USER_1_CLINIC: CLINIC_LIMAO,
      ECNH_USER_1_PROFILE: 'medico'
    });
    assert.equal(comProfile[0]?.perfilEsperado, 'medico');

    const comRole = resolveEnabledSyncProfessionals({
      ECNH_USER_2_ENABLED: 'true',
      ECNH_USER_2_NAME: 'Beta',
      ECNH_USER_2_CPF: '222.222.222-22',
      ECNH_USER_2_PASSWORD: 'b',
      ECNH_USER_2_CLINIC: CLINIC_CAPAO,
      ECNH_USER_2_ROLE: 'Psicologo'
    });
    assert.equal(comRole[0]?.perfilEsperado, 'psicologo');
  });

  it('mapeia UNIDADE / UNID_TRANSITO para unidadeDesejada', () => {
    const comLabel = resolveEnabledSyncProfessionals({
      ECNH_USER_1_ENABLED: 'true',
      ECNH_USER_1_NAME: 'Alpha',
      ECNH_USER_1_CPF: '111.111.111-11',
      ECNH_USER_1_PASSWORD: 'a',
      ECNH_USER_1_CLINIC: CLINIC_LIMAO,
      ECNH_USER_1_UNIDADE: 'CIR-SAO PAULO'
    });
    assert.deepEqual(comLabel[0]?.unidadeDesejada, { label: 'CIR-SAO PAULO' });

    const comId = resolveEnabledSyncProfessionals({
      ECNH_USER_2_ENABLED: 'true',
      ECNH_USER_2_NAME: 'Beta',
      ECNH_USER_2_CPF: '222.222.222-22',
      ECNH_USER_2_PASSWORD: 'b',
      ECNH_USER_2_CLINIC: CLINIC_CAPAO,
      ECNH_USER_2_UNID_TRANSITO: '18',
      ECNH_USER_2_UNIDADE: 'OUTRA'
    });
    assert.deepEqual(comId[0]?.unidadeDesejada, {
      label: 'OUTRA',
      idUnidTransito: '18'
    });
  });

  it('falha com PROFILE inválido', () => {
    assert.throws(
      () =>
        resolveEnabledSyncProfessionals({
          ECNH_USER_1_ENABLED: 'true',
          ECNH_USER_1_NAME: 'Alpha',
          ECNH_USER_1_CPF: '111.111.111-11',
          ECNH_USER_1_PASSWORD: 'a',
          ECNH_USER_1_CLINIC: CLINIC_LIMAO,
          ECNH_USER_1_PROFILE: 'dentista'
        }),
      (error: unknown) =>
        error instanceof ConfigurationError && error.message.includes('PROFILE/ROLE inválido')
    );
  });

  it('falha com CLINIC ausente ou sem mapeamento', () => {
    assert.throws(
      () =>
        resolveEnabledSyncProfessionals({
          ECNH_USER_1_ENABLED: 'true',
          ECNH_USER_1_NAME: 'Alpha',
          ECNH_USER_1_CPF: '111.111.111-11',
          ECNH_USER_1_PASSWORD: 'a'
        }),
      (error: unknown) =>
        error instanceof ConfigurationError && error.message.includes('CLINIC')
    );

    assert.throws(
      () =>
        resolveEnabledSyncProfessionals({
          ECNH_USER_1_ENABLED: 'true',
          ECNH_USER_1_NAME: 'Alpha',
          ECNH_USER_1_CPF: '111.111.111-11',
          ECNH_USER_1_PASSWORD: 'a',
          ECNH_USER_1_CLINIC: 'Clínica Desconhecida'
        }),
      (error: unknown) =>
        error instanceof ConfigurationError && error.message.includes('sem mapeamento operacional')
    );
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
      ECNH_USER_1_CLINIC: CLINIC_LIMAO,
      ECNH_USER_3_ENABLED: 'true',
      ECNH_USER_3_NAME: 'Gamma',
      ECNH_USER_3_CPF: '333.333.333-33',
      ECNH_USER_3_PASSWORD: 'c',
      ECNH_USER_3_CLINIC: CLINIC_CARRAO,
      ECNH_USER_2_ENABLED: 'true',
      ECNH_USER_2_NAME: 'Beta',
      ECNH_USER_2_CPF: '222.222.222-22',
      ECNH_USER_2_PASSWORD: 'b',
      ECNH_USER_2_CLINIC: CLINIC_CAPAO
    });

    assert.deepEqual(
      profissionais.map((item) => item.identificadorSeguro),
      ['ECNH_USER_1', 'ECNH_USER_2', 'ECNH_USER_3']
    );
    assert.deepEqual(
      profissionais.map((item) => item.nome),
      ['Alpha', 'Beta', 'Gamma']
    );
    assert.deepEqual(
      profissionais.map((item) => item.unidadeOperacional),
      ['LIMÃO', 'CAPÃO REDONDO', 'VILA CARRÃO']
    );
  });

  it('descobre dinamicamente índices altos sem limite fixo', () => {
    const profissionais = resolveEnabledSyncProfessionals({
      ECNH_USER_99_ENABLED: 'true',
      ECNH_USER_99_NAME: 'Italo',
      ECNH_USER_99_CPF: '999.999.999-99',
      ECNH_USER_99_PASSWORD: 'senha',
      ECNH_USER_99_CLINIC: CLINIC_LIMAO,
      ECNH_USER_120_ENABLED: 'true',
      ECNH_USER_120_NAME: 'Caio',
      ECNH_USER_120_CPF: '888.888.888-88',
      ECNH_USER_120_PASSWORD: 'senha',
      ECNH_USER_120_CLINIC: CLINIC_CAPAO
    });

    assert.deepEqual(
      profissionais.map((item) => item.identificadorSeguro),
      ['ECNH_USER_99', 'ECNH_USER_120']
    );
  });
});

describe('paraEntradaSincronizacao / resolveEntradasSincronizacao', () => {
  it('mapeia para EntradaSincronizacaoProfissional sem expor o .env ao serviço', () => {
    const entrada = paraEntradaSincronizacao({
      cpf: '111.111.111-11',
      identificadorSeguro: 'ECNH_USER_1',
      nome: 'Profissional Alpha',
      senha: 'senha-alpha',
      unidadeOperacional: 'LIMÃO'
    });

    assert.deepEqual(entrada, {
      cpf: '111.111.111-11',
      identificadorSeguro: 'ECNH_USER_1',
      password: 'senha-alpha',
      profissional: 'Profissional Alpha',
      unidadeOperacional: 'LIMÃO'
    });

    const entradas = resolveEntradasSincronizacao({
      ECNH_USER_1_ENABLED: 'true',
      ECNH_USER_1_NAME: 'Profissional Alpha',
      ECNH_USER_1_CPF: '111.111.111-11',
      ECNH_USER_1_PASSWORD: 'senha-alpha',
      ECNH_USER_1_CLINIC: CLINIC_LIMAO
    });

    assert.equal(entradas.length, 1);
    assert.equal(entradas[0]?.profissional, 'Profissional Alpha');
    assert.equal(entradas[0]?.unidadeOperacional, 'LIMÃO');
  });
});
