import 'dotenv/config';

import { runEcnhConnectivityProbe } from '../diagnostics/ecnh-connectivity-probe.js';

/**
 * CLI de diagnóstico isolado (mesmo núcleo do modo `RUN_CONNECTIVITY_PROBE`).
 *
 *   npm run test:ecnh-connectivity
 *   npm run test:ecnh-connectivity:prod
 */
async function main(): Promise<void> {
  const resultado = await runEcnhConnectivityProbe();
  process.exit(resultado.exitCode);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`Teste de conectividade falhou: ${message}`);
  process.exit(1);
});
