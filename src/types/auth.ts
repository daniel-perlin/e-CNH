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

export type LoginResult =
  | { session: AuthenticatedSession; status: 'sucesso' }
  | { message: string; status: 'senha_invalida' }
  | { message: string; status: 'usuario_bloqueado' }
  | { message: string; status: 'erro_sistema' }
  | { message: string; status: 'erro_desconhecido' };
