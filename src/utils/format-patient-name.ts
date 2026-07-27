/**
 * Reduz o nome ao primeiro token em Title Case (pt-BR).
 * Utilitário legado de formatação; a projeção Sheets e o merge usam o nome completo.
 */
export function formatPatientName(nomeCompleto: string): string {
  const primeiro = nomeCompleto.trim().split(/\s+/).find((token) => token.length > 0);
  if (primeiro === undefined) {
    return '';
  }
  return paraTitleCaseToken(primeiro);
}

function paraTitleCaseToken(token: string): string {
  const minusculo = token.toLocaleLowerCase('pt-BR');
  if (minusculo.length === 0) {
    return '';
  }
  return (
    minusculo.charAt(0).toLocaleUpperCase('pt-BR') + minusculo.slice(1)
  );
}
