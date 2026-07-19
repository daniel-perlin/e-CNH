import { AxiosError } from 'axios';

import { LoginCredentials, LoginResult } from '../types/auth.js';
import { AuthTransport } from './auth-transport.js';
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
  /** Perfil esperado (config); se definido, deve coincidir com o HTML. */
  perfilEsperado?: PerfilProfissionalId;
  /**
   * Unidade desejada (B011). Obrigatória somente se o portal emitir `openDialogChoice`.
   */
  unidadeDesejada?: UnidadeDesejadaConfig;
}

/**
 * Protocolo confirmado no DevTools para a autenticação HTTP do e-CNH.
 */
export class ECNHAuthenticationProtocol {
  public async login(
    credentials: LoginCredentials,
    transport: AuthTransport,
    options: AuthenticationLoginOptions = {}
  ): Promise<AuthenticationLoginOutcome> {
    try {
      const loginUrl = transport.resolveUrl(LOGIN_PATH);
      const loginOrigin = new URL(loginUrl).origin;
      const initialLoginPath = `${LOGIN_PATH}?method=iniciarLogin`;

      await transport.request<string>({
        headers: {
          Origin: undefined,
          Referer: transport.resolveUrl('/')
        },
        method: 'GET',
        responseEncoding: 'latin1',
        url: initialLoginPath
      });

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
        method: 'POST',
        responseEncoding: 'latin1',
        url: LOGIN_PATH
      });

      const firstAuth = await transport.request<string>({
        data: this.buildAutenticarBody(credentials, '-1', 'false'),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: loginOrigin,
          Referer: loginUrl
        },
        method: 'POST',
        responseEncoding: 'latin1',
        url: LOGIN_PATH
      });

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
          loginUrl
        );
        if (sessao.status !== 'ok') {
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
          options.unidadeDesejada
        );
        if (escolha.status !== 'ok') {
          return escolha;
        }
        htmlAutenticado = escolha.html;
      }

      return this.classificarSucessoAutenticacao(
        htmlAutenticado,
        await transport.hasCookie(SESSION_COOKIE_NAME),
        options.perfilEsperado
      );
    } catch (error) {
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
    loginUrl: string
  ): Promise<
    | { html: string; status: 'ok' }
    | Exclude<LoginResult, { status: 'sucesso' }>
  > {
    const autenticadoCyberark =
      extrairAutenticadoCyberarkDeOpenDialogNewSession(htmlPosAutenticar);

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
      method: 'POST',
      responseEncoding: 'latin1',
      url: LOGIN_PATH
    });

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
    unidadeDesejada: UnidadeDesejadaConfig | undefined
  ): Promise<
    | { html: string; status: 'ok' }
    | Exclude<LoginResult, { status: 'sucesso' }>
  > {
    const autenticadoCyberark =
      extrairAutenticadoCyberarkDeOpenDialogChoice(htmlPosAutenticar);

    const openChoice = await transport.request<string>({
      headers: {
        Referer: loginUrl
      },
      method: 'GET',
      responseEncoding: 'latin1',
      url: `${LOGIN_PATH}?method=openChoice&autenticadoCyberark=${encodeURIComponent(autenticadoCyberark)}`
    });

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
      method: 'POST',
      responseEncoding: 'latin1',
      url: LOGIN_PATH
    });

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
      return {
        message:
          'O portal respondeu ao login, mas os sinais de autenticação confirmados não foram encontrados.',
        status: 'erro_desconhecido'
      };
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
