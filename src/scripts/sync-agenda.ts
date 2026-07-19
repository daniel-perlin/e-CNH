import 'dotenv/config';

import { ECNHClient } from '../client/ecnh-client.js';
import { ConfigurationError } from '../client/errors.js';
import { GoogleSheetsClient } from '../client/google-sheets-client.js';
import { resolveGoogleSheetsConfig } from '../config/google-sheets-config.js';
import { resolveEntradasSincronizacao } from '../config/sync-professionals.js';
import { parseAgendaHtml } from '../parsers/agenda-parser.js';
import { GoogleSheetsAgendaRepository } from '../repositories/google-sheets-agenda-repository.js';
import { AgendaSyncService } from '../services/agenda-sync-service.js';
import type { StructuredLogger } from '../types/logger.js';

import { formatarResumoSincronizacao } from './sync-agenda-resumo.js';

/**
 * Ponto de entrada sob demanda da sincronização (Fase 006).
 * Apenas compõe dependências e imprime um resumo sem PII.
 */
async function main(): Promise<void> {
  const baseUrl = process.env.ECNH_BASE_URL?.trim();
  if (baseUrl === undefined || baseUrl.length === 0) {
    throw new ConfigurationError(
      'Defina ECNH_BASE_URL no arquivo .env antes de executar a sincronização.'
    );
  }

  const entradas = resolveEntradasSincronizacao();
  const sheetsConfig = resolveGoogleSheetsConfig();
  const sheets = new GoogleSheetsClient({
    credentialsPath: sheetsConfig.credentialsPath,
    spreadsheetId: sheetsConfig.spreadsheetId
  });
  const agendaRepository = new GoogleSheetsAgendaRepository({
    sheets,
    sheetName: sheetsConfig.sheetName
  });

  const service = new AgendaSyncService({
    agendaRepository,
    client: () =>
      new ECNHClient({
        baseUrl,
        logger: createQuietLogger()
      }),
    logger: createQuietLogger(),
    parseAgendaHtml
  });

  console.log(
    `Iniciando sincronização de ${entradas.length} profissional(is) habilitado(s)...`
  );

  const resultado = await service.sincronizarProfissionais(entradas);
  console.log(formatarResumoSincronizacao(resultado));

  if (!resultado.sucessoGeral) {
    process.exitCode = 1;
  }
}

function createQuietLogger(): StructuredLogger {
  const noop = (): void => undefined;
  return { debug: noop, error: noop, info: noop, warn: noop };
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`Sincronização da agenda falhou: ${message}`);
  process.exitCode = 1;
});
