/**
 * Placeholder visual da aba Agenda (Google Sheets).
 * Não faz parte do domínio nem do HTML do portal.
 */
export const SHEET_PLACEHOLDER = '(não informado)' as const;

/**
 * Converte ausência / “não informado” do portal em placeholder visual da planilha.
 * Demais valores permanecem exatamente como recebidos (já normalizados pelo chamador).
 */
export function formatOptionalFieldForSheet(valor: string | null | undefined): string {
  if (valor === null || valor === undefined) {
    return SHEET_PLACEHOLDER;
  }
  const trimado = valor.trim();
  if (trimado.length === 0 || isNaoInformado(trimado)) {
    return SHEET_PLACEHOLDER;
  }
  return valor;
}

/**
 * Converte placeholder / “não informado” da planilha em ausência no domínio.
 * Valores reais são devolvidos trimados; vazio → `undefined`.
 */
export function parseOptionalFieldFromSheet(
  valor: string | null | undefined
): string | undefined {
  if (valor === null || valor === undefined) {
    return undefined;
  }
  const trimado = valor.trim();
  if (trimado.length === 0) {
    return undefined;
  }
  if (trimado === SHEET_PLACEHOLDER || isNaoInformado(trimado)) {
    return undefined;
  }
  return trimado;
}

function isNaoInformado(valor: string): boolean {
  const normalizado = valor
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
  return normalizado === 'nao informado';
}
