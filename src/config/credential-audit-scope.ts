import { readFileSync } from 'node:fs';

import { ConfigurationError } from '../client/errors.js';
import type { UnidadeDesejadaConfig } from '../client/escolha-unidade-portal.js';
import type { PerfilProfissionalId } from '../client/perfil-profissional-portal.js';
import { resolveNomeUnidadeOperacional } from '../utils/unidade-operacional.js';
import { normalizeCpfKey } from '../utils/cpf.js';

import {
  normalizarNomeProfissional,
  type CredencialCandidata
} from './credential-candidates.js';
import { listarIndicesUsuariosEnv } from './ecnh-user-env.js';
import { resolveUnidadeDesejadaEnv } from './login-credentials.js';
import { resolvePerfilEsperadoEnv } from './perfil-esperado-env.js';
import type { ProfissionalParaSincronizacao } from './sync-professionals.js';

/**
 * Profissional do `.env` para validação/atualização de credenciais
 * (habilitado ou não). Nunca altera `ENABLED`.
 */
export interface ProfissionalParaCredencial extends ProfissionalParaSincronizacao {
  /** Espelho de `ECNH_USER_<n>_ENABLED=true`. */
  habilitado: boolean;
}

/**
 * Lista todos os `ECNH_USER_<n>` com NAME, CPF e PASSWORD —
 * incluindo `ENABLED=false`. Não exige CLINIC (auditoria não sincroniza agenda).
 */
export function listarProfissionaisEnvParaCredenciais(
  env: NodeJS.ProcessEnv = process.env
): ProfissionalParaCredencial[] {
  const profissionais: ProfissionalParaCredencial[] = [];

  for (const index of listarIndicesUsuariosEnv(env)) {
    const name = env[`ECNH_USER_${index}_NAME`]?.trim() ?? '';
    const cpf = env[`ECNH_USER_${index}_CPF`]?.trim() ?? '';
    const senha = env[`ECNH_USER_${index}_PASSWORD`] ?? '';
    const clinic = env[`ECNH_USER_${index}_CLINIC`]?.trim() ?? '';
    const habilitado = env[`ECNH_USER_${index}_ENABLED`] === 'true';

    if (name.length === 0 || cpf.length === 0 || senha.length === 0) {
      continue;
    }

    let unidadeOperacional = 'AUDITORIA';
    if (clinic.length > 0) {
      try {
        unidadeOperacional = resolveNomeUnidadeOperacional(clinic);
      } catch {
        unidadeOperacional = 'AUDITORIA';
      }
    }

    const profissional: ProfissionalParaCredencial = {
      cpf,
      habilitado,
      identificadorSeguro: `ECNH_USER_${index}`,
      nome: name,
      senha,
      unidadeOperacional
    };

    const perfilEsperado = resolvePerfilEsperadoEnv(env, index);
    if (perfilEsperado !== undefined) {
      profissional.perfilEsperado = perfilEsperado;
    }
    const unidadeDesejada = resolveUnidadeDesejadaEnv(env, index);
    if (unidadeDesejada !== undefined) {
      profissional.unidadeDesejada = unidadeDesejada;
    }

    profissionais.push(profissional);
  }

  return profissionais;
}

/** Candidata do catálogo que não pôde ser auditada com as credenciais oficiais. */
export interface CandidataForaDoEscopoAuditoria {
  candidata: CredencialCandidata;
  /** Motivo legível para o desenvolvedor (sem senha). */
  motivo: string;
  /** `ECNH_USER_<n>` quando a entrada existe mas está incompleta/inválida. */
  identificadorSeguro?: string;
}

export interface EscopoAuditoriaCredenciais {
  /** Ordem do catálogo; um item por candidata com match no `.env`. */
  profissionais: ProfissionalParaCredencial[];
  /**
   * Candidatas que não entraram no escopo utilizável.
   * Inclui diagnóstico quando o `ECNH_USER` existe mas foi ignorado
   * (senha vazia, `#` sem aspas no dotenv, etc.).
   */
  foraDoEscopo: CandidataForaDoEscopoAuditoria[];
}

export interface OpcoesEscopoAuditoria {
  /** Ambiente para diagnóstico de índices incompletos (default: process.env). */
  env?: NodeJS.ProcessEnv;
  /** Caminho do `.env` bruto para inspecionar linhas PASSWORD. */
  caminhoEnv?: string;
}

/**
 * Monta o escopo da auditoria a partir do catálogo (fonte da verdade da varredura).
 * Matching: CPF (dígitos) → nome normalizado. Não altera ENABLED.
 */
export function resolverEscopoAuditoriaCredenciais(
  candidatas: readonly CredencialCandidata[],
  envProfissionais: readonly ProfissionalParaCredencial[],
  options: OpcoesEscopoAuditoria = {}
): EscopoAuditoriaCredenciais {
  if (candidatas.length === 0) {
    throw new ConfigurationError(
      'Catálogo de credenciais candidatas vazio — nada a auditar.'
    );
  }

  const env = options.env ?? process.env;
  const profissionais: ProfissionalParaCredencial[] = [];
  const foraDoEscopo: CandidataForaDoEscopoAuditoria[] = [];
  const indicesUsados = new Set<string>();

  for (const candidata of candidatas) {
    const match = encontrarProfissionalEnv(candidata, envProfissionais, indicesUsados);
    if (match === undefined) {
      foraDoEscopo.push(
        diagnosticarCandidataForaDoEscopo(candidata, env, options.caminhoEnv)
      );
      continue;
    }
    indicesUsados.add(match.identificadorSeguro);
    profissionais.push(match);
  }

  return { profissionais, foraDoEscopo };
}

/**
 * Explica por que a candidata não entrou no escopo — inclusive quando o
 * `ECNH_USER_<n>` existe, mas foi filtrado (PASSWORD vazia / parse dotenv).
 */
export function diagnosticarCandidataForaDoEscopo(
  candidata: CredencialCandidata,
  env: NodeJS.ProcessEnv = process.env,
  caminhoEnv?: string
): CandidataForaDoEscopoAuditoria {
  const encontrado = encontrarIndiceEnvIncompleto(candidata, env);
  if (encontrado === undefined) {
    return {
      candidata,
      motivo:
        'Candidata sem ECNH_USER correspondente no .env (nenhum índice com mesmo CPF ou nome).'
    };
  }

  const { indice, nomePresente, cpfPresente, senhaPresente } = encontrado;
  const identificadorSeguro = `ECNH_USER_${indice}`;

  if (!nomePresente) {
    return {
      candidata,
      identificadorSeguro,
      motivo: `${identificadorSeguro} encontrado, mas NAME está vazio.`
    };
  }
  if (!cpfPresente) {
    return {
      candidata,
      identificadorSeguro,
      motivo: `${identificadorSeguro} encontrado, mas CPF está vazio.`
    };
  }
  if (!senhaPresente) {
    const detalheSenha = diagnosticarLinhaPasswordNoArquivo(indice, caminhoEnv);
    return {
      candidata,
      identificadorSeguro,
      motivo: `${identificadorSeguro} encontrado, mas ${detalheSenha}`
    };
  }

  return {
    candidata,
    identificadorSeguro,
    motivo: `${identificadorSeguro} existe, mas não entrou no escopo por inconsistência de configuração.`
  };
}

function encontrarIndiceEnvIncompleto(
  candidata: CredencialCandidata,
  env: NodeJS.ProcessEnv
):
  | {
      indice: number;
      nomePresente: boolean;
      cpfPresente: boolean;
      senhaPresente: boolean;
    }
  | undefined {
  const cpfKey = normalizeCpfKey(candidata.cpf);
  const nomeKey = normalizarNomeProfissional(candidata.nome);

  for (const index of listarIndicesUsuariosEnv(env)) {
    const nome = env[`ECNH_USER_${index}_NAME`]?.trim() ?? '';
    const cpf = env[`ECNH_USER_${index}_CPF`]?.trim() ?? '';
    const senha = env[`ECNH_USER_${index}_PASSWORD`] ?? '';
    const cpfOk = cpfKey !== undefined && normalizeCpfKey(cpf) === cpfKey;
    const nomeOk = nome.length > 0 && normalizarNomeProfissional(nome) === nomeKey;
    if (!cpfOk && !nomeOk) {
      continue;
    }
    return {
      indice: index,
      nomePresente: nome.length > 0,
      cpfPresente: cpf.length > 0,
      senhaPresente: senha.length > 0
    };
  }
  return undefined;
}

/**
 * Lê a linha bruta do `.env` para distinguir senha vazia de `#` sem aspas
 * (dotenv trata `#` inicial como comentário e esvazia o valor).
 */
export function diagnosticarLinhaPasswordNoArquivo(
  indice: number,
  caminhoEnv?: string
): string {
  const caminho = caminhoEnv?.trim() || process.env.ECNH_ENV_FILE_PATH?.trim() || '.env';
  try {
    const conteudo = readFileSync(caminho, 'utf8');
    const chave = `ECNH_USER_${indice}_PASSWORD=`;
    const linha = conteudo.split(/\r?\n/).find((l) => l.startsWith(chave));
    if (linha === undefined) {
      return 'PASSWORD está ausente no arquivo .env.';
    }
    const bruto = linha.slice(chave.length);
    if (bruto.length === 0 || bruto === '""' || bruto === "''") {
      return (
        'PASSWORD está vazia no .env — preencha a senha (use aspas se houver #, @, espaços ou $).'
      );
    }
    const semEspaco = bruto.trimStart();
    if (!bruto.startsWith('"') && !bruto.startsWith("'") && semEspaco.startsWith('#')) {
      return (
        'PASSWORD começa com "#" sem aspas no .env — o dotenv interpreta como comentário e a senha fica vazia. ' +
        'Coloque o valor entre aspas duplas.'
      );
    }
    return (
      'PASSWORD ficou vazia após o parse do dotenv — verifique aspas e caracteres especiais (#, @, espaços).'
    );
  } catch {
    return 'PASSWORD está vazia no ambiente (não foi possível inspecionar o arquivo .env).';
  }
}

function encontrarProfissionalEnv(
  candidata: CredencialCandidata,
  envProfissionais: readonly ProfissionalParaCredencial[],
  indicesUsados: ReadonlySet<string>
): ProfissionalParaCredencial | undefined {
  const cpfKey = normalizeCpfKey(candidata.cpf);
  const nomeKey = normalizarNomeProfissional(candidata.nome);

  for (const profissional of envProfissionais) {
    if (indicesUsados.has(profissional.identificadorSeguro)) {
      continue;
    }
    if (cpfKey !== undefined && normalizeCpfKey(profissional.cpf) === cpfKey) {
      return profissional;
    }
  }

  for (const profissional of envProfissionais) {
    if (indicesUsados.has(profissional.identificadorSeguro)) {
      continue;
    }
    if (normalizarNomeProfissional(profissional.nome) === nomeKey) {
      return profissional;
    }
  }

  return undefined;
}

export type { PerfilProfissionalId, UnidadeDesejadaConfig };
