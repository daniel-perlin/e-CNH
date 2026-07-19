/** Fuso usado na coluna operacional "Data de inclusão". */
export const TIMEZONE_SINCRONIZACAO = 'America/Sao_Paulo';

/**
 * Formata o instante da primeira inclusão do paciente na planilha.
 * Formato: `DD/MM/YYYY HH:mm` no fuso `America/Sao_Paulo`.
 */
export function formatSyncTimestamp(instant: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE_SINCRONIZACAO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(instant);

  const valor = (tipo: Intl.DateTimeFormatPartTypes): string =>
    parts.find((parte) => parte.type === tipo)?.value ?? '';

  const hora = valor('hour') === '24' ? '00' : valor('hour');

  return `${valor('day')}/${valor('month')}/${valor('year')} ${hora}:${valor('minute')}`;
}
