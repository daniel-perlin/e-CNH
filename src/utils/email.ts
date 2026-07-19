/**
 * Normaliza e-mail antes da persistência: remove espaços nas extremidades
 * e converte para minúsculas. Não valida formato nem corrige e-mails inválidos.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
