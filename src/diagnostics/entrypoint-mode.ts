/**
 * Modo do entrypoint de produção (`node dist/index.js`).
 * Não altera regras de sync — apenas escolhe o fluxo one-shot.
 */
export type EntrypointMode = 'agenda-sync' | 'connectivity-probe';

/**
 * Resolve o modo a partir do ambiente.
 *
 * `RUN_CONNECTIVITY_PROBE=true` (também `1` / `yes` / `on`) → só o GET isolado
 * ao portal. Qualquer outro valor (ou ausência) → AgendaSync (padrão).
 */
export function resolveEntrypointMode(
  env: NodeJS.ProcessEnv = process.env
): EntrypointMode {
  const raw = env.RUN_CONNECTIVITY_PROBE?.trim().toLowerCase();
  if (raw === undefined || raw.length === 0) {
    return 'agenda-sync';
  }
  if (raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on') {
    return 'connectivity-probe';
  }
  return 'agenda-sync';
}
