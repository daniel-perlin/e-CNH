import { ConfigurationError } from '../client/errors.js';
import type { EntradaSincronizacaoProfissional } from '../services/agenda-sync-service.js';

const MAX_USER_INDEX = 50;

/**
 * Profissional habilitado para sincronização.
 * Resolve na fronteira de configuração; o serviço não lê `.env`.
 */
export interface ProfissionalParaSincronizacao {
  /** CPF usado apenas no login. */
  cpf: string;
  /** Rótulo seguro para logs/resultado (ex.: `ECNH_USER_1`), sem CPF. */
  identificadorSeguro: string;
  /** Nome gravado na coluna Profissional da planilha (`ECNH_USER_<n>_NAME`). */
  nome: string;
  /** Senha usada apenas no login. */
  senha: string;
}

/**
 * Lista profissionais com `ECNH_USER_<n>_ENABLED=true` e campos obrigatórios preenchidos.
 *
 * Variáveis por índice: `NAME`, `CPF`, `PASSWORD`, `ENABLED`.
 * Slots sem nenhuma variável definida são ignorados.
 * `ENABLED=true` com NAME/CPF/PASSWORD ausentes lança `ConfigurationError`.
 */
export function resolveEnabledSyncProfessionals(
  env: NodeJS.ProcessEnv = process.env
): ProfissionalParaSincronizacao[] {
  const profissionais: ProfissionalParaSincronizacao[] = [];

  for (let index = 1; index <= MAX_USER_INDEX; index += 1) {
    const enabled = env[`ECNH_USER_${index}_ENABLED`];
    const name = env[`ECNH_USER_${index}_NAME`];
    const cpf = env[`ECNH_USER_${index}_CPF`];
    const password = env[`ECNH_USER_${index}_PASSWORD`];

    if (
      enabled === undefined &&
      name === undefined &&
      cpf === undefined &&
      password === undefined
    ) {
      continue;
    }

    if (enabled !== 'true') {
      continue;
    }

    const nome = name?.trim() ?? '';
    const cpfNormalizado = cpf?.trim() ?? '';
    const senha = password ?? '';

    if (nome.length === 0 || cpfNormalizado.length === 0 || senha.length === 0) {
      throw new ConfigurationError(
        `ECNH_USER_${index}_ENABLED=true exige ECNH_USER_${index}_NAME, ECNH_USER_${index}_CPF e ECNH_USER_${index}_PASSWORD preenchidos.`
      );
    }

    profissionais.push({
      cpf: cpfNormalizado,
      identificadorSeguro: `ECNH_USER_${index}`,
      nome,
      senha
    });
  }

  if (profissionais.length === 0) {
    throw new ConfigurationError(
      'Nenhum profissional habilitado para sincronização. Defina ao menos um ECNH_USER_<n>_ENABLED=true com NAME, CPF e PASSWORD.'
    );
  }

  return profissionais;
}

/** Converte o profissional resolvido na entrada tipada do `AgendaSyncService`. */
export function paraEntradaSincronizacao(
  profissional: ProfissionalParaSincronizacao
): EntradaSincronizacaoProfissional {
  return {
    cpf: profissional.cpf,
    identificadorSeguro: profissional.identificadorSeguro,
    password: profissional.senha,
    profissional: profissional.nome
  };
}

/** Atalho: resolve o ambiente e devolve entradas prontas para `sincronizarProfissionais`. */
export function resolveEntradasSincronizacao(
  env: NodeJS.ProcessEnv = process.env
): EntradaSincronizacaoProfissional[] {
  return resolveEnabledSyncProfessionals(env).map(paraEntradaSincronizacao);
}
