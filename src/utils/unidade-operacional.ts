/**
 * Traduz o nome de clínica do `.env` (`ECNH_USER_<n>_CLINIC`)
 * para o nome operacional exibido na planilha (coluna Unidade).
 *
 * Mapeamento centralizado: novas unidades entram apenas neste registro.
 */

/** Pares clínica (.env) → nome operacional (planilha). */
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
 * @throws {Error} se a clínica estiver vazia ou não estiver no mapa.
 */
export function resolveNomeUnidadeOperacional(clinic: string): string {
  const bruto = clinic.trim();
  if (bruto.length === 0) {
    throw new Error('CLINIC vazio: informe a clínica do profissional no .env.');
  }

  const unidade = UNIDADES_POR_CLINICA_NORMALIZADA.get(normalizarChaveClinica(bruto));
  if (unidade === undefined) {
    throw new Error(
      `CLINIC sem mapeamento operacional: "${bruto}". Atualize o registro em unidade-operacional.`
    );
  }
  return unidade;
}

/** Lista as clínicas conhecidas (útil para mensagens e documentação). */
export function listarClinicasMapeadas(): readonly string[] {
  return MAPA_CLINICA_PARA_UNIDADE_OPERACIONAL.map(([clinica]) => clinica);
}

function normalizarChaveClinica(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}
