/**
 * Paciente retornado em um item da agenda diária.
 * Campos preenchidos somente quando presentes no HTML confirmado.
 */
export interface Paciente {
  /** Identificador do paciente, se informado na tabela. Dado sensível. */
  cpf?: string;
  /** E-mail de contato, se informado. Dado sensível. */
  email?: string;
  /** Nome do paciente. */
  nome?: string;
  /** Telefone de contato, se informado. Dado sensível. */
  telefone?: string;
}

/**
 * Um atendimento/linha da agenda diária (`table#agenda`).
 * Não modela classes CSS nem atributos de apresentação.
 */
export interface ItemAgenda {
  /** Categoria associada ao processo/atendimento (coluna "Categoria"). */
  categoria?: string;
  /** Horário do atendimento (coluna "Hora"). */
  horario?: string;
  /** Paciente associado à linha. */
  paciente: Paciente;
  /** Status do exame médico (coluna "Status do Exame Médico"). */
  statusExameMedico?: string;
  /** Status do exame psicológico (coluna "Status do Exame Psicológico"). */
  statusExamePsicologico?: string;
  /** Tipo de processo DETRAN (coluna "Tipo de Processo"). */
  tipoProcesso?: string;
}

/**
 * Agenda diária extraída do HTML de resultado.
 *
 * `dataConsulta` não é lida da tabela: o HTML pós-consulta não preserva
 * de forma confiável o valor selecionado. O chamador pode informar o contexto.
 */
export interface Agenda {
  /** Data da consulta no formato `DD/MM/YYYY`, quando fornecida pelo contexto. */
  dataConsulta?: string;
  /** Itens (linhas) da `table#agenda`. Lista vazia é agenda válida sem pacientes. */
  itens: ItemAgenda[];
}

/** Motivos tipados de falha na extração (sem dados pessoais). */
export type MotivoFalhaExtracaoAgenda =
  | 'html-sem-tabela-agenda'
  | 'cabecalhos-obrigatorios-ausentes'
  | 'estrutura-invalida';

/**
 * Resultado lógico da extração HTML → domínio.
 * Independente de HTTP/sessão.
 */
export interface ResultadoExtracaoAgenda {
  agenda?: Agenda;
  motivoFalha?: MotivoFalhaExtracaoAgenda;
  sucesso: boolean;
}

/** Contexto opcional da consulta que originou o HTML. */
export interface ContextoExtracaoAgenda {
  /** Data consultada (`DD/MM/YYYY`), conhecida pelo chamador. */
  dataConsulta?: string;
}
