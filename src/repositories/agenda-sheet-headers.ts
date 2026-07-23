/**
 * Contrato oficial da aba `Agenda` (projeção Google Sheets).
 * Única fonte de verdade do layout — ordem e títulos canônicos de escrita.
 *
 * Domínio (`Paciente` / `ItemAgenda`) pode conter mais campos (CPF, categoria, etc.);
 * o contrato visual operacional não os inclui. O CPF permanece a chave de negócio (B004/B005).
 */
export const CABECALHOS_ABA_AGENDA = [
  'UNIDADE',
  'AGENDAMENTO DO DETRAN',
  'HORÁRIO',
  'PACIENTE',
  'TELEFONE',
  'EMAIL',
  'PROFISSIONAL',
  'DATA DE INCLUSÃO'
] as const;

export type CabecalhoAbaAgenda = (typeof CABECALHOS_ABA_AGENDA)[number];

/** Colunas legíveis na migração (canônicas + CPF legado, não escrito). */
export type ColunaAgendaLeitura = CabecalhoAbaAgenda | 'CPF';

export const NOME_ABA_AGENDA_PADRAO = 'Agenda';

/**
 * Aliases de cabeçalho aceitos na leitura (layouts anteriores → canônico).
 * Inclui `CPF` só para migração / chave de unicidade; nunca é reescrito.
 */
export const ALIASES_CABECALHO_ABA_AGENDA: Readonly<Record<string, ColunaAgendaLeitura>> = {
  UNIDADE: 'UNIDADE',
  Unidade: 'UNIDADE',
  'AGENDAMENTO DO DETRAN': 'AGENDAMENTO DO DETRAN',
  'Data de Agendamento': 'AGENDAMENTO DO DETRAN',
  Data: 'AGENDAMENTO DO DETRAN',
  HORÁRIO: 'HORÁRIO',
  Hora: 'HORÁRIO',
  PACIENTE: 'PACIENTE',
  Nome: 'PACIENTE',
  TELEFONE: 'TELEFONE',
  Telefone: 'TELEFONE',
  EMAIL: 'EMAIL',
  'E-mail': 'EMAIL',
  PROFISSIONAL: 'PROFISSIONAL',
  Profissional: 'PROFISSIONAL',
  'DATA DE INCLUSÃO': 'DATA DE INCLUSÃO',
  'Data de inclusão': 'DATA DE INCLUSÃO',
  'Última sincronização': 'DATA DE INCLUSÃO',
  CPF: 'CPF'
};

/** Layout legado completo (pré-simplificação), aceito na leitura. */
export const CABECALHOS_ABA_AGENDA_LEGADO = [
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

/** Nome anterior da coluna de agendamento (pré-B005), aceito na leitura. */
export const CABECALHO_DATA_AGENDAMENTO_LEGADO = 'Data';

/** Nome anterior da coluna de inclusão (B003), aceito na leitura. */
export const CABECALHO_DATA_INCLUSAO_LEGADO = 'Última sincronização';

/** Converte índice 0-based em letra de coluna A1 (0→A, 7→H). */
export function colunaA1(indiceZeroBased: number): string {
  if (indiceZeroBased < 0) {
    throw new Error('Índice de coluna A1 inválido.');
  }
  let n = indiceZeroBased + 1;
  let resultado = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    resultado = String.fromCharCode(65 + resto) + resultado;
    n = Math.floor((n - 1) / 26);
  }
  return resultado;
}

/** Última coluna do layout oficial (derivada de `CABECALHOS_ABA_AGENDA`). */
export const ULTIMA_COLUNA_ABA_AGENDA = colunaA1(CABECALHOS_ABA_AGENDA.length - 1);

/**
 * Coluna técnica (fora do contrato operacional) para preservar o CPF entre sincronizações.
 * Não entra em `CABECALHOS_ABA_AGENDA` e não faz parte da projeção exibida à clínica.
 * Índice 0-based: imediatamente após as colunas oficiais.
 */
export const INDICE_COLUNA_TECNICA_CPF = CABECALHOS_ABA_AGENDA.length;

/** Última coluna usada na escrita persistida (oficial + CPF técnico). */
export const ULTIMA_COLUNA_PERSISTENCIA_ABA_AGENDA = colunaA1(INDICE_COLUNA_TECNICA_CPF);

/**
 * Faixa ampla de leitura: cobre o layout legado (até M) e o oficial + coluna técnica.
 * A projeção operacional permanece nas colunas de `CABECALHOS_ABA_AGENDA`.
 */
export const FAIXA_COLUNAS_LEITURA_ABA_AGENDA = 'A:Z';

/**
 * Normaliza rótulo de cabeçalho para comparação semântica.
 * Colapsa qualquer sequência de whitespace (espaços, tabs, `\n`, `\r\n`) em um espaço
 * e remove bordas — sem alterar o significado do texto.
 */
export function normalizeTextoCabecalho(valor: string): string {
  return valor.replace(/\s+/g, ' ').trim();
}

/**
 * Resolve o canônico a partir do título bruto da planilha,
 * tolerando diferenças de formatação de whitespace.
 */
export function resolverAliasCabecalho(tituloBruto: string): ColunaAgendaLeitura | undefined {
  const normalizado = normalizeTextoCabecalho(tituloBruto);
  if (normalizado.length === 0) {
    return undefined;
  }

  const direto = ALIASES_CABECALHO_ABA_AGENDA[normalizado];
  if (direto !== undefined) {
    return direto;
  }

  for (const [chave, canonico] of Object.entries(ALIASES_CABECALHO_ABA_AGENDA)) {
    if (normalizeTextoCabecalho(chave) === normalizado) {
      return canonico;
    }
  }

  return undefined;
}
