/**
 * Cabeçalhos canônicos da aba `Agenda`.
 * A ordem é contrato de persistência; o mapper liga por texto, não por índice mágico externo.
 * Colunas operacionais (Data de Agendamento / Data de inclusão) existem só na planilha.
 */
export const CABECALHOS_ABA_AGENDA = [
  'Profissional',
  'Unidade',
  'Data de Agendamento',
  'Hora',
  'CPF',
  'Nome',
  'Telefone',
  'E-mail',
  'Tipo de Processo',
  'Categoria',
  'Status do Exame Médico',
  'Status do Exame Psicológico',
  'Data de inclusão'
] as const;

export type CabecalhoAbaAgenda = (typeof CABECALHOS_ABA_AGENDA)[number];

export const NOME_ABA_AGENDA_PADRAO = 'Agenda';

/** Nome anterior da coluna de agendamento (pré-B005), aceito na leitura. */
export const CABECALHO_DATA_AGENDAMENTO_LEGADO = 'Data';

/**
 * Nome anterior da coluna de inclusão (B003), aceito na leitura.
 * Na regravação o cabeçalho canônico passa a ser "Data de inclusão".
 */
export const CABECALHO_DATA_INCLUSAO_LEGADO = 'Última sincronização';
