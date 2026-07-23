import 'dotenv/config';

import pino from 'pino';

import { ECNHClient } from '../client/ecnh-client.js';
import { ConfigurationError } from '../client/errors.js';
import {
  carregarCredenciaisCandidatasDoArquivo,
  resolveCaminhoCredenciaisCandidatas
} from '../config/credential-candidates.js';
import { criarEnvFileCredentialStore } from '../config/env-credential-store.js';
import { resolveEnabledSyncProfessionals } from '../config/sync-professionals.js';
import {
  CredentialRefreshService,
  formatarResumoCredenciais
} from '../services/credential-refresh-service.js';

/**
 * Atualização inteligente de credenciais dos profissionais habilitados.
 *
 * Uso:
 *   1. Preencha `secrets/credenciais-candidatas.json` (gitignored) — ver exemplo em docs/
 *   2. `npm run refresh:credenciais`
 *
 * Não altera credenciais que ainda autenticam. Só tenta candidatas quando o
 * login atual retorna `senha_invalida`. Persistência oficial: arquivo `.env`.
 */
async function main(): Promise<void> {
  const baseUrl = process.env.ECNH_BASE_URL?.trim() ?? '';
  if (baseUrl.length === 0) {
    throw new ConfigurationError('ECNH_BASE_URL é obrigatória.');
  }

  const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info'
  });

  const caminhoCatalogo = resolveCaminhoCredenciaisCandidatas();
  const catalogo = carregarCredenciaisCandidatasDoArquivo(caminhoCatalogo);
  const profissionais = resolveEnabledSyncProfessionals();
  const caminhoEnv = process.env.ECNH_ENV_FILE_PATH?.trim() || '.env';

  logger.info(
    {
      event: 'credential.refresh.started',
      profissionais: profissionais.length,
      candidatas: catalogo.candidatas.length,
      origemCatalogo: catalogo.origem
    },
    'Iniciando atualização inteligente de credenciais'
  );

  const service = new CredentialRefreshService({
    candidatas: catalogo.candidatas,
    createClient: ({ perfilEsperado, unidadeDesejada }) =>
      new ECNHClient({
        baseUrl,
        logger,
        perfilEsperado,
        unidadeDesejada
      }),
    logger,
    profissionais,
    store: criarEnvFileCredentialStore({ caminhoEnv })
  });

  const resultado = await service.executar();
  const resumo = formatarResumoCredenciais(resultado);
  console.log(resumo);
  logger.info(
    {
      event: 'credential.refresh.finished',
      mantidas: resultado.mantidas,
      atualizadas: resultado.atualizadas,
      falharam: resultado.falharam
    },
    'Atualização inteligente de credenciais finalizada'
  );

  if (resultado.falharam > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Falha não classificada.';
  console.error(message);
  process.exitCode = 1;
});
