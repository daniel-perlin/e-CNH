import pino from 'pino';

import { LoginCredentials, LoginResult } from '../types/auth.js';
import { StructuredLogger } from '../types/logger.js';
import { formatCpfForPortal } from '../utils/cpf.js';
import { AuthTransport } from './auth-transport.js';
import { ECNHAuthenticationProtocol } from './ecnh-auth-protocol.js';
import { ConfigurationError } from './errors.js';
import { SessionManager } from './session-manager.js';

export interface ECNHClientOptions {
  baseUrl: string;
  logger?: StructuredLogger;
}

/** Cliente do portal e-CNH responsável por autenticação, sessão e transporte HTTP. */
export class ECNHClient {
  private readonly authenticationProtocol = new ECNHAuthenticationProtocol();
  private readonly logger: StructuredLogger;
  private readonly sessionManager = new SessionManager();
  private readonly transport: AuthTransport;

  public constructor(options: ECNHClientOptions) {
    if (options.baseUrl.trim().length === 0) {
      throw new ConfigurationError('ECNHClient requer ECNH_BASE_URL configurada.');
    }

    this.logger = options.logger ?? createLogger();
    this.transport = new AuthTransport(options.baseUrl, this.logger, this.sessionManager);
  }

  public async login(cpf: string, password: string): Promise<LoginResult> {
    const credentials = this.validateCredentials(cpf, password);
    this.logger.info({ event: 'ecnh.login.started' }, 'Iniciando autenticação e-CNH');

    const result = await this.authenticationProtocol.login(credentials, this.transport);
    if (result.status === 'sucesso') {
      const session = this.sessionManager.markAuthenticated();
      this.logger.info({ event: 'ecnh.login.succeeded' }, 'Autenticação e-CNH concluída');
      return { session, status: 'sucesso' };
    }

    this.sessionManager.clear();
    this.logger.warn(
      { event: 'ecnh.login.failed', status: result.status },
      'Autenticação e-CNH não foi confirmada'
    );
    return result;
  }

  /**
   * O endpoint de logout ainda não foi observado. O método descarta localmente a sessão.
   * TODO(Fase 003A): enviar logout HTTP quando endpoint e comportamento forem confirmados.
   */
  public async logout(): Promise<void> {
    this.logger.info({ event: 'ecnh.logout.started' }, 'Iniciando encerramento da sessão e-CNH');
    this.sessionManager.clear();
    this.logger.warn(
      { event: 'ecnh.logout.local_only' },
      'Sessão local descartada; endpoint de logout do portal ainda não é conhecido'
    );
  }

  private validateCredentials(cpf: string, password: string): LoginCredentials {
    if (password.length === 0) {
      throw new ConfigurationError('ECNHClient.login requer senha não vazia.');
    }

    const formattedCpf = formatCpfForPortal(cpf);
    if (formattedCpf === undefined) {
      throw new ConfigurationError(
        'ECNHClient.login requer CPF com exatamente 11 dígitos, com ou sem máscara.'
      );
    }

    return { cpf: formattedCpf, password };
  }
}

function createLogger(): StructuredLogger {
  return pino({
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: ['cpf', 'password', 'headers.cookie', 'headers.authorization', 'err.config.headers'],
      remove: true
    }
  });
}
