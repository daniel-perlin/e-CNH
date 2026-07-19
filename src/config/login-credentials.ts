import { ConfigurationError } from '../client/errors.js';
import type { UnidadeDesejadaConfig } from '../client/escolha-unidade-portal.js';
import type { PerfilProfissionalId } from '../client/perfil-profissional-portal.js';

import { listarIndicesUsuariosEnv } from './ecnh-user-env.js';
import { resolvePerfilEsperadoEnv } from './perfil-esperado-env.js';

export interface ResolvedLoginCredentials {
  cpf: string;
  password: string;
  /** Perfil opcional (`PROFILE`/`ROLE`) para validação cruzada no login. */
  perfilEsperado?: PerfilProfissionalId;
  source: string;
  /** Unidade opcional (`UNIDADE` / `UNID_TRANSITO`) para B011. */
  unidadeDesejada?: UnidadeDesejadaConfig;
}

/**
 * Resolve as credenciais de teste a partir do ambiente.
 *
 * Ordem de precedência:
 * 1. `ECNH_CPF` e `ECNH_PASSWORD`;
 * 2. `ECNH_LOGIN_USER_INDEX` apontando para `ECNH_USER_<n>_CPF/PASSWORD`;
 * 3. primeiro usuário habilitado com CPF e senha preenchidos.
 */
export function resolveLoginCredentials(
  env: NodeJS.ProcessEnv = process.env
): ResolvedLoginCredentials {
  const legacyCpf = env.ECNH_CPF?.trim();
  const legacyPassword = env.ECNH_PASSWORD;
  if (legacyCpf !== undefined && legacyCpf.length > 0 && legacyPassword !== undefined) {
    if (legacyPassword.length === 0) {
      throw new ConfigurationError('ECNH_PASSWORD não pode ser vazia.');
    }
    return { cpf: legacyCpf, password: legacyPassword, source: 'ECNH_CPF' };
  }

  const requestedIndex = parseUserIndex(env.ECNH_LOGIN_USER_INDEX);
  if (requestedIndex !== undefined) {
    return readUserCredentials(env, requestedIndex, true);
  }

  for (const index of listarIndicesUsuariosEnv(env)) {
    const enabled = env[`ECNH_USER_${index}_ENABLED`];
    const cpf = env[`ECNH_USER_${index}_CPF`];
    const password = env[`ECNH_USER_${index}_PASSWORD`];
    if (enabled !== 'true') {
      continue;
    }
    if (
      cpf === undefined ||
      cpf.trim().length === 0 ||
      password === undefined ||
      password.length === 0
    ) {
      continue;
    }
    return buildUserCredentials(env, index, cpf.trim(), password);
  }

  throw new ConfigurationError(
    'Defina ECNH_CPF e ECNH_PASSWORD, ou um usuário habilitado ECNH_USER_<n>_CPF/PASSWORD no arquivo .env.'
  );
}

/**
 * Lista usuários habilitados com CPF e senha, na ordem do ambiente.
 * Usado pela validação reproduzível para evitar re-login imediato da mesma conta.
 */
export function listEnabledLoginCredentials(
  env: NodeJS.ProcessEnv = process.env
): ResolvedLoginCredentials[] {
  const users: ResolvedLoginCredentials[] = [];

  for (const index of listarIndicesUsuariosEnv(env)) {
    const enabled = env[`ECNH_USER_${index}_ENABLED`];
    const cpf = env[`ECNH_USER_${index}_CPF`];
    const password = env[`ECNH_USER_${index}_PASSWORD`];
    if (enabled !== 'true') {
      continue;
    }
    if (
      cpf === undefined ||
      cpf.trim().length === 0 ||
      password === undefined ||
      password.length === 0
    ) {
      continue;
    }
    users.push(buildUserCredentials(env, index, cpf.trim(), password));
  }

  return users;
}

function parseUserIndex(value: string | undefined): number | undefined {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ConfigurationError('ECNH_LOGIN_USER_INDEX deve ser um inteiro ≥ 1.');
  }
  return parsed;
}

function readUserCredentials(
  env: NodeJS.ProcessEnv,
  index: number,
  required: boolean
): ResolvedLoginCredentials {
  const cpf = env[`ECNH_USER_${index}_CPF`]?.trim();
  const password = env[`ECNH_USER_${index}_PASSWORD`];

  if (cpf === undefined || cpf.length === 0 || password === undefined || password.length === 0) {
    if (required) {
      throw new ConfigurationError(
        `ECNH_USER_${index}_CPF e ECNH_USER_${index}_PASSWORD precisam estar preenchidos.`
      );
    }
    throw new ConfigurationError('Credenciais de usuário incompletas.');
  }

  return buildUserCredentials(env, index, cpf, password);
}

function buildUserCredentials(
  env: NodeJS.ProcessEnv,
  index: number,
  cpf: string,
  password: string
): ResolvedLoginCredentials {
  const credentials: ResolvedLoginCredentials = {
    cpf,
    password,
    source: `ECNH_USER_${index}`
  };
  const perfilEsperado = resolvePerfilEsperadoEnv(env, index);
  if (perfilEsperado !== undefined) {
    credentials.perfilEsperado = perfilEsperado;
  }
  const unidadeDesejada = resolveUnidadeDesejadaEnv(env, index);
  if (unidadeDesejada !== undefined) {
    credentials.unidadeDesejada = unidadeDesejada;
  }
  return credentials;
}

/** Resolve `UNIDADE` / `UNID_TRANSITO` opcionais do profissional. */
export function resolveUnidadeDesejadaEnv(
  env: NodeJS.ProcessEnv,
  index: number
): UnidadeDesejadaConfig | undefined {
  const label = env[`ECNH_USER_${index}_UNIDADE`]?.trim() ?? '';
  const idUnidTransito = env[`ECNH_USER_${index}_UNID_TRANSITO`]?.trim() ?? '';
  if (label.length === 0 && idUnidTransito.length === 0) {
    return undefined;
  }
  return {
    ...(label.length > 0 ? { label } : {}),
    ...(idUnidTransito.length > 0 ? { idUnidTransito } : {})
  };
}
