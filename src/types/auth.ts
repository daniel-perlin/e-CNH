import type { PerfilProfissionalId } from '../client/perfil-profissional-portal.js';

export interface LoginCredentials {
  cpf: string;
  password: string;
}

export interface AuthenticatedSession {
  authenticatedAt: Date;
  /** Perfil de portal resolvido no login (sem PII). */
  perfilId: PerfilProfissionalId;
}

/**
 * Resultado tipado do login no portal.
 *
 * - `senha_invalida`: rejeição estrutural de credencial (heurística operacional; ver ADR-019).
 * - `usuario_bloqueado`: reservado; sinais HTML ainda sem evidência confirmada.
 * - `timeout`: transporte esgotou o tempo (Axios timeout / ETIMEDOUT / ECONNABORTED).
 * - `portal_indisponivel`: falha de rede/DNS/conexão com o host.
 * - `erro_sistema`: demais erros Axios de transporte.
 * - `erro_desconhecido`: resposta HTML sem classificação segura (inclui B010/B011 mal resolvidos).
 */
export type LoginResult =
  | { session: AuthenticatedSession; status: 'sucesso' }
  | { message: string; status: 'senha_invalida' }
  | { message: string; status: 'usuario_bloqueado' }
  | { message: string; status: 'timeout' }
  | { message: string; status: 'portal_indisponivel' }
  | { message: string; status: 'erro_sistema' }
  | { message: string; status: 'erro_desconhecido' };

/** Status em que a atualização inteligente de credenciais pode ser tentada. */
export const LOGIN_STATUS_PERMITE_ATUALIZACAO_CREDENCIAL = ['senha_invalida'] as const;

export type LoginStatusPermiteAtualizacaoCredencial =
  (typeof LOGIN_STATUS_PERMITE_ATUALIZACAO_CREDENCIAL)[number];

export function loginStatusPermiteAtualizacaoCredencial(
  status: LoginResult['status']
): status is LoginStatusPermiteAtualizacaoCredencial {
  return (LOGIN_STATUS_PERMITE_ATUALIZACAO_CREDENCIAL as readonly string[]).includes(status);
}
