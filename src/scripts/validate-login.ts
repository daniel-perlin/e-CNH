import 'dotenv/config';

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

import { AuthTransport } from '../client/auth-transport.js';
import { ECNHClient } from '../client/ecnh-client.js';
import { ConfigurationError } from '../client/errors.js';
import {
  listEnabledLoginCredentials,
  resolveLoginCredentials,
  type ResolvedLoginCredentials
} from '../config/login-credentials.js';
import { StructuredLogger } from '../types/logger.js';

const AUTHENTICATED_PAGE_MARKER = 'Imprimir Agenda Diária do Psicólogo';
const DEFAULT_ATTEMPTS = 5;
const DEFAULT_DELAY_MS = 5_000;
const EVIDENCE_DIRECTORY = 'docs/evidencias';
const INITIAL_LOGIN_PATH = '/gefor/SGU/login.do?method=iniciarLogin';
const LOGIN_PATH = '/gefor/SGU/login.do';
const MAX_ATTEMPTS = 50;
const MAX_DELAY_MS = 60_000;
const SESSION_COOKIE_NAME = 'JSESSIONID';

interface RequestEvidence {
  bodyBytes?: number;
  bodySha256?: string;
  containsAuthenticatedMarker?: boolean;
  containsLoginForm?: boolean;
  containsProtectedForm?: boolean;
  durationMs: number;
  errorCode?: string;
  method: string;
  status?: number;
  url: string;
}

interface AttemptEvidence {
  approved: boolean;
  credentialsSource: string;
  durationMs: number;
  finishedAt: string;
  number: number;
  requests: RequestEvidence[];
  resultStatus: string;
  sessionCookiePresent: boolean;
  startedAt: string;
}

interface AttemptState {
  requests: RequestEvidence[];
  sessionCookiePresent: boolean;
}

let activeAttempt: AttemptState | undefined;

const originalRequest = AuthTransport.prototype.request;
AuthTransport.prototype.request = async function <T>(
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  const startedAt = performance.now();

  try {
    const response = (await originalRequest.call(this, config)) as AxiosResponse<T>;
    activeAttempt?.requests.push(
      createRequestEvidence(config, performance.now() - startedAt, response)
    );
    return response;
  } catch (error) {
    activeAttempt?.requests.push({
      durationMs: roundDuration(performance.now() - startedAt),
      errorCode: axios.isAxiosError(error) ? error.code : undefined,
      method: normalizeMethod(config.method),
      url: config.url ?? ''
    });
    throw error;
  }
};

async function main(): Promise<void> {
  const baseUrl = process.env.ECNH_BASE_URL;
  if (baseUrl === undefined || baseUrl.trim().length === 0) {
    throw new ConfigurationError(
      'Defina ECNH_BASE_URL no arquivo .env antes de executar a validação.'
    );
  }

  const credentialPool = resolveCredentialPool();
  const attemptsCount = parseAttempts(process.env.LOGIN_VALIDATION_ATTEMPTS);
  const delayMs = parseDelayMs(process.env.LOGIN_VALIDATION_DELAY_MS);
  const validationStartedAt = new Date();
  const attempts: AttemptEvidence[] = [];

  if (credentialPool.length < attemptsCount) {
    throw new ConfigurationError(
      `A validação exige ${attemptsCount} credenciais habilitadas distintas; encontradas ${credentialPool.length}. ` +
        'Habilite mais usuários com ECNH_USER_<n>_ENABLED=true ou reduza LOGIN_VALIDATION_ATTEMPTS.'
    );
  }

  for (let number = 1; number <= attemptsCount; number += 1) {
    if (number > 1 && delayMs > 0) {
      await wait(delayMs);
    }
    const credentials = credentialPool[number - 1];
    attempts.push(
      await executeAttempt(number, baseUrl, credentials.cpf, credentials.password, credentials.source)
    );
  }

  const approvedAttempts = attempts.filter((attempt) => attempt.approved).length;
  const evidence = {
    attempts,
    criteria: {
      consecutiveApprovedAttempts: attemptsCount,
      delayMsBetweenAttempts: delayMs,
      distinctCredentialsPerAttempt: true,
      finalMarker: AUTHENTICATED_PAGE_MARKER,
      loginFormAbsent: true,
      protectedFormPresent: true,
      requestSequence: [`GET ${INITIAL_LOGIN_PATH}`, `POST ${LOGIN_PATH}`, `POST ${LOGIN_PATH}`],
      sessionCookie: SESSION_COOKIE_NAME
    },
    credentialsSources: credentialPool.slice(0, attemptsCount).map((item) => item.source),
    finishedAt: new Date().toISOString(),
    nodeVersion: process.version,
    phase: '003A',
    schemaVersion: 1,
    startedAt: validationStartedAt.toISOString(),
    summary: {
      approved: approvedAttempts === attemptsCount,
      approvedAttempts,
      failedAttempts: attemptsCount - approvedAttempts,
      totalAttempts: attemptsCount
    }
  };
  const evidencePath = await saveEvidence(validationStartedAt, evidence);

  console.log(
    JSON.stringify(
      {
        approved: evidence.summary.approved,
        approvedAttempts,
        evidencePath,
        failedAttempts: evidence.summary.failedAttempts,
        totalAttempts: attemptsCount
      },
      null,
      2
    )
  );

  if (!evidence.summary.approved) {
    process.exitCode = 1;
  }
}

async function executeAttempt(
  number: number,
  baseUrl: string,
  cpf: string,
  password: string,
  credentialsSource: string
): Promise<AttemptEvidence> {
  const state: AttemptState = { requests: [], sessionCookiePresent: false };
  const startedAt = new Date();
  const startedAtPerformance = performance.now();
  activeAttempt = state;

  try {
    const client = new ECNHClient({ baseUrl, logger: createEvidenceLogger(state) });
    const result = await client.login(cpf, password);
    const durationMs = roundDuration(performance.now() - startedAtPerformance);
    const approved = isAttemptApproved(result.status, state);

    if (result.status === 'sucesso') {
      await client.logout();
    }

    return {
      approved,
      credentialsSource,
      durationMs,
      finishedAt: new Date().toISOString(),
      number,
      requests: state.requests,
      resultStatus: result.status,
      sessionCookiePresent: state.sessionCookiePresent,
      startedAt: startedAt.toISOString()
    };
  } finally {
    activeAttempt = undefined;
  }
}

function resolveCredentialPool(): ResolvedLoginCredentials[] {
  const enabledUsers = listEnabledLoginCredentials();
  if (enabledUsers.length > 0) {
    return enabledUsers;
  }

  return [resolveLoginCredentials()];
}

function createEvidenceLogger(state: AttemptState): StructuredLogger {
  const inspect = (bindings: object): void => {
    const event = Reflect.get(bindings, 'event');
    const name = Reflect.get(bindings, 'name');
    const present = Reflect.get(bindings, 'present');

    if (
      event === 'ecnh.session.cookie_checked' &&
      name === SESSION_COOKIE_NAME &&
      present === true
    ) {
      state.sessionCookiePresent = true;
    }
  };

  return {
    debug: inspect,
    error: inspect,
    info: inspect,
    warn: inspect
  };
}

function createRequestEvidence<T>(
  config: AxiosRequestConfig,
  durationMs: number,
  response: AxiosResponse<T>
): RequestEvidence {
  const evidence: RequestEvidence = {
    durationMs: roundDuration(durationMs),
    method: normalizeMethod(config.method),
    status: response.status,
    url: config.url ?? ''
  };

  if (typeof response.data !== 'string') {
    return evidence;
  }

  const body = Buffer.from(response.data, 'latin1');
  return {
    ...evidence,
    bodyBytes: body.length,
    bodySha256: createHash('sha256').update(body).digest('hex'),
    containsAuthenticatedMarker: response.data.includes(AUTHENTICATED_PAGE_MARKER),
    containsLoginForm: response.data.includes('LoginActionForm'),
    containsProtectedForm: response.data.includes('DivisaoEquitativaForm')
  };
}

function isAttemptApproved(resultStatus: string, state: AttemptState): boolean {
  const [initialRequest, agendaRequest, authenticationRequest] = state.requests;
  const validSequence =
    state.requests.length === 3 &&
    initialRequest?.method === 'GET' &&
    initialRequest.url === INITIAL_LOGIN_PATH &&
    agendaRequest?.method === 'POST' &&
    agendaRequest.url === LOGIN_PATH &&
    authenticationRequest?.method === 'POST' &&
    authenticationRequest.url === LOGIN_PATH;
  const allResponsesSucceeded = state.requests.every((request) => request.status === 200);

  return (
    resultStatus === 'sucesso' &&
    state.sessionCookiePresent &&
    validSequence &&
    allResponsesSucceeded &&
    authenticationRequest?.containsAuthenticatedMarker === true &&
    authenticationRequest.containsProtectedForm === true &&
    authenticationRequest.containsLoginForm === false
  );
}

function normalizeMethod(method: string | undefined): string {
  return (method ?? 'GET').toUpperCase();
}

function parseAttempts(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_ATTEMPTS;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_ATTEMPTS) {
    throw new ConfigurationError(
      `LOGIN_VALIDATION_ATTEMPTS deve ser um inteiro entre 1 e ${MAX_ATTEMPTS}.`
    );
  }
  return parsed;
}

function parseDelayMs(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_DELAY_MS;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_DELAY_MS) {
    throw new ConfigurationError(
      `LOGIN_VALIDATION_DELAY_MS deve ser um inteiro entre 0 e ${MAX_DELAY_MS}.`
    );
  }
  return parsed;
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function saveEvidence(startedAt: Date, evidence: object): Promise<string> {
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
  const timestamp = startedAt.toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const path = `${EVIDENCE_DIRECTORY}/003a-validacao-login-${timestamp}.json`;
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return path;
}

function roundDuration(durationMs: number): number {
  return Math.round(durationMs);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`Validação reproduzível falhou: ${message}`);
  process.exitCode = 1;
});
