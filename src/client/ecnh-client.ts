import pino from 'pino';

import { LoginCredentials, LoginResult } from '../types/auth.js';
import { StructuredLogger } from '../types/logger.js';
import { formatCpfForPortal } from '../utils/cpf.js';
import { AuthTransport } from './auth-transport.js';
import {
  ConsultarAgendaParams,
  ConsultarAgendaPsicologoParams,
  ECNHAgendaProtocol
} from './ecnh-agenda-protocol.js';
import { ECNHAuthenticationProtocol } from './ecnh-auth-protocol.js';
import { ConfigurationError } from './errors.js';
import {
  type PerfilProfissionalId,
  type PerfilProfissionalPortal
} from './perfil-profissional-portal.js';
import type { UnidadeDesejadaConfig } from './escolha-unidade-portal.js';
import { SessionManager } from './session-manager.js';

export type { ConsultarAgendaParams, ConsultarAgendaPsicologoParams };

export interface ECNHClientOptions {
  baseUrl: string;
  logger?: StructuredLogger;
  /**
   * Perfil esperado (ex.: configurado em `ECNH_USER_<n>_PROFILE`).
   * Se informado, deve coincidir com o marcador do HTML pós-login.
   */
  perfilEsperado?: PerfilProfissionalId;
  /**
   * Unidade desejada quando o portal emitir "Escolha de Perfil e/ou Visão" (B011).
   * Ignorada se o diálogo não aparecer.
   */
  unidadeDesejada?: UnidadeDesejadaConfig;
}

/** Cliente do portal e-CNH responsável por autenticação, sessão e navegação HTTP. */
export class ECNHClient {
  private readonly agendaProtocol = new ECNHAgendaProtocol();
  private readonly authenticationProtocol = new ECNHAuthenticationProtocol();
  private readonly logger: StructuredLogger;
  private readonly perfilEsperado: PerfilProfissionalId | undefined;
  private readonly unidadeDesejada: UnidadeDesejadaConfig | undefined;
  private readonly sessionManager = new SessionManager();
  private readonly transport: AuthTransport;
  private lastAuthenticatedHtml: string | undefined;
  private perfilResolvido: PerfilProfissionalPortal | undefined;

  public constructor(options: ECNHClientOptions) {
    if (options.baseUrl.trim().length === 0) {
      throw new ConfigurationError('ECNHClient requer ECNH_BASE_URL configurada.');
    }

    this.logger = options.logger ?? createLogger();
    this.perfilEsperado = options.perfilEsperado;
    this.unidadeDesejada = options.unidadeDesejada;
    this.transport = new AuthTransport(options.baseUrl, this.logger, this.sessionManager);
  }

  public async login(cpf: string, password: string): Promise<LoginResult> {
    const credentials = this.validateCredentials(cpf, password);
    this.logger.info({ event: 'ecnh.login.started' }, 'Iniciando autenticação e-CNH');

    const result = await this.authenticationProtocol.login(credentials, this.transport, {
      perfilEsperado: this.perfilEsperado,
      unidadeDesejada: this.unidadeDesejada
    });
    if (result.status === 'sucesso') {
      this.lastAuthenticatedHtml = result.html;
      this.perfilResolvido = result.perfil;
      const session = this.sessionManager.markAuthenticated(result.perfil.id);
      this.logger.info(
        { event: 'ecnh.login.succeeded', perfilId: result.perfil.id },
        'Autenticação e-CNH concluída'
      );
      return { session, status: 'sucesso' };
    }

    this.lastAuthenticatedHtml = undefined;
    this.perfilResolvido = undefined;
    this.sessionManager.clear();
    this.logger.warn(
      { event: 'ecnh.login.failed', status: result.status },
      'Autenticação e-CNH não foi confirmada'
    );
    return result;
  }

  /** Perfil do portal resolvido no último login bem-sucedido. */
  public obterPerfilPortal(): PerfilProfissionalId | undefined {
    return this.perfilResolvido?.id;
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
   * Obtém o HTML bruto da agenda diária via POST no method do perfil resolvido.
   * Retorna somente o documento HTML; parsing de pacientes fica fora desta camada.
   */
  public async obterHtmlAgenda(params: ConsultarAgendaParams): Promise<string> {
    const html = this.requireAuthenticatedHtml('obterHtmlAgenda');
    const perfil = this.requirePerfilResolvido('obterHtmlAgenda');
    this.logger.info(
      {
        event: 'ecnh.agenda.consulta.started',
        method: perfil.methodConsultarAgenda,
        path: '/gefor/GFR/divisao/divisaoEquitativa.do',
        perfilId: perfil.id
      },
      'Iniciando consulta HTTP da agenda e-CNH'
    );

    const agendaHtml = await this.agendaProtocol.consultarAgenda(
      this.transport,
      html,
      perfil,
      params
    );

    this.logger.info(
      {
        event: 'ecnh.agenda.consulta.completed',
        htmlBytes: Buffer.byteLength(agendaHtml, 'latin1'),
        perfilId: perfil.id
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
      this.perfilResolvido = undefined;
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

  private requirePerfilResolvido(operation: string): PerfilProfissionalPortal {
    if (this.perfilResolvido === undefined) {
      throw new ConfigurationError(
        `ECNHClient.${operation} requer perfil de portal resolvido no login.`
      );
    }
    return this.perfilResolvido;
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
