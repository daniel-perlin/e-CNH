/**
 * Sessão já autenticada no portal — B010 / Fase 003E.
 * Isolado de `EscolhaUnidadePortal` (B011) e `PerfilProfissionalPortal` (B012).
 * Gatilho exclusivo: marcador HTML `openDialogNewSession`.
 */

/** Detecta o ramo JS pós-`autenticar` que pede encerrar sessão anterior. */
export function htmlRequerEncerramentoSessaoExistente(html: string): boolean {
  return /openDialogNewSession\s*\(/.test(html);
}

/**
 * Extrai o argumento `autenticadoCyberark` de
 * `openDialogNewSession(cpf, senha, autenticadoCyberark)`.
 * Evidência: terceiro parâmetro da chamada injetada no HTML pós-autenticar.
 */
export function extrairAutenticadoCyberarkDeOpenDialogNewSession(html: string): string {
  const match = html.match(
    /openDialogNewSession\s*\(\s*['"][^'"]*['"]\s*,\s*['"][^'"]*['"]\s*,\s*['"]([^'"]*)['"]/
  );
  if (match?.[1] !== undefined && match[1].length > 0) {
    return match[1];
  }
  return 'false';
}
