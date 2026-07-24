import type { ECNHClient } from '../client/ecnh-client.js';
import type { UnidadeDesejadaConfig } from '../client/escolha-unidade-portal.js';
import type { PerfilProfissionalId } from '../client/perfil-profissional-portal.js';
import type {
  Agenda,
  ContextoExtracaoAgenda,
  MotivoFalhaExtracaoAgenda,
  ResultadoExtracaoAgenda
} from '../models/agenda.js';
import type {
  AgendaRepository,
  MotivoFalhaPersistenciaAgenda,
  ResultadoPersistenciaAgenda
} from '../repositories/agenda-repository.js';
import { pessoasDaAgenda } from '../repositories/pessoa-from-agenda.js';
import type { PessoaRepository } from '../repositories/pessoa-repository.js';
import type { LoginResult } from '../types/auth.js';
import type { StructuredLogger } from '../types/logger.js';
import {
  PIPELINE_STEPS,
  PipelineStepTracker,
  serializarErroObservabilidade
} from '../utils/pipeline-observability.js';

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
  /** Contagem de profissionais com sucesso. */
  sucessos: number;
  /** Contagem de profissionais com falha. */
  falhas: number;
  /** Duração total da sincronização multi-profissional (ms). */
  duracaoTotalMs: number;
  /** Agregado de motivos de falha (login/data/persistência) sem PII. */
  falhasPorMotivo: Record<string, number>;
}

export interface AgendaSyncServiceOptions {
  /**
   * Cliente do portal ou fábrica de clientes.
   * A fábrica recebe a entrada do profissional (para `perfilEsperado` etc.).
   */
  client:
    | AgendaSyncPortalClient
    | ((entrada: EntradaSincronizacaoProfissional) => AgendaSyncPortalClient);
  /** Destino operacional (Google Sheets) — comportamento inalterado. */
  agendaRepository: AgendaRepository;
  /**
   * Destino histórico paralelo (banco). Best-effort: falha nunca altera o resultado do Sheets.
   * Opcional: ausente = não persiste pessoas.
   */
  pessoaRepository?: PessoaRepository;
  logger?: StructuredLogger;
  parseAgendaHtml: AgendaSyncHtmlParser;
}

/**
 * Caso de uso de sincronização da agenda (Fase 006).
 * Passo 3: `sincronizarProfissional` e `sincronizarProfissionais` implementados.
 *
 * Após o parse, os objetos de domínio alimentam destinos independentes:
 * Sheets (`AgendaRepository`) e, em best-effort, banco (`PessoaRepository`).
 */
export class AgendaSyncService {
  private readonly agendaRepository: AgendaRepository;
  private readonly pessoaRepository: PessoaRepository | undefined;
  private readonly client:
    | AgendaSyncPortalClient
    | ((entrada: EntradaSincronizacaoProfissional) => AgendaSyncPortalClient);
  private readonly logger: StructuredLogger | undefined;
  private readonly parseAgendaHtml: AgendaSyncHtmlParser;

  public constructor(options: AgendaSyncServiceOptions) {
    this.client = options.client;
    this.parseAgendaHtml = options.parseAgendaHtml;
    this.agendaRepository = options.agendaRepository;
    this.pessoaRepository = options.pessoaRepository;
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
    const tracker = new PipelineStepTracker(this.logger, {
      identificadorSeguro: entrada.identificadorSeguro
    });

    try {
      this.logger?.warn(
        {
          event: 'agenda.sync.profissional.started',
          identificadorSeguro: entrada.identificadorSeguro,
          temUnidadeDesejadaPortal: entrada.unidadeDesejada !== undefined,
          unidadeOperacionalLength: entrada.unidadeOperacional.length,
          perfilEsperado: entrada.perfilEsperado
        },
        'Iniciando sincronização de profissional'
      );

      const loginResult = await client.login(entrada.cpf, entrada.password);
      resultado.loginStatus = loginResult.status;

      if (loginResult.status !== 'sucesso') {
        this.logger?.warn(
          {
            event: 'agenda.sync.profissional.login_failed',
            identificadorSeguro: entrada.identificadorSeguro,
            loginStatus: loginResult.status,
            lastSuccessfulPipelineStep: tracker.lastSuccessfulPipelineStep
          },
          'Login não confirmado; sincronização interrompida'
        );
        tracker.flowFailed('login_failed', { loginStatus: loginResult.status });
        return resultado;
      }

      this.logger?.warn(
        {
          event: 'agenda.pipeline.post_login.start',
          identificadorSeguro: entrada.identificadorSeguro
        },
        'Login confirmado; iniciando pipeline pós-login'
      );

      const perfilStartedAt = tracker.start(PIPELINE_STEPS.RESOLVE_PERFIL_POS_LOGIN);
      resultado.perfilId =
        loginResult.session.perfilId ?? client.obterPerfilPortal?.() ?? undefined;

      const perfilId = resultado.perfilId;
      if (perfilId === undefined) {
        tracker.fail(
          PIPELINE_STEPS.RESOLVE_PERFIL_POS_LOGIN,
          perfilStartedAt,
          new Error('Login ok sem perfil resolvido')
        );
        this.logger?.warn(
          {
            event: 'agenda.sync.profissional.perfil_ausente',
            identificadorSeguro: entrada.identificadorSeguro,
            lastSuccessfulPipelineStep: tracker.lastSuccessfulPipelineStep
          },
          'Login ok sem perfil resolvido; sincronização interrompida'
        );
        tracker.flowFailed('perfil_ausente');
        resultado.sucesso = false;
        return resultado;
      }
      tracker.complete(PIPELINE_STEPS.RESOLVE_PERFIL_POS_LOGIN, perfilStartedAt, {
        perfilId,
        itemCount: 1
      });

      let datasDisponiveis: string[];
      try {
        datasDisponiveis = await tracker.run(
          PIPELINE_STEPS.LIST_DATAS_AGENDAMENTO,
          () => client.listarDatasAgendamento(),
          {
            onSuccess: (datas) => ({
              itemCount: datas.length,
              datasDisponiveisCount: datas.length
            })
          }
        );
      } catch (error) {
        tracker.flowFailed('listar_datas', {
          error: serializarErroObservabilidade(error)
        });
        resultado.sucesso = false;
        return resultado;
      }

      const datasParaSincronizar = selecionarDatas(datasDisponiveis, entrada.datas);
      this.logger?.warn(
        {
          event: 'agenda.pipeline.datas.selected',
          identificadorSeguro: entrada.identificadorSeguro,
          datasDisponiveisCount: datasDisponiveis.length,
          datasParaSincronizarCount: datasParaSincronizar.length,
          filtroAplicado: entrada.datas !== undefined,
          lastSuccessfulPipelineStep: tracker.lastSuccessfulPipelineStep
        },
        'Datas de agendamento selecionadas para sincronização'
      );

      for (const dataConsulta of datasParaSincronizar) {
        const resultadoData = await this.sincronizarData(
          client,
          entrada,
          dataConsulta,
          perfilId,
          tracker
        );
        resultado.datas.push(resultadoData);
        if (!resultadoData.sucesso) {
          tracker.flowFailed('data_sync_failed', {
            dataConsulta,
            motivoFalhaExtracao: resultadoData.motivoFalhaExtracao,
            motivoFalhaPersistencia: resultadoData.motivoFalhaPersistencia
          });
        }
      }

      resultado.sucesso = resultado.datas.every((item) => item.sucesso);
      if (resultado.sucesso) {
        tracker.flowCompleted({
          datasSincronizadas: resultado.datas.length,
          perfilId
        });
      }
      return resultado;
    } finally {
      const logoutStartedAt = tracker.start(PIPELINE_STEPS.LOGOUT);
      try {
        await client.logout();
        resultado.logoutExecutado = true;
        tracker.complete(PIPELINE_STEPS.LOGOUT, logoutStartedAt, { itemCount: 0 });
        this.logger?.warn(
          {
            event: 'agenda.sync.profissional.logout_completed',
            identificadorSeguro: entrada.identificadorSeguro,
            lastSuccessfulPipelineStep: tracker.lastSuccessfulPipelineStep
          },
          'Logout da sincronização concluído'
        );
      } catch (error) {
        resultado.logoutExecutado = false;
        tracker.fail(PIPELINE_STEPS.LOGOUT, logoutStartedAt, error);
        this.logger?.warn(
          {
            event: 'agenda.sync.profissional.logout_failed',
            identificadorSeguro: entrada.identificadorSeguro,
            lastSuccessfulPipelineStep: tracker.lastSuccessfulPipelineStep,
            error: serializarErroObservabilidade(error)
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
    const iniciadoEm = Date.now();

    this.logger?.warn(
      { event: 'agenda.sync.profissionais.started', quantidade: entradas.length },
      'Iniciando sincronização multi-profissional'
    );

    for (const entrada of entradas) {
      const resultadoProfissional = await this.sincronizarProfissional(entrada);
      profissionais.push(resultadoProfissional);
    }

    const sucessoGeral = profissionais.every((item) => item.sucesso);
    const sucessos = profissionais.filter((item) => item.sucesso).length;
    const falhas = profissionais.length - sucessos;
    const duracaoTotalMs = Date.now() - iniciadoEm;
    const falhasPorMotivo = agregarFalhasPorMotivo(profissionais);

    this.logger?.warn(
      {
        event: 'agenda.sync.profissionais.completed',
        quantidade: profissionais.length,
        profissionaisProcessados: profissionais.length,
        sucessoGeral,
        sucessos,
        falhas,
        duracaoTotalMs,
        falhasPorMotivo
      },
      'Sincronização multi-profissional concluída'
    );

    return {
      profissionais,
      sucessoGeral,
      sucessos,
      falhas,
      duracaoTotalMs,
      falhasPorMotivo
    };
  }

  private resolveClient(entrada: EntradaSincronizacaoProfissional): AgendaSyncPortalClient {
    return typeof this.client === 'function' ? this.client(entrada) : this.client;
  }

  private async sincronizarData(
    client: AgendaSyncPortalClient,
    entrada: EntradaSincronizacaoProfissional,
    dataConsulta: string,
    perfilId: PerfilProfissionalId,
    tracker: PipelineStepTracker
  ): Promise<ResultadoSincronizacaoData> {
    this.logger?.warn(
      {
        event: 'agenda.sync.data.started',
        identificadorSeguro: entrada.identificadorSeguro,
        dataConsulta,
        perfilId,
        lastSuccessfulPipelineStep: tracker.lastSuccessfulPipelineStep
      },
      'Sincronização de data da agenda iniciada'
    );

    let html: string;
    try {
      html = await tracker.run(
        PIPELINE_STEPS.FETCH_AGENDA_HTML,
        () => client.obterHtmlAgenda({ data: dataConsulta, dataReferencia: dataConsulta }),
        {
          onStart: { dataConsulta },
          onSuccess: (documento) => ({
            dataConsulta,
            itemCount: 1,
            htmlBytes: Buffer.byteLength(documento, 'latin1')
          })
        }
      );
    } catch (error) {
      this.logFalhaData(entrada.identificadorSeguro, dataConsulta, 'obter_html', error, tracker);
      return { dataConsulta, sucesso: false, motivoFalhaExtracao: 'estrutura-invalida' };
    }

    let extracao: ResultadoExtracaoAgenda;
    const parseStartedAt = tracker.start(PIPELINE_STEPS.PARSE_AGENDA_HTML, {
      dataConsulta,
      htmlBytes: Buffer.byteLength(html, 'latin1')
    });
    try {
      extracao = this.parseAgendaHtml(html, { dataConsulta });
    } catch (error) {
      tracker.fail(PIPELINE_STEPS.PARSE_AGENDA_HTML, parseStartedAt, error, { dataConsulta });
      this.logFalhaData(entrada.identificadorSeguro, dataConsulta, 'parse', error, tracker);
      return { dataConsulta, sucesso: false, motivoFalhaExtracao: 'estrutura-invalida' };
    }

    if (!extracao.sucesso || extracao.agenda === undefined) {
      tracker.fail(
        PIPELINE_STEPS.PARSE_AGENDA_HTML,
        parseStartedAt,
        new Error(extracao.motivoFalha ?? 'estrutura-invalida'),
        {
          dataConsulta,
          motivoFalhaExtracao: extracao.motivoFalha ?? 'estrutura-invalida',
          itemCount: 0
        }
      );
      this.logger?.warn(
        {
          event: 'agenda.sync.data.failed',
          identificadorSeguro: entrada.identificadorSeguro,
          dataConsulta,
          etapa: 'parse',
          motivoFalhaExtracao: extracao.motivoFalha ?? 'estrutura-invalida',
          lastSuccessfulPipelineStep: tracker.lastSuccessfulPipelineStep
        },
        'Extração da agenda sem sucesso estrutural'
      );
      return {
        dataConsulta,
        sucesso: false,
        motivoFalhaExtracao: extracao.motivoFalha ?? 'estrutura-invalida'
      };
    }

    tracker.complete(PIPELINE_STEPS.PARSE_AGENDA_HTML, parseStartedAt, {
      dataConsulta,
      itemCount: extracao.agenda.itens.length
    });

    const transformStartedAt = tracker.start(PIPELINE_STEPS.TRANSFORM_AGENDA_DATA, {
      dataConsulta,
      itensBrutos: extracao.agenda.itens.length
    });
    const agenda = {
      ...extracao.agenda,
      dataConsulta: extracao.agenda.dataConsulta ?? dataConsulta
    };
    tracker.complete(PIPELINE_STEPS.TRANSFORM_AGENDA_DATA, transformStartedAt, {
      dataConsulta,
      itemCount: agenda.itens.length
    });

    let persistencia: ResultadoPersistenciaAgenda;
    const persistStartedAt = tracker.start(PIPELINE_STEPS.PERSIST_AGENDA, {
      dataConsulta,
      itemCount: agenda.itens.length
    });
    try {
      persistencia = await this.agendaRepository.salvarAgenda(agenda, {
        profissional: entrada.profissional,
        perfilId,
        unidadeOperacional: entrada.unidadeOperacional
      });
    } catch (error) {
      tracker.fail(PIPELINE_STEPS.PERSIST_AGENDA, persistStartedAt, error, { dataConsulta });
      this.logFalhaData(entrada.identificadorSeguro, dataConsulta, 'persistencia', error, tracker);
      await this.persistirPessoasBestEffort(agenda, entrada.identificadorSeguro, dataConsulta);
      return {
        dataConsulta,
        itensExtraidos: agenda.itens.length,
        sucesso: false,
        motivoFalhaPersistencia: 'erro-infraestrutura'
      };
    }

    // Destino histórico paralelo: após Sheets, nunca altera sucesso/falha operacional.
    await this.persistirPessoasBestEffort(agenda, entrada.identificadorSeguro, dataConsulta);

    if (!persistencia.sucesso) {
      tracker.fail(
        PIPELINE_STEPS.PERSIST_AGENDA,
        persistStartedAt,
        new Error(persistencia.motivoFalha ?? 'erro-infraestrutura'),
        {
          dataConsulta,
          motivoFalhaPersistencia: persistencia.motivoFalha ?? 'erro-infraestrutura',
          linhasGravadas: persistencia.linhasGravadas,
          linhasRemovidas: persistencia.linhasRemovidas
        }
      );
      this.logger?.warn(
        {
          event: 'agenda.sync.data.failed',
          identificadorSeguro: entrada.identificadorSeguro,
          dataConsulta,
          etapa: 'persistencia',
          motivoFalhaPersistencia: persistencia.motivoFalha ?? 'erro-infraestrutura',
          lastSuccessfulPipelineStep: tracker.lastSuccessfulPipelineStep,
          linhasGravadas: persistencia.linhasGravadas,
          linhasRemovidas: persistencia.linhasRemovidas
        },
        'Persistência da agenda sem sucesso'
      );
      return {
        dataConsulta,
        itensExtraidos: agenda.itens.length,
        linhasGravadas: persistencia.linhasGravadas,
        linhasRemovidas: persistencia.linhasRemovidas,
        motivoFalhaPersistencia: persistencia.motivoFalha ?? 'erro-infraestrutura',
        sucesso: false
      };
    }

    tracker.complete(PIPELINE_STEPS.PERSIST_AGENDA, persistStartedAt, {
      dataConsulta,
      itemCount: agenda.itens.length,
      linhasGravadas: persistencia.linhasGravadas,
      linhasRemovidas: persistencia.linhasRemovidas
    });

    this.logger?.warn(
      {
        event: 'agenda.sync.data.completed',
        identificadorSeguro: entrada.identificadorSeguro,
        dataConsulta,
        itensExtraidos: agenda.itens.length,
        linhasGravadas: persistencia.linhasGravadas,
        linhasRemovidas: persistencia.linhasRemovidas,
        lastSuccessfulPipelineStep: tracker.lastSuccessfulPipelineStep
      },
      'Sincronização de data da agenda concluída'
    );

    return {
      dataConsulta,
      itensExtraidos: agenda.itens.length,
      linhasGravadas: persistencia.linhasGravadas,
      linhasRemovidas: persistencia.linhasRemovidas,
      sucesso: true
    };
  }

  /**
   * Grava pessoas no banco sem afetar o resultado operacional do Sheets.
   * Qualquer erro é apenas registrado.
   */
  private async persistirPessoasBestEffort(
    agenda: Agenda,
    identificadorSeguro: string,
    dataConsulta: string
  ): Promise<void> {
    if (this.pessoaRepository === undefined) {
      return;
    }

    const pessoas = pessoasDaAgenda(agenda);
    if (pessoas.length === 0) {
      return;
    }

    try {
      const resultado = await this.pessoaRepository.upsertMuitos(pessoas);
      this.logger?.warn(
        {
          event: 'pessoas.upsert.ok',
          identificadorSeguro,
          dataConsulta,
          inseridas: resultado.inseridas,
          atualizadas: resultado.atualizadas,
          ignoradas: resultado.ignoradas
        },
        'Upsert de pessoas no banco concluído (best-effort)'
      );
    } catch (error) {
      this.logger?.warn(
        {
          event: 'pessoas.upsert.failed',
          identificadorSeguro,
          dataConsulta,
          error: serializarErroObservabilidade(error)
        },
        'Falha ao persistir pessoas no banco; sync Sheets permanece válida'
      );
    }
  }

  private logFalhaData(
    identificadorSeguro: string,
    dataConsulta: string,
    etapa: 'obter_html' | 'parse' | 'persistencia',
    error: unknown,
    tracker: PipelineStepTracker
  ): void {
    this.logger?.warn(
      {
        event: 'agenda.sync.data.failed',
        identificadorSeguro,
        dataConsulta,
        etapa,
        lastSuccessfulPipelineStep: tracker.lastSuccessfulPipelineStep,
        error: serializarErroObservabilidade(error)
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

/** Agrega motivos de falha por profissional/data sem PII. */
export function agregarFalhasPorMotivo(
  profissionais: ResultadoSincronizacaoProfissional[]
): Record<string, number> {
  const contagem: Record<string, number> = {};
  const incrementar = (motivo: string): void => {
    contagem[motivo] = (contagem[motivo] ?? 0) + 1;
  };

  for (const profissional of profissionais) {
    if (profissional.sucesso) {
      continue;
    }
    if (profissional.loginStatus !== undefined && profissional.loginStatus !== 'sucesso') {
      incrementar(`login:${profissional.loginStatus}`);
      continue;
    }
    if (profissional.perfilId === undefined && profissional.loginStatus === 'sucesso') {
      incrementar('perfil_ausente');
      continue;
    }
    const falhasData = profissional.datas.filter((data) => !data.sucesso);
    if (falhasData.length === 0) {
      incrementar('profissional_falha_nao_classificada');
      continue;
    }
    for (const data of falhasData) {
      if (data.motivoFalhaPersistencia !== undefined) {
        incrementar(`persistencia:${data.motivoFalhaPersistencia}`);
      } else if (data.motivoFalhaExtracao !== undefined) {
        incrementar(`extracao:${data.motivoFalhaExtracao}`);
      } else {
        incrementar('data_falha_nao_classificada');
      }
    }
  }

  return contagem;
}
