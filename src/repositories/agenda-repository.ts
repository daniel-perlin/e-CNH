import type { PerfilProfissionalId } from '../client/perfil-profissional-portal.js';
import type { Agenda } from '../models/agenda.js';

/**
 * Contexto exigido na fronteira de persistência.
 * Não faz parte do modelo HTML; identifica o profissional na planilha.
 */
export interface ContextoPersistenciaAgenda {
  /** Nome completo do profissional (config); formatado na escrita com `perfilId`. */
  profissional: string;
  /** Perfil de domínio (Psicólogo / Médico) para a coluna PROFISSIONAL. */
  perfilId: PerfilProfissionalId;
  /**
   * Nome operacional da unidade (coluna UNIDADE).
   * Derivado de `CLINIC` via `resolveNomeUnidadeOperacional` — não vem da agenda HTML.
   */
  unidadeOperacional: string;
}

/** Motivos tipados de falha na persistência (sem dados pessoais). */
export type MotivoFalhaPersistenciaAgenda =
  | 'contexto-incompleto'
  | 'data-consulta-ausente'
  | 'cabecalho-incompativel'
  | 'erro-infraestrutura';

/**
 * Resultado lógico da persistência domínio → destino.
 * Independente de Google Sheets.
 */
export interface ResultadoPersistenciaAgenda {
  linhasGravadas?: number;
  linhasRemovidas?: number;
  motivoFalha?: MotivoFalhaPersistenciaAgenda;
  sucesso: boolean;
}

/**
 * Porta de persistência da agenda.
 * Consumidores dependem apenas desta interface.
 */
export interface AgendaRepository {
  /**
   * Substitui todas as linhas da mesma `dataConsulta` + `profissional`
   * e regrava os itens da agenda informada (agenda vazia remove as linhas).
   */
  salvarAgenda(
    agenda: Agenda,
    contexto: ContextoPersistenciaAgenda
  ): Promise<ResultadoPersistenciaAgenda>;

  /**
   * Recupera a agenda persistida para o par data/profissional.
   * Retorna `null` quando não há linhas.
   */
  listarPorData(
    dataConsulta: string,
    contexto: ContextoPersistenciaAgenda
  ): Promise<Agenda | null>;
}
