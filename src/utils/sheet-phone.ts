/**
 * Projeção operacional do telefone na aba Google Sheets.
 * Não altera o domínio; fixos e formatos do portal podem ser descartados (ADR-026).
 */

/**
 * Extrai apenas celulares do campo de telefone do domínio, em dígitos.
 *
 * Regras:
 * - partes separadas por `/`;
 * - celular = DDD (2 dígitos) + número de 9 dígitos iniciado em `9`, ou
 *   9 dígitos iniciados em `9` (assume DDD 11);
 * - DDD informado é preservado; ausente → `11`;
 * - fixos e lixo são descartados;
 * - múltiplos celulares → unidos com ` / `;
 * - nenhum celular → string vazia (o mapper aplica o placeholder visual).
 */
export function formatPhoneForSheet(phone: string | null | undefined): string {
  if (phone === null || phone === undefined) {
    return '';
  }

  const celulares = phone
    .split('/')
    .map((parte) => extrairCelularEmDigitos(parte))
    .filter((parte) => parte.length > 0);

  return celulares.join(' / ');
}

function extrairCelularEmDigitos(parte: string): string {
  const digitos = parte.replace(/\D/g, '');
  if (digitos.length === 0 || isDigitoUnicoRepetido(digitos)) {
    return '';
  }

  // Celular sem DDD: 9 dígitos iniciados em 9 → assume DDD 11.
  if (digitos.length === 9 && digitos.startsWith('9')) {
    return `11${digitos}`;
  }

  // Celular com DDD: 11 dígitos, terceiro dígito = 9 (padrão brasileiro).
  if (digitos.length === 11 && digitos[2] === '9') {
    return digitos;
  }

  return '';
}

function isDigitoUnicoRepetido(digitos: string): boolean {
  const primeiro = digitos[0];
  return primeiro !== undefined && [...digitos].every((digito) => digito === primeiro);
}
