import type { ECNHClientOptions } from '../client/ecnh-client.js';
import type { ProfissionalParaSincronizacao } from '../config/sync-professionals.js';
import {
  resolverEscopoAuditoriaCredenciais,
  type ProfissionalParaCredencial
} from '../config/credential-audit-scope.js';
import {
  extrairIndiceUsuarioSeguro,
  type EnvCredentialStore
} from '../config/env-credential-store.js';
import {
  resolverCredencialCandidata,
  type CredencialCandidata
} from '../config/credential-candidates.js';
import {
  loginStatusPermiteAtualizacaoCredencial,
  type LoginResult
} from '../types/auth.js';
import type { StructuredLogger } from '../types/logger.js';
import { mascararCpf } from '../utils/cpf-mask.js';
import { normalizeCpfKey } from '../utils/cpf.js';

/** Cliente mínimo reutilizado do fluxo de autenticação. */
export interface CredentialRefreshPortalClient {
  login(cpf: string, password: string): Promise<LoginResult>;
  logout(): Promise<void>;
}

export type ResultadoCredencialProfissionalStatus =
  | 'mantida'
  | 'atualizada'
  | 'falhou';

export type CamposCredencialAtualizados = 'cpf' | 'senha' | 'ambos';

export type CategoriaFalhaCredencial =
  | 'sem_candidata'
  | 'falhou_novamente'
  | 'portal_indisponivel'
  | 'timeout'
  | 'erro_interno'
  | 'sem_env'
  | 'outro';

export interface ResultadoCredencialProfissional {
  identificadorSeguro: string;
  nome: string;
  status: ResultadoCredencialProfissionalStatus;
  /** Status do primeiro login (credencial atual). */
  loginStatusInicial?: LoginResult['status'];
  /** Status do segundo login (candidata), se tentado. */
  loginStatusCandidata?: LoginResult['status'];
  /** Motivo seguro (sem senha/CPF completo). */
  motivo?: string;
  /** Quando status=atualizada: o que mudou no .env. */
  camposAtualizados?: CamposCredencialAtualizados;
  /** Classificação da falha para o resumo final. */
  categoriaFalha?: CategoriaFalhaCredencial;
  /**
   * Espelho de ENABLED no momento da execução.
   * `true` por padrão no refresh (somente habilitados).
   */
  habilitado: boolean;
}

export interface ResultadoAtualizacaoCredenciais {
  profissionais: ResultadoCredencialProfissional[];
  processados: number;
  mantidas: number;
  atualizadas: number;
  semCandidata: number;
  falharamNovamente: number;
  portalIndisponivel: number;
  timeout: number;
  errosInternos: number;
  falharam: number;
}

export interface ResultadoAuditoriaCredenciais extends ResultadoAtualizacaoCredenciais {
  autenticaram: number;
  desabilitadosValidados: number;
  continuamInvalidos: number;
}

export interface CredentialRefreshServiceOptions {
  candidatas: readonly CredencialCandidata[];
  createClient: (options: {
    perfilEsperado?: ECNHClientOptions['perfilEsperado'];
    unidadeDesejada?: ECNHClientOptions['unidadeDesejada'];
  }) => CredentialRefreshPortalClient;
  logger: StructuredLogger;
  /** Escopo do refresh (`ENABLED=true`). Ignorado por `executarAuditoria`. */
  profissionais: readonly ProfissionalParaSincronizacao[];
  store: EnvCredentialStore;
}

type ProfissionalProcessavel = ProfissionalParaSincronizacao & {
  habilitado?: boolean;
};

/**
 * Atualização inteligente de credenciais:
 * 1) tenta login atual;
 * 2) só se `senha_invalida`, busca candidata e tenta de novo (no máximo 1 retry);
 * 3) em sucesso do retry, persiste no `.env` e registra log estruturado.
 *
 * `executar()` — apenas habilitados (comportamento original).
 * `executarAuditoria()` — percorre o catálogo (inclui desabilitados; não altera ENABLED).
 */
export class CredentialRefreshService {
  private readonly candidatas: readonly CredencialCandidata[];
  private readonly createClient: CredentialRefreshServiceOptions['createClient'];
  private readonly logger: StructuredLogger;
  private readonly profissionais: readonly ProfissionalParaSincronizacao[];
  private readonly store: EnvCredentialStore;

  public constructor(options: CredentialRefreshServiceOptions) {
    this.candidatas = options.candidatas;
    this.createClient = options.createClient;
    this.logger = options.logger;
    this.profissionais = options.profissionais;
    this.store = options.store;
  }

  /** Modo refresh: somente profissionais já resolvidos (habilitados). */
  public async executar(): Promise<ResultadoAtualizacaoCredenciais> {
    const profissionais: ResultadoCredencialProfissional[] = [];

    for (const profissional of this.profissionais) {
      profissionais.push(
        await this.processarProfissional({ ...profissional, habilitado: true })
      );
    }

    return agregarResultadoCredenciais(profissionais);
  }

  /**
   * Modo audit: percorre o catálogo; faz match com `.env` (habilitado ou não);
   * valida/atualiza credenciais; **nunca** altera `ENABLED`.
   */
  public async executarAuditoria(
    envProfissionais: readonly ProfissionalParaCredencial[],
    options: { caminhoEnv?: string } = {}
  ): Promise<ResultadoAuditoriaCredenciais> {
    const escopo = resolverEscopoAuditoriaCredenciais(this.candidatas, envProfissionais, {
      caminhoEnv: options.caminhoEnv
    });
    const resultados: ResultadoCredencialProfissional[] = [];

    this.logger.info(
      {
        event: 'credential.audit.started',
        candidatas: this.candidatas.length,
        comEnv: escopo.profissionais.length,
        foraDoEscopo: escopo.foraDoEscopo.length
      },
      'Iniciando auditoria de credenciais (catálogo × .env)'
    );

    for (const profissional of escopo.profissionais) {
      resultados.push(await this.processarProfissional(profissional));
    }

    for (const item of escopo.foraDoEscopo) {
      this.logger.warn(
        {
          event: 'credential.audit.fora_do_escopo',
          nome: item.candidata.nome,
          cpfMascarado: mascararCpf(item.candidata.cpf),
          identificadorSeguro: item.identificadorSeguro,
          motivo: item.motivo
        },
        item.motivo
      );
      resultados.push({
        identificadorSeguro: item.identificadorSeguro ?? 'SEM_ENV',
        nome: item.candidata.nome,
        status: 'falhou',
        motivo: item.motivo,
        categoriaFalha: 'sem_env',
        habilitado: false
      });
    }

    return agregarResultadoAuditoria(resultados);
  }

  private async processarProfissional(
    profissional: ProfissionalProcessavel
  ): Promise<ResultadoCredencialProfissional> {
    const habilitado = profissional.habilitado ?? true;
    const cpfMascarado = mascararCpf(profissional.cpf);
    const baseLog = {
      identificadorSeguro: profissional.identificadorSeguro,
      nome: profissional.nome,
      cpfMascarado,
      habilitado
    };

    this.logger.info(
      { event: 'credential.refresh.profissional.inicio', ...baseLog },
      `Início do processamento: ${profissional.nome} (${cpfMascarado}) [ENABLED=${habilitado}]`
    );

    const client = this.createClient({
      perfilEsperado: profissional.perfilEsperado,
      unidadeDesejada: profissional.unidadeDesejada
    });

    this.logger.info(
      { event: 'credential.refresh.login.tentativa_atual', ...baseLog },
      'Primeira tentativa de login com a credencial atual'
    );

    const loginInicial = await this.tentarLogin(
      client,
      profissional.cpf,
      profissional.senha
    );

    this.logger.info(
      {
        event: 'credential.refresh.login.resultado_atual',
        ...baseLog,
        resultado: mapearResultadoLoginParaAuditoria(loginInicial.status)
      },
      `Resultado da primeira tentativa: ${mapearResultadoLoginParaAuditoria(loginInicial.status)}`
    );

    if (loginInicial.status === 'sucesso') {
      this.logger.info(
        { event: 'credential.refresh.mantida', ...baseLog },
        'Autenticado com a credencial atual — nenhuma alteração.'
      );
      return {
        identificadorSeguro: profissional.identificadorSeguro,
        nome: profissional.nome,
        status: 'mantida',
        loginStatusInicial: 'sucesso',
        habilitado
      };
    }

    if (!loginStatusPermiteAtualizacaoCredencial(loginInicial.status)) {
      const categoriaFalha = categorizarFalhaSemRetry(loginInicial.status);
      const motivo = `Login atual falhou com status ${loginInicial.status} (sem atualização).`;
      this.logger.warn(
        {
          event: 'credential.refresh.falhou_sem_retry',
          ...baseLog,
          loginStatus: loginInicial.status,
          categoriaFalha,
          motivo
        },
        `Falha sem tentativa de atualização (${loginInicial.status}). Seguindo para o próximo.`
      );
      return {
        identificadorSeguro: profissional.identificadorSeguro,
        nome: profissional.nome,
        status: 'falhou',
        loginStatusInicial: loginInicial.status,
        motivo,
        categoriaFalha,
        habilitado
      };
    }

    this.logger.info(
      { event: 'credential.refresh.candidata.busca', ...baseLog },
      'senha_invalida — procurando credencial candidata no catálogo'
    );

    const candidata = resolverCredencialCandidata({
      candidatas: this.candidatas,
      cpfAtual: profissional.cpf,
      nomeAtual: profissional.nome,
      senhaAtual: profissional.senha
    });

    if (candidata === undefined) {
      const motivo =
        'Portal rejeitou a credencial atual e a candidata do catálogo é idêntica (CPF+senha) — possível conta bloqueada ou necessidade de reativação no portal; não há credencial distinta para tentar.';
      this.logger.warn(
        {
          event: 'credential.refresh.sem_candidata',
          ...baseLog,
          loginStatus: loginInicial.status,
          motivo
        },
        `${motivo} Seguindo para o próximo.`
      );
      return {
        identificadorSeguro: profissional.identificadorSeguro,
        nome: profissional.nome,
        status: 'falhou',
        loginStatusInicial: loginInicial.status,
        motivo,
        categoriaFalha: 'sem_candidata',
        habilitado
      };
    }

    this.logger.info(
      {
        event: 'credential.refresh.login.tentativa_candidata',
        ...baseLog,
        candidataCpfMascarado: mascararCpf(candidata.cpf),
        candidataNome: candidata.nome
      },
      'Candidata encontrada — segunda tentativa de login (senha não registrada)'
    );

    const loginCandidata = await this.tentarLogin(client, candidata.cpf, candidata.senha);

    if (loginCandidata.status !== 'sucesso') {
      const motivo = `Candidata falhou com status ${loginCandidata.status}.`;
      this.logger.warn(
        {
          event: 'credential.refresh.candidata_falhou',
          ...baseLog,
          loginStatusInicial: loginInicial.status,
          loginStatusCandidata: loginCandidata.status,
          resultadoSegundaTentativa: 'falhou',
          motivo
        },
        `Segunda tentativa: falhou (${loginCandidata.status}). Seguindo para o próximo.`
      );
      return {
        identificadorSeguro: profissional.identificadorSeguro,
        nome: profissional.nome,
        status: 'falhou',
        loginStatusInicial: loginInicial.status,
        loginStatusCandidata: loginCandidata.status,
        motivo,
        categoriaFalha: 'falhou_novamente',
        habilitado
      };
    }

    this.logger.info(
      {
        event: 'credential.refresh.login.resultado_candidata',
        ...baseLog,
        resultadoSegundaTentativa: 'autenticado'
      },
      'Segunda tentativa: autenticado'
    );

    const indice = extrairIndiceUsuarioSeguro(profissional.identificadorSeguro);
    if (indice === undefined) {
      const motivo = 'Identificador seguro inválido para persistência no .env.';
      this.logger.error(
        { event: 'credential.refresh.persistencia_invalida', ...baseLog, motivo },
        motivo
      );
      return {
        identificadorSeguro: profissional.identificadorSeguro,
        nome: profissional.nome,
        status: 'falhou',
        loginStatusInicial: loginInicial.status,
        loginStatusCandidata: 'sucesso',
        motivo,
        categoriaFalha: 'erro_interno',
        habilitado
      };
    }

    const camposAtualizados = resolverCamposAtualizados(
      profissional.cpf,
      profissional.senha,
      candidata.cpf,
      candidata.senha
    );

    this.store.atualizarCredencialUsuario({
      indice,
      cpf: candidata.cpf,
      senha: candidata.senha
    });

    this.logger.info(
      {
        event: 'credential.refresh.atualizada',
        ...baseLog,
        camposAtualizados
      },
      `Credencial oficial atualizada no .env (${camposAtualizados}). ENABLED inalterado (${habilitado}).`
    );

    return {
      identificadorSeguro: profissional.identificadorSeguro,
      nome: profissional.nome,
      status: 'atualizada',
      loginStatusInicial: loginInicial.status,
      loginStatusCandidata: 'sucesso',
      camposAtualizados,
      habilitado
    };
  }

  private async tentarLogin(
    client: CredentialRefreshPortalClient,
    cpf: string,
    senha: string
  ): Promise<LoginResult> {
    try {
      const resultado = await client.login(cpf, senha);
      if (resultado.status === 'sucesso') {
        try {
          await client.logout();
        } catch {
          // Logout best-effort: não mascara o sucesso do login.
        }
      }
      return resultado;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro interno não classificado no login.';
      return { message, status: 'erro_desconhecido' };
    }
  }
}

export function mapearResultadoLoginParaAuditoria(
  status: LoginResult['status']
): string {
  if (status === 'sucesso') {
    return 'autenticado';
  }
  return status;
}

export function resolverCamposAtualizados(
  cpfAtual: string,
  senhaAtual: string,
  cpfNovo: string,
  senhaNova: string
): CamposCredencialAtualizados {
  const cpfMudou = normalizeCpfKey(cpfAtual) !== normalizeCpfKey(cpfNovo);
  const senhaMudou = senhaAtual !== senhaNova;
  if (cpfMudou && senhaMudou) {
    return 'ambos';
  }
  if (cpfMudou) {
    return 'cpf';
  }
  return 'senha';
}

export function categorizarFalhaSemRetry(
  status: LoginResult['status']
): CategoriaFalhaCredencial {
  switch (status) {
    case 'portal_indisponivel':
      return 'portal_indisponivel';
    case 'timeout':
      return 'timeout';
    case 'erro_sistema':
    case 'erro_desconhecido':
    case 'usuario_bloqueado':
      return 'erro_interno';
    default:
      return 'outro';
  }
}

export function agregarResultadoCredenciais(
  profissionais: readonly ResultadoCredencialProfissional[]
): ResultadoAtualizacaoCredenciais {
  return {
    profissionais: [...profissionais],
    processados: profissionais.length,
    mantidas: profissionais.filter((p) => p.status === 'mantida').length,
    atualizadas: profissionais.filter((p) => p.status === 'atualizada').length,
    semCandidata: profissionais.filter((p) => p.categoriaFalha === 'sem_candidata').length,
    falharamNovamente: profissionais.filter((p) => p.categoriaFalha === 'falhou_novamente')
      .length,
    portalIndisponivel: profissionais.filter(
      (p) => p.categoriaFalha === 'portal_indisponivel'
    ).length,
    timeout: profissionais.filter((p) => p.categoriaFalha === 'timeout').length,
    errosInternos: profissionais.filter((p) => p.categoriaFalha === 'erro_interno').length,
    falharam: profissionais.filter((p) => p.status === 'falhou').length
  };
}

export function agregarResultadoAuditoria(
  profissionais: readonly ResultadoCredencialProfissional[]
): ResultadoAuditoriaCredenciais {
  const base = agregarResultadoCredenciais(profissionais);
  const autenticaram = profissionais.filter(
    (p) => p.status === 'mantida' || p.status === 'atualizada'
  ).length;
  const desabilitadosValidados = profissionais.filter(
    (p) => !p.habilitado && (p.status === 'mantida' || p.status === 'atualizada')
  ).length;
  return {
    ...base,
    autenticaram,
    desabilitadosValidados,
    continuamInvalidos: base.falharam
  };
}

/** Formata o resumo textual do refresh (sem CPF/senha). */
export function formatarResumoCredenciais(
  resultado: ResultadoAtualizacaoCredenciais
): string {
  const atualizadas = resultado.profissionais
    .filter((p) => p.status === 'atualizada')
    .map((p) => {
      const campos = p.camposAtualizados !== undefined ? ` (${p.camposAtualizados})` : '';
      return `- ${p.nome}${campos}`;
    });
  const falharam = resultado.profissionais
    .filter((p) => p.status === 'falhou')
    .map((p) => `- ${p.nome} (${p.motivo ?? 'erro não classificado'})`);

  const pad = (n: number): string => String(n).padStart(2, '0');

  return [
    '==================================================',
    'REFRESH DE CREDENCIAIS',
    '==================================================',
    '',
    `Profissionais processados: ${pad(resultado.processados)}`,
    '',
    `Mantidos: ${pad(resultado.mantidas)}`,
    '',
    `Atualizados: ${pad(resultado.atualizadas)}`,
    '',
    `Sem credencial candidata: ${pad(resultado.semCandidata)}`,
    '',
    `Falharam novamente: ${pad(resultado.falharamNovamente)}`,
    '',
    `Portal indisponível: ${pad(resultado.portalIndisponivel)}`,
    '',
    `Timeout: ${pad(resultado.timeout)}`,
    '',
    `Erros internos: ${pad(resultado.errosInternos)}`,
    '',
    'Lista dos profissionais atualizados:',
    ...(atualizadas.length > 0 ? atualizadas : ['- (nenhuma)']),
    '',
    'Lista dos profissionais que continuam com erro:',
    ...(falharam.length > 0 ? falharam : ['- (nenhuma)']),
    ''
  ].join('\n');
}

/** Formata o resumo textual da auditoria (sem CPF/senha). */
export function formatarResumoAuditoriaCredenciais(
  resultado: ResultadoAuditoriaCredenciais
): string {
  const pad = (n: number): string => String(n).padStart(2, '0');

  const atualizados = resultado.profissionais
    .filter((p) => p.status === 'atualizada')
    .map((p) => {
      const campos = p.camposAtualizados !== undefined ? ` (${p.camposAtualizados})` : '';
      const flag = p.habilitado ? '' : ' [desabilitado]';
      return `- ${p.nome}${campos}${flag}`;
    });

  const invalidos = resultado.profissionais
    .filter((p) => p.status === 'falhou')
    .map((p) => `- ${p.nome} (${p.motivo ?? 'erro não classificado'})`);

  const desabilitadosOk = resultado.profissionais
    .filter((p) => !p.habilitado && (p.status === 'mantida' || p.status === 'atualizada'))
    .map((p) => `- ${p.nome} (${p.status})`);

  return [
    '==========================================',
    'AUDITORIA DE CREDENCIAIS',
    '==========================================',
    '',
    `Processados: ${pad(resultado.processados)}`,
    '',
    `Autenticaram: ${pad(resultado.autenticaram)}`,
    '',
    `Atualizados: ${pad(resultado.atualizadas)}`,
    '',
    `Desabilitados validados: ${pad(resultado.desabilitadosValidados)}`,
    '',
    `Continuam inválidos: ${pad(resultado.continuamInvalidos)}`,
    '',
    `Portal indisponível: ${pad(resultado.portalIndisponivel)}`,
    '',
    `Timeout: ${pad(resultado.timeout)}`,
    '',
    'Profissionais atualizados:',
    ...(atualizados.length > 0 ? atualizados : ['- (nenhuma)']),
    '',
    'Profissionais ainda inválidos:',
    ...(invalidos.length > 0 ? invalidos : ['- (nenhuma)']),
    '',
    'Desabilitados que autenticaram com sucesso:',
    ...(desabilitadosOk.length > 0 ? desabilitadosOk : ['- (nenhuma)']),
    ''
  ].join('\n');
}
