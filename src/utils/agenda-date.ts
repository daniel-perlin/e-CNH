import { TIMEZONE_SINCRONIZACAO } from './sync-timestamp.js';

/** Componentes de uma data de calendário (sem horário). */
export interface DataCalendario {
  day: number;
  month: number;
  year: number;
}

/**
 * Interpreta `DD/MM/YYYY` como data de calendário.
 * Retorna `undefined` quando o formato ou a data civil é inválida.
 *
 * Utilitário técnico — não decide se a data permanece na Agenda operacional.
 * Decisões de negócio: `AgendaOperacionalPolicy`.
 */
export function parseDataAgendamento(valor: string): DataCalendario | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor.trim());
  if (match === null) {
    return undefined;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return undefined;
  }

  const candidato = new Date(Date.UTC(year, month - 1, day));
  if (
    candidato.getUTCFullYear() !== year ||
    candidato.getUTCMonth() !== month - 1 ||
    candidato.getUTCDate() !== day
  ) {
    return undefined;
  }

  return { day, month, year };
}

/** Obtém a data de calendário “hoje” no fuso `America/Sao_Paulo`. */
export function obterDataCalendarioSaoPaulo(instant: Date = new Date()): DataCalendario {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE_SINCRONIZACAO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).formatToParts(instant);

  const valor = (tipo: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((parte) => parte.type === tipo)?.value ?? Number.NaN);

  return {
    day: valor('day'),
    month: valor('month'),
    year: valor('year')
  };
}
