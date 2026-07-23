import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { HttpCookieAgent, HttpsCookieAgent } from 'http-cookie-agent/http';

import { StructuredLogger } from '../types/logger.js';
import { SessionManager } from './session-manager.js';

const CHROME_ACCEPT =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
const CHROME_ACCEPT_LANGUAGE = 'en-US,en;q=0.9';
const CHROME_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

const HEADERS_SENSIVEIS = new Set(['authorization', 'cookie', 'set-cookie', 'proxy-authorization']);

/** Extensão opcional do Axios config — só metadados de diagnóstico (não vão ao wire). */
export interface AuthRequestConfig extends AxiosRequestConfig {
  /** Nome da etapa do fluxo de login (ex.: GET_iniciarLogin). */
  loginStep?: string;
}

/** Transporte HTTP autenticável que preserva cookies no CookieJar da sessão. */
export class AuthTransport {
  private readonly http: AxiosInstance;
  private readonly keepAlive = true;
  private readonly requestTimeoutMs = 30_000;

  public constructor(
    private readonly baseUrl: string,
    private readonly logger: StructuredLogger,
    private readonly session: SessionManager
  ) {
    const cookieAgentOptions = {
      cookies: { jar: session.cookieJar },
      keepAlive: this.keepAlive,
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
      timeout: this.requestTimeoutMs,
      validateStatus: () => true
    });
    this.http = httpClient;
  }

  public async request<T>(config: AuthRequestConfig): Promise<AxiosResponse<T>> {
    const { loginStep, ...axiosConfig } = config;
    const method = (axiosConfig.method ?? 'GET').toUpperCase();
    const relativeUrl = typeof axiosConfig.url === 'string' ? axiosConfig.url : '';
    const absoluteUrl = this.resolveUrl(relativeUrl);
    const parsedUrl = new URL(absoluteUrl);
    const startedAt = Date.now();
    const headersDiagnostico = this.extrairHeadersRequisicao(axiosConfig);
    const cookiesSentCount = await this.contarCookiesParaUrl(absoluteUrl);

    // warn: sync de produção usa logger level=warn; info ficaria invisível no Railway.
    this.logger.warn(
      {
        event: 'ecnh.http.request.start',
        loginStep,
        method,
        absoluteUrl,
        protocol: parsedUrl.protocol.replace(':', ''),
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80'),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        relativeUrl,
        baseUrl: this.baseUrl,
        timeoutMs: this.requestTimeoutMs,
        keepAlive: this.keepAlive,
        maxSockets: 1,
        maxRedirects: 5,
        cookiesSentCount,
        headers: headersDiagnostico
      },
      'Enviando requisição HTTP ao e-CNH'
    );

    try {
      const response = await this.http.request<T>({
        ...axiosConfig,
        beforeRedirect: (options, redirectDetails, requestDetails) => {
          const locationHeader = redirectDetails.headers.location;
          const location = Array.isArray(locationHeader)
            ? locationHeader[0]
            : locationHeader;
          this.logger.warn(
            {
              event: 'ecnh.http.redirect',
              loginStep,
              method,
              fromUrl: absoluteUrl,
              statusCode: redirectDetails.statusCode,
              location: location !== undefined ? String(location) : undefined,
              nextHostname: options.hostname,
              nextPath: options.pathname,
              setCookiePresent: redirectDetails.headers['set-cookie'] !== undefined,
              setCookieCount: contarSetCookie(redirectDetails.headers['set-cookie'])
            },
            'Redirect HTTP observado no e-CNH'
          );
          if (typeof axiosConfig.beforeRedirect === 'function') {
            axiosConfig.beforeRedirect(options, redirectDetails, requestDetails);
          }
        }
      });
      const durationMs = Date.now() - startedAt;
      const bodyBytes = medirBodyBytes(response.data);
      const setCookieCount = contarSetCookie(response.headers['set-cookie']);
      const location = lerHeaderUnico(response.headers, 'location');
      const contentType = lerHeaderUnico(response.headers, 'content-type');
      const responseUrl = extrairResponseUrl(response) ?? absoluteUrl;
      const cookiesAfterCount = await this.contarCookiesParaUrl(responseUrl);

      this.logger.warn(
        {
          event: 'ecnh.http.request.completed',
          loginStep,
          method,
          absoluteUrl,
          responseUrl,
          hostname: parsedUrl.hostname,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          status: response.status,
          statusText: response.statusText,
          durationMs,
          cookiesSentCount,
          cookiesReceivedCount: setCookieCount,
          cookiesJarCountAfter: cookiesAfterCount,
          setCookiePresent: setCookieCount > 0,
          location,
          bodyBytes,
          contentType,
          responseHeaders: this.extrairHeadersResposta(response.headers)
        },
        'Resposta HTTP recebida do e-CNH'
      );
      return response;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const errorDetails = this.serializarErroTransporte(error);
      this.logger.error(
        {
          event: 'ecnh.http.request.failed',
          loginStep,
          method,
          absoluteUrl,
          protocol: parsedUrl.protocol.replace(':', ''),
          hostname: parsedUrl.hostname,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          baseUrl: this.baseUrl,
          timeoutMs: this.requestTimeoutMs,
          keepAlive: this.keepAlive,
          durationMs,
          cookiesSentCount,
          headers: headersDiagnostico,
          connectionPhaseHint: inferirFaseConexao(errorDetails),
          error: errorDetails
        },
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

  private async contarCookiesParaUrl(url: string): Promise<number> {
    const cookies = await this.session.cookieJar.getCookies(url);
    return cookies.length;
  }

  private extrairHeadersRequisicao(
    config: AxiosRequestConfig
  ): Record<string, string | undefined> {
    const merged: Record<string, unknown> = {
      ...(this.http.defaults.headers.common as Record<string, unknown>),
      ...((this.http.defaults.headers[config.method?.toLowerCase() ?? 'get'] as
        | Record<string, unknown>
        | undefined) ?? {}),
      ...(config.headers as Record<string, unknown> | undefined)
    };

    const out: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(merged)) {
      const lower = key.toLowerCase();
      if (HEADERS_SENSIVEIS.has(lower)) {
        out[lower] =
          value === undefined || value === null || value === false ? undefined : '[redacted]';
        continue;
      }
      if (value === undefined || value === null || value === false) {
        out[lower] = undefined;
      } else {
        out[lower] = String(value);
      }
    }
    return out;
  }

  private extrairHeadersResposta(
    headers: AxiosResponse['headers']
  ): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, raw] of Object.entries(headers)) {
      const lower = key.toLowerCase();
      if (HEADERS_SENSIVEIS.has(lower)) {
        out[`${lower}-present`] = 'true';
        continue;
      }
      if (raw === undefined) {
        continue;
      }
      out[lower] = Array.isArray(raw) ? raw.join('; ') : String(raw);
    }
    return out;
  }

  private serializarErroTransporte(error: unknown): Record<string, unknown> {
    if (!axios.isAxiosError(error)) {
      if (error instanceof Error) {
        return {
          name: error.name,
          message: error.message,
          stack: error.stack
        };
      }
      return { message: 'Erro não identificado', name: 'UnknownError' };
    }

    const nodeError = error as NodeJS.ErrnoException & {
      address?: string;
      port?: number;
    };

    const cause =
      error.cause instanceof Error
        ? {
            name: error.cause.name,
            message: error.cause.message,
            stack: error.cause.stack,
            code: (error.cause as NodeJS.ErrnoException).code,
            errno: (error.cause as NodeJS.ErrnoException).errno,
            syscall: (error.cause as NodeJS.ErrnoException).syscall
          }
        : error.cause;

    return {
      name: error.name,
      message: error.message,
      code: error.code,
      errno: nodeError.errno,
      syscall: nodeError.syscall,
      address: nodeError.address,
      port: nodeError.port,
      stack: error.stack,
      isAxiosError: true,
      hasRequestObject: error.request !== undefined && error.request !== null,
      hasResponseObject: error.response !== undefined && error.response !== null,
      requestPath: error.request?.path,
      configUrl: error.config?.url,
      configBaseUrl: error.config?.baseURL,
      configMethod: error.config?.method,
      configTimeout: error.config?.timeout,
      cause
    };
  }
}

function contarSetCookie(raw: unknown): number {
  if (raw === undefined || raw === null) {
    return 0;
  }
  if (Array.isArray(raw)) {
    return raw.length;
  }
  return 1;
}

function lerHeaderUnico(
  headers: AxiosResponse['headers'],
  name: string
): string | undefined {
  const raw = headers[name];
  if (raw === undefined) {
    return undefined;
  }
  return Array.isArray(raw) ? raw[0] : String(raw);
}

function medirBodyBytes(data: unknown): number | undefined {
  if (typeof data === 'string') {
    return Buffer.byteLength(data, 'latin1');
  }
  if (Buffer.isBuffer(data)) {
    return data.byteLength;
  }
  return undefined;
}

function extrairResponseUrl(response: AxiosResponse): string | undefined {
  const fromRes = (
    response.request as { res?: { responseUrl?: string } } | undefined
  )?.res?.responseUrl;
  if (typeof fromRes === 'string' && fromRes.length > 0) {
    return fromRes;
  }
  const fromResponseUrl = (response.request as { responseUrl?: string } | undefined)
    ?.responseUrl;
  if (typeof fromResponseUrl === 'string' && fromResponseUrl.length > 0) {
    return fromResponseUrl;
  }
  return undefined;
}

/**
 * Hipótese observacional da fase do ciclo HTTP (somente log — não altera tratamento).
 * Baseada em code/syscall/presença de request/response do Axios.
 */
function inferirFaseConexao(errorDetails: Record<string, unknown>): string {
  const code = String(errorDetails.code ?? '');
  const syscall = String(errorDetails.syscall ?? '');
  const message = String(errorDetails.message ?? '').toLowerCase();
  const hasRequest = errorDetails.hasRequestObject === true;
  const hasResponse = errorDetails.hasResponseObject === true;

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return 'dns_resolution';
  }
  if (code === 'ECONNREFUSED') {
    return 'tcp_connect_refused';
  }
  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED' || message.includes('timeout')) {
    return 'timeout_before_complete_response';
  }
  if (
    code === 'CERT_HAS_EXPIRED' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    message.includes('certificate')
  ) {
    return 'tls_certificate';
  }
  if (hasResponse) {
    return 'after_http_response_received';
  }
  if (code === 'ECONNRESET' || message.includes('socket hang up')) {
    if (syscall === 'connect') {
      return 'during_tcp_connect_or_early_handshake';
    }
    if (syscall === 'read' || syscall === 'write') {
      return hasRequest
        ? 'after_request_sent_or_during_response_read'
        : 'during_tls_or_before_request_write';
    }
    return hasRequest
      ? 'after_tcp_connected_request_may_have_been_sent'
      : 'during_or_right_after_tcp_tls_before_response';
  }
  if (hasRequest && !hasResponse) {
    return 'request_object_present_no_response';
  }
  return 'unclassified_transport_failure';
}
