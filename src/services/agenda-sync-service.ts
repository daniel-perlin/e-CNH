import type { ECNHClient } from '../client/ecnh-client.js';
import type { UnidadeDesejadaConfig } from '../client/escolha-unidade-portal.js';
import type { PerfilProfissionalId } from '../client/perfil-profissional-portal.js';
import type {
  ContextoExtracaoAgenda,
  MotivoFalhaExtracaoAgenda,
  ResultadoExtracaoAgenda
} from '../models/agenda.js';
import type {
  AgendaRepository,
  MotivoFalhaPersistenciaAgenda,
  ResultadoPersistenciaAgenda
} from '../repositories/agenda-repository.js';
import type { LoginResult } from '../types/auth.js';
import type { StructuredLogger } from '../types/logger.js';

/** Garante em compile-time que `ECNHClient` continua satisfazendo a porta (sem alterá-lo). */
type AssertECNHClientCompativel = ECNHClient extends AgendaSyncPortalClient ? true : never;
const _ecnhClientCompativelComPorta: AssertECNHClientCompativel = true;
void _ecnhClientCompativelComPorta;

/**
 * Porta mínima do portal e-CNH para a orquestração.
 * `ECNHClient` satisfaz este contrato sem alteração estrutural.
 */
export interface AgendaSyncPortalClient {
  listarDatasAgendamento(): string[];
  login(cpf: string, password: string): Promise<LoginResult>;
  logout(): Promise<void>;
  obterHtmlAgenda(params: { data: string; dataReferencia: string }): Promise<string>;
  /** Opcional: perfil resolvido após login (ECNHClient implementa). */
  obterPerfilPortal?(): PerfilProfissionalId | undefined;
}

/** Parser HTML → domínio injetável (`parseAgendaHtml`). */
export type AgendaSyncHtmlParser = (
  html: string,
  contexto?: ContextoExtracaoAgenda
) => ResultadoExtracaoAgenda;

/**
 * Entrada de sincronização de um profissional.
 * CPF e senha são efêmeros: nunca devem aparecer no resultado tipado.
 */
export interface EntradaSincronizacaoProfissional {
  /** CPF usado apenas no login. */
  cpf: string;
  /**
   * Filtro opcional de datas (`DD/MM/YYYY`).
   * Se omitido, usa todas as retornadas por `listarDatasAgendamento()`.
   */
  datas?: string[];
  /** Rótulo seguro para logs/resultado (ex.: `ECNH_USER_3`), sem CPF. */
  identificadorSeguro: string;
  /** Senha usada apenas no login. */
  password: string;
  /** Nome completo do profissional (config); formatado na escrita com `perfilId`. */
  profissional: string;
  /**
   * Perfil esperado opcional; quando a fábrica cria o client, deve ser repassado
   * via `ECNHClientOptions.perfilEsperado`. A detecção efetiva ocorre no HTML.
   */
  perfilEsperado?: PerfilProfissionalId;
  /**
   * Unidade desejada opcional (B011); repassar via `ECNHClientOptions.unidadeDesejada`.
   */
  unidadeDesejada?: UnidadeDesejadaConfig;
  /**
   * Nome operacional da unidade (coluna Unidade na planilha).
   * Derivado de `CLINIC` — distinto da unidade/visão do portal (B011).
   */
  unidadeOperacional: string;
}

/** Resultado da sincronização de uma data de consulta. */
export interface ResultadoSincronizacaoData {
  dataConsulta: string;
  /** Quantidade de itens da agenda quando a extração teve sucesso. */
  itensExtraidos?: number;
  linhasGravadas?: number;
  linhasRemovidas?: number;
  motivoFalhaExtracao?: MotivoFalhaExtracaoAgenda;
  motivoFalhaPersistencia?: MotivoFalhaPersistenciaAgenda;
  sucesso: boolean;
}

/** Resultado da sincronização de um profissional. */
export interface ResultadoSincronizacaoProfissional {
  datas: ResultadoSincronizacaoData[];
  identificadorSeguro: string;
  /** Status do login. */
  loginStatus?: LoginResult['status'];
  /** Indica se `logout` foi executado (mesmo após falha parcial). */
  logoutExecutado: boolean;
  /** Perfil de portal resolvido no login (sem PII). */
  perfilId?: PerfilProfissionalId;
  sucesso: boolean;
}

/** Resultado agregado da sincronização de um ou mais profissionais. */
export interface ResultadoSincronizacao {
  profissionais: ResultadoSincronizacaoProfissional[];
  /** Verdadeiro somente se todos os profissionais sincronizaram com sucesso. */
  sucessoGeral: boolean;
}

export interface AgendaSyncServiceOptions {
  /**
   * Cliente do portal ou fábrica de clientes.
   * A fábrica recebe a entrada do profissional (para `perfilEsperado` etc.).
   */
  client:
    | AgendaSyncPortalClient
    | ((entrada: EntradaSincronizacaoProfissional) => AgendaSyncPortalClient);
  agendaRepository: AgendaRepository;
  logger?: StructuredLogger;
  parseAgendaHtml: AgendaSyncHtmlParser;
}

/**
 * Caso de uso de sincronização da agenda (Fase 006).
 * Passo 3: `sincronizarProfissional` e `sincronizarProfissionais` implementados.
 */
export class AgendaSyncService {
  private readonly agendaRepository: AgendaRepository;
  private readonly client:
    | AgendaSyncPortalClient
    | ((entrada: EntradaSincronizacaoProfissional) => AgendaSyncPortalClient);
  private readonly logger: StructuredLogger | undefined;
  private readonly parseAgendaHtml: AgendaSyncHtmlParser;

  public constructor(options: AgendaSyncServiceOptions) {
    this.client = options.client;
    this.parseAgendaHtml = options.parseAgendaHtml;
    this.agendaRepository = options.agendaRepository;
    this.logger = options.logger;
  }

  /**
   * Sincroniza a agenda de um profissional.
   * Ordem: login → listar datas → HTML → parse → persistência → logout (finally).
   */
  public async sincronizarProfissional(
    entrada: EntradaSincronizacaoProfissional
  ): Promise<ResultadoSincronizacaoProfissional> {
    const client = this.resolveClient(entrada);
    const resultado: ResultadoSincronizacaoProfissional = {
      datas: [],
      identificadorSeguro: entrada.identificadorSeguro,
      logoutExecutado: false,
      sucesso: false
    };

    try {
      this.logger?.info(
        { event: 'agenda.sync.profissional.started', identificadorSeguro: entrada.identificadorSeguro },
        'Iniciando sincronização de profissional'
      );

      const loginResult = await client.login(entrada.cpf, entrada.password);
      resultado.loginStatus = loginResult.status;

      if (loginResult.status !== 'sucesso') {
        this.logger?.warn(
          {
            event: 'agenda.sync.profissional.login_failed',
            identificadorSeguro: entrada.identificadorSeguro,
            loginStatus: loginResult.status
          },
          'Login não confirmado; sincronização interrompida'
        );
        return resultado;
      }

      resultado.perfilId =
        loginResult.session.perfilId ?? client.obterPerfilPortal?.() ?? undefined;

      const perfilId = resultado.perfilId;
      if (perfilId === undefined) {
        this.logger?.warn(
          {
            event: 'agenda.sync.profissional.perfil_ausente',
            identificadorSeguro: entrada.identificadorSeguro
          },
          'Login ok sem perfil resolvido; sincronização interrompida'
        );
        resultado.sucesso = false;
        return resultado;
      }

      const datasDisponiveis = client.listarDatasAgendamento();
      const datasParaSincronizar = selecionarDatas(datasDisponiveis, entrada.datas);

      for (const dataConsulta of datasParaSincronizar) {
        const resultadoData = await this.sincronizarData(
          client,
          entrada,
          dataConsulta,
          perfilId
        );
        resultado.datas.push(resultadoData);
      }

      resultado.sucesso = resultado.datas.every((item) => item.sucesso);
      return resultado;
    } finally {
      try {
        await client.logout();
        resultado.logoutExecutado = true;
        this.logger?.info(
          {
            event: 'agenda.sync.profissional.logout_completed',
            identificadorSeguro: entrada.identificadorSeguro
          },
          'Logout da sincronização concluído'
        );
      } catch (error) {
        resultado.logoutExecutado = false;
        const message = error instanceof Error ? error.message : 'erro desconhecido';
        this.logger?.warn(
          {
            event: 'agenda.sync.profissional.logout_failed',
            identificadorSeguro: entrada.identificadorSeguro,
            message
          },
          'Falha ao executar logout após sincronização'
        );
      }
    }
  }

  /**
   * Sincroniza vários profissionais em sequência.
   * Reutiliza `sincronizarProfissional`; falha parcial não interrompe o restante.
   */
  public async sincronizarProfissionais(
    entradas: EntradaSincronizacaoProfissional[]
  ): Promise<ResultadoSincronizacao> {
    const profissionais: ResultadoSincronizacaoProfissional[] = [];

    this.logger?.info(
      { event: 'agenda.sync.profissionais.started', quantidade: entradas.length },
      'Iniciando sincronização multi-profissional'
    );

    for (const entrada of entradas) {
      const resultadoProfissional = await this.sincronizarProfissional(entrada);
      profissionais.push(resultadoProfissional);
    }

    const sucessoGeral = profissionais.every((item) => item.sucesso);

    this.logger?.info(
      {
        event: 'agenda.sync.profissionais.completed',
        quantidade: profissionais.length,
        sucessoGeral
      },
      'Sincronização multi-profissional concluída'
    );

    return { profissionais, sucessoGeral };
  }

  private resolveClient(entrada: EntradaSincronizacaoProfissional): AgendaSyncPortalClient {
    return typeof this.client === 'function' ? this.client(entrada) : this.client;
  }

  private async sincronizarData(
    client: AgendaSyncPortalClient,
    entrada: EntradaSincronizacaoProfissional,
    dataConsulta: string,
    perfilId: PerfilProfissionalId
  ): Promise<ResultadoSincronizacaoData> {
    let html: string;
    try {
      html = await client.obterHtmlAgenda({ data: dataConsulta, dataReferencia: dataConsulta });
    } catch (error) {
      this.logFalhaData(entrada.identificadorSeguro, dataConsulta, 'obter_html', error);
      return { dataConsulta, sucesso: false, motivoFalhaExtracao: 'estrutura-invalida' };
    }

    let extracao: ResultadoExtracaoAgenda;
    try {
      extracao = this.parseAgendaHtml(html, { dataConsulta });
    } catch (error) {
      this.logFalhaData(entrada.identificadorSeguro, dataConsulta, 'parse', error);
      return { dataConsulta, sucesso: false, motivoFalhaExtracao: 'estrutura-invalida' };
    }

    if (!extracao.sucesso || extracao.agenda === undefined) {
      return {
        dataConsulta,
        sucesso: false,
        motivoFalhaExtracao: extracao.motivoFalha ?? 'estrutura-invalida'
      };
    }

    const agenda = {
      ...extracao.agenda,
      dataConsulta: extracao.agenda.dataConsulta ?? dataConsulta
    };

    let persistencia: ResultadoPersistenciaAgenda;
    try {
      persistencia = await this.agendaRepository.salvarAgenda(agenda, {
        profissional: entrada.profissional,
        perfilId,
        unidadeOperacional: entrada.unidadeOperacional
      });
    } catch (error) {
      this.logFalhaData(entrada.identificadorSeguro, dataConsulta, 'persistencia', error);
      return {
        dataConsulta,
        itensExtraidos: agenda.itens.length,
        sucesso: false,
        motivoFalhaPersistencia: 'erro-infraestrutura'
      };
    }

    if (!persistencia.sucesso) {
      return {
        dataConsulta,
        itensExtraidos: agenda.itens.length,
        linhasGravadas: persistencia.linhasGravadas,
        linhasRemovidas: persistencia.linhasRemovidas,
        motivoFalhaPersistencia: persistencia.motivoFalha ?? 'erro-infraestrutura',
        sucesso: false
      };
    }

    return {
      dataConsulta,
      itensExtraidos: agenda.itens.length,
      linhasGravadas: persistencia.linhasGravadas,
      linhasRemovidas: persistencia.linhasRemovidas,
      sucesso: true
    };
  }

  private logFalhaData(
    identificadorSeguro: string,
    dataConsulta: string,
    etapa: 'obter_html' | 'parse' | 'persistencia',
    error: unknown
  ): void {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    this.logger?.warn(
      {
        event: 'agenda.sync.data.failed',
        identificadorSeguro,
        dataConsulta,
        etapa,
        message
      },
      'Falha ao sincronizar data da agenda'
    );
  }
}

function selecionarDatas(disponiveis: string[], filtro: string[] | undefined): string[] {
  if (filtro === undefined) {
    return [...disponiveis];
  }

  const permitidas = new Set(filtro);
  return disponiveis.filter((data) => permitidas.has(data));
}
