/**
 * Cabeçalhos canônicos da aba `Agenda` (Fase 005).
 * A ordem é contrato de persistência; o mapper liga por texto, não por índice mágico externo.
 */
export const CABECALHOS_ABA_AGENDA = [
  'Profissional',
  'Data',
  'Hora',
  'CPF',
  'Nome',
  'Telefone',
  'E-mail',
  'Tipo de Processo',
  'Categoria',
  'Status do Exame Médico',
  'Status do Exame Psicológico'
] as const;

export type CabecalhoAbaAgenda = (typeof CABECALHOS_ABA_AGENDA)[number];

export const NOME_ABA_AGENDA_PADRAO = 'Agenda';
