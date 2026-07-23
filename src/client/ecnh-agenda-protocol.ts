import * as cheerio from 'cheerio';

import { AuthTransport } from './auth-transport.js';
import { ConfigurationError } from './errors.js';
import {
  type PerfilProfissionalPortal,
  perfilPsicologo
} from './perfil-profissional-portal.js';

const DIVISAO_PATH = '/gefor/GFR/divisao/divisaoEquitativa.do';
const LOGIN_PATH = '/gefor/SGU/login.do';

/** Parâmetros da consulta de agenda diária (independente do perfil). */
export interface ConsultarAgendaParams {
  /** Data de agendamento no formato `DD/MM/YYYY`, conforme o select `#agendamentos`. */
  data: string;
  /**
   * Data de referência exigida pela validação JS do portal.
   * Aceita `DD/MM/YYYY` ou `DDMMYYYY` (maxlength=8 no campo).
   */
  dataReferencia: string;
}

/** @deprecated Use `ConsultarAgendaParams`. Mantido para compatibilidade. */
export type ConsultarAgendaPsicologoParams = ConsultarAgendaParams;

/**
 * Protocolo HTTP da consulta de agenda diária.
 * O `method` Struts vem do `PerfilProfissionalPortal` resolvido no login.
 */
export class ECNHAgendaProtocol {
  public async consultarAgenda(
    transport: AuthTransport,
    postLoginHtml: string,
    perfil: PerfilProfissionalPortal,
    params: ConsultarAgendaParams
  ): Promise<string> {
    const data = params.data.trim();
    const dataReferencia = params.dataReferencia.trim();

    if (!isSlashDate(data)) {
      throw new ConfigurationError(
        'consultarAgenda requer data de agendamento no formato DD/MM/YYYY.'
      );
    }

    if (!isSlashDate(dataReferencia) && !isCompactDate(dataReferencia)) {
      throw new ConfigurationError(
        'consultarAgenda requer dataReferencia no formato DD/MM/YYYY ou DDMMYYYY.'
      );
    }

    const payload = buildConsultationPayload(
      postLoginHtml,
      perfil.methodConsultarAgenda,
      data,
      dataReferencia
    );
    const origin = new URL(transport.resolveUrl(LOGIN_PATH)).origin;

    const response = await transport.request<string>({
      data: payload.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: origin,
        Referer: transport.resolveUrl(LOGIN_PATH)
      },
      loginStep: 'POST_consultarAgenda',
      method: 'POST',
      responseEncoding: 'latin1',
      url: DIVISAO_PATH
    });

    return response.data;
  }

  /**
   * @deprecated Use `consultarAgenda` com perfil resolvido.
   */
  public async consultarAgendaPsicologo(
    transport: AuthTransport,
    postLoginHtml: string,
    params: ConsultarAgendaParams
  ): Promise<string> {
    return this.consultarAgenda(transport, postLoginHtml, perfilPsicologo, params);
  }

  /**
   * Lê as datas disponíveis no select `#agendamentos` do HTML pós-login.
   * Não interpreta pacientes nem horários.
   */
  public listarDatasAgendamento(postLoginHtml: string): string[] {
    const $ = cheerio.load(postLoginHtml);
    const dates: string[] = [];

    $('select[name="data"] option, #agendamentos option').each((_index, element) => {
      const value = ($(element).attr('value') ?? '').trim();
      if (isSlashDate(value)) {
        dates.push(value);
      }
    });

    return [...new Set(dates)];
  }
}

function buildConsultationPayload(
  postLoginHtml: string,
  consultMethod: string,
  data: string,
  dataReferencia: string
): URLSearchParams {
  const $ = cheerio.load(postLoginHtml);
  const form = $('form[name="DivisaoEquitativaForm"]').first();

  if (form.length === 0) {
    throw new ConfigurationError(
      'HTML autenticado sem DivisaoEquitativaForm; não é possível montar a consulta de agenda.'
    );
  }

  const idUnidade =
    form.find('select[name="idUnidadeTransitoConsulta"] option[selected]').attr('value') ??
    form
      .find('select[name="idUnidadeTransitoConsulta"] option')
      .filter((_index, element) => (($(element).attr('value') ?? '').trim().length > 0))
      .first()
      .attr('value') ??
    '';

  const idUsuario = (form.find('input[name="idUsuarioMedicoConsulta"]').attr('value') ?? '').trim();

  if (idUnidade.length === 0) {
    throw new ConfigurationError(
      'Campo idUnidadeTransitoConsulta ausente no HTML autenticado.'
    );
  }

  if (idUsuario.length === 0) {
    throw new ConfigurationError(
      'Campo idUsuarioMedicoConsulta ausente no HTML autenticado.'
    );
  }

  return new URLSearchParams([
    ['method', consultMethod],
    ['idUnidadeTransitoConsulta', idUnidade],
    ['idUsuarioMedicoConsulta', idUsuario],
    ['dataReferencia', dataReferencia],
    ['data', data]
  ]);
}

function isSlashDate(value: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value);
}

function isCompactDate(value: string): boolean {
  return /^\d{8}$/.test(value);
}
