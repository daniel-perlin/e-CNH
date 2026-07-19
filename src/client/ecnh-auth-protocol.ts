import { AxiosError } from 'axios';

import { LoginCredentials, LoginResult } from '../types/auth.js';
import { AuthTransport } from './auth-transport.js';
import {
  type PerfilProfissionalId,
  type PerfilProfissionalPortal,
  obterPerfilPorId,
  resolverPerfilNoHtml
} from './perfil-profissional-portal.js';

const LOGIN_PATH = '/gefor/SGU/login.do';
const LOGOUT_PATH = `${LOGIN_PATH}?method=finalizarLogin`;
const SESSION_COOKIE_NAME = 'JSESSIONID';

export type AuthenticationLoginOutcome =
  | { html: string; perfil: PerfilProfissionalPortal; status: 'sucesso' }
  | Exclude<LoginResult, { status: 'sucesso' }>;

export interface AuthenticationLoginOptions {
  /** Perfil esperado (config); se definido, deve coincidir com o HTML. */
  perfilEsperado?: PerfilProfissionalId;
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

      const response = await transport.request<string>({
        data: new URLSearchParams([
          ['method', 'autenticar'],
          ['novaSenha', ''],
          ['novaSenha1', ''],
          ['alteraSenha', 'false'],
          ['idGrupoUsuario', '-1'],
          ['idCFC', ''],
          ['idUnidTransito', '-1'],
          ['msgPublicacao', ''],
          ['consultaAgenda', 'true'],
          ['autenticadoCyberark', 'false'],
          ['codigo', credentials.cpf],
          ['senha', credentials.password]
        ]).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: loginOrigin,
          Referer: loginUrl
        },
        method: 'POST',
        responseEncoding: 'latin1',
        url: LOGIN_PATH
      });

      const hasSessionCookie = await transport.hasCookie(SESSION_COOKIE_NAME);
      const perfilDetectado = resolverPerfilNoHtml(response.data);

      if (!hasSessionCookie || perfilDetectado === undefined) {
        return {
          message:
            'O portal respondeu ao login, mas os sinais de autenticação confirmados não foram encontrados.',
          status: 'erro_desconhecido'
        };
      }

      if (
        options.perfilEsperado !== undefined &&
        options.perfilEsperado !== perfilDetectado.id
      ) {
        return {
          message: `Perfil configurado (${options.perfilEsperado}) diverge do HTML autenticado (${perfilDetectado.id}).`,
          status: 'erro_desconhecido'
        };
      }

      const perfil =
        options.perfilEsperado !== undefined
          ? obterPerfilPorId(options.perfilEsperado)
          : perfilDetectado;

      return { html: response.data, perfil, status: 'sucesso' };
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
