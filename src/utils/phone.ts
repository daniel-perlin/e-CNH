/**
 * Normaliza telefone para comparação / consistência interna (ex.: merge).
 * Não é a projeção visual da planilha — ver `formatPhoneForSheet`.
 *
 * Regras:
 * - remove hífens e espaços extras;
 * - descarta números formados por um único dígito repetido;
 * - celular com exatamente 9 dígitos iniciados em 9 recebe DDD 11;
 * - múltiplos valores separados por `/` são normalizados individualmente
 *   e reconstruídos com ` / ` (descartados somem do resultado).
 */
export function normalizePhone(phone: string): string {
  const partes = phone
    .split('/')
    .map((parte) => normalizarTelefoneUnico(parte))
    .filter((parte) => parte.length > 0);

  return partes.join(' / ');
}

function normalizarTelefoneUnico(telefone: string): string {
  const limpo = telefone.replaceAll('-', '').replace(/\s+/g, ' ').trim();
  if (limpo.length === 0) {
    return '';
  }

  const digitos = limpo.replace(/\D/g, '');
  if (digitos.length === 0 || isDigitoUnicoRepetido(digitos)) {
    return '';
  }

  if (digitos.length === 9 && digitos.startsWith('9')) {
    return `(11) ${digitos}`;
  }

  return limpo;
}

function isDigitoUnicoRepetido(digitos: string): boolean {
  const primeiro = digitos[0];
  return primeiro !== undefined && [...digitos].every((digito) => digito === primeiro);
}
