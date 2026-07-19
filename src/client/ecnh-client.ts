import pino from 'pino';

import { LoginCredentials, LoginResult } from '../types/auth.js';
import { StructuredLogger } from '../types/logger.js';
import { formatCpfForPortal } from '../utils/cpf.js';
import { AuthTransport } from './auth-transport.js';
import {
  ConsultarAgendaPsicologoParams,
  ECNHAgendaProtocol
} from './ecnh-agenda-protocol.js';
import { ECNHAuthenticationProtocol } from './ecnh-auth-protocol.js';
import { ConfigurationError } from './errors.js';
import { SessionManager } from './session-manager.js';

export interface ECNHClientOptions {
  baseUrl: string;
  logger?: StructuredLogger;
}

/** Cliente do portal e-CNH responsável por autenticação, sessão e navegação HTTP. */
export class ECNHClient {
  private readonly agendaProtocol = new ECNHAgendaProtocol();
  private readonly authenticationProtocol = new ECNHAuthenticationProtocol();
  private readonly logger: StructuredLogger;
  private readonly sessionManager = new SessionManager();
  private readonly transport: AuthTransport;
  private lastAuthenticatedHtml: string | undefined;

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
      this.lastAuthenticatedHtml = result.html;
      const session = this.sessionManager.markAuthenticated();
      this.logger.info({ event: 'ecnh.login.succeeded' }, 'Autenticação e-CNH concluída');
      return { session, status: 'sucesso' };
    }

    this.lastAuthenticatedHtml = undefined;
    this.sessionManager.clear();
    this.logger.warn(
      { event: 'ecnh.login.failed', status: result.status },
      'Autenticação e-CNH não foi confirmada'
    );
    return result;
  }

  /**
   * Lista datas de agendamento presentes no HTML pós-login (`select#agendamentos`).
   * Não interpreta a agenda nem dados de pacientes.
   */
  public listarDatasAgendamento(): string[] {
    const html = this.requireAuthenticatedHtml('listarDatasAgendamento');
    return this.agendaProtocol.listarDatasAgendamento(html);
  }

  /**
   * Obtém o HTML bruto da agenda diária via POST `method=consultarAgendaPsicologo`.
   * Retorna somente o documento HTML; parsing de pacientes fica fora desta fase.
   */
  public async obterHtmlAgenda(params: ConsultarAgendaPsicologoParams): Promise<string> {
    const html = this.requireAuthenticatedHtml('obterHtmlAgenda');
    this.logger.info(
      { event: 'ecnh.agenda.consulta.started', path: '/gefor/GFR/divisao/divisaoEquitativa.do' },
      'Iniciando consulta HTTP da agenda e-CNH'
    );

    const agendaHtml = await this.agendaProtocol.consultarAgendaPsicologo(
      this.transport,
      html,
      params
    );

    this.logger.info(
      {
        event: 'ecnh.agenda.consulta.completed',
        htmlBytes: Buffer.byteLength(agendaHtml, 'latin1')
      },
      'Consulta HTTP da agenda e-CNH concluída'
    );

    return agendaHtml;
  }

  /**
   * Encerra a sessão no portal com `GET method=finalizarLogin` e descarta o estado local.
   * O CookieJar é limpo mesmo se a requisição HTTP falhar.
   */
  public async logout(): Promise<void> {
    this.logger.info({ event: 'ecnh.logout.started' }, 'Iniciando encerramento da sessão e-CNH');

    try {
      await this.authenticationProtocol.logout(this.transport);
      this.logger.info(
        { event: 'ecnh.logout.http', path: '/gefor/SGU/login.do?method=finalizarLogin' },
        'Logout HTTP enviado ao portal e-CNH'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erro desconhecido';
      this.logger.warn(
        { event: 'ecnh.logout.http_failed', message },
        'Falha ao enviar logout HTTP; a sessão local será descartada mesmo assim'
      );
    } finally {
      this.lastAuthenticatedHtml = undefined;
      this.sessionManager.clear();
      this.logger.info({ event: 'ecnh.logout.completed' }, 'Sessão e-CNH encerrada localmente');
    }
  }

  private requireAuthenticatedHtml(operation: string): string {
    if (this.lastAuthenticatedHtml === undefined) {
      throw new ConfigurationError(
        `ECNHClient.${operation} requer login autenticado prévio com HTML pós-login disponível.`
      );
    }
    return this.lastAuthenticatedHtml;
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
