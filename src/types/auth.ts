export interface LoginCredentials {
  cpf: string;
  password: string;
}

export interface AuthenticatedSession {
  authenticatedAt: Date;
}

export type LoginResult =
  | { session: AuthenticatedSession; status: 'sucesso' }
  | { message: string; status: 'senha_invalida' }
  | { message: string; status: 'usuario_bloqueado' }
  | { message: string; status: 'erro_sistema' }
  | { message: string; status: 'erro_desconhecido' };
