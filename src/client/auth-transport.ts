import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { HttpCookieAgent, HttpsCookieAgent } from 'http-cookie-agent/http';

import { StructuredLogger } from '../types/logger.js';
import { SessionManager } from './session-manager.js';

const CHROME_ACCEPT =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
const CHROME_ACCEPT_LANGUAGE = 'en-US,en;q=0.9';
const CHROME_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

/** Transporte HTTP autenticável que preserva cookies no CookieJar da sessão. */
export class AuthTransport {
  private readonly http: AxiosInstance;

  public constructor(
    private readonly baseUrl: string,
    private readonly logger: StructuredLogger,
    private readonly session: SessionManager
  ) {
    const cookieAgentOptions = {
      cookies: { jar: session.cookieJar },
      keepAlive: true,
      maxSockets: 1
    };
    const httpAgent = new HttpCookieAgent(cookieAgentOptions);
    const httpsAgent = new HttpsCookieAgent(cookieAgentOptions);
    const httpClient = axios.create({
      baseURL: baseUrl,
      headers: {
        Accept: CHROME_ACCEPT,
        'Accept-Language': CHROME_ACCEPT_LANGUAGE,
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': CHROME_USER_AGENT
      },
      httpAgent,
      httpsAgent,
      maxRedirects: 5,
      timeout: 30_000,
      validateStatus: () => true
    });
    this.http = httpClient;
  }

  public async request<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const method = (config.method ?? 'GET').toUpperCase();
    this.logger.info(
      { event: 'ecnh.http.request', method, url: config.url },
      'Enviando requisição HTTP ao e-CNH'
    );

    try {
      const response = await this.http.request<T>(config);
      this.logger.info(
        { event: 'ecnh.http.response', method, status: response.status, url: config.url },
        'Resposta HTTP recebida do e-CNH'
      );
      return response;
    } catch (error) {
      const errorDetails =
        error instanceof Error
          ? {
              code: axios.isAxiosError(error) ? error.code : undefined,
              message: error.message,
              name: error.name
            }
          : { message: 'Erro não identificado', name: 'UnknownError' };
      this.logger.error(
        { error: errorDetails, event: 'ecnh.http.error', method, url: config.url },
        'Falha na requisição HTTP ao e-CNH'
      );
      throw error;
    }
  }

  public resolveUrl(path: string): string {
    return new URL(path, this.baseUrl).toString();
  }

  public async hasCookie(name: string): Promise<boolean> {
    const present = await this.session.hasCookie(name, this.http.defaults.baseURL ?? '');
    this.logger.info(
      { event: 'ecnh.session.cookie_checked', name, present },
      'Cookie de sessão verificado'
    );
    return present;
  }
}
