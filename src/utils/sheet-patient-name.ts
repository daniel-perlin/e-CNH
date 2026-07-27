/**
 * Projeção operacional do nome na coluna PACIENTE (Google Sheets).
 * Não altera o domínio; Title Case só na borda visual (ADR-026).
 */

const PARTICULAS_MINUSCULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/**
 * Formata o nome completo do domínio para exibição na planilha.
 * Title Case (pt-BR); partículas `da`/`de`/`do`/`das`/`dos`/`e` permanecem em minúsculas.
 */
export function formatPatientNameForSheet(nome: string | null | undefined): string {
  if (nome === null || nome === undefined) {
    return '';
  }
  const tokens = nome.trim().split(/\s+/).filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return '';
  }
  return tokens.map((token) => formatarToken(token)).join(' ');
}

function formatarToken(token: string): string {
  const minusculo = token.toLocaleLowerCase('pt-BR');
  if (PARTICULAS_MINUSCULAS.has(minusculo)) {
    return minusculo;
  }
  return (
    minusculo.charAt(0).toLocaleUpperCase('pt-BR') + minusculo.slice(1)
  );
}
