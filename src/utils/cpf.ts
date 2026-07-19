/**
 * Formata o CPF no padrão confirmado pelo HAR do login bem-sucedido: `DDD.DDD.DDD-DD`.
 * Retorna `undefined` quando a entrada não contém exatamente 11 dígitos.
 */
export function formatCpfForPortal(cpf: string): string | undefined {
  const digits = cpf.replace(/\D/g, '');

  if (digits.length !== 11) {
    return undefined;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
