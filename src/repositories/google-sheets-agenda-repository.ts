import type { Agenda, ItemAgenda, Paciente } from '../models/agenda.js';
import type { GoogleSheetsValuesPort } from '../client/google-sheets-client.js';
import { agendaOperacionalPolicy } from '../domain/agenda-operacional-policy.js';
import type { StructuredLogger } from '../types/logger.js';
import { normalizeCpfKey } from '../utils/cpf.js';
import { normalizeEmail } from '../utils/email.js';
import { formatPatientName } from '../utils/format-patient-name.js';
import { formatProfessionalDisplayName } from '../utils/format-professional-display-name.js';
import { normalizePhone } from '../utils/phone.js';
import { mascararCpf } from '../utils/cpf-mask.js';
import {
  PIPELINE_STEPS,
  serializarErroObservabilidade
} from '../utils/pipeline-observability.js';
import { formatSyncTimestamp } from '../utils/sync-timestamp.js';

import type {
  AgendaRepository,
  ContextoPersistenciaAgenda,
  MotivoFalhaPersistenciaAgenda,
  ResultadoPersistenciaAgenda
} from './agenda-repository.js';
import {
  CABECALHO_DATA_AGENDAMENTO_LEGADO,
  CABECALHO_DATA_INCLUSAO_LEGADO,
  CABECALHOS_ABA_AGENDA,
  CABECALHOS_ABA_AGENDA_LEGADO,
  CABECALHOS_ABA_AGENDA_OFICIAL_V8,
  FAIXA_COLUNAS_LEITURA_ABA_AGENDA,
  INDICE_COLUNA_TECNICA_CPF,
  indiceCabecalhoAgenda,
  NOME_ABA_AGENDA_PADRAO,
  normalizeTextoCabecalho,
  resolverIndiceColunaTecnicaCpf,
  ULTIMA_COLUNA_PERSISTENCIA_ABA_AGENDA
} from './agenda-sheet-headers.js';
import { AgendaSheetMapper, type LinhaAgendaPersistida } from './agenda-sheet-mapper.js';

/** Divergência pontual entre cabeçalho encontrado e uma variante esperada. */
export interface DivergenciaCabecalhoAgenda {
  /** Índice 0-based da primeira coluna divergente (ou faltante). */
  indice: number;
  esperado: string;
  encontrado: string;
}

export interface GoogleSheetsAgendaRepositoryOptions {
  mapper?: AgendaSheetMapper;
  sheetName?: string;
  sheets: GoogleSheetsValuesPort;
  /**
   * Instante de referência do “hoje” (fuso America/Sao_Paulo).
   * Destinado a testes; em produção usa `new Date()`.
   */
  agora?: Date;
  /** Logger opcional para diagnóstico de cabeçalho incompatível (sem PII). */
  logger?: StructuredLogger;
}

/** Resultado do backfill de projeção visual (sem portal / sem policy). */
export interface ResultadoBackfillProjecaoAgenda {
  linhasLidas: number;
  linhasReescritas: number;
  motivoFalha?: MotivoFalhaPersistenciaAgenda;
  sucesso: boolean;
}

/**
 * Persistência da agenda em Google Sheets.
 * Cadastro de pacientes ativos (B004/B005): `AgendaOperacionalPolicy`
 * (hoje ou futuro no calendário SP); chave CPF normalizado.
 * A projeção operacional (`CABECALHOS_ABA_AGENDA`) não exibe CPF.
 */
export class GoogleSheetsAgendaRepository implements AgendaRepository {
  private readonly mapper: AgendaSheetMapper;
  private readonly sheetName: string;
  private readonly sheets: GoogleSheetsValuesPort;
  private readonly agora: Date | undefined;
  private readonly logger: StructuredLogger | undefined;

  public constructor(options: GoogleSheetsAgendaRepositoryOptions) {
    this.sheets = options.sheets;
    this.mapper = options.mapper ?? new AgendaSheetMapper();
    this.sheetName = options.sheetName?.trim() || NOME_ABA_AGENDA_PADRAO;
    this.agora = options.agora;
    this.logger = options.logger;
  }

  public async salvarAgenda(
    agenda: Agenda,
    contexto: ContextoPersistenciaAgenda
  ): Promise<ResultadoPersistenciaAgenda> {
    const profissional = contexto.profissional?.trim() ?? '';
    if (profissional.length === 0) {
      return { sucesso: false, motivoFalha: 'contexto-incompleto' };
    }

    const unidadeOperacional = contexto.unidadeOperacional?.trim() ?? '';
    if (unidadeOperacional.length === 0) {
      return { sucesso: false, motivoFalha: 'contexto-incompleto' };
    }

    const dataConsulta = agenda.dataConsulta?.trim() ?? '';
    if (dataConsulta.length === 0) {
      return { sucesso: false, motivoFalha: 'data-consulta-ausente' };
    }

    const profissionalExibicao = formatProfessionalDisplayName(
      profissional,
      contexto.perfilId
    );

    const salvarStartedAt = Date.now();
    this.logger?.warn(
      {
        event: 'agenda.sheets.salvar.started',
        pipelineStep: PIPELINE_STEPS.PERSIST_AGENDA,
        sheetName: this.sheetName,
        dataConsulta,
        itemCount: agenda.itens.length,
        perfilId: contexto.perfilId
      },
      'Persistência da agenda no Google Sheets iniciada'
    );

    try {
      const referencia = this.agora ?? new Date();

      const lerStartedAt = Date.now();
      this.logger?.warn(
        {
          event: 'agenda.pipeline.step.start',
          pipelineStep: PIPELINE_STEPS.SHEETS_LER_MATRIZ,
          sheetName: this.sheetName,
          dataConsulta
        },
        'Etapa do pipeline pós-login iniciada'
      );
      const matriz = await this.lerMatriz();
      this.logger?.warn(
        {
          event: 'agenda.pipeline.step.completed',
          pipelineStep: PIPELINE_STEPS.SHEETS_LER_MATRIZ,
          durationMs: Date.now() - lerStartedAt,
          sheetName: this.sheetName,
          dataConsulta,
          itemCount: matriz.length,
          rowCount: matriz.length,
          columnCount: matriz[0]?.length ?? 0
        },
        'Etapa do pipeline pós-login concluída'
      );

      const cabecalhoAtual = matriz[0];
      const corpo = matriz.length > 0 ? matriz.slice(1) : [];

      if (cabecalhoAtual !== undefined && !this.cabecalhoCompativel(cabecalhoAtual)) {
        this.registrarCabecalhoIncompativel(cabecalhoAtual);
        this.logger?.warn(
          {
            event: 'agenda.sheets.salvar.failed',
            pipelineStep: PIPELINE_STEPS.PERSIST_AGENDA,
            durationMs: Date.now() - salvarStartedAt,
            motivoFalha: 'cabecalho-incompativel',
            dataConsulta,
            itemCount: agenda.itens.length
          },
          'Persistência interrompida por cabeçalho incompatível'
        );
        return { sucesso: false, motivoFalha: 'cabecalho-incompativel' };
      }

      const transformStartedAt = Date.now();
      this.logger?.warn(
        {
          event: 'agenda.pipeline.step.start',
          pipelineStep: PIPELINE_STEPS.SHEETS_TRANSFORMAR,
          dataConsulta,
          registrosExistentesCount: corpo.length,
          itensAgendaCount: agenda.itens.length
        },
        'Etapa do pipeline pós-login iniciada'
      );

      const cabecalho = this.mapper.cabecalho();
      const registrosExistentes =
        cabecalhoAtual === undefined
          ? []
          : this.hidratarCpfTecnico(
              this.mapper.linhasParaRegistros(corpo, cabecalhoAtual),
              corpo,
              cabecalhoAtual
            );

      const ativos: LinhaAgendaPersistida[] = [];
      let linhasRemovidas = 0;
      for (const registro of registrosExistentes) {
        if (
          agendaOperacionalPolicy.devePermanecerNaAgendaOperacional(
            registro.dataConsulta,
            referencia
          )
        ) {
          ativos.push(registro);
        } else {
          linhasRemovidas += 1;
        }
      }

      const cpfsAtivos = new Set<string>();
      for (const registro of ativos) {
        const chave = normalizeCpfKey(registro.item.paciente.cpf ?? '');
        if (chave !== undefined) {
          cpfsAtivos.add(chave);
        }
      }

      // Diagnóstico: dessincronização possível entre corpo[] e registros[] após skips no mapper.
      const linhasCorpoIgnoradasEstimate = Math.max(0, corpo.length - registrosExistentes.length);
      const registrosComCpf = registrosExistentes.filter(
        (registro) => normalizeCpfKey(registro.item.paciente.cpf ?? '') !== undefined
      ).length;
      this.logger?.warn(
        {
          event: 'agenda.sheets.classificacao.resumo_pre',
          dataConsulta,
          corpoLinhasCount: corpo.length,
          registrosExistentesCount: registrosExistentes.length,
          linhasCorpoIgnoradasEstimate,
          possivelDessincronizacaoIndiceCpf: linhasCorpoIgnoradasEstimate > 0,
          registrosComCpfCount: registrosComCpf,
          registrosSemCpfCount: registrosExistentes.length - registrosComCpf,
          ativosCount: ativos.length,
          cpfsAtivosCount: cpfsAtivos.size,
          linhasRemovidasCount: linhasRemovidas,
          itensAgendaPortalCount: agenda.itens.length
        },
        'Resumo pré-classificação de linhas novas vs existentes'
      );

      // --- Diagnóstico temporário (merge Tipo/Categoria) — procurar no Railway por este event ---
      const portalComTipoProcesso = agenda.itens.filter(
        (item) => (item.tipoProcesso?.trim() ?? '').length > 0
      ).length;
      const portalComCategoria = agenda.itens.filter(
        (item) => (item.categoria?.trim() ?? '').length > 0
      ).length;
      this.logger?.warn(
        {
          event: 'agenda.sheets.diag.merge.portal_campos',
          diagnosticoTemporario: true,
          dataConsulta,
          itensPortalCount: agenda.itens.length,
          itensPortalComTipoProcesso: portalComTipoProcesso,
          itensPortalComCategoria: portalComCategoria,
          cpfsAtivosNaPlanilha: cpfsAtivos.size,
          ativosCount: ativos.length
        },
        'DIAG merge: campos tipo/categoria no ItemAgenda do portal'
      );

      const indiceAtivoPorCpf = new Map<string, number>();
      for (let indice = 0; indice < ativos.length; indice += 1) {
        const registro = ativos[indice];
        if (registro === undefined) {
          continue;
        }
        const chave = normalizeCpfKey(registro.item.paciente.cpf ?? '');
        if (chave !== undefined && !indiceAtivoPorCpf.has(chave)) {
          indiceAtivoPorCpf.set(chave, indice);
        }
      }

      const dataInclusao = formatSyncTimestamp(referencia);
      const novasLinhas: string[][] = [];
      let linhasAtivasAtualizadasDoPortal = 0;
      let mergesInvocados = 0;
      let mergesComAlteracao = 0;
      let mergesSemAlteracao = 0;
      let portalItensComCpfAtivo = 0;
      let portalItensNovos = 0;

      const portalIncluivel =
        agendaOperacionalPolicy.deveIncluirAgendamentoDoPortalNaAgendaOperacional(
          dataConsulta,
          referencia
        );

      if (!portalIncluivel) {
        this.logger?.warn(
          {
            event: 'agenda.sheets.diag.merge.portal_fora_da_policy',
            diagnosticoTemporario: true,
            dataConsulta,
            itensPortalCount: agenda.itens.length,
            itensPortalComTipoProcesso: portalComTipoProcesso,
            itensPortalComCategoria: portalComCategoria,
            motivo: 'dataConsulta_nao_incluivel_hoje_ou_futuro'
          },
          'DIAG merge: portal NÃO processado (policy bloqueou a data) — merge e novas linhas omitidos'
        );
      }

      if (portalIncluivel) {
        for (const item of agenda.itens) {
          const cpfOriginalPortal = item.paciente.cpf?.trim() ?? '';
          const chave = normalizeCpfKey(cpfOriginalPortal);
          const indiceAtivo =
            chave !== undefined ? indiceAtivoPorCpf.get(chave) : undefined;

          // CPF já ativo: merge do estado do portal na linha existente (sem nova inclusão).
          if (indiceAtivo !== undefined) {
            portalItensComCpfAtivo += 1;
            const registroAtual = ativos[indiceAtivo];
            if (registroAtual === undefined) {
              continue;
            }
            mergesInvocados += 1;
            const mesclado = mesclarItemPortalEmRegistroAtivo(registroAtual, item);
            if (mesclado.alterouProjecao) {
              ativos[indiceAtivo] = mesclado.registro;
              linhasAtivasAtualizadasDoPortal += 1;
              mergesComAlteracao += 1;
              this.logger?.warn(
                {
                  event: 'agenda.sheets.classificacao.linha_ativa_atualizada',
                  dataConsulta,
                  cpfMascarado: mascararCpf(cpfOriginalPortal),
                  camposAtualizados: mesclado.camposAtualizados
                },
                'Registro ativo atualizado com campos do portal'
              );
            } else {
              mergesSemAlteracao += 1;
            }
            continue;
          }

          const existiaEmCpfsAtivos = chave !== undefined && cpfsAtivos.has(chave);
          if (existiaEmCpfsAtivos) {
            continue;
          }

          portalItensNovos += 1;

          const registroExistenteMesmoCpf =
            chave === undefined
              ? undefined
              : registrosExistentes.find(
                  (registro) => normalizeCpfKey(registro.item.paciente.cpf ?? '') === chave
                );
          const existiaEmRegistrosExistentes = registroExistenteMesmoCpf !== undefined;
          const motivo = classificarMotivoLinhaNova({
            chaveDefinida: chave !== undefined,
            existiaEmCpfsAtivos,
            existiaEmRegistrosExistentes,
            registroExistenteAtivo:
              registroExistenteMesmoCpf !== undefined &&
              agendaOperacionalPolicy.pacientePermaneceAtivoNaAgendaOperacional(
                registroExistenteMesmoCpf.dataConsulta,
                referencia
              )
          });

          this.logger?.warn(
            {
              event: 'agenda.sheets.classificacao.linha_nova',
              dataConsulta,
              cpfMascarado: mascararCpf(cpfOriginalPortal),
              cpfNormalizadoDigits: chave?.length ?? 0,
              cpfNormalizadoPresente: chave !== undefined,
              nomePaciente: item.paciente.nome ?? '',
              existiaEmCpfsAtivos,
              existiaEmRegistrosExistentes,
              dataInclusaoExistente: registroExistenteMesmoCpf?.dataInclusao,
              dataInclusaoNova: dataInclusao,
              motivo
            },
            'Paciente classificado como linha nova na planilha'
          );

          const linha = this.projetarLinhaComCpfTecnico(
            item,
            dataConsulta,
            profissional,
            unidadeOperacional,
            dataInclusao,
            contexto.perfilId
          );
          if (linha === undefined) {
            continue;
          }

          novasLinhas.push(linha);
          if (chave !== undefined) {
            cpfsAtivos.add(chave);
          }
        }
      }

      const ativosComTipoAposMerge = ativos.filter(
        (registro) => (registro.item.tipoProcesso?.trim() ?? '').length > 0
      ).length;
      const ativosComCategoriaAposMerge = ativos.filter(
        (registro) => (registro.item.categoria?.trim() ?? '').length > 0
      ).length;

      this.logger?.warn(
        {
          event: 'agenda.sheets.diag.merge.pos_merge',
          diagnosticoTemporario: true,
          dataConsulta,
          portalIncluivel,
          itensPortalCount: agenda.itens.length,
          itensPortalComTipoProcesso: portalComTipoProcesso,
          itensPortalComCategoria: portalComCategoria,
          cpfsAtivosNaPlanilha: cpfsAtivos.size,
          portalItensComCpfAtivo,
          portalItensNovos,
          mergesInvocados,
          mergesComAlteracao,
          mergesSemAlteracao,
          linhasAtivasAtualizadasDoPortal,
          ativosCount: ativos.length,
          ativosComTipoProcessoAposMerge: ativosComTipoAposMerge,
          ativosComCategoriaAposMerge: ativosComCategoriaAposMerge
        },
        'DIAG merge: contadores após processar portal vs ativos'
      );

      const linhasAtivas: string[][] = [];
      let amostraItemAntesProjecaoRegistrada = false;
      for (const registro of ativos) {
        if (!amostraItemAntesProjecaoRegistrada) {
          amostraItemAntesProjecaoRegistrada = true;
          this.logger?.warn(
            {
              event: 'agenda.sheets.diag.merge.amostra_item_antes_projecao',
              diagnosticoTemporario: true,
              dataConsulta,
              pacienteNome: registro.item.paciente.nome ?? '',
              cpfMascarado: mascararCpf(registro.item.paciente.cpf ?? ''),
              tipoProcesso: registro.item.tipoProcesso ?? null,
              categoria: registro.item.categoria ?? null,
              horario: registro.item.horario ?? null,
              dataConsultaLinha: registro.dataConsulta,
              dataInclusao: registro.dataInclusao ?? null
            },
            'DIAG merge: amostra ItemAgenda imediatamente antes de projetarLinhaComCpfTecnico (1º ativo)'
          );
        }

        const unidadePreservada = registro.unidadeOperacional?.trim() ?? '';
        const mesmoProfissional =
          registro.profissional === profissional ||
          registro.profissional === profissionalExibicao;
        const unidadeLinha =
          unidadePreservada.length > 0
            ? unidadePreservada
            : mesmoProfissional
              ? unidadeOperacional
              : '';
        // Regravação: não reformata PROFISSIONAL (valor já projetado na planilha).
        const linha = this.projetarLinhaComCpfTecnico(
          registro.item,
          registro.dataConsulta,
          registro.profissional,
          unidadeLinha,
          registro.dataInclusao ?? ''
        );
        if (linha !== undefined) {
          linhasAtivas.push(linha);
        }
      }

      // Preferir amostra com tipo/categoria preenchidos, se existir entre os ativos.
      const amostraComCampos = ativos.find(
        (registro) =>
          (registro.item.tipoProcesso?.trim() ?? '').length > 0 ||
          (registro.item.categoria?.trim() ?? '').length > 0
      );
      if (amostraComCampos !== undefined) {
        this.logger?.warn(
          {
            event: 'agenda.sheets.diag.merge.amostra_item_com_tipo_ou_categoria',
            diagnosticoTemporario: true,
            dataConsulta,
            pacienteNome: amostraComCampos.item.paciente.nome ?? '',
            cpfMascarado: mascararCpf(amostraComCampos.item.paciente.cpf ?? ''),
            tipoProcesso: amostraComCampos.item.tipoProcesso ?? null,
            categoria: amostraComCampos.item.categoria ?? null
          },
          'DIAG merge: existe ao menos um ativo com tipo/categoria após merge'
        );
      } else {
        this.logger?.warn(
          {
            event: 'agenda.sheets.diag.merge.nenhum_ativo_com_tipo_ou_categoria',
            diagnosticoTemporario: true,
            dataConsulta,
            ativosCount: ativos.length,
            mergesInvocados,
            itensPortalComTipoProcesso: portalComTipoProcesso
          },
          'DIAG merge: NENHUM ativo ficou com tipoProcesso/categoria após merge'
        );
      }

      this.logger?.warn(
        {
          event: 'agenda.sheets.classificacao.resumo_pos',
          dataConsulta,
          registrosExistentesCount: registrosExistentes.length,
          ativosCount: ativos.length,
          cpfsAtivosCount: cpfsAtivos.size,
          novasLinhasCount: novasLinhas.length,
          linhasAtivasCount: linhasAtivas.length,
          linhasAtivasAtualizadasDoPortal,
          mergesInvocados,
          mergesComAlteracao,
          mergesSemAlteracao,
          linhasRemovidasCount: linhasRemovidas,
          possivelDessincronizacaoIndiceCpf: linhasCorpoIgnoradasEstimate > 0
        },
        'Resumo pós-classificação de linhas novas vs existentes'
      );
      this.logger?.warn(
        {
          event: 'agenda.pipeline.step.completed',
          pipelineStep: PIPELINE_STEPS.SHEETS_TRANSFORMAR,
          durationMs: Date.now() - transformStartedAt,
          dataConsulta,
          itemCount: novasLinhas.length,
          linhasAtivasCount: linhasAtivas.length,
          linhasNovasCount: novasLinhas.length,
          linhasAtivasAtualizadasDoPortal,
          linhasRemovidasCount: linhasRemovidas,
          registrosExistentesCount: registrosExistentes.length
        },
        'Etapa do pipeline pós-login concluída'
      );

      const valoresFinais = [cabecalho, ...linhasAtivas, ...novasLinhas];

      const cabecalhoJaOficial =
        cabecalhoAtual !== undefined &&
        this.cabecalhosIguais(cabecalhoAtual, CABECALHOS_ABA_AGENDA);

      // Sem mudança efetiva e layout já canônico: evita writes desnecessários.
      if (
        novasLinhas.length === 0 &&
        linhasRemovidas === 0 &&
        linhasAtivasAtualizadasDoPortal === 0 &&
        cabecalhoJaOficial
      ) {
        this.logger?.warn(
          {
            event: 'agenda.sheets.salvar.skipped_noop',
            pipelineStep: PIPELINE_STEPS.PERSIST_AGENDA,
            durationMs: Date.now() - salvarStartedAt,
            dataConsulta,
            itemCount: agenda.itens.length,
            rowCountExistente: matriz.length,
            diagnosticoTemporario: true,
            itensPortalComTipoProcesso: portalComTipoProcesso,
            itensPortalComCategoria: portalComCategoria,
            mergesInvocados,
            mergesComAlteracao,
            mergesSemAlteracao,
            portalItensComCpfAtivo,
            ativosComTipoProcessoAposMerge: ativosComTipoAposMerge,
            ativosComCategoriaAposMerge: ativosComCategoriaAposMerge
          },
          'Persistência Sheets omitida: nenhuma linha nova, remoção nem atualização de ativos'
        );
        this.logger?.warn(
          {
            event: 'agenda.sheets.salvar.completed',
            pipelineStep: PIPELINE_STEPS.PERSIST_AGENDA,
            durationMs: Date.now() - salvarStartedAt,
            dataConsulta,
            itemCount: agenda.itens.length,
            linhasGravadas: 0,
            linhasRemovidas: 0,
            skippedNoop: true
          },
          'Persistência da agenda no Google Sheets concluída'
        );
        return {
          sucesso: true,
          linhasGravadas: 0,
          linhasRemovidas: 0
        };
      }

      const reescreverStartedAt = Date.now();
      const amostraLinhaEscrita =
        linhasAtivas.find(
          (linha) =>
            (linha[indiceCabecalhoAgenda('Tipo de Processo')] ?? '').trim().length > 0 ||
            (linha[indiceCabecalhoAgenda('Categoria')] ?? '').trim().length > 0
        ) ??
        linhasAtivas[0] ??
        novasLinhas[0];
      if (amostraLinhaEscrita !== undefined) {
        this.logger?.warn(
          {
            event: 'agenda.sheets.diag.merge.amostra_linha_antes_updateValues',
            diagnosticoTemporario: true,
            dataConsulta,
            pacienteNome: amostraLinhaEscrita[indiceCabecalhoAgenda('PACIENTE')] ?? '',
            cpfMascarado: mascararCpf(
              amostraLinhaEscrita[INDICE_COLUNA_TECNICA_CPF] ?? ''
            ),
            tipoProcesso:
              amostraLinhaEscrita[indiceCabecalhoAgenda('Tipo de Processo')] ?? '',
            categoria: amostraLinhaEscrita[indiceCabecalhoAgenda('Categoria')] ?? '',
            horario: amostraLinhaEscrita[indiceCabecalhoAgenda('HORÁRIO')] ?? '',
            dataAgendamento:
              amostraLinhaEscrita[indiceCabecalhoAgenda('AGENDAMENTO DO DETRAN')] ?? '',
            dataInclusao:
              amostraLinhaEscrita[indiceCabecalhoAgenda('DATA DE INCLUSÃO')] ?? '',
            columnCount: amostraLinhaEscrita.length,
            valoresFinaisRowCount: valoresFinais.length
          },
          'DIAG merge: amostra de linha imediatamente antes de updateValues'
        );
      } else {
        this.logger?.warn(
          {
            event: 'agenda.sheets.diag.merge.sem_linha_para_updateValues',
            diagnosticoTemporario: true,
            dataConsulta,
            valoresFinaisRowCount: valoresFinais.length
          },
          'DIAG merge: nenhuma linha de dados a enviar ao updateValues'
        );
      }
      this.logger?.warn(
        {
          event: 'agenda.pipeline.step.start',
          pipelineStep: PIPELINE_STEPS.SHEETS_REESCREVER,
          dataConsulta,
          itemCount: valoresFinais.length,
          rowCount: valoresFinais.length,
          previousRowCount: matriz.length
        },
        'Etapa do pipeline pós-login iniciada'
      );
      await this.reescreverAba(valoresFinais, matriz.length);
      this.logger?.warn(
        {
          event: 'agenda.pipeline.step.completed',
          pipelineStep: PIPELINE_STEPS.SHEETS_REESCREVER,
          durationMs: Date.now() - reescreverStartedAt,
          dataConsulta,
          itemCount: valoresFinais.length,
          rowCount: valoresFinais.length,
          linhasGravadas: novasLinhas.length,
          linhasRemovidas
        },
        'Etapa do pipeline pós-login concluída'
      );

      this.logger?.warn(
        {
          event: 'agenda.sheets.salvar.completed',
          pipelineStep: PIPELINE_STEPS.PERSIST_AGENDA,
          durationMs: Date.now() - salvarStartedAt,
          dataConsulta,
          itemCount: agenda.itens.length,
          linhasGravadas: novasLinhas.length,
          linhasRemovidas
        },
        'Persistência da agenda no Google Sheets concluída'
      );

      return {
        sucesso: true,
        linhasGravadas: novasLinhas.length,
        linhasRemovidas
      };
    } catch (error) {
      this.logger?.error(
        {
          event: 'agenda.sheets.salvar.failed',
          pipelineStep: PIPELINE_STEPS.PERSIST_AGENDA,
          durationMs: Date.now() - salvarStartedAt,
          dataConsulta,
          itemCount: agenda.itens.length,
          motivoFalha: 'erro-infraestrutura',
          error: serializarErroObservabilidade(error)
        },
        'Falha de infraestrutura na persistência Google Sheets'
      );
      return { sucesso: false, motivoFalha: 'erro-infraestrutura' };
    }
  }

  /**
   * Reescreve a aba Agenda aplicando só a projeção visual atual do mapper
   * (`itemParaLinha` via `agendaParaLinhas`: placeholders, normalizações).
   *
   * Não consulta o portal, não aplica policy de remoção, não faz merge e
   * **ignora** o noop de `salvarAgenda` — sempre chama `updateValues`.
   */
  public async reescreverProjecaoVisual(): Promise<ResultadoBackfillProjecaoAgenda> {
    const startedAt = Date.now();
    this.logger?.warn(
      {
        event: 'agenda.sheets.backfill_projecao.started',
        sheetName: this.sheetName
      },
      'Backfill de projeção visual da Agenda iniciado'
    );

    try {
      const matriz = await this.lerMatriz();
      const cabecalhoAtual = matriz[0];
      const corpo = matriz.length > 0 ? matriz.slice(1) : [];

      if (cabecalhoAtual !== undefined && !this.cabecalhoCompativel(cabecalhoAtual)) {
        this.registrarCabecalhoIncompativel(cabecalhoAtual);
        this.logger?.warn(
          {
            event: 'agenda.sheets.backfill_projecao.failed',
            durationMs: Date.now() - startedAt,
            motivoFalha: 'cabecalho-incompativel',
            rowCount: matriz.length
          },
          'Backfill interrompido por cabeçalho incompatível'
        );
        return {
          sucesso: false,
          linhasLidas: corpo.length,
          linhasReescritas: 0,
          motivoFalha: 'cabecalho-incompativel'
        };
      }

      const registros =
        cabecalhoAtual === undefined
          ? []
          : this.hidratarCpfTecnico(
              this.mapper.linhasParaRegistros(corpo, cabecalhoAtual),
              corpo,
              cabecalhoAtual
            );

      const linhasReprojetadas: string[][] = [];
      for (const registro of registros) {
        const unidadeLinha = registro.unidadeOperacional?.trim() ?? '';
        // Sem perfilId: preserva PROFISSIONAL já projetado (mesma regra da regravação de ativos).
        const linha = this.projetarLinhaComCpfTecnico(
          registro.item,
          registro.dataConsulta,
          registro.profissional,
          unidadeLinha,
          registro.dataInclusao ?? ''
        );
        if (linha !== undefined) {
          linhasReprojetadas.push(linha);
        }
      }

      const valoresFinais = [this.mapper.cabecalho(), ...linhasReprojetadas];
      await this.reescreverAba(valoresFinais, matriz.length);

      this.logger?.warn(
        {
          event: 'agenda.sheets.backfill_projecao.completed',
          durationMs: Date.now() - startedAt,
          linhasLidas: registros.length,
          linhasReescritas: linhasReprojetadas.length,
          previousRowCount: matriz.length,
          rowCountFinal: valoresFinais.length
        },
        'Backfill de projeção visual da Agenda concluído'
      );

      return {
        sucesso: true,
        linhasLidas: registros.length,
        linhasReescritas: linhasReprojetadas.length
      };
    } catch (error) {
      this.logger?.error(
        {
          event: 'agenda.sheets.backfill_projecao.failed',
          durationMs: Date.now() - startedAt,
          motivoFalha: 'erro-infraestrutura',
          error: serializarErroObservabilidade(error)
        },
        'Falha de infraestrutura no backfill de projeção visual'
      );
      return {
        sucesso: false,
        linhasLidas: 0,
        linhasReescritas: 0,
        motivoFalha: 'erro-infraestrutura'
      };
    }
  }

  public async listarPorData(
    dataConsulta: string,
    contexto: ContextoPersistenciaAgenda
  ): Promise<Agenda | null> {
    const profissional = contexto.profissional?.trim() ?? '';
    const data = dataConsulta.trim();
    if (profissional.length === 0 || data.length === 0) {
      return null;
    }

    const matriz = await this.lerMatriz();
    if (matriz.length === 0) {
      return null;
    }

    const cabecalho = matriz[0];
    if (cabecalho === undefined || !this.cabecalhoCompativel(cabecalho)) {
      return null;
    }

    const corpo = matriz.slice(1);
    const registros = this.hidratarCpfTecnico(
      this.mapper.linhasParaRegistros(corpo, cabecalho),
      corpo,
      cabecalho
    );
    const profissionalExibicao = formatProfessionalDisplayName(
      profissional,
      contexto.perfilId
    );
    const agenda = this.mapper.registrosParaAgenda(registros, data, profissionalExibicao);
    if (agenda.itens.length === 0) {
      return null;
    }
    return agenda;
  }

  /**
   * Projeção oficial (10 colunas) + CPF técnico na coluna seguinte (fora do contrato visual).
   * Com `perfilId`, formata PROFISSIONAL na escrita de linhas novas.
   */
  private projetarLinhaComCpfTecnico(
    item: ItemAgenda,
    dataConsulta: string,
    profissional: string,
    unidadeOperacional: string,
    dataInclusao: string,
    perfilId?: ContextoPersistenciaAgenda['perfilId']
  ): string[] | undefined {
    const linha = this.mapper.agendaParaLinhas(
      { dataConsulta, itens: [item] },
      { profissional, unidadeOperacional, dataInclusao, perfilId }
    )[0];
    if (linha === undefined) {
      return undefined;
    }
    const projetada = [...linha];
    while (projetada.length < INDICE_COLUNA_TECNICA_CPF) {
      projetada.push('');
    }
    projetada[INDICE_COLUNA_TECNICA_CPF] = item.paciente.cpf?.trim() ?? '';
    return projetada;
  }

  /**
   * Reinjeta CPF da coluna técnica (ou mantém o CPF legado já mapeado) no domínio.
   * Usa `registro.rowIndex` (índice na matriz original), nunca o índice do array filtrado.
   * O índice da coluna técnica depende do layout lido (V8 → 8; canônico → 10).
   */
  private hidratarCpfTecnico(
    registros: LinhaAgendaPersistida[],
    corpo: readonly (readonly string[])[],
    cabecalho: readonly string[] | undefined
  ): LinhaAgendaPersistida[] {
    const indiceCpfTecnico = resolverIndiceColunaTecnicaCpf(cabecalho);

    if (registros.length !== corpo.length) {
      this.logger?.warn(
        {
          event: 'agenda.sheets.hidratar_cpf.indice_dessincronizado',
          registrosCount: registros.length,
          corpoLinhasCount: corpo.length,
          delta: corpo.length - registros.length,
          indiceCpfTecnico
        },
        'Possível dessincronização de índice entre registros parseados e linhas do corpo'
      );
    }

    return registros.map((registro) => {
      if (registro.item.paciente.cpf !== undefined) {
        return registro;
      }
      const cpfTecnico = corpo[registro.rowIndex]?.[indiceCpfTecnico]?.trim() ?? '';
      if (cpfTecnico.length === 0) {
        return registro;
      }
      return {
        ...registro,
        item: {
          ...registro.item,
          paciente: { ...registro.item.paciente, cpf: cpfTecnico }
        }
      };
    });
  }

  private async lerMatriz(): Promise<string[][]> {
    const range = this.rangeLeitura();
    const startedAt = Date.now();
    this.logger?.warn(
      {
        event: 'agenda.sheets.api.getValues.started',
        pipelineStep: PIPELINE_STEPS.SHEETS_LER_MATRIZ,
        rangeLength: range.length,
        sheetName: this.sheetName
      },
      'Google Sheets getValues iniciado'
    );
    try {
      const values = await this.sheets.getValues(range);
      this.logger?.warn(
        {
          event: 'agenda.sheets.api.getValues.completed',
          pipelineStep: PIPELINE_STEPS.SHEETS_LER_MATRIZ,
          durationMs: Date.now() - startedAt,
          itemCount: values.length,
          rowCount: values.length
        },
        'Google Sheets getValues concluído'
      );
      return values;
    } catch (error) {
      this.logger?.error(
        {
          event: 'agenda.sheets.api.getValues.failed',
          pipelineStep: PIPELINE_STEPS.SHEETS_LER_MATRIZ,
          durationMs: Date.now() - startedAt,
          error: serializarErroObservabilidade(error)
        },
        'Google Sheets getValues falhou'
      );
      throw error;
    }
  }

  /**
   * Reescreve a aba priorizando **um** write:
   * - `updateValues` com o conteúdo novo;
   * - `clearValues` apenas das linhas excedentes (quando o conteúdo encolhe).
   * Evita o padrão anterior clear-total + update (2 writes sempre).
   */
  private async reescreverAba(
    valores: string[][],
    previousRowCount: number = 0
  ): Promise<void> {
    if (valores.length === 0) {
      if (previousRowCount <= 0) {
        return;
      }
      await this.executarClearValues(this.rangeLeitura());
      return;
    }

    await this.executarUpdateValues(this.rangeEscrita(valores), valores);

    if (previousRowCount > valores.length) {
      const primeiraLinhaExcedente = valores.length + 1;
      const rangeCauda = `'${this.escapeSheetName(this.sheetName)}'!A${primeiraLinhaExcedente}:${ULTIMA_COLUNA_PERSISTENCIA_ABA_AGENDA}${previousRowCount}`;
      await this.executarClearValues(rangeCauda);
    }
  }

  private async executarUpdateValues(range: string, values: string[][]): Promise<void> {
    const updateStartedAt = Date.now();
    this.logger?.warn(
      {
        event: 'agenda.sheets.api.updateValues.started',
        pipelineStep: PIPELINE_STEPS.SHEETS_REESCREVER,
        sheetName: this.sheetName,
        itemCount: values.length,
        rowCount: values.length,
        writeStrategy: 'update_then_clear_tail',
        rangeLength: range.length
      },
      'Google Sheets updateValues iniciado'
    );
    try {
      await this.sheets.updateValues(range, values);
      this.logger?.warn(
        {
          event: 'agenda.sheets.api.updateValues.completed',
          pipelineStep: PIPELINE_STEPS.SHEETS_REESCREVER,
          durationMs: Date.now() - updateStartedAt,
          itemCount: values.length,
          rowCount: values.length,
          writeStrategy: 'update_then_clear_tail'
        },
        'Google Sheets updateValues concluído'
      );
    } catch (error) {
      this.logger?.error(
        {
          event: 'agenda.sheets.api.updateValues.failed',
          pipelineStep: PIPELINE_STEPS.SHEETS_REESCREVER,
          durationMs: Date.now() - updateStartedAt,
          itemCount: values.length,
          writeStrategy: 'update_then_clear_tail',
          error: serializarErroObservabilidade(error)
        },
        'Google Sheets updateValues falhou'
      );
      throw error;
    }
  }

  private async executarClearValues(range: string): Promise<void> {
    const clearStartedAt = Date.now();
    this.logger?.warn(
      {
        event: 'agenda.sheets.api.clearValues.started',
        pipelineStep: PIPELINE_STEPS.SHEETS_REESCREVER,
        sheetName: this.sheetName,
        writeStrategy: 'update_then_clear_tail',
        rangeLength: range.length
      },
      'Google Sheets clearValues iniciado'
    );
    try {
      await this.sheets.clearValues(range);
      this.logger?.warn(
        {
          event: 'agenda.sheets.api.clearValues.completed',
          pipelineStep: PIPELINE_STEPS.SHEETS_REESCREVER,
          durationMs: Date.now() - clearStartedAt,
          writeStrategy: 'update_then_clear_tail'
        },
        'Google Sheets clearValues concluído'
      );
    } catch (error) {
      this.logger?.error(
        {
          event: 'agenda.sheets.api.clearValues.failed',
          pipelineStep: PIPELINE_STEPS.SHEETS_REESCREVER,
          durationMs: Date.now() - clearStartedAt,
          writeStrategy: 'update_then_clear_tail',
          error: serializarErroObservabilidade(error)
        },
        'Google Sheets clearValues falhou'
      );
      throw error;
    }
  }

  private rangeLeitura(): string {
    return `'${this.escapeSheetName(this.sheetName)}'!${FAIXA_COLUNAS_LEITURA_ABA_AGENDA}`;
  }

  private rangeEscrita(valores: string[][]): string {
    const ultimaLinha = Math.max(valores.length, 1);
    return `'${this.escapeSheetName(this.sheetName)}'!A1:${ULTIMA_COLUNA_PERSISTENCIA_ABA_AGENDA}${ultimaLinha}`;
  }

  private escapeSheetName(name: string): string {
    return name.replaceAll("'", "''");
  }

  private cabecalhoCompativel(cabecalho: readonly string[]): boolean {
    return this.variantesCabecalhoAceitas().some((esperado) =>
      this.cabecalhosIguais(cabecalho, esperado)
    );
  }

  private variantesCabecalhoAceitas(): readonly string[][] {
    const legado = [...CABECALHOS_ABA_AGENDA_LEGADO];
    const legadoSemUnidade = CABECALHOS_ABA_AGENDA_LEGADO.filter(
      (titulo) => titulo !== 'Unidade'
    );

    return [
      [...CABECALHOS_ABA_AGENDA],
      // Layout oficial anterior (8 colunas) — migração automática na primeira escrita.
      [...CABECALHOS_ABA_AGENDA_OFICIAL_V8],
      legado,
      this.substituirCabecalho(legado, 'Data de Agendamento', CABECALHO_DATA_AGENDAMENTO_LEGADO),
      this.substituirCabecalho(legado, 'Data de inclusão', CABECALHO_DATA_INCLUSAO_LEGADO),
      this.substituirCabecalho(
        this.substituirCabecalho(legado, 'Data de Agendamento', CABECALHO_DATA_AGENDAMENTO_LEGADO),
        'Data de inclusão',
        CABECALHO_DATA_INCLUSAO_LEGADO
      ),
      legadoSemUnidade,
      this.substituirCabecalho(
        legadoSemUnidade,
        'Data de Agendamento',
        CABECALHO_DATA_AGENDAMENTO_LEGADO
      ),
      this.substituirCabecalho(legadoSemUnidade, 'Data de inclusão', CABECALHO_DATA_INCLUSAO_LEGADO),
      this.substituirCabecalho(
        this.substituirCabecalho(
          legadoSemUnidade,
          'Data de Agendamento',
          CABECALHO_DATA_AGENDAMENTO_LEGADO
        ),
        'Data de inclusão',
        CABECALHO_DATA_INCLUSAO_LEGADO
      ),
      legadoSemUnidade.slice(0, -1),
      this.substituirCabecalho(
        [...legadoSemUnidade.slice(0, -1)],
        'Data de Agendamento',
        CABECALHO_DATA_AGENDAMENTO_LEGADO
      )
    ];
  }

  private substituirCabecalho(
    cabecalhos: string[],
    atual: string,
    novo: string
  ): string[] {
    return cabecalhos.map((titulo) => (titulo === atual ? novo : titulo));
  }

  private cabecalhosIguais(
    atual: readonly string[],
    esperado: readonly string[]
  ): boolean {
    if (atual.length < esperado.length) {
      return false;
    }
    return esperado.every(
      (titulo, index) =>
        normalizeTextoCabecalho(atual[index] ?? '') === normalizeTextoCabecalho(titulo)
    );
  }

  /**
   * Localiza a primeira coluna divergente em relação a uma variante esperada
   * (após normalização de whitespace e case-fold).
   */
  private primeiraDivergenciaCabecalho(
    atual: readonly string[],
    esperado: readonly string[]
  ): DivergenciaCabecalhoAgenda | undefined {
    const limite = Math.max(atual.length, esperado.length);
    for (let indice = 0; indice < limite; indice += 1) {
      const valorEsperado = esperado[indice];
      const valorEncontrado = atual[indice];
      if (valorEsperado === undefined) {
        // Colunas extras após o prefixo aceito não invalidam o layout.
        return undefined;
      }
      const encontrado = valorEncontrado ?? '';
      if (normalizeTextoCabecalho(encontrado) !== normalizeTextoCabecalho(valorEsperado)) {
        return {
          indice,
          esperado: valorEsperado,
          encontrado
        };
      }
    }
    return undefined;
  }

  private registrarCabecalhoIncompativel(encontrado: readonly string[]): void {
    const referencia = [...CABECALHOS_ABA_AGENDA];
    let divergencia = this.primeiraDivergenciaCabecalho(encontrado, referencia);

    if (divergencia === undefined) {
      for (const variante of this.variantesCabecalhoAceitas()) {
        const candidata = this.primeiraDivergenciaCabecalho(encontrado, variante);
        if (candidata !== undefined) {
          divergencia = candidata;
          break;
        }
      }
    }

    this.logger?.warn(
      {
        event: 'agenda.sheets.cabecalho_incompativel',
        motivoFalha: 'cabecalho-incompativel',
        cabecalhoEsperado: referencia,
        cabecalhoEncontrado: [...encontrado],
        colunaDivergente: divergencia
          ? {
              indice: divergencia.indice,
              posicao: divergencia.indice + 1,
              esperado: divergencia.esperado,
              encontrado: divergencia.encontrado
            }
          : undefined
      },
      'Cabeçalho da aba Agenda incompatível com o layout aceito'
    );
  }
}

/** Motivo estruturado (diagnóstico) para entrada em `novasLinhas`. */
function classificarMotivoLinhaNova(input: {
  chaveDefinida: boolean;
  existiaEmCpfsAtivos: boolean;
  existiaEmRegistrosExistentes: boolean;
  registroExistenteAtivo: boolean;
}): string {
  if (!input.chaveDefinida) {
    return 'cpf_ausente_ou_invalido_no_portal';
  }
  if (input.existiaEmCpfsAtivos) {
    return 'nao_deveria_entrar_ja_em_cpfs_ativos';
  }
  if (input.existiaEmRegistrosExistentes && input.registroExistenteAtivo) {
    return 'cpf_presente_em_registros_mas_ausente_em_cpfs_ativos';
  }
  if (input.existiaEmRegistrosExistentes && !input.registroExistenteAtivo) {
    return 'cpf_em_registro_inativo_reinserido_como_novo';
  }
  return 'cpf_nao_encontrado_em_registros_existentes';
}

/**
 * Mescla estado atual do portal em um registro já ativo na planilha.
 *
 * Atualiza (quando o portal traz valor e a projeção muda): Tipo de Processo, Categoria,
 * nome, telefone e e-mail. Comparações usam as mesmas normalizações do mapper
 * (formatPatientName / normalizePhone / normalizeEmail) para não forçar rewrite inútil.
 *
 * Preserva: CPF, horário e metadados da linha (dataConsulta, dataInclusao, profissional, unidade)
 * — o horário permanece atado ao AGENDAMENTO já persistido.
 */
export function mesclarItemPortalEmRegistroAtivo(
  registro: LinhaAgendaPersistida,
  portal: ItemAgenda
): {
  registro: LinhaAgendaPersistida;
  alterouProjecao: boolean;
  camposAtualizados: string[];
} {
  const atual = registro.item;
  const pacienteAtual = atual.paciente;
  const camposAtualizados: string[] = [];

  const tipoProcesso = escolherValorPortal(portal.tipoProcesso, atual.tipoProcesso);
  const categoria = escolherValorPortal(portal.categoria, atual.categoria);
  const nomePortal = portal.paciente.nome?.trim();
  const telefonePortal = portal.paciente.telefone?.trim();
  const emailPortal = portal.paciente.email?.trim();

  let nome = pacienteAtual.nome;
  if (nomePortal !== undefined && nomePortal.length > 0) {
    if (formatPatientName(nomePortal) !== formatPatientName(pacienteAtual.nome ?? '')) {
      nome = nomePortal;
      camposAtualizados.push('nome');
    }
  }

  let telefone = pacienteAtual.telefone;
  if (telefonePortal !== undefined && telefonePortal.length > 0) {
    if (normalizePhone(telefonePortal) !== normalizePhone(pacienteAtual.telefone ?? '')) {
      telefone = telefonePortal;
      camposAtualizados.push('telefone');
    }
  }

  let email = pacienteAtual.email;
  if (emailPortal !== undefined && emailPortal.length > 0) {
    if (normalizeEmail(emailPortal) !== normalizeEmail(pacienteAtual.email ?? '')) {
      email = emailPortal;
      camposAtualizados.push('email');
    }
  }

  if (normalizarComparacao(tipoProcesso) !== normalizarComparacao(atual.tipoProcesso)) {
    camposAtualizados.push('tipoProcesso');
  }
  if (normalizarComparacao(categoria) !== normalizarComparacao(atual.categoria)) {
    camposAtualizados.push('categoria');
  }

  if (camposAtualizados.length === 0) {
    return { registro, alterouProjecao: false, camposAtualizados };
  }

  const pacienteMesclado: Paciente = {
    ...pacienteAtual,
    ...(nome !== undefined ? { nome } : {}),
    ...(telefone !== undefined ? { telefone } : {}),
    ...(email !== undefined ? { email } : {})
  };
  if (pacienteAtual.cpf !== undefined) {
    pacienteMesclado.cpf = pacienteAtual.cpf;
  }

  const itemMesclado: ItemAgenda = {
    paciente: pacienteMesclado,
    ...(atual.horario !== undefined ? { horario: atual.horario } : {}),
    ...(tipoProcesso !== undefined ? { tipoProcesso } : {}),
    ...(categoria !== undefined ? { categoria } : {}),
    ...(atual.statusExameMedico !== undefined
      ? { statusExameMedico: atual.statusExameMedico }
      : {}),
    ...(atual.statusExamePsicologico !== undefined
      ? { statusExamePsicologico: atual.statusExamePsicologico }
      : {})
  };

  return {
    registro: { ...registro, item: itemMesclado },
    alterouProjecao: true,
    camposAtualizados
  };
}

/** Prefere valor do portal quando presente (não vazio); senão mantém o da planilha. */
function escolherValorPortal(
  portal: string | undefined,
  atual: string | undefined
): string | undefined {
  const candidato = portal?.trim();
  if (candidato !== undefined && candidato.length > 0) {
    return candidato;
  }
  const existente = atual?.trim();
  if (existente !== undefined && existente.length > 0) {
    return existente;
  }
  return undefined;
}

function normalizarComparacao(valor: string | undefined): string {
  return valor?.trim() ?? '';
}
