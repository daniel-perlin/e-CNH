/**
 * Formata o nome do paciente para a coluna PACIENTE da aba Agenda.
 * Apenas o primeiro token, em Title Case (pt-BR).
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
