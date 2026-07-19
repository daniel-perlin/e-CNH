import 'dotenv/config';

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

import { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';

import { AuthTransport } from '../client/auth-transport.js';
import { ConfigurationError } from '../client/errors.js';
import { htmlContemMarcadorAutenticado } from '../client/perfil-profissional-portal.js';
import { SessionManager } from '../client/session-manager.js';
import {
  listEnabledLoginCredentials,
  resolveLoginCredentials
} from '../config/login-credentials.js';
import { StructuredLogger } from '../types/logger.js';
import { formatCpfForPortal } from '../utils/cpf.js';

const EVIDENCE_DIRECTORY = 'docs/evidencias';
const INITIAL_LOGIN_PATH = '/gefor/SGU/login.do?method=iniciarLogin';
const LOGIN_PATH = '/gefor/SGU/login.do';
const LOGOUT_PATH = `${LOGIN_PATH}?method=finalizarLogin`;
const DIVISAO_PATH = '/gefor/GFR/divisao/divisaoEquitativa.do';
const SESSION_COOKIE_NAME = 'JSESSIONID';
const AGENDA_SCRIPT_PATHS = [
  '/GFR/js/app/divisao/agendaPsicologo.js',
  '/GFR/js/app/divisao/comum.js?v=1'
];

interface FormFieldInventory {
  id: string;
  name: string;
  optionCount?: number;
  optionDateCount?: number;
  selectedOptionPresent?: boolean;
  tag: string;
  type: string;
  valueKind: 'empty' | 'static' | 'date' | 'identifier' | 'other' | 'absent';
  valueLength?: number;
}

interface FormInventory {
  action: string;
  fieldCount: number;
  fields: FormFieldInventory[];
  id: string;
  method: string;
  name: string;
  onsubmit: string;
  strutsMethods: string[];
}

interface ScriptDiscovery {
  bodyBytes?: number;
  bodySha256?: string;
  functionHints: string[];
  methodHints: string[];
  path: string;
  status?: number;
  urlHints: string[];
  validationHints: string[];
}

interface JsonProbeResult {
  arrayLength?: number;
  bodyBytes?: number;
  bodySha256?: string;
  contentType?: string;
  durationMs: number;
  errorMessage?: string;
  isArray?: boolean;
  isObject?: boolean;
  itemKeysSample?: string[];
  parseOk?: boolean;
  request: {
    action: string;
    fieldNames: string[];
    httpMethod: 'GET' | 'POST';
    strutsMethod: string;
  };
  sessionCookiePresentAfter: boolean;
  status?: number;
}

interface ProbeResult {
  bodyBytes?: number;
  bodySha256?: string;
  durationMs: number;
  errorMessage?: string;
  request: {
    action: string;
    fieldNames: string[];
    httpMethod: 'GET' | 'POST';
    strutsMethod?: string;
    variant: string;
  };
  sessionCookiePresentAfter: boolean;
  status?: number;
  structuralSignals?: StructuralSignals;
}

interface StructuralSignals {
  authenticatedMarkerPresent: boolean;
  dateOptionCount: number;
  formNames: string[];
  htmlBytes: number;
  keywordHits: Record<string, boolean>;
  legends: string[];
  loginFormPresent: boolean;
  methodValues: string[];
  tableCount: number;
  thTexts: string[];
  title: string;
}

interface DiscoveryEvidence {
  credentialsSource: string;
  finishedAt: string;
  forms: FormInventory[];
  jsonProbes: JsonProbeResult[];
  kind: 'descoberta-navegacao-agenda';
  loginSucceeded: boolean;
  nodeVersion: string;
  phase: '003B';
  postLoginSignals?: StructuralSignals;
  probes: ProbeResult[];
  schemaVersion: 2;
  scripts: ScriptDiscovery[];
  startedAt: string;
  summary: {
    confirmedConsultation: boolean;
    confirmedJsonRefresh: boolean;
    note: string;
    postLoginFormFound: boolean;
  };
  uiHints: {
    cancelHrefPresent: boolean;
    dataReferenciaRequiredInJs: boolean;
    pesquisarOnclickPresent: boolean;
    refreshAgendaHintPresent: boolean;
    refreshPsicologoHintPresent: boolean;
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
        break;
      }
    }
  } finally {
    AuthTransport.prototype.request = originalRequest;
  }

  if (!loginSucceeded || finalHtml === undefined) {
    const evidencePath = await saveEvidence(startedAt, {
      credentialsSource: credentials.source,
      finishedAt: new Date().toISOString(),
      forms: [],
      jsonProbes: [],
      kind: 'descoberta-navegacao-agenda',
      loginSucceeded: false,
      nodeVersion: process.version,
      phase: '003B',
      probes: [],
      schemaVersion: 2,
      scripts: [],
      startedAt: startedAt.toISOString(),
      summary: {
        confirmedConsultation: false,
        confirmedJsonRefresh: false,
        note: 'Login não confirmado; descoberta de navegação não foi executada.',
        postLoginFormFound: false
      },
      uiHints: {
        cancelHrefPresent: false,
        dataReferenciaRequiredInJs: false,
        pesquisarOnclickPresent: false,
        refreshAgendaHintPresent: false,
        refreshPsicologoHintPresent: false
      }
    });
    console.log(JSON.stringify({ evidencePath, loginSucceeded: false }, null, 2));
    process.exitCode = 1;
    return;
  }

  const postLoginSignals = buildStructuralSignals(finalHtml);
  const forms = inventoryForms(finalHtml);
  const scripts = await discoverScripts(transport, finalHtml);
  const dataReferenciaRequiredInJs = scripts.some((script) =>
    script.validationHints.includes('dataReferencia')
  );
  const uiHints = {
    cancelHrefPresent: /onclick\s*=\s*["']cancelar\(\)/i.test(finalHtml),
    dataReferenciaRequiredInJs,
    pesquisarOnclickPresent: /onclick\s*=\s*["']pesquisar\(\)/i.test(finalHtml),
    refreshAgendaHintPresent: /refreshAgendaMedica\s*\(/i.test(finalHtml),
    refreshPsicologoHintPresent: /refreshPsicologo\s*\(/i.test(finalHtml)
  };

  const agendaForm = forms.find(
    (form) =>
      form.name === 'DivisaoEquitativaForm' ||
      form.strutsMethods.includes('consultarAgendaPsicologo') ||
      /divisaoEquitativa\.do/i.test(form.action)
  );

  const probes: ProbeResult[] = [];
  const jsonProbes: JsonProbeResult[] = [];

  if (agendaForm !== undefined) {
    const availableDates = extractAvailableDates(finalHtml);
    const referenceCandidates = buildReferenceDateCandidates(availableDates);

    probes.push(
      await probeAgendaConsultation(transport, session, baseUrl, finalHtml, agendaForm, {
        dateOptionOffset: 0,
        dataReferencia: '',
        variant: 'sem-dataReferencia'
      })
    );

    for (const [index, referenceDate] of referenceCandidates.entries()) {
      probes.push(
        await probeAgendaConsultation(transport, session, baseUrl, finalHtml, agendaForm, {
          dateOptionOffset: 0,
          dataReferencia: referenceDate,
          variant: `com-dataReferencia-${index + 1}`
        })
      );
    }

    if (availableDates.length > 1) {
      probes.push(
        await probeAgendaConsultation(transport, session, baseUrl, finalHtml, agendaForm, {
          dateOptionOffset: 1,
          dataReferencia: referenceCandidates[0] ?? '',
          variant: 'segunda-data-agendamento'
        })
      );
    }

    jsonProbes.push(
      ...(await probeJsonRefreshEndpoints(transport, session, baseUrl, finalHtml, referenceCandidates[0]))
    );
  }

  try {
    await transport.request<string>({
      headers: { Referer: transport.resolveUrl(LOGIN_PATH) },
      method: 'GET',
      responseEncoding: 'latin1',
      url: LOGOUT_PATH
    });
  } catch {
    // A limpeza local abaixo permanece obrigatória.
  }
  session.clear();

  const confirmedConsultation = probes.some(
    (probe) =>
      probe.status === 200 &&
      probe.structuralSignals !== undefined &&
      probe.structuralSignals.authenticatedMarkerPresent &&
      !probe.structuralSignals.loginFormPresent
  );
  const confirmedJsonRefresh = jsonProbes.some(
    (probe) => probe.status === 200 && probe.parseOk === true
  );

  const evidencePath = await saveEvidence(startedAt, {
    credentialsSource: credentials.source,
    finishedAt: new Date().toISOString(),
    forms,
    jsonProbes,
    kind: 'descoberta-navegacao-agenda',
    loginSucceeded: true,
    nodeVersion: process.version,
    phase: '003B',
    postLoginSignals,
    probes,
    schemaVersion: 2,
    scripts,
    startedAt: startedAt.toISOString(),
    summary: {
      confirmedConsultation,
      confirmedJsonRefresh,
      note:
        agendaForm === undefined
          ? 'Login ok, mas o formulário de agenda não foi encontrado no HTML pós-login.'
          : confirmedConsultation
            ? 'Fluxo de consulta da agenda exercitado com sinais estruturais autenticados.'
            : 'Formulário de agenda encontrado; o probe de consulta não confirmou resposta autenticada.',
      postLoginFormFound: agendaForm !== undefined
    },
    uiHints
  });

  console.log(
    JSON.stringify(
      {
        confirmedConsultation,
        confirmedJsonRefresh,
        evidencePath,
        formCount: forms.length,
        jsonProbeCount: jsonProbes.length,
        postLoginFormFound: agendaForm !== undefined,
        probeCount: probes.length,
        scriptCount: scripts.length,
        topForm: agendaForm
          ? {
              action: agendaForm.action,
              name: agendaForm.name,
              strutsMethods: agendaForm.strutsMethods
            }
          : undefined
      },
      null,
      2
    )
  );

  if (!confirmedConsultation) {
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

function inventoryForms(html: string): FormInventory[] {
  const $ = cheerio.load(html);
  const forms: FormInventory[] = [];

  $('form').each((_index, element) => {
    const form = $(element);
    const fields: FormFieldInventory[] = [];
    const strutsMethods: string[] = [];

    form.find('input, select, textarea, button').each((_fieldIndex, fieldElement) => {
      const field = $(fieldElement);
      const tag = fieldElement.tagName.toLowerCase();
      const name = (field.attr('name') ?? '').trim();
      const id = (field.attr('id') ?? '').trim();
      const type = (field.attr('type') ?? tag).trim().toLowerCase();
      const rawValue = field.attr('value') ?? (tag === 'textarea' ? field.text() : '');

      if (name === 'method' && rawValue.trim().length > 0) {
        strutsMethods.push(rawValue.trim());
      }

      if (tag === 'select') {
        const options = field.find('option');
        let optionDateCount = 0;
        options.each((_optionIndex, optionElement) => {
          const optionValue = ($(optionElement).attr('value') ?? '').trim();
          const optionText = normalizeText($(optionElement).text());
          if (isDateToken(optionValue) || isDateToken(optionText)) {
            optionDateCount += 1;
          }
        });
        fields.push({
          id,
          name,
          optionCount: options.length,
          optionDateCount,
          selectedOptionPresent: field.find('option[selected]').length > 0,
          tag,
          type: 'select',
          valueKind: optionDateCount > 0 ? 'date' : 'other'
        });
        return;
      }

      fields.push({
        id,
        name,
        tag,
        type,
        valueKind: classifyValue(name, rawValue),
        valueLength: rawValue.length
      });
    });

    forms.push({
      action: (form.attr('action') ?? '').trim(),
      fieldCount: fields.length,
      fields,
      id: (form.attr('id') ?? '').trim(),
      method: ((form.attr('method') ?? 'get').trim() || 'get').toUpperCase(),
      name: (form.attr('name') ?? '').trim(),
      onsubmit: (form.attr('onsubmit') ?? '').trim(),
      strutsMethods: [...new Set(strutsMethods)]
    });
  });

  return forms;
}

async function discoverScripts(
  transport: AuthTransport,
  postLoginHtml: string
): Promise<ScriptDiscovery[]> {
  const $ = cheerio.load(postLoginHtml);
  const referenced = $('script[src]')
    .map((_index, element) => ($(element).attr('src') ?? '').trim())
    .get()
    .filter((src) => /divisao|agenda/i.test(src));

  const paths = [...new Set([...referenced.map(normalizeScriptPath), ...AGENDA_SCRIPT_PATHS])];
  const discoveries: ScriptDiscovery[] = [];

  for (const path of paths) {
    try {
      const response = await transport.request<string>({
        headers: { Referer: transport.resolveUrl(LOGIN_PATH) },
        method: 'GET',
        responseEncoding: 'utf8',
        url: path
      });
      const body = typeof response.data === 'string' ? response.data : '';
      const bodyBuffer = Buffer.from(body, 'utf8');
      discoveries.push({
        bodyBytes: bodyBuffer.length,
        bodySha256: createHash('sha256').update(bodyBuffer).digest('hex'),
        functionHints: extractFunctionHints(body),
        methodHints: extractMethodHints(body),
        path,
        status: response.status,
        urlHints: extractUrlHints(body),
        validationHints: extractValidationHints(body)
      });
    } catch {
      discoveries.push({
        functionHints: [],
        methodHints: [],
        path,
        urlHints: [],
        validationHints: []
      });
    }
  }

  return discoveries;
}

async function probeAgendaConsultation(
  transport: AuthTransport,
  session: SessionManager,
  baseUrl: string,
  html: string,
  form: FormInventory,
  options: { dataReferencia: string; dateOptionOffset: number; variant: string }
): Promise<ProbeResult> {
  const startedAt = performance.now();
  const payload = buildConsultationPayload(html, form, options);
  const action = form.action.length > 0 ? form.action : DIVISAO_PATH;
  const origin = new URL(baseUrl).origin;

  try {
    const response = await transport.request<string>({
      data: payload.body.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: origin,
        Referer: transport.resolveUrl(LOGIN_PATH)
      },
      method: 'POST',
      responseEncoding: 'latin1',
      url: action
    });

    const body =
      typeof response.data === 'string' ? Buffer.from(response.data, 'latin1') : undefined;

    return {
      bodyBytes: body?.length,
      bodySha256: body !== undefined ? createHash('sha256').update(body).digest('hex') : undefined,
      durationMs: Math.round(performance.now() - startedAt),
      request: {
        action,
        fieldNames: payload.fieldNames,
        httpMethod: 'POST',
        strutsMethod: payload.strutsMethod,
        variant: options.variant
      },
      sessionCookiePresentAfter: await session.hasCookie(SESSION_COOKIE_NAME, baseUrl),
      status: response.status,
      structuralSignals:
        typeof response.data === 'string' ? buildStructuralSignals(response.data) : undefined
    };
  } catch (error) {
    return {
      durationMs: Math.round(performance.now() - startedAt),
      errorMessage: error instanceof Error ? error.message : 'erro desconhecido',
      request: {
        action,
        fieldNames: payload.fieldNames,
        httpMethod: 'POST',
        strutsMethod: payload.strutsMethod,
        variant: options.variant
      },
      sessionCookiePresentAfter: await session.hasCookie(SESSION_COOKIE_NAME, baseUrl)
    };
  }
}

async function probeJsonRefreshEndpoints(
  transport: AuthTransport,
  session: SessionManager,
  baseUrl: string,
  html: string,
  dataReferencia: string | undefined
): Promise<JsonProbeResult[]> {
  const $ = cheerio.load(html);
  const form = $('form[name="DivisaoEquitativaForm"]').first();
  const idUnidade =
    form.find('select[name="idUnidadeTransitoConsulta"] option[selected]').attr('value') ??
    form
      .find('select[name="idUnidadeTransitoConsulta"] option')
      .filter((_index, element) => (($(element).attr('value') ?? '').trim().length > 0))
      .first()
      .attr('value') ??
    '';
  const idUsuario = form.find('input[name="idUsuarioMedicoConsulta"]').attr('value') ?? '';
  const origin = new URL(baseUrl).origin;
  const results: JsonProbeResult[] = [];

  results.push(
    await probeJson(transport, session, baseUrl, {
      action: DIVISAO_PATH,
      data: {
        idTipoProfessional: '4',
        idUnidadeTransitoConsulta: idUnidade,
        method: 'refreshMedicosByUnidadeTransito'
      },
      origin,
      strutsMethod: 'refreshMedicosByUnidadeTransito'
    })
  );

  results.push(
    await probeJson(transport, session, baseUrl, {
      action: DIVISAO_PATH,
      data: {
        dataReferencia: dataReferencia ?? '',
        idUsuarioMedicoConsulta: idUsuario,
        method: 'refreshAgendaMedicaByMedico'
      },
      origin,
      strutsMethod: 'refreshAgendaMedicaByMedico'
    })
  );

  return results;
}

async function probeJson(
  transport: AuthTransport,
  session: SessionManager,
  baseUrl: string,
  options: {
    action: string;
    data: Record<string, string>;
    origin: string;
    strutsMethod: string;
  }
): Promise<JsonProbeResult> {
  const startedAt = performance.now();
  const fieldNames = Object.keys(options.data);

  try {
    const response = await transport.request<string>({
      data: new URLSearchParams(Object.entries(options.data)).toString(),
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: options.origin,
        Referer: transport.resolveUrl(LOGIN_PATH),
        'X-Requested-With': 'XMLHttpRequest'
      },
      method: 'POST',
      responseEncoding: 'utf8',
      url: options.action
    });

    const raw = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    const body = Buffer.from(raw, 'utf8');
    let parseOk = false;
    let isArray = false;
    let isObject = false;
    let arrayLength: number | undefined;
    let itemKeysSample: string[] | undefined;

    try {
      const parsed: unknown = JSON.parse(raw);
      parseOk = true;
      isArray = Array.isArray(parsed);
      isObject = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
      if (Array.isArray(parsed)) {
        arrayLength = parsed.length;
        const first = parsed[0];
        if (first !== null && typeof first === 'object') {
          itemKeysSample = Object.keys(first as Record<string, unknown>).slice(0, 8);
        }
      }
    } catch {
      parseOk = false;
    }

    return {
      arrayLength,
      bodyBytes: body.length,
      bodySha256: createHash('sha256').update(body).digest('hex'),
      contentType: String(response.headers['content-type'] ?? ''),
      durationMs: Math.round(performance.now() - startedAt),
      isArray,
      isObject,
      itemKeysSample,
      parseOk,
      request: {
        action: options.action,
        fieldNames,
        httpMethod: 'POST',
        strutsMethod: options.strutsMethod
      },
      sessionCookiePresentAfter: await session.hasCookie(SESSION_COOKIE_NAME, baseUrl),
      status: response.status
    };
  } catch (error) {
    return {
      durationMs: Math.round(performance.now() - startedAt),
      errorMessage: error instanceof Error ? error.message : 'erro desconhecido',
      request: {
        action: options.action,
        fieldNames,
        httpMethod: 'POST',
        strutsMethod: options.strutsMethod
      },
      sessionCookiePresentAfter: await session.hasCookie(SESSION_COOKIE_NAME, baseUrl)
    };
  }
}

function buildConsultationPayload(
  html: string,
  form: FormInventory,
  payloadOptions: { dataReferencia: string; dateOptionOffset: number }
): { body: URLSearchParams; fieldNames: string[]; strutsMethod?: string } {
  const $ = cheerio.load(html);
  const formSelector =
    form.name.length > 0
      ? `form[name="${form.name}"]`
      : form.id.length > 0
        ? `form#${form.id}`
        : 'form';
  const selectedForm = $(formSelector).first();
  const pairs: Array<[string, string]> = [];
  const fieldNames: string[] = [];
  let strutsMethod: string | undefined;

  selectedForm.find('input, select, textarea').each((_index, element) => {
    const field = $(element);
    const name = (field.attr('name') ?? '').trim();
    if (name.length === 0) {
      return;
    }

    let value = '';
    if (element.tagName.toLowerCase() === 'select') {
      const selectOptions = field
        .find('option')
        .toArray()
        .map((option) => ({
          selected: $(option).is('[selected]'),
          text: normalizeText($(option).text()),
          value: ($(option).attr('value') ?? '').trim()
        }));

      if (name === 'data') {
        const dateOptions = selectOptions.filter(
          (option) => isDateToken(option.value) || isDateToken(option.text)
        );
        const chosen = dateOptions[payloadOptions.dateOptionOffset] ?? dateOptions[0];
        value = chosen !== undefined ? (chosen.value.length > 0 ? chosen.value : chosen.text) : '';
      } else {
        const selected = selectOptions.find((option) => option.selected && option.value.length > 0);
        const fallback = selectOptions.find((option) => option.value.length > 0);
        value = (selected ?? fallback)?.value ?? '';
      }
    } else if (name === 'dataReferencia') {
      value = payloadOptions.dataReferencia;
    } else {
      value = field.attr('value') ?? field.text();
    }

    if (name === 'method') {
      strutsMethod = value.trim();
    }

    pairs.push([name, value]);
    fieldNames.push(name);
  });

  if (!fieldNames.includes('method')) {
    pairs.unshift(['method', 'consultarAgendaPsicologo']);
    fieldNames.unshift('method');
    strutsMethod = 'consultarAgendaPsicologo';
  }

  return {
    body: new URLSearchParams(pairs),
    fieldNames: [...new Set(fieldNames)],
    strutsMethod
  };
}

function extractAvailableDates(html: string): string[] {
  const $ = cheerio.load(html);
  const dates: string[] = [];
  $('select[name="data"] option, #agendamentos option').each((_index, element) => {
    const value = ($(element).attr('value') ?? '').trim();
    if (isDateToken(value)) {
      dates.push(value);
    }
  });
  return [...new Set(dates)];
}

function buildReferenceDateCandidates(availableDates: string[]): string[] {
  const candidates = new Set<string>();
  const today = formatDate(new Date());
  candidates.add(today);
  candidates.add(toCompactDate(today));

  const first = availableDates[0];
  if (first !== undefined) {
    candidates.add(first);
    candidates.add(toCompactDate(first));
    const minusSeven = shiftDate(first, -7);
    if (minusSeven !== undefined) {
      candidates.add(minusSeven);
      candidates.add(toCompactDate(minusSeven));
    }
  }

  return [...candidates];
}

function buildStructuralSignals(html: string): StructuralSignals {
  const $ = cheerio.load(html);
  const formNames = $('form')
    .map((_index, element) => ($(element).attr('name') ?? $(element).attr('id') ?? '').trim())
    .get()
    .filter((name) => name.length > 0);

  let dateOptionCount = 0;
  $('select[name="data"] option, #agendamentos option').each((_index, element) => {
    const value = ($(element).attr('value') ?? '').trim();
    const text = normalizeText($(element).text());
    if (isDateToken(value) || isDateToken(text)) {
      dateOptionCount += 1;
    }
  });

  const thTexts = $('th')
    .map((_index, element) => normalizeText($(element).text()))
    .get()
    .filter((text) => text.length > 0 && text.length < 80)
    .filter((text, index, array) => array.indexOf(text) === index)
    .slice(0, 20);

  const legends = $('legend')
    .map((_index, element) => normalizeText($(element).text()))
    .get()
    .filter((text) => text.length > 0 && text.length < 80)
    .slice(0, 10);

  const methodValues = $('input[name="method"]')
    .map((_index, element) => ($(element).attr('value') ?? '').trim())
    .get()
    .filter((value) => value.length > 0);

  return {
    authenticatedMarkerPresent: htmlContemMarcadorAutenticado(html),
    dateOptionCount,
    formNames: [...new Set(formNames)],
    htmlBytes: Buffer.byteLength(html, 'latin1'),
    keywordHits: {
      categoria: /categoria/i.test(html),
      cpfLabel: /\bCPF\b/.test(html),
      horario: /hor[aá]rio/i.test(html),
      paciente: /paciente/i.test(html),
      renach: /renach/i.test(html),
      resultado: /resultado|nenhum agendamento|n[aã]o h[aá]/i.test(html)
    },
    legends,
    loginFormPresent: html.includes('LoginActionForm'),
    methodValues: [...new Set(methodValues)],
    tableCount: $('table').length,
    thTexts,
    title: normalizeText($('title').text())
  };
}

function extractFunctionHints(script: string): string[] {
  const hints = new Set<string>();
  for (const match of script.matchAll(
    /function\s+(pesquisar|cancelar|refreshAgendaMedica|refreshPsicologo|refreshMedicos|print|fieldsValidate)\s*\(/gi
  )) {
    hints.add(match[1]);
  }
  return [...hints].sort();
}

function extractMethodHints(script: string): string[] {
  const hints = new Set<string>();
  for (const match of script.matchAll(/method\s*[:=]\s*['"]([A-Za-z0-9_]+)['"]/gi)) {
    hints.add(match[1]);
  }
  for (const match of script.matchAll(/method=([A-Za-z0-9_]+)/gi)) {
    hints.add(match[1]);
  }
  return [...hints].sort();
}

function extractUrlHints(script: string): string[] {
  const hints = new Set<string>();
  for (const match of script.matchAll(/['"](\/[^'"]*(?:divisao|agenda|GFR)[^'"]*)['"]/gi)) {
    const path = sanitizePath(match[1]);
    if (path !== undefined) {
      hints.add(path);
    }
  }
  if (/divisaoEquitativa\.do/i.test(script)) {
    hints.add(DIVISAO_PATH);
  }
  return [...hints].sort();
}

function extractValidationHints(script: string): string[] {
  const hints = new Set<string>();
  for (const field of [
    'idUnidadeTransitoConsulta',
    'idUsuarioMedicoConsulta',
    'dataReferencia',
    'data'
  ]) {
    if (new RegExp(`!\\s*myForm\\.${field}\\.value|myForm\\.${field}\\s*&&\\s*!myForm\\.${field}\\.value`).test(script)) {
      hints.add(field);
    }
  }
  return [...hints].sort();
}

function classifyValue(name: string, value: string): FormFieldInventory['valueKind'] {
  if (value.length === 0) {
    return 'empty';
  }
  if (isDateToken(value) || isCompactDateToken(value)) {
    return 'date';
  }
  if (/idUsuario|idUnidade|codigo|cpf|senha|medico|paciente/i.test(name)) {
    return 'identifier';
  }
  if (/^(true|false|-1|consultarAgendaPsicologo)$/i.test(value)) {
    return 'static';
  }
  return 'other';
}

function isDateToken(value: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value.trim());
}

function isCompactDateToken(value: string): boolean {
  return /^\d{8}$/.test(value.trim());
}

function toCompactDate(value: string): string {
  if (isCompactDateToken(value)) {
    return value;
  }
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match === null) {
    return value.replaceAll('/', '');
  }
  return `${match[1]}${match[2]}${match[3]}`;
}

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function shiftDate(value: string, days: number): string | undefined {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match === null) {
    return undefined;
  }
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function normalizeScriptPath(src: string): string {
  if (src.startsWith('http://') || src.startsWith('https://')) {
    try {
      const url = new URL(src);
      return `${url.pathname}${url.search}`;
    } catch {
      return src;
    }
  }
  return src.startsWith('/') ? src : `/${src}`;
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

function normalizeMethod(method: string | undefined): string {
  return (method ?? 'GET').toUpperCase();
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function createQuietLogger(): StructuredLogger {
  const noop = (): void => undefined;
  return { debug: noop, error: noop, info: noop, warn: noop };
}

async function saveEvidence(startedAt: Date, evidence: DiscoveryEvidence): Promise<string> {
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
  const timestamp = startedAt.toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const path = `${EVIDENCE_DIRECTORY}/003b-descoberta-navegacao-${timestamp}.json`;
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return path;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`Descoberta de navegação autenticada falhou: ${message}`);
  process.exitCode = 1;
});
