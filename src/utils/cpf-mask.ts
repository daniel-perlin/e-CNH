import { normalizeCpfKey } from './cpf.js';

/**
 * Mascara CPF para logs/auditoria: `***.***.***-XX` (só os 2 últimos dígitos).
 * Retorna `***` se não houver 11 dígitos.
 */
export function mascararCpf(cpf: string): string {
  const digits = normalizeCpfKey(cpf);
  if (digits === undefined) {
    return '***';
  }
  return `***.***.***-${digits.slice(9)}`;
}
