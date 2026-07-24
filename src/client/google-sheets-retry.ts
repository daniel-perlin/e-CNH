/**
 * Classificação e backoff para erros transitórios da Google Sheets API.
 * Usado exclusivamente por `GoogleSheetsClient` (sem acoplar repositórios).
 */

/** Tentativas totais padrão (1 inicial + 4 retries → esperas 2s, 4s, 8s, 16s). */
export const DEFAULT_SHEETS_MAX_ATTEMPTS = 5;

/** Base do backoff exponencial em ms (2^attempt * base). */
export const DEFAULT_SHEETS_BACKOFF_BASE_MS = 2_000;

/** Teto de espera por retry (evita sleeps extremos se Retry-After vier alto). */
export const DEFAULT_SHEETS_MAX_WAIT_MS = 60_000;

const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

const TRANSIENT_REASON_FRAGMENTS = [
  'rate limit',
  'ratelimit',
  'quota exceeded',
  'userRateLimitExceeded',
  'rateLimitExceeded',
  'backendError',
  'internal error',
  'temporarily unavailable',
  'unavailable',
  'econnreset',
  'etimedout',
  'socket hang up',
  'eai_again'
] as const;

const PERMANENT_STATUS = new Set([400, 401, 403, 404]);

const PERMANENT_MESSAGE_FRAGMENTS = [
  'invalid_grant',
  'invalid credentials',
  'permission denied',
  'caller does not have permission',
  'the caller does not have permission',
  'requested entity was not found',
  'unable to parse range',
  'unable to parse the range',
  'no such sheet',
  'sheet not found',
  'not found',
  'invalid_request',
  'invalid argument'
] as const;

export interface SheetsRetryPolicy {
  backoffBaseMs: number;
  maxAttempts: number;
  maxWaitMs: number;
}

export const DEFAULT_SHEETS_RETRY_POLICY: SheetsRetryPolicy = {
  maxAttempts: DEFAULT_SHEETS_MAX_ATTEMPTS,
  backoffBaseMs: DEFAULT_SHEETS_BACKOFF_BASE_MS,
  maxWaitMs: DEFAULT_SHEETS_MAX_WAIT_MS
};

/** Extrai status HTTP de erros gaxios/googleapis quando disponíveis. */
export function extrairStatusHttpSheets(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const record = error as {
    code?: unknown;
    response?: { status?: unknown };
    status?: unknown;
  };
  const candidates = [record.response?.status, record.status, record.code];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string' && /^\d{3}$/.test(candidate)) {
      return Number(candidate);
    }
  }
  return undefined;
}

/** Lê `Retry-After` (segundos ou HTTP-date) quando a API o envia. */
export function extrairRetryAfterMs(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const headers = (error as { response?: { headers?: Record<string, unknown> } }).response
    ?.headers;
  if (headers === undefined) {
    return undefined;
  }
  const raw =
    headers['retry-after'] ??
    headers['Retry-After'] ??
    headers['RETRY-AFTER'];
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const text = Array.isArray(raw) ? String(raw[0]) : String(raw);
  const asSeconds = Number(text);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.round(asSeconds * 1_000);
  }
  const asDate = Date.parse(text);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now());
  }
  return undefined;
}

function mensagemErro(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function razoesGoogle(error: unknown): string[] {
  if (typeof error !== 'object' || error === null) {
    return [];
  }
  const errors = (error as { errors?: Array<{ reason?: string; message?: string }> }).errors;
  if (!Array.isArray(errors)) {
    return [];
  }
  return errors.flatMap((item) => {
    const parts: string[] = [];
    if (typeof item.reason === 'string') {
      parts.push(item.reason);
    }
    if (typeof item.message === 'string') {
      parts.push(item.message);
    }
    return parts;
  });
}

/**
 * Erros permanentes (credencial, permissão, planilha/aba/range) → sem retry.
 * 429 / quota / 5xx / rede transitória → retry.
 */
export function isTransientSheetsError(error: unknown): boolean {
  const status = extrairStatusHttpSheets(error);
  if (status !== undefined && PERMANENT_STATUS.has(status)) {
    return false;
  }

  const blob = `${mensagemErro(error)} ${razoesGoogle(error).join(' ')}`.toLowerCase();
  if (PERMANENT_MESSAGE_FRAGMENTS.some((fragment) => blob.includes(fragment))) {
    // "not found" em mensagem de quota é raro; 404 já coberto por status.
    // Evita tratar 429 com texto genérico como permanente.
    if (status === 429 || status === 503) {
      return true;
    }
    if (blob.includes('quota') || blob.includes('rate limit')) {
      return true;
    }
    return false;
  }

  if (status !== undefined && TRANSIENT_STATUS.has(status)) {
    return true;
  }

  return TRANSIENT_REASON_FRAGMENTS.some((fragment) => blob.includes(fragment.toLowerCase()));
}

/** Motivo curto para logs (sem PII). */
export function motivoRetrySheets(error: unknown): string {
  const status = extrairStatusHttpSheets(error);
  const message = mensagemErro(error);
  if (status === 429 || /quota|rate limit/i.test(message)) {
    return 'quota_or_rate_limit';
  }
  if (status === 503 || /unavailable|backendError/i.test(message)) {
    return 'service_unavailable';
  }
  if (status !== undefined && status >= 500) {
    return `http_${status}`;
  }
  if (status !== undefined) {
    return `http_${status}`;
  }
  return 'transient_network_or_api';
}

/**
 * Espera após a tentativa `attempt` falhar (1-based).
 * Sem Retry-After: 2^attempt * baseMs (attempt=1 → 2s com base 2000).
 */
export function calcularEsperaRetryMs(
  attempt: number,
  error: unknown,
  policy: SheetsRetryPolicy = DEFAULT_SHEETS_RETRY_POLICY
): number {
  const retryAfter = extrairRetryAfterMs(error);
  if (retryAfter !== undefined) {
    return Math.min(Math.max(retryAfter, 0), policy.maxWaitMs);
  }
  const exp = Math.max(1, attempt);
  const calculated = policy.backoffBaseMs * 2 ** (exp - 1);
  return Math.min(calculated, policy.maxWaitMs);
}

export function serializarErroSheets(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }
  const status = extrairStatusHttpSheets(error);
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    status,
    code: (error as NodeJS.ErrnoException).code
  };
}
