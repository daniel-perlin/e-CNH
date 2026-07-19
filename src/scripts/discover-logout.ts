import 'dotenv/config';

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';

import { AuthTransport } from '../client/auth-transport.js';
import { ConfigurationError } from '../client/errors.js';
import { htmlContemMarcadorAutenticado } from '../client/perfil-profissional-portal.js';
import { SessionManager } from '../client/session-manager.js';
import { resolveLoginCredentials, listEnabledLoginCredentials } from '../config/login-credentials.js';
import { StructuredLogger } from '../types/logger.js';
import { formatCpfForPortal } from '../utils/cpf.js';

const EVIDENCE_DIRECTORY = 'docs/evidencias';
const INITIAL_LOGIN_PATH = '/gefor/SGU/login.do?method=iniciarLogin';
const LOGIN_PATH = '/gefor/SGU/login.do';
const LOGOUT_KEYWORD_PATTERN =
  /logout|logoff|sair|encerrar|finalizar.?sess|invalidar.?sess|desconectar/i;
const FORCE_LOGOUT_PATTERN = /forceLogout/i;
const SESSION_COOKIE_NAME = 'JSESSIONID';

interface LogoutCandidate {
  httpMethod: 'GET' | 'POST';
  kind: 'anchor' | 'form' | 'script_hint';
  path: string;
  reason: string;
  score: number;
  strutsMethod?: string;
}

interface ProbeResult {
  bodyBytes?: number;
  bodySha256?: string;
  candidate: LogoutCandidate;
  containsAuthenticatedMarker?: boolean;
  containsLoginForm?: boolean;
  durationMs: number;
  errorCode?: string;
  sessionCookiePresentAfter: boolean;
  status?: number;
}

interface PathInventoryItem {
  httpMethod: 'GET' | 'POST';
  kind: 'anchor' | 'form' | 'onclick' | 'frame';
  path: string;
  strutsMethod?: string;
  textHint?: string;
}

interface DiscoveryEvidence {
  candidates: LogoutCandidate[];
  credentialsSource: string;
  finishedAt: string;
  kind: 'descoberta-logout';
  loginSucceeded: boolean;
  menuSources: Array<{
    bodyBytes?: number;
    bodySha256?: string;
    candidateCount: number;
    excerpts?: string[];
    path: string;
    status?: number;
  }>;
  nodeVersion: string;
  pathInventory: PathInventoryItem[];
  phase: '003A';
  probe?: ProbeResult;
  reLoginAfterProbe?: {
    resultStatus: string;
    sessionCookiePresent: boolean;
  };
  schemaVersion: 1;
  startedAt: string;
  structuralSignals: {
    anchorCount: number;
    formCount: number;
    frameCount: number;
    htmlBytes: number;
    keywordHits: Record<string, boolean>;
    scriptSrcCount: number;
  };
  summary: {
    candidateCount: number;
    confirmed: boolean;
    note: string;
  };
}

async function main(): Promise<void> {
  const baseUrl = process.env.ECNH_BASE_URL;
  if (baseUrl === undefined || baseUrl.trim().length === 0) {
    throw new ConfigurationError(
      'Defina ECNH_BASE_URL no arquivo .env antes de executar a descoberta.'
    );
  }

  const credentialsPool =
    listEnabledLoginCredentials().length > 0
      ? listEnabledLoginCredentials()
      : [resolveLoginCredentials()];

  const startedAt = new Date();
  let credentials = credentialsPool[0];
  let formattedCpf = formatCpfForPortal(credentials.cpf);
  if (formattedCpf === undefined) {
    throw new ConfigurationError('CPF inválido para descoberta de logout.');
  }

  let session = new SessionManager();
  let transport = new AuthTransport(baseUrl, createQuietLogger(), session);
  let finalHtml: string | undefined;
  let loginSucceeded = false;

  const originalRequest = AuthTransport.prototype.request;
  AuthTransport.prototype.request = async function <T>(
    config: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    const response = (await originalRequest.call(this, config)) as AxiosResponse<T>;
    if (
      typeof response.data === 'string' &&
      normalizeMethod(config.method) === 'POST' &&
      (config.url ?? '') === LOGIN_PATH
    ) {
      finalHtml = response.data;
    }
    return response;
  };

  try {
    for (const [index, candidateCredentials] of credentialsPool.entries()) {
      if (index > 0) {
        await wait(2_000);
      }
      const candidateCpf = formatCpfForPortal(candidateCredentials.cpf);
      if (candidateCpf === undefined) {
        continue;
      }
      session.clear();
      session = new SessionManager();
      transport = new AuthTransport(baseUrl, createQuietLogger(), session);
      finalHtml = undefined;
      loginSucceeded = await performLogin(transport, candidateCpf, candidateCredentials.password);
      if (loginSucceeded && finalHtml !== undefined) {
        credentials = candidateCredentials;
        formattedCpf = candidateCpf;
        break;
      }
    }
  } finally {
    AuthTransport.prototype.request = originalRequest;
  }

  if (!loginSucceeded || finalHtml === undefined) {
    const evidence = await saveEvidence(startedAt, {
      candidates: [],
      credentialsSource: credentials.source,
      finishedAt: new Date().toISOString(),
      kind: 'descoberta-logout',
      loginSucceeded: false,
      menuSources: [],
      nodeVersion: process.version,
      pathInventory: [],
      phase: '003A',
      schemaVersion: 1,
      startedAt: startedAt.toISOString(),
      structuralSignals: {
        anchorCount: 0,
        formCount: 0,
        frameCount: 0,
        htmlBytes: 0,
        keywordHits: {},
        scriptSrcCount: 0
      },
      summary: {
        candidateCount: 0,
        confirmed: false,
        note: 'Login não confirmado; varredura de logout não foi executada.'
      }
    });
    console.log(JSON.stringify({ confirmed: false, evidencePath: evidence, loginSucceeded }, null, 2));
    process.exitCode = 1;
    return;
  }

  const pathInventory = buildPathInventory(finalHtml);
  const structuralSignals = buildStructuralSignals(finalHtml);
  const menuSources = pathInventory.filter(
    (item) =>
      item.path.includes('menu_items') ||
      item.path.includes('build_menu') ||
      /menu/i.test(item.path)
  );

  const menuScan = await scanReferencedMenuSources(transport, menuSources);
  const candidates = dedupeCandidates([
    ...findLogoutCandidates(finalHtml),
    ...inferCandidatesFromInventory(pathInventory),
    ...menuScan.candidates
  ]);
  const ranked = candidates.sort((left, right) => right.score - left.score);
  let probe: ProbeResult | undefined;
  let reLoginAfterProbe: DiscoveryEvidence['reLoginAfterProbe'];

  if (ranked.length > 0) {
    const candidate = ranked.find((item) => item.path.length > 0) ?? ranked[0];
    if (candidate.path.length > 0) {
      probe = await probeCandidate(transport, session, baseUrl, candidate);

      const sessionStillPresent = await session.hasCookie(SESSION_COOKIE_NAME, baseUrl);
      if (!sessionStillPresent || probe.containsLoginForm === true) {
        session.clear();
        const reLoginSession = new SessionManager();
        const reLoginTransport = new AuthTransport(baseUrl, createQuietLogger(), reLoginSession);
        const reLoginSucceeded = await performLogin(
          reLoginTransport,
          formattedCpf,
          credentials.password
        );
        reLoginAfterProbe = {
          resultStatus: reLoginSucceeded ? 'sucesso' : 'erro_desconhecido',
          sessionCookiePresent: await reLoginSession.hasCookie(SESSION_COOKIE_NAME, baseUrl)
        };
        reLoginSession.clear();
      }
    }
  }

  session.clear();

  const confirmed =
    probe !== undefined &&
    probe.status === 200 &&
    (probe.containsLoginForm === true ||
      probe.containsAuthenticatedMarker === false ||
      probe.sessionCookiePresentAfter === false);

  const evidencePath = await saveEvidence(startedAt, {
    candidates: ranked,
    credentialsSource: credentials.source,
    finishedAt: new Date().toISOString(),
    kind: 'descoberta-logout',
    loginSucceeded: true,
    menuSources: menuScan.sources,
    nodeVersion: process.version,
    pathInventory,
    phase: '003A',
    probe,
    reLoginAfterProbe,
    schemaVersion: 1,
    startedAt: startedAt.toISOString(),
    structuralSignals,
    summary: {
      candidateCount: ranked.length,
      confirmed,
      note:
        ranked.length === 0
          ? 'Nenhum candidato de logout encontrado no HTML autenticado nem nas fontes de menu referenciadas. Captura HAR manual do clique em Sair permanece necessária.'
          : confirmed
            ? 'Candidato de logout executado com sinais de encerramento de sessão.'
            : 'Candidatos encontrados, mas o probe não confirmou invalidação clara da sessão.'
    }
  });

  console.log(
    JSON.stringify(
      {
        candidateCount: ranked.length,
        confirmed,
        evidencePath,
        inventoryCount: pathInventory.length,
        probeStatus: probe?.status,
        topCandidate: ranked[0]
      },
      null,
      2
    )
  );

  if (!confirmed) {
    process.exitCode = 1;
  }
}

async function performLogin(
  transport: AuthTransport,
  cpf: string,
  password: string
): Promise<boolean> {
  const loginUrl = transport.resolveUrl(LOGIN_PATH);
  const loginOrigin = new URL(loginUrl).origin;

  await transport.request<string>({
    headers: {
      Origin: undefined,
      Referer: transport.resolveUrl('/')
    },
    method: 'GET',
    responseEncoding: 'latin1',
    url: INITIAL_LOGIN_PATH
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
      Referer: transport.resolveUrl(INITIAL_LOGIN_PATH)
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
      ['codigo', cpf],
      ['senha', password]
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
  return hasSessionCookie && htmlContemMarcadorAutenticado(response.data);
}

function findLogoutCandidates(html: string): LogoutCandidate[] {
  const $ = cheerio.load(html);
  const candidates: LogoutCandidate[] = [];

  $('a[href]').each((_index, element) => {
    const href = ($(element).attr('href') ?? '').trim();
    const text = normalizeText($(element).text());
    const title = normalizeText($(element).attr('title') ?? '');
    const searchable = `${href} ${text} ${title}`;
    if (!LOGOUT_KEYWORD_PATTERN.test(searchable) || FORCE_LOGOUT_PATTERN.test(searchable)) {
      return;
    }

    const path = sanitizePath(href);
    if (path === undefined) {
      return;
    }

    candidates.push({
      httpMethod: 'GET',
      kind: 'anchor',
      path,
      reason: text.length > 0 ? `anchor_text:${truncate(text, 40)}` : 'anchor_href_keyword',
      score: scoreCandidate(searchable, 'anchor'),
      strutsMethod: extractStrutsMethod(href)
    });
  });

  $('[onclick]').each((_index, element) => {
    const onclick = ($(element).attr('onclick') ?? '').trim();
    const text = normalizeText($(element).text());
    const searchable = `${onclick} ${text}`;
    if (!LOGOUT_KEYWORD_PATTERN.test(searchable) || FORCE_LOGOUT_PATTERN.test(searchable)) {
      return;
    }

    const hrefMatch = onclick.match(/(?:location(?:\.href)?|window\.open)\s*=\s*['"]([^'"]+)['"]/i);
    const submitMatch = onclick.match(/method\s*=\s*['"]?([A-Za-z0-9_]+)/i);
    const pathFromClick = hrefMatch?.[1] !== undefined ? sanitizePath(hrefMatch[1]) : undefined;

    candidates.push({
      httpMethod: pathFromClick !== undefined ? 'GET' : 'POST',
      kind: 'script_hint',
      path: pathFromClick ?? LOGIN_PATH,
      reason: `onclick:${truncate(onclick.replace(/\s+/g, ' '), 80)}`,
      score: scoreCandidate(searchable, 'script_hint') + 3,
      strutsMethod: submitMatch?.[1]
    });
  });

  $('form').each((_index, element) => {
    const action = ($(element).attr('action') ?? '').trim();
    const formText = normalizeText($(element).text());
    const methodInputs = $(element)
      .find('input[name="method"]')
      .map((_i, input) => ($(input).attr('value') ?? '').trim())
      .get()
      .filter((value) => value.length > 0);
    const searchable = `${action} ${formText} ${methodInputs.join(' ')}`;
    if (!LOGOUT_KEYWORD_PATTERN.test(searchable) || FORCE_LOGOUT_PATTERN.test(searchable)) {
      return;
    }

    const path = sanitizePath(action.length > 0 ? action : LOGIN_PATH);
    if (path === undefined) {
      return;
    }

    const strutsMethod = methodInputs.find((value) => LOGOUT_KEYWORD_PATTERN.test(value));
    candidates.push({
      httpMethod: 'POST',
      kind: 'form',
      path,
      reason: strutsMethod !== undefined ? `form_method:${strutsMethod}` : 'form_keyword',
      score: scoreCandidate(searchable, 'form'),
      strutsMethod
    });
  });

  const scriptHints = html.match(LOGOUT_KEYWORD_PATTERN);
  if (scriptHints !== null && candidates.length === 0) {
    const uniqueHints = [...new Set(scriptHints.map((hint) => hint.toLowerCase()))];
    for (const hint of uniqueHints) {
      if (FORCE_LOGOUT_PATTERN.test(hint)) {
        continue;
      }
      candidates.push({
        httpMethod: 'GET',
        kind: 'script_hint',
        path: '',
        reason: `keyword_in_html:${hint}`,
        score: 1
      });
    }
  }

  return candidates;
}

function buildPathInventory(html: string): PathInventoryItem[] {
  const $ = cheerio.load(html);
  const items: PathInventoryItem[] = [];

  $('a[href]').each((_index, element) => {
    const href = ($(element).attr('href') ?? '').trim();
    const path = sanitizePath(href);
    if (path === undefined) {
      return;
    }
    items.push({
      httpMethod: 'GET',
      kind: 'anchor',
      path,
      strutsMethod: extractStrutsMethod(href),
      textHint: truncate(normalizeText($(element).text() || $(element).attr('title') || ''), 40)
    });
  });

  $('form').each((_index, element) => {
    const action = ($(element).attr('action') ?? '').trim();
    const path = sanitizePath(action.length > 0 ? action : LOGIN_PATH);
    if (path === undefined) {
      return;
    }
    const methodInputs = $(element)
      .find('input[name="method"]')
      .map((_i, input) => ($(input).attr('value') ?? '').trim())
      .get()
      .filter((value) => value.length > 0);
    for (const strutsMethod of methodInputs.length > 0 ? methodInputs : [undefined]) {
      items.push({
        httpMethod: 'POST',
        kind: 'form',
        path,
        strutsMethod,
        textHint: truncate(normalizeText($(element).attr('name') ?? $(element).attr('id') ?? ''), 40)
      });
    }
  });

  $('[onclick]').each((_index, element) => {
    const onclick = ($(element).attr('onclick') ?? '').trim();
    const hrefMatch = onclick.match(/(?:['"])(\/[^'"]+)(?:['"])/);
    if (hrefMatch?.[1] === undefined) {
      return;
    }
    const path = sanitizePath(hrefMatch[1]);
    if (path === undefined) {
      return;
    }
    items.push({
      httpMethod: 'GET',
      kind: 'onclick',
      path,
      strutsMethod: extractStrutsMethod(path),
      textHint: truncate(normalizeText($(element).text()), 40)
    });
  });

  $('frame[src], iframe[src]').each((_index, element) => {
    const src = ($(element).attr('src') ?? '').trim();
    const path = sanitizePath(src);
    if (path === undefined) {
      return;
    }
    items.push({
      httpMethod: 'GET',
      kind: 'frame',
      path,
      strutsMethod: extractStrutsMethod(src),
      textHint: truncate(normalizeText($(element).attr('name') ?? ''), 40)
    });
  });

  $('script[src]').each((_index, element) => {
    const src = ($(element).attr('src') ?? '').trim();
    const path = sanitizePath(src);
    if (path === undefined) {
      return;
    }
    items.push({
      httpMethod: 'GET',
      kind: 'frame',
      path,
      textHint: 'script_src'
    });
  });

  const methodMatches = html.matchAll(
    /[?&]method=([A-Za-z0-9_]+)|name=["']method["'][^>]*value=["']([^"']+)["']/gi
  );
  for (const match of methodMatches) {
    const strutsMethod = match[1] ?? match[2];
    if (strutsMethod === undefined || strutsMethod.length === 0) {
      continue;
    }
    items.push({
      httpMethod: 'POST',
      kind: 'form',
      path: LOGIN_PATH,
      strutsMethod,
      textHint: 'method_token'
    });
  }

  return dedupeInventory(items);
}

function buildStructuralSignals(html: string): DiscoveryEvidence['structuralSignals'] {
  const $ = cheerio.load(html);
  const keywords = ['sair', 'logout', 'logoff', 'encerrar', 'desconectar', 'finalizar', 'forceLogout'];
  const keywordHits: Record<string, boolean> = {};
  const lowerHtml = html.toLowerCase();
  for (const keyword of keywords) {
    keywordHits[keyword] = lowerHtml.includes(keyword.toLowerCase());
  }

  return {
    anchorCount: $('a[href]').length,
    formCount: $('form').length,
    frameCount: $('frame[src], iframe[src]').length,
    htmlBytes: Buffer.byteLength(html, 'latin1'),
    keywordHits,
    scriptSrcCount: $('script[src]').length
  };
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function inferCandidatesFromInventory(inventory: PathInventoryItem[]): LogoutCandidate[] {
  return inventory
    .filter((item) => {
      const searchable = `${item.path} ${item.strutsMethod ?? ''} ${item.textHint ?? ''}`;
      return LOGOUT_KEYWORD_PATTERN.test(searchable) && !FORCE_LOGOUT_PATTERN.test(searchable);
    })
    .map((item) => ({
      httpMethod: item.httpMethod,
      kind: item.kind === 'form' ? 'form' : item.kind === 'anchor' ? 'anchor' : 'script_hint',
      path: item.path,
      reason: `inventory:${item.kind}`,
      score: scoreCandidate(
        `${item.path} ${item.strutsMethod ?? ''} ${item.textHint ?? ''}`,
        item.kind === 'form' ? 'form' : item.kind === 'anchor' ? 'anchor' : 'script_hint'
      ),
      strutsMethod: item.strutsMethod
    }));
}

function dedupeInventory(items: PathInventoryItem[]): PathInventoryItem[] {
  const seen = new Set<string>();
  const unique: PathInventoryItem[] = [];
  for (const item of items) {
    const key = `${item.httpMethod}:${item.path}:${item.strutsMethod ?? ''}:${item.kind}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

async function scanReferencedMenuSources(
  transport: AuthTransport,
  sources: PathInventoryItem[]
): Promise<{
  candidates: LogoutCandidate[];
  sources: DiscoveryEvidence['menuSources'];
}> {
  const candidates: LogoutCandidate[] = [];
  const scanned: DiscoveryEvidence['menuSources'] = [];
  const relevant = sources.filter((item) => /menu_items|build_menu/i.test(item.path));

  for (const source of relevant) {
    try {
      const response = await transport.request<string>({
        headers: {
          Referer: transport.resolveUrl(LOGIN_PATH)
        },
        method: 'GET',
        responseEncoding: 'latin1',
        url: source.path
      });

      const body =
        typeof response.data === 'string' ? Buffer.from(response.data, 'latin1') : undefined;
      const sourceCandidates =
        typeof response.data === 'string'
          ? [
              ...findLogoutCandidates(response.data),
              ...findLogoutCandidatesInText(response.data),
              ...inferCandidatesFromInventory(buildPathInventory(response.data))
            ]
          : [];

      scanned.push({
        bodyBytes: body?.length,
        bodySha256:
          body !== undefined ? createHash('sha256').update(body).digest('hex') : undefined,
        candidateCount: sourceCandidates.length,
        excerpts:
          typeof response.data === 'string'
            ? extractLogoutExcerpts(response.data)
            : undefined,
        path: source.path,
        status: response.status
      });
      candidates.push(...sourceCandidates);
    } catch {
      scanned.push({
        candidateCount: 0,
        path: source.path
      });
    }
  }

  return { candidates, sources: scanned };
}

function extractLogoutExcerpts(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && LOGOUT_KEYWORD_PATTERN.test(line))
    .map((line) =>
      truncate(
        line
          .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, '[CPF]')
          .replace(/[A-Za-z0-9+/]{20,}={0,2}/g, '[TOKEN]'),
        180
      )
    )
    .slice(0, 20);
}

function findLogoutCandidatesInText(content: string): LogoutCandidate[] {
  const candidates: LogoutCandidate[] = [];
  const urlPatterns = [
    /(?:href|url|link|action|location)\s*[:=]\s*["']([^"']+)["']/gi,
    /["'](\/gefor\/[^"']*(?:logout|logoff|sair|encerrar)[^"']*)["']/gi,
    /["']([^"']*\/(?:logout|logoff|sair)(?:\.do)?[^"']*)["']/gi
  ];

  for (const pattern of urlPatterns) {
    for (const match of content.matchAll(pattern)) {
      const raw = match[1];
      if (raw === undefined) {
        continue;
      }
      if (!LOGOUT_KEYWORD_PATTERN.test(raw) && !/\/gefor\//i.test(raw)) {
        continue;
      }
      if (!LOGOUT_KEYWORD_PATTERN.test(raw) || FORCE_LOGOUT_PATTERN.test(raw)) {
        continue;
      }
      const path = sanitizePath(raw);
      if (path === undefined || path === '/Sair' || path.length < 2) {
        continue;
      }
      candidates.push({
        httpMethod: inferHttpMethod(raw),
        kind: 'script_hint',
        path,
        reason: 'menu_or_script_url',
        score: scoreCandidate(raw, 'script_hint') + 6,
        strutsMethod: extractStrutsMethod(raw)
      });
    }
  }

  // Entradas de menu no formato label/url próximos.
  const sairBlocks = content.matchAll(/sair[\s\S]{0,120}/gi);
  for (const blockMatch of sairBlocks) {
    const block = blockMatch[0];
    const urlMatch = block.match(/["'](\/[^"']+)["']/);
    if (urlMatch?.[1] === undefined) {
      continue;
    }
    const path = sanitizePath(urlMatch[1]);
    if (path === undefined || path === '/Sair') {
      continue;
    }
    candidates.push({
      httpMethod: inferHttpMethod(urlMatch[1]),
      kind: 'script_hint',
      path,
      reason: 'sair_block_url',
      score: 12,
      strutsMethod: extractStrutsMethod(urlMatch[1])
    });
  }

  return candidates;
}

function inferHttpMethod(raw: string): 'GET' | 'POST' {
  if (/\.do(?:\?|$)/i.test(raw) && /method=/i.test(raw)) {
    return 'GET';
  }
  if (/logout|logoff|sair/i.test(raw) && /\.do/i.test(raw)) {
    return 'GET';
  }
  return 'GET';
}

async function probeCandidate(
  transport: AuthTransport,
  session: SessionManager,
  baseUrl: string,
  candidate: LogoutCandidate
): Promise<ProbeResult> {
  const startedAt = performance.now();

  try {
    const response =
      candidate.httpMethod === 'GET'
        ? await transport.request<string>({
            headers: {
              Referer: transport.resolveUrl(LOGIN_PATH)
            },
            method: 'GET',
            responseEncoding: 'latin1',
            url: candidate.path
          })
        : await transport.request<string>({
            data: new URLSearchParams(
              candidate.strutsMethod !== undefined
                ? [['method', candidate.strutsMethod]]
                : [['method', 'logout']]
            ).toString(),
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Origin: new URL(baseUrl).origin,
              Referer: transport.resolveUrl(LOGIN_PATH)
            },
            method: 'POST',
            responseEncoding: 'latin1',
            url: candidate.path
          });

    const body =
      typeof response.data === 'string' ? Buffer.from(response.data, 'latin1') : undefined;

    return {
      bodyBytes: body?.length,
      bodySha256: body !== undefined ? createHash('sha256').update(body).digest('hex') : undefined,
      candidate,
      containsAuthenticatedMarker:
        typeof response.data === 'string'
          ? htmlContemMarcadorAutenticado(response.data)
          : undefined,
      containsLoginForm:
        typeof response.data === 'string' ? response.data.includes('LoginActionForm') : undefined,
      durationMs: Math.round(performance.now() - startedAt),
      sessionCookiePresentAfter: await session.hasCookie(SESSION_COOKIE_NAME, baseUrl),
      status: response.status
    };
  } catch (error) {
    return {
      candidate,
      durationMs: Math.round(performance.now() - startedAt),
      errorCode: axios.isAxiosError(error) ? error.code : undefined,
      sessionCookiePresentAfter: await session.hasCookie(SESSION_COOKIE_NAME, baseUrl)
    };
  }
}

function scoreCandidate(searchable: string, kind: LogoutCandidate['kind']): number {
  let score = kind === 'anchor' ? 5 : kind === 'form' ? 4 : 1;
  if (/logout|logoff/i.test(searchable)) {
    score += 5;
  }
  if (/\bsair\b/i.test(searchable)) {
    score += 4;
  }
  if (/encerrar|desconectar|finalizar/i.test(searchable)) {
    score += 2;
  }
  return score;
}

function sanitizePath(raw: string): string | undefined {
  if (raw.length === 0 || raw.startsWith('#') || raw.toLowerCase().startsWith('javascript:')) {
    return undefined;
  }

  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const url = new URL(raw);
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return undefined;
  }

  if (raw.startsWith('/')) {
    return raw.split('#')[0];
  }

  return `/${raw.split('#')[0]}`;
}

function extractStrutsMethod(href: string): string | undefined {
  try {
    const url = href.startsWith('http')
      ? new URL(href)
      : new URL(href, 'https://example.invalid');
    const method = url.searchParams.get('method');
    return method === null || method.length === 0 ? undefined : method;
  } catch {
    return undefined;
  }
}

function dedupeCandidates(candidates: LogoutCandidate[]): LogoutCandidate[] {
  const seen = new Set<string>();
  const unique: LogoutCandidate[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.httpMethod}:${candidate.path}:${candidate.strutsMethod ?? ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(candidate);
  }

  return unique;
}

function normalizeMethod(method: string | undefined): string {
  return (method ?? 'GET').toUpperCase();
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}…`;
}

function createQuietLogger(): StructuredLogger {
  const noop = (): void => undefined;
  return { debug: noop, error: noop, info: noop, warn: noop };
}

async function saveEvidence(startedAt: Date, evidence: DiscoveryEvidence): Promise<string> {
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
  const timestamp = startedAt.toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const path = `${EVIDENCE_DIRECTORY}/003a-descoberta-logout-${timestamp}.json`;
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return path;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`Descoberta de logout falhou: ${message}`);
  process.exitCode = 1;
});
