/**
 * Contrato oficial da aba `Agenda` (projeção Google Sheets).
 * Única fonte de verdade do layout — ordem e títulos canônicos de escrita.
 *
 * Domínio (`Paciente` / `ItemAgenda`) pode conter mais campos (CPF, status de exames);
 * o contrato visual operacional não inclui CPF. O CPF permanece a chave de negócio (B004/B005).
 */

/**
 * Layout oficial anterior (8 colunas), ainda aceito na leitura para migração automática 8→10.
 * CPF técnico nestas planilhas fica imediatamente após estas colunas (índice 8).
 */
export const CABECALHOS_ABA_AGENDA_OFICIAL_V8 = [
  'UNIDADE',
  'AGENDAMENTO DO DETRAN',
  'HORÁRIO',
  'PACIENTE',
  'TELEFONE',
  'EMAIL',
  'PROFISSIONAL',
  'DATA DE INCLUSÃO'
] as const;

/**
 * Layout oficial atual (10 colunas).
 * `Tipo de Processo` e `Categoria` ficam logo após `EMAIL`.
 */
export const CABECALHOS_ABA_AGENDA = [
  'UNIDADE',
  'AGENDAMENTO DO DETRAN',
  'HORÁRIO',
  'PACIENTE',
  'TELEFONE',
  'EMAIL',
  'Tipo de Processo',
  'Categoria',
  'PROFISSIONAL',
  'DATA DE INCLUSÃO'
] as const;

export type CabecalhoAbaAgenda = (typeof CABECALHOS_ABA_AGENDA)[number];

/** Colunas legíveis na migração (canônicas + CPF legado, não escrito). */
export type ColunaAgendaLeitura = CabecalhoAbaAgenda | 'CPF';

export const NOME_ABA_AGENDA_PADRAO = 'Agenda';

/**
 * Aliases de cabeçalho aceitos na leitura (layouts anteriores → canônico).
 * Inclui `CPF` só para migração / chave de unicidade; nunca é reescrito no cabeçalho oficial.
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
  'Tipo de Processo': 'Tipo de Processo',
  Categoria: 'Categoria',
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

/**
 * Índice 0-based de uma coluna oficial no layout canônico atual.
 * Preferir a constantes derivadas em vez de literais numéricos nos consumidores.
 */
export function indiceCabecalhoAgenda(titulo: CabecalhoAbaAgenda): number {
  const indice = CABECALHOS_ABA_AGENDA.indexOf(titulo);
  if (indice < 0) {
    throw new Error(`Cabeçalho ausente no layout oficial: ${titulo}`);
  }
  return indice;
}

/** Última coluna do layout oficial (derivada de `CABECALHOS_ABA_AGENDA`). */
export const ULTIMA_COLUNA_ABA_AGENDA = colunaA1(CABECALHOS_ABA_AGENDA.length - 1);

/**
 * Coluna técnica (fora do contrato operacional) para preservar o CPF entre sincronizações.
 * Não entra em `CABECALHOS_ABA_AGENDA` e não faz parte da projeção exibida à clínica.
 * Índice 0-based de **escrita**: imediatamente após as colunas oficiais atuais.
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
 * Colapsa whitespace (espaços, tabs, `\n`, `\r\n`), remove bordas e
 * aplica case-fold (`pt-BR`) — `PROFISSIONAL` e `Profissional` são equivalentes.
 */
export function normalizeTextoCabecalho(valor: string): string {
  return valor.replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
}

/** Compara prefixo do cabeçalho lido com um layout esperado (tolerante a whitespace). */
export function prefixoCabecalhoCompativel(
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
 * Resolve o índice da coluna técnica de CPF conforme o cabeçalho **lido**.
 * Planilhas V8 (8 oficiais) → índice 8; layout atual (10) → índice 10.
 * Layouts legados com coluna `CPF` nomeada não dependem deste índice (mapper hidrata pelo alias).
 */
export function resolverIndiceColunaTecnicaCpf(
  cabecalho: readonly string[] | undefined
): number {
  if (cabecalho === undefined) {
    return INDICE_COLUNA_TECNICA_CPF;
  }
  if (prefixoCabecalhoCompativel(cabecalho, CABECALHOS_ABA_AGENDA)) {
    return CABECALHOS_ABA_AGENDA.length;
  }
  if (prefixoCabecalhoCompativel(cabecalho, CABECALHOS_ABA_AGENDA_OFICIAL_V8)) {
    return CABECALHOS_ABA_AGENDA_OFICIAL_V8.length;
  }
  return INDICE_COLUNA_TECNICA_CPF;
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
