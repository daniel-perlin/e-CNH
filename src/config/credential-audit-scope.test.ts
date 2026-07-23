import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  listarProfissionaisEnvParaCredenciais,
  diagnosticarCandidataForaDoEscopo,
  resolverEscopoAuditoriaCredenciais,
  type ProfissionalParaCredencial
} from './credential-audit-scope.js';
import type { CredencialCandidata } from './credential-candidates.js';

describe('credential-audit-scope', () => {
  it('lista habilitados e desabilitados com NAME/CPF/PASSWORD', () => {
    const env = {
      ECNH_USER_1_NAME: 'Aline',
      ECNH_USER_1_CPF: '406.345.028-75',
      ECNH_USER_1_PASSWORD: 'x',
      ECNH_USER_1_ENABLED: 'true',
      ECNH_USER_1_CLINIC: 'Talento Limão/Zona Norte',
      ECNH_USER_8_NAME: 'Valeria',
      ECNH_USER_8_CPF: '156.788.298-66',
      ECNH_USER_8_PASSWORD: 'y',
      ECNH_USER_8_ENABLED: 'false',
      ECNH_USER_8_CLINIC: 'Clínica Carrão/Zona Leste'
    } as NodeJS.ProcessEnv;

    const lista = listarProfissionaisEnvParaCredenciais(env);
    assert.equal(lista.length, 2);
    assert.equal(lista.find((p) => p.nome === 'Aline')?.habilitado, true);
    assert.equal(lista.find((p) => p.nome === 'Valeria')?.habilitado, false);
  });

  it('monta escopo na ordem do catálogo e isola órfãos', () => {
    const envProfissionais: ProfissionalParaCredencial[] = [
      {
        cpf: '111.111.111-11',
        habilitado: false,
        identificadorSeguro: 'ECNH_USER_9',
        nome: 'Priscila',
        senha: 'antiga',
        unidadeOperacional: 'CAPÃO REDONDO'
      }
    ];
    const candidatas: CredencialCandidata[] = [
      { nome: 'Priscila', cpf: '228.107.688-11', senha: '@Pl197325' },
      { nome: 'Fantasma', cpf: '999.999.999-99', senha: 'x' }
    ];

    const escopo = resolverEscopoAuditoriaCredenciais(candidatas, envProfissionais);
    assert.equal(escopo.profissionais.length, 1);
    assert.equal(escopo.profissionais[0]?.identificadorSeguro, 'ECNH_USER_9');
    assert.equal(escopo.profissionais[0]?.habilitado, false);
    assert.equal(escopo.foraDoEscopo.length, 1);
    assert.equal(escopo.foraDoEscopo[0]?.candidata.nome, 'Fantasma');
    assert.match(
      escopo.foraDoEscopo[0]?.motivo ?? '',
      /sem ECNH_USER correspondente/
    );
  });

  it('diagnostica PASSWORD vazia quando o ECNH_USER existe', () => {
    const env = {
      ECNH_USER_15_NAME: 'Priscila',
      ECNH_USER_15_CPF: '228.107.688-11',
      ECNH_USER_15_PASSWORD: '',
      ECNH_USER_15_ENABLED: 'false'
    } as NodeJS.ProcessEnv;

    const { writeFileSync, mkdtempSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    const { tmpdir } = require('node:os') as typeof import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'ecnh-env-'));
    const caminho = join(dir, '.env');
    writeFileSync(
      caminho,
      'ECNH_USER_15_NAME=Priscila\nECNH_USER_15_CPF=228.107.688-11\nECNH_USER_15_PASSWORD=\n',
      'utf8'
    );

    const diag = diagnosticarCandidataForaDoEscopo(
      { nome: 'Priscila', cpf: '228.107.688-11', senha: '@Pl197325' },
      env,
      caminho
    );
    assert.equal(diag.identificadorSeguro, 'ECNH_USER_15');
    assert.match(diag.motivo, /PASSWORD está vazia/);
  });

  it('diagnostica senha com # sem aspas no arquivo .env', () => {
    const { writeFileSync, mkdtempSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    const { tmpdir } = require('node:os') as typeof import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'ecnh-hash-'));
    const caminho = join(dir, '.env');
    writeFileSync(
      caminho,
      [
        'ECNH_USER_13_NAME=Rodrigo Mitchell Pereira da Silva',
        'ECNH_USER_13_CPF=035.403.997-04',
        'ECNH_USER_13_PASSWORD=#Segredo123',
        ''
      ].join('\n'),
      'utf8'
    );
    const env = {
      ECNH_USER_13_NAME: 'Rodrigo Mitchell Pereira da Silva',
      ECNH_USER_13_CPF: '035.403.997-04',
      ECNH_USER_13_PASSWORD: '',
      ECNH_USER_13_ENABLED: 'false'
    } as NodeJS.ProcessEnv;

    const diag = diagnosticarCandidataForaDoEscopo(
      {
        nome: 'Rodrigo Mitchell Pereira da Silva',
        cpf: '035.403.997-04',
        senha: 'Clinica2024@'
      },
      env,
      caminho
    );
    assert.equal(diag.identificadorSeguro, 'ECNH_USER_13');
    assert.match(diag.motivo, /"#"/);
  });
});
