/**
 * Normaliza ausência de informação na fronteira do portal e-CNH / Detran.
 * Textos como “NÃO INFORMADO” são convenção de apresentação do HTML, não dado de negócio.
 */

/**
 * Converte ausência / “não informado” do portal em `undefined` (domínio canônico).
 * Demais valores permanecem exatamente como recebidos.
 */
export function parseOptionalPortalField(
  valor: string | null | undefined
): string | undefined {
  if (valor === null || valor === undefined) {
    return undefined;
  }
  const trimado = valor.trim();
  if (trimado.length === 0) {
    return undefined;
  }
  if (isNaoInformadoPortal(trimado)) {
    return undefined;
  }
  return valor;
}

function isNaoInformadoPortal(valor: string): boolean {
  const normalizado = valor
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
  return normalizado === 'nao informado';
}
