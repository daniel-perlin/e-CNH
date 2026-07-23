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

  public async request<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const method = (config.method ?? 'GET').toUpperCase();
    const relativeUrl = typeof config.url === 'string' ? config.url : '';
    const absoluteUrl = this.resolveUrl(relativeUrl);
    const parsedUrl = new URL(absoluteUrl);
    const startedAt = Date.now();
    const headersDiagnostico = this.extrairHeadersRequisicao(config);

    // warn: sync de produção usa logger level=warn; info ficaria invisível no Railway.
    this.logger.warn(
      {
        event: 'ecnh.http.request.start',
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
        headers: headersDiagnostico
      },
      'Enviando requisição HTTP ao e-CNH'
    );

    try {
      const response = await this.http.request<T>(config);
      const durationMs = Date.now() - startedAt;
      this.logger.warn(
        {
          event: 'ecnh.http.request.completed',
          method,
          absoluteUrl,
          hostname: parsedUrl.hostname,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          status: response.status,
          statusText: response.statusText,
          durationMs,
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
          method,
          absoluteUrl,
          protocol: parsedUrl.protocol.replace(':', ''),
          hostname: parsedUrl.hostname,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          baseUrl: this.baseUrl,
          timeoutMs: this.requestTimeoutMs,
          keepAlive: this.keepAlive,
          durationMs,
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
        out[lower] = value === undefined || value === null || value === false ? undefined : '[redacted]';
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
  if (code === 'CERT_HAS_EXPIRED' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || message.includes('certificate')) {
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
