import 'dotenv/config';

import { resolveEntrypointMode } from './diagnostics/entrypoint-mode.js';

/**
 * Entrypoint de produção (`node dist/index.js` / `npm start`).
 *
 * - Padrão: AgendaSync one-shot (ADR-020).
 * - `RUN_CONNECTIVITY_PROBE=true`: apenas GET isolado ao portal (diagnóstico de rede).
 *
 * O Start Command no Railway permanece sempre `node dist/index.js`.
 */
async function main(): Promise<void> {
  const mode = resolveEntrypointMode(process.env);

  if (mode === 'connectivity-probe') {
    const { runEcnhConnectivityProbe } = await import(
      './diagnostics/ecnh-connectivity-probe.js'
    );
    const resultado = await runEcnhConnectivityProbe();
    process.exit(resultado.exitCode);
  }

  await import('./scripts/sync-agenda.js');
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`Entrypoint falhou: ${message}`);
  process.exit(1);
});
