import pino from 'pino';

import { AuthTransport } from '../client/auth-transport.js';
import { SessionManager } from '../client/session-manager.js';
import type { StructuredLogger } from '../types/logger.js';

/** Mesmo path da 1ª etapa do login HTTP (sem autenticar). */
export const INICIAR_LOGIN_PATH = '/gefor/SGU/login.do?method=iniciarLogin';

export interface EcnhConnectivityProbeResult {
  absoluteUrl: string;
  durationMs: number;
  exitCode: 0 | 1;
  ok: boolean;
  status?: number;
  statusText?: string;
}

export interface RunEcnhConnectivityProbeOptions {
  /** Base URL do portal (`ECNH_BASE_URL`). */
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
  logger?: StructuredLogger;
  /** Quando false, não imprime JSON no stdout/stderr (testes). Default true. */
  printToConsole?: boolean;
}

/**
 * GET isolado `method=iniciarLogin` com o mesmo `AuthTransport` do sistema.
 * Não executa autenticação, sync, Sheets, parser nem lógica de negócio.
 *
 * @returns `exitCode` 0 = portal alcançado; 1 = falha de transporte/config.
 */
export async function runEcnhConnectivityProbe(
  options: RunEcnhConnectivityProbeOptions = {}
): Promise<EcnhConnectivityProbeResult> {
  const env = options.env ?? process.env;
  const printToConsole = options.printToConsole !== false;
  const baseUrl = (options.baseUrl ?? env.ECNH_BASE_URL)?.trim();

  if (baseUrl === undefined || baseUrl.length === 0) {
    if (printToConsole) {
      console.error(
        'Defina ECNH_BASE_URL no ambiente antes de executar o teste de conectividade.'
      );
    }
    return {
      absoluteUrl: '',
      durationMs: 0,
      exitCode: 1,
      ok: false
    };
  }

  const logger =
    options.logger ??
    pino({
      level: 'warn',
      redact: {
        paths: [
          'cpf',
          'password',
          'headers.cookie',
          'headers.authorization',
          'err.config.headers'
        ],
        remove: true
      }
    });

  const session = new SessionManager();
  const transport = new AuthTransport(baseUrl, logger, session);
  const absoluteUrl = transport.resolveUrl(INICIAR_LOGIN_PATH);
  const parsed = new URL(absoluteUrl);

  if (printToConsole) {
    console.log(
      JSON.stringify(
        {
          event: 'ecnh.connectivity.probe.starting',
          baseUrl,
          absoluteUrl,
          protocol: parsed.protocol.replace(':', ''),
          hostname: parsed.hostname,
          path: `${parsed.pathname}${parsed.search}`,
          note: 'GET isolado com AuthTransport (mesmo cliente HTTP do login); sem autenticação.'
        },
        null,
        2
      )
    );
  }

  const startedAt = Date.now();

  try {
    const response = await transport.request<string>({
      headers: {
        Origin: undefined,
        Referer: transport.resolveUrl('/')
      },
      method: 'GET',
      responseEncoding: 'latin1',
      url: INICIAR_LOGIN_PATH
    });

    const durationMs = Date.now() - startedAt;
    const bodyPreview =
      typeof response.data === 'string'
        ? response.data.slice(0, 120).replace(/\s+/g, ' ')
        : undefined;

    if (printToConsole) {
      console.log(
        JSON.stringify(
          {
            event: 'ecnh.connectivity.probe.success',
            absoluteUrl,
            status: response.status,
            statusText: response.statusText,
            durationMs,
            htmlBytes:
              typeof response.data === 'string'
                ? Buffer.byteLength(response.data, 'latin1')
                : undefined,
            bodyPreview,
            verdict: 'GET iniciarLogin alcançou o portal a partir deste ambiente.'
          },
          null,
          2
        )
      );
    }

    return {
      absoluteUrl,
      durationMs,
      exitCode: 0,
      ok: true,
      status: response.status,
      statusText: response.statusText
    };
  } catch (error: unknown) {
    const durationMs = Date.now() - startedAt;
    const details =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: (error as NodeJS.ErrnoException).code,
            errno: (error as NodeJS.ErrnoException).errno,
            syscall: (error as NodeJS.ErrnoException).syscall,
            address: (error as { address?: string }).address,
            port: (error as { port?: number }).port,
            cause:
              error.cause instanceof Error
                ? {
                    name: error.cause.name,
                    message: error.cause.message,
                    stack: error.cause.stack
                  }
                : error.cause
          }
        : { message: String(error) };

    if (printToConsole) {
      console.error(
        JSON.stringify(
          {
            event: 'ecnh.connectivity.probe.failed',
            absoluteUrl,
            durationMs,
            error: details,
            verdict:
              'GET iniciarLogin falhou neste ambiente. Compare com a execução local: se só falha no Railway, evidência forte de bloqueio de rede/WAF/TLS/egress.'
          },
          null,
          2
        )
      );
    }

    return {
      absoluteUrl,
      durationMs,
      exitCode: 1,
      ok: false
    };
  }
}
