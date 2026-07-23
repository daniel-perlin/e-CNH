import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  carregarCredenciaisCandidatasDoArquivo,
  normalizarNomeProfissional,
  resolverCredencialCandidata,
  type CredencialCandidata
} from './credential-candidates.js';
import {
  extrairIndiceUsuarioSeguro,
  serializarValorEnv,
  substituirOuInserirChaveEnv
} from './env-credential-store.js';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('credential-candidates', () => {
  it('normaliza nome para matching', () => {
    assert.equal(normalizarNomeProfissional('  Maria   Rozana '), 'maria rozana');
  });

  it('resolve candidata por CPF mesmo com máscara diferente', () => {
    const candidatas: CredencialCandidata[] = [
      { nome: 'Outro', cpf: '440.234.858-70', senha: 'NovaSenha1@' }
    ];
    const encontrada = resolverCredencialCandidata({
      candidatas,
      cpfAtual: '44023485870',
      nomeAtual: 'Isis',
      senhaAtual: 'Antiga'
    });
    assert.equal(encontrada?.senha, 'NovaSenha1@');
  });

  it('resolve por nome quando CPF não bate', () => {
    const candidatas: CredencialCandidata[] = [
      { nome: 'Priscila', cpf: '228.107.688-11', senha: '@Pl197325' }
    ];
    const encontrada = resolverCredencialCandidata({
      candidatas,
      cpfAtual: '111.111.111-11',
      nomeAtual: 'priscila',
      senhaAtual: 'antiga'
    });
    assert.equal(encontrada?.cpf, '228.107.688-11');
  });

  it('ignora candidata idêntica à credencial atual', () => {
    const candidatas: CredencialCandidata[] = [
      { nome: 'Aline', cpf: '406.345.028-75', senha: 'Julia1903@' }
    ];
    const encontrada = resolverCredencialCandidata({
      candidatas,
      cpfAtual: '406.345.028-75',
      nomeAtual: 'Aline',
      senhaAtual: 'Julia1903@'
    });
    assert.equal(encontrada, undefined);
  });

  it('carrega catálogo JSON com objeto candidatas', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ecnh-cand-'));
    const path = join(dir, 'c.json');
    writeFileSync(
      path,
      JSON.stringify({
        candidatas: [{ nome: 'Teste', cpf: '123.456.789-09', senha: 'Senha@1' }]
      }),
      'utf8'
    );
    const catalogo = carregarCredenciaisCandidatasDoArquivo(path);
    assert.equal(catalogo.candidatas.length, 1);
    assert.equal(catalogo.candidatas[0]?.cpf, '123.456.789-09');
  });

  it('rejeita CPF com dígitos inválidos no catálogo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ecnh-cand-'));
    const path = join(dir, 'bad.json');
    writeFileSync(
      path,
      JSON.stringify([{ nome: 'X', cpf: '123', senha: 'a' }]),
      'utf8'
    );
    assert.throws(() => carregarCredenciaisCandidatasDoArquivo(path));
  });
});

describe('env-credential-store', () => {
  it('serializa senhas com caracteres especiais entre aspas', () => {
    assert.equal(serializarValorEnv('abc'), 'abc');
    assert.equal(serializarValorEnv('#Mello38936'), '"#Mello38936"');
    assert.equal(serializarValorEnv('@Pl197325'), '"@Pl197325"');
    assert.equal(serializarValorEnv('Jk25060*'), '"Jk25060*"');
  });

  it('substitui CPF e PASSWORD existentes no .env', () => {
    const original = [
      'ECNH_USER_2_NAME=Italo',
      'ECNH_USER_2_CPF=111.111.111-11',
      'ECNH_USER_2_PASSWORD=antiga',
      ''
    ].join('\n');
    const comCpf = substituirOuInserirChaveEnv(
      original,
      'ECNH_USER_2_CPF',
      '230.070.548-69'
    );
    const final = substituirOuInserirChaveEnv(comCpf, 'ECNH_USER_2_PASSWORD', 'F@cella90');
    assert.match(final, /ECNH_USER_2_CPF=230\.070\.548-69/);
    assert.match(final, /ECNH_USER_2_PASSWORD="F@cella90"/);
    assert.match(final, /ECNH_USER_2_NAME=Italo/);
  });

  it('extrai índice do identificador seguro', () => {
    assert.equal(extrairIndiceUsuarioSeguro('ECNH_USER_16'), 16);
    assert.equal(extrairIndiceUsuarioSeguro('outro'), undefined);
  });
});
