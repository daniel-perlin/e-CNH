import * as cheerio from 'cheerio';

import { AuthTransport } from './auth-transport.js';
import { ConfigurationError } from './errors.js';

const DIVISAO_PATH = '/gefor/GFR/divisao/divisaoEquitativa.do';
const LOGIN_PATH = '/gefor/SGU/login.do';
const CONSULT_METHOD = 'consultarAgendaPsicologo';

export interface ConsultarAgendaPsicologoParams {
  /** Data de agendamento no formato `DD/MM/YYYY`, conforme o select `#agendamentos`. */
  data: string;
  /**
   * Data de referência exigida pela validação JS do portal.
   * Aceita `DD/MM/YYYY` ou `DDMMYYYY` (maxlength=8 no campo).
   */
  dataReferencia: string;
}

/**
 * Protocolo HTTP confirmado para consulta da agenda diária do psicólogo.
 *
 * Evidência: POST `method=consultarAgendaPsicologo` em
 * `/gefor/GFR/divisao/divisaoEquitativa.do`, a partir do formulário
 * `DivisaoEquitativaForm` devolvido no HTML autenticado.
 */
export class ECNHAgendaProtocol {
  public async consultarAgendaPsicologo(
    transport: AuthTransport,
    postLoginHtml: string,
    params: ConsultarAgendaPsicologoParams
  ): Promise<string> {
    const data = params.data.trim();
    const dataReferencia = params.dataReferencia.trim();

    if (!isSlashDate(data)) {
      throw new ConfigurationError(
        'consultarAgendaPsicologo requer data de agendamento no formato DD/MM/YYYY.'
      );
    }

    if (!isSlashDate(dataReferencia) && !isCompactDate(dataReferencia)) {
      throw new ConfigurationError(
        'consultarAgendaPsicologo requer dataReferencia no formato DD/MM/YYYY ou DDMMYYYY.'
      );
    }

    const payload = buildConsultationPayload(postLoginHtml, data, dataReferencia);
    const origin = new URL(transport.resolveUrl(LOGIN_PATH)).origin;

    const response = await transport.request<string>({
      data: payload.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: origin,
        Referer: transport.resolveUrl(LOGIN_PATH)
      },
      method: 'POST',
      responseEncoding: 'latin1',
      url: DIVISAO_PATH
    });

    return response.data;
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
    ['method', CONSULT_METHOD],
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
