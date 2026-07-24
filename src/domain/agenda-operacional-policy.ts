import {
  obterDataCalendarioSaoPaulo,
  parseDataAgendamento,
  type DataCalendario
} from '../utils/agenda-date.js';

/**
 * Relação civil entre a data do agendamento DETRAN e o “hoje” operacional
 * (`America/Sao_Paulo`), sem horário.
 */
export type RelacaoDataAgendaComHoje = 'passado' | 'hoje' | 'futuro' | 'invalida';

/**
 * Política de domínio da Agenda operacional (aba Google Sheets / B004–B005).
 *
 * Fonte de produto: `docs/VISAO_DO_PRODUTO.md` — pacientes com agendamento
 * **hoje ou futuro**. Datas passadas saem da visão operacional.
 *
 * Utilitários de data (`agenda-date`) apenas interpretam calendário; a decisão
 * de negócio vive aqui.
 */
export class AgendaOperacionalPolicy {
  /**
   * Classifica a data do agendamento em relação a hoje (calendário SP).
   */
  public classificarDataRelativaAHoje(
    dataAgendamento: string,
    referencia: Date = new Date()
  ): RelacaoDataAgendaComHoje {
    const agendada = parseDataAgendamento(dataAgendamento);
    if (agendada === undefined) {
      return 'invalida';
    }
    const hoje = obterDataCalendarioSaoPaulo(referencia);
    const cmp = compararDatasCalendario(agendada, hoje);
    if (cmp < 0) {
      return 'passado';
    }
    if (cmp === 0) {
      return 'hoje';
    }
    return 'futuro';
  }

  /**
   * O agendamento deve permanecer (ou entrar) na aba Agenda operacional?
   * Contrato de produto: **hoje ou futuro**.
   */
  public devePermanecerNaAgendaOperacional(
    dataAgendamento: string,
    referencia: Date = new Date()
  ): boolean {
    const relacao = this.classificarDataRelativaAHoje(dataAgendamento, referencia);
    return relacao === 'hoje' || relacao === 'futuro';
  }

  /**
   * Itens vindos do portal nesta `dataConsulta` devem ser considerados para
   * inclusão na planilha operacional?
   */
  public deveIncluirAgendamentoDoPortalNaAgendaOperacional(
    dataConsulta: string,
    referencia: Date = new Date()
  ): boolean {
    return this.devePermanecerNaAgendaOperacional(dataConsulta, referencia);
  }

  /**
   * Paciente permanece “ativo” no cadastro operacional (chave CPF) enquanto o
   * agendamento DETRAN ainda é hoje ou futuro.
   */
  public pacientePermaneceAtivoNaAgendaOperacional(
    dataAgendamento: string,
    referencia: Date = new Date()
  ): boolean {
    return this.devePermanecerNaAgendaOperacional(dataAgendamento, referencia);
  }
}

/** Instância padrão (stateless) para consumidores. */
export const agendaOperacionalPolicy = new AgendaOperacionalPolicy();

function compararDatasCalendario(a: DataCalendario, b: DataCalendario): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  if (a.month !== b.month) {
    return a.month - b.month;
  }
  return a.day - b.day;
}
