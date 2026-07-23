import 'dotenv/config';

import pino from 'pino';

import { ECNHClient } from '../client/ecnh-client.js';
import { ConfigurationError } from '../client/errors.js';
import { listarProfissionaisEnvParaCredenciais } from '../config/credential-audit-scope.js';
import {
  carregarCredenciaisCandidatasDoArquivo,
  resolveCaminhoCredenciaisCandidatas
} from '../config/credential-candidates.js';
import { criarEnvFileCredentialStore } from '../config/env-credential-store.js';
import {
  CredentialRefreshService,
  formatarResumoAuditoriaCredenciais
} from '../services/credential-refresh-service.js';

/**
 * Auditoria de credenciais a partir do catálogo de candidatas.
 *
 * - Percorre todas as entradas do catálogo (não só ENABLED=true).
 * - Valida autenticação; atualiza CPF/senha no `.env` se necessário.
 * - Nunca altera `ENABLED` (desabilitados permanecem desabilitados).
 * - Não sincroniza agenda.
 *
 * Uso: `npm run audit:credenciais`
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
  const envProfissionais = listarProfissionaisEnvParaCredenciais();
  const caminhoEnv = process.env.ECNH_ENV_FILE_PATH?.trim() || '.env';

  logger.info(
    {
      event: 'credential.audit.bootstrap',
      candidatas: catalogo.candidatas.length,
      profissionaisEnv: envProfissionais.length,
      origemCatalogo: catalogo.origem
    },
    'Preparando auditoria de credenciais'
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
    // Escopo do refresh não é usado em executarAuditoria.
    profissionais: [],
    store: criarEnvFileCredentialStore({ caminhoEnv })
  });

  const resultado = await service.executarAuditoria(envProfissionais, { caminhoEnv });
  console.log(formatarResumoAuditoriaCredenciais(resultado));

  logger.info(
    {
      event: 'credential.audit.finished',
      processados: resultado.processados,
      autenticaram: resultado.autenticaram,
      atualizadas: resultado.atualizadas,
      desabilitadosValidados: resultado.desabilitadosValidados,
      continuamInvalidos: resultado.continuamInvalidos
    },
    'Auditoria de credenciais finalizada'
  );

  if (resultado.continuamInvalidos > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Falha não classificada.';
  console.error(message);
  process.exitCode = 1;
});
