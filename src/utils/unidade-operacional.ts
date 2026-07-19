/**
 * Traduz o nome de clínica do `.env` (`ECNH_USER_<n>_CLINIC`)
 * para o nome operacional exibido na planilha (coluna Unidade).
 *
 * Mapeamento centralizado: novas unidades entram apenas neste registro.
 * O lookup usa chave normalizada (acentos, `/`, `-`, espaços e capitalização).
 */

/** Pares clínica canônica (.env) → nome operacional (planilha). */
const MAPA_CLINICA_PARA_UNIDADE_OPERACIONAL: ReadonlyArray<readonly [string, string]> = [
  ['Talento Limão/Zona Norte', 'LIMÃO'],
  ['Capão Redondo/Zona Sul', 'CAPÃO REDONDO'],
  ['Clínica Carrão/Zona Leste', 'VILA CARRÃO']
];

const UNIDADES_POR_CLINICA_NORMALIZADA: ReadonlyMap<string, string> = new Map(
  MAPA_CLINICA_PARA_UNIDADE_OPERACIONAL.map(([clinica, unidade]) => [
    normalizarChaveClinica(clinica),
    unidade
  ])
);

/**
 * Resolve o nome operacional a partir do valor de `CLINIC`.
 * Aceita variações naturais de escrita (acentos, barras, capitalização, espaços).
 * @throws {Error} se a clínica estiver vazia ou não estiver no mapa após normalização.
 */
export function resolveNomeUnidadeOperacional(clinic: string): string {
  const bruto = clinic.trim();
  if (bruto.length === 0) {
    throw new Error('CLINIC vazio: informe a clínica do profissional no .env.');
  }

  const unidade = UNIDADES_POR_CLINICA_NORMALIZADA.get(normalizarChaveClinica(bruto));
  if (unidade === undefined) {
    throw new Error(
      `CLINIC sem mapeamento operacional: "${bruto}" não possui unidade operacional cadastrada. Atualize o registro em unidade-operacional.`
    );
  }
  return unidade;
}

/** Lista as clínicas canônicas conhecidas (útil para mensagens e documentação). */
export function listarClinicasMapeadas(): readonly string[] {
  return MAPA_CLINICA_PARA_UNIDADE_OPERACIONAL.map(([clinica]) => clinica);
}

/**
 * Normaliza o nome da clínica antes do lookup no mapa.
 * Ordem: trim → remover acentos → lowercase → `/` e `-` viram espaço → colapsar espaços.
 */
export function normalizarChaveClinica(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
