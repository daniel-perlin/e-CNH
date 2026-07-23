import { AxiosError } from 'axios';

import { LoginCredentials, LoginResult } from '../types/auth.js';
import type { StructuredLogger } from '../types/logger.js';
import { AuthTransport } from './auth-transport.js';
import { classificarFalhaAutenticacaoHtml } from './classificar-falha-login.js';
import {
  extrairAutenticadoCyberarkDeOpenDialogChoice,
  htmlContemFormularioEscolhaUnidade,
  htmlRequerEscolhaUnidade,
  parseOpcoesUnidadeTransito,
  resolverUnidadeConfigurada,
  type UnidadeDesejadaConfig
} from './escolha-unidade-portal.js';
import {
  type PerfilProfissionalId,
  type PerfilProfissionalPortal,
  obterPerfilPorId,
  resolverPerfilNoHtml
} from './perfil-profissional-portal.js';
import {
  extrairAutenticadoCyberarkDeOpenDialogNewSession,
  htmlRequerEncerramentoSessaoExistente
} from './sessao-existente-portal.js';

const LOGIN_PATH = '/gefor/SGU/login.do';
const LOGOUT_PATH = `${LOGIN_PATH}?method=finalizarLogin`;
const SESSION_COOKIE_NAME = 'JSESSIONID';

export type AuthenticationLoginOutcome =
  | { html: string; perfil: PerfilProfissionalPortal; status: 'sucesso' }
  | Exclude<LoginResult, { status: 'sucesso' }>;

export interface AuthenticationLoginOptions {
  /** Logger estruturado (observabilidade do fluxo; não altera a lógica). */
  logger?: StructuredLogger;
  /** Perfil esperado (config); se definido, deve coincidir com o HTML. */
  perfilEsperado?: PerfilProfissionalId;
  /**
   * Unidade desejada (B011). Obrigatória somente se o portal emitir `openDialogChoice`.
   */
  unidadeDesejada?: UnidadeDesejadaConfig;
}

/** Nomes estáveis das etapas do login (logs). */
export const LOGIN_STEPS = {
  GET_INICIAR_LOGIN: 'GET_iniciarLogin',
  POST_INICIAR_LOGIN_AGENDA: 'POST_iniciarLoginAgenda',
  POST_AUTENTICAR: 'POST_autenticar',
  POST_AUTENTICAR_FORCE_LOGOUT: 'POST_autenticar_forceLogout',
  GET_OPEN_CHOICE: 'GET_openChoice',
  POST_AUTENTICAR_COM_UNIDADE: 'POST_autenticar_com_unidade',
  LOGIN_CONFIRMATION: 'login_confirmation'
} as const;

/**
 * Protocolo confirmado no DevTools para a autenticação HTTP do e-CNH.
 */
export class ECNHAuthenticationProtocol {
  public async login(
    credentials: LoginCredentials,
    transport: AuthTransport,
    options: AuthenticationLoginOptions = {}
  ): Promise<AuthenticationLoginOutcome> {
    const logger = options.logger;
    let lastSuccessfulLoginStep: string | undefined;
    let currentLoginStep: string | undefined;

    const markStepStart = (loginStep: string): void => {
      currentLoginStep = loginStep;
      logger?.warn(
        {
          event: 'ecnh.login.step.start',
          loginStep,
          lastSuccessfulLoginStep
        },
        'Etapa do login e-CNH iniciada'
      );
    };

    const markStepCompleted = (loginStep: string): void => {
      lastSuccessfulLoginStep = loginStep;
      currentLoginStep = undefined;
      logger?.warn(
        {
          event: 'ecnh.login.step.completed',
          loginStep,
          lastSuccessfulLoginStep
        },
        'Etapa do login e-CNH concluída'
      );
    };

    try {
      const loginUrl = transport.resolveUrl(LOGIN_PATH);
      const loginOrigin = new URL(loginUrl).origin;
      const initialLoginPath = `${LOGIN_PATH}?method=iniciarLogin`;

      logger?.warn(
        { event: 'ecnh.login.flow.start' },
        'Fluxo de autenticação e-CNH iniciado'
      );

      markStepStart(LOGIN_STEPS.GET_INICIAR_LOGIN);
      await transport.request<string>({
        headers: {
          Origin: undefined,
          Referer: transport.resolveUrl('/')
        },
        loginStep: LOGIN_STEPS.GET_INICIAR_LOGIN,
        method: 'GET',
        responseEncoding: 'latin1',
        url: initialLoginPath
      });
      markStepCompleted(LOGIN_STEPS.GET_INICIAR_LOGIN);

      markStepStart(LOGIN_STEPS.POST_INICIAR_LOGIN_AGENDA);
      await transport.request<string>({
        data: new URLSearchParams([
          ['method', 'iniciarLoginAgenda'],
          ['isCyberark', ''],
          ['codigo', ''],
          ['senha', ''],
          ['autenticadoCyberark', 'false'],
          ['cpfStorage', ''],
          ['novaSenha', ''],
          ['novaSenha1', ''],
          ['alteraSenha', 'false'],
          ['idGrupoUsuario', '-1'],
          ['idCFC', ''],
          ['idUnidTransito', '-1'],
          ['msgPublicacao', ''],
          ['forceLogout', 'false'],
          ['codigo', '']
        ]).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: loginOrigin,
          Referer: transport.resolveUrl(initialLoginPath)
        },
        loginStep: LOGIN_STEPS.POST_INICIAR_LOGIN_AGENDA,
        method: 'POST',
        responseEncoding: 'latin1',
        url: LOGIN_PATH
      });
      markStepCompleted(LOGIN_STEPS.POST_INICIAR_LOGIN_AGENDA);

      markStepStart(LOGIN_STEPS.POST_AUTENTICAR);
      const firstAuth = await transport.request<string>({
        data: this.buildAutenticarBody(credentials, '-1', 'false'),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: loginOrigin,
          Referer: loginUrl
        },
        loginStep: LOGIN_STEPS.POST_AUTENTICAR,
        method: 'POST',
        responseEncoding: 'latin1',
        url: LOGIN_PATH
      });
      markStepCompleted(LOGIN_STEPS.POST_AUTENTICAR);

      let htmlAutenticado = firstAuth.data;

      // B010 → B011 → B012 (classificação final). Ordem fixa; ramos isolados.
      if (
        resolverPerfilNoHtml(htmlAutenticado) === undefined &&
        htmlRequerEncerramentoSessaoExistente(htmlAutenticado)
      ) {
        const sessao = await this.completarEncerramentoSessaoExistente(
          credentials,
          transport,
          htmlAutenticado,
          loginOrigin,
          loginUrl,
          { logger, markStepStart, markStepCompleted }
        );
        if (sessao.status !== 'ok') {
          logger?.warn(
            {
              event: 'ecnh.login.flow.failed',
              reason: 'b010_incomplete',
              lastSuccessfulLoginStep,
              currentLoginStep,
              outcomeStatus: sessao.status
            },
            'Fluxo de autenticação e-CNH interrompido no ramo B010'
          );
          return sessao;
        }
        htmlAutenticado = sessao.html;
      }

      const perfilImediato = resolverPerfilNoHtml(htmlAutenticado);
      if (perfilImediato === undefined && htmlRequerEscolhaUnidade(htmlAutenticado)) {
        const escolha = await this.completarEscolhaUnidade(
          credentials,
          transport,
          htmlAutenticado,
          loginOrigin,
          loginUrl,
          options.unidadeDesejada,
          { logger, markStepStart, markStepCompleted }
        );
        if (escolha.status !== 'ok') {
          logger?.warn(
            {
              event: 'ecnh.login.flow.failed',
              reason: 'b011_incomplete',
              lastSuccessfulLoginStep,
              currentLoginStep,
              outcomeStatus: escolha.status
            },
            'Fluxo de autenticação e-CNH interrompido no ramo B011'
          );
          return escolha;
        }
        htmlAutenticado = escolha.html;
      }

      markStepStart(LOGIN_STEPS.LOGIN_CONFIRMATION);
      const hasSessionCookie = await transport.hasCookie(SESSION_COOKIE_NAME);
      const outcome = this.classificarSucessoAutenticacao(
        htmlAutenticado,
        hasSessionCookie,
        options.perfilEsperado
      );

      if (outcome.status === 'sucesso') {
        markStepCompleted(LOGIN_STEPS.LOGIN_CONFIRMATION);
        logger?.warn(
          {
            event: 'ecnh.login.flow.completed',
            lastSuccessfulLoginStep: LOGIN_STEPS.LOGIN_CONFIRMATION,
            perfilId: outcome.perfil.id,
            jsessionPresent: hasSessionCookie
          },
          'Fluxo de autenticação e-CNH confirmado'
        );
      } else {
        logger?.warn(
          {
            event: 'ecnh.login.flow.failed',
            reason: 'login_confirmation',
            loginStep: LOGIN_STEPS.LOGIN_CONFIRMATION,
            lastSuccessfulLoginStep,
            outcomeStatus: outcome.status,
            jsessionPresent: hasSessionCookie,
            htmlBytes: Buffer.byteLength(htmlAutenticado, 'latin1')
          },
          'Confirmação final do login e-CNH não satisfeita'
        );
      }

      return outcome;
    } catch (error) {
      logger?.error(
        {
          event: 'ecnh.login.flow.failed',
          reason: 'transport_error',
          loginStep: currentLoginStep,
          lastSuccessfulLoginStep,
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                  code: (error as NodeJS.ErrnoException).code
                }
              : { message: String(error) }
        },
        'Fluxo de autenticação e-CNH falhou no transporte HTTP'
      );
      return this.fromTransportError(error);
    }
  }

  /**
   * Encerra a sessão no portal conforme o item de menu "Sair"
   * (`GET method=finalizarLogin`), observado em `/gefor/global/menu_items.jsp`.
   */
  public async logout(transport: AuthTransport): Promise<void> {
    await transport.request<string>({
      headers: {
        Referer: transport.resolveUrl(LOGIN_PATH)
      },
      loginStep: 'GET_finalizarLogin',
      method: 'GET',
      responseEncoding: 'latin1',
      url: LOGOUT_PATH
    });
  }

  /**
   * B010: POST autenticar com forceLogout=true no mesmo CookieJar.
   * Contrato: docs/evidencias/003e-contrato-congelado-force-logout-2026-07-19.json
   */
  private async completarEncerramentoSessaoExistente(
    credentials: LoginCredentials,
    transport: AuthTransport,
    htmlPosAutenticar: string,
    loginOrigin: string,
    loginUrl: string,
    stepHooks: LoginStepHooks
  ): Promise<
    | { html: string; status: 'ok' }
    | Exclude<LoginResult, { status: 'sucesso' }>
  > {
    const autenticadoCyberark =
      extrairAutenticadoCyberarkDeOpenDialogNewSession(htmlPosAutenticar);

    stepHooks.markStepStart(LOGIN_STEPS.POST_AUTENTICAR_FORCE_LOGOUT);
    const forceLogoutAuth = await transport.request<string>({
      data: this.buildAutenticarBody(
        credentials,
        '-1',
        autenticadoCyberark,
        'true'
      ),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: loginOrigin,
        Referer: loginUrl
      },
      loginStep: LOGIN_STEPS.POST_AUTENTICAR_FORCE_LOGOUT,
      method: 'POST',
      responseEncoding: 'latin1',
      url: LOGIN_PATH
    });
    stepHooks.markStepCompleted(LOGIN_STEPS.POST_AUTENTICAR_FORCE_LOGOUT);

    if (htmlRequerEncerramentoSessaoExistente(forceLogoutAuth.data)) {
      return {
        message:
          'O portal manteve openDialogNewSession após autenticar com forceLogout=true.',
        status: 'erro_desconhecido'
      };
    }

    return { html: forceLogoutAuth.data, status: 'ok' };
  }

  /**
   * B011: GET openChoice → resolver unidade → segundo POST autenticar.
   * Contrato: docs/evidencias/003d-descoberta-enviar-escolha-unidade-2026-07-19.json
   */
  private async completarEscolhaUnidade(
    credentials: LoginCredentials,
    transport: AuthTransport,
    htmlPosAutenticar: string,
    loginOrigin: string,
    loginUrl: string,
    unidadeDesejada: UnidadeDesejadaConfig | undefined,
    stepHooks: LoginStepHooks
  ): Promise<
    | { html: string; status: 'ok' }
    | Exclude<LoginResult, { status: 'sucesso' }>
  > {
    const autenticadoCyberark =
      extrairAutenticadoCyberarkDeOpenDialogChoice(htmlPosAutenticar);

    stepHooks.markStepStart(LOGIN_STEPS.GET_OPEN_CHOICE);
    const openChoice = await transport.request<string>({
      headers: {
        Referer: loginUrl
      },
      loginStep: LOGIN_STEPS.GET_OPEN_CHOICE,
      method: 'GET',
      responseEncoding: 'latin1',
      url: `${LOGIN_PATH}?method=openChoice&autenticadoCyberark=${encodeURIComponent(autenticadoCyberark)}`
    });
    stepHooks.markStepCompleted(LOGIN_STEPS.GET_OPEN_CHOICE);

    if (!htmlContemFormularioEscolhaUnidade(openChoice.data)) {
      return {
        message:
          'O portal indicou openDialogChoice, mas a resposta de openChoice não contém o formulário de escolha de unidade esperado.',
        status: 'erro_desconhecido'
      };
    }

    const opcoes = parseOpcoesUnidadeTransito(openChoice.data);
    const resolucao = resolverUnidadeConfigurada(opcoes, unidadeDesejada);
    if (resolucao.status === 'erro') {
      return {
        message: resolucao.motivo,
        status: 'erro_desconhecido'
      };
    }

    stepHooks.markStepStart(LOGIN_STEPS.POST_AUTENTICAR_COM_UNIDADE);
    const secondAuth = await transport.request<string>({
      data: this.buildAutenticarBody(
        credentials,
        resolucao.opcao.value,
        autenticadoCyberark
      ),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: loginOrigin,
        Referer: loginUrl
      },
      loginStep: LOGIN_STEPS.POST_AUTENTICAR_COM_UNIDADE,
      method: 'POST',
      responseEncoding: 'latin1',
      url: LOGIN_PATH
    });
    stepHooks.markStepCompleted(LOGIN_STEPS.POST_AUTENTICAR_COM_UNIDADE);

    return { html: secondAuth.data, status: 'ok' };
  }

  private buildAutenticarBody(
    credentials: LoginCredentials,
    idUnidTransito: string,
    autenticadoCyberark: string,
    forceLogout: string = 'false'
  ): string {
    return new URLSearchParams([
      ['method', 'autenticar'],
      ['novaSenha', ''],
      ['novaSenha1', ''],
      ['alteraSenha', 'false'],
      ['idGrupoUsuario', '-1'],
      ['idCFC', ''],
      ['idUnidTransito', idUnidTransito],
      ['msgPublicacao', ''],
      ['consultaAgenda', 'true'],
      ['autenticadoCyberark', autenticadoCyberark],
      ['codigo', credentials.cpf],
      ['senha', credentials.password],
      ['forceLogout', forceLogout]
    ]).toString();
  }

  private classificarSucessoAutenticacao(
    html: string,
    hasSessionCookie: boolean,
    perfilEsperado: PerfilProfissionalId | undefined
  ): AuthenticationLoginOutcome {
    const perfilDetectado = resolverPerfilNoHtml(html);

    if (!hasSessionCookie || perfilDetectado === undefined) {
      return classificarFalhaAutenticacaoHtml(html);
    }

    if (perfilEsperado !== undefined && perfilEsperado !== perfilDetectado.id) {
      return {
        message: `Perfil configurado (${perfilEsperado}) diverge do HTML autenticado (${perfilDetectado.id}).`,
        status: 'erro_desconhecido'
      };
    }

    const perfil =
      perfilEsperado !== undefined ? obterPerfilPorId(perfilEsperado) : perfilDetectado;

    return { html, perfil, status: 'sucesso' };
  }

  private fromTransportError(error: unknown): Exclude<LoginResult, { status: 'sucesso' }> {
    if (error instanceof AxiosError) {
      const code = error.code ?? '';
      const messageLower = error.message.toLowerCase();

      if (
        code === 'ETIMEDOUT' ||
        code === 'ECONNABORTED' ||
        error.message.includes('timeout') ||
        messageLower.includes('timed out')
      ) {
        return {
          message: `Timeout na comunicação HTTP com o portal: ${error.message}`,
          status: 'timeout'
        };
      }

      if (
        code === 'ECONNREFUSED' ||
        code === 'ENOTFOUND' ||
        code === 'EAI_AGAIN' ||
        code === 'ENETUNREACH' ||
        code === 'EHOSTUNREACH'
      ) {
        return {
          message: `Portal indisponível ou inacessível: ${error.message}`,
          status: 'portal_indisponivel'
        };
      }

      return {
        message: `Não foi possível concluir a comunicação HTTP com o portal: ${error.message}`,
        status: 'erro_sistema'
      };
    }

    return {
      message: 'Ocorreu um erro não classificado durante a autenticação.',
      status: 'erro_desconhecido'
    };
  }
}

interface LoginStepHooks {
  logger?: StructuredLogger;
  markStepCompleted: (loginStep: string) => void;
  markStepStart: (loginStep: string) => void;
}
