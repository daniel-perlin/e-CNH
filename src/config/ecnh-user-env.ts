const USER_ENV_KEY = /^ECNH_USER_(\d+)_(?:ENABLED|NAME|CPF|PASSWORD|CLINIC|ROLE)$/;

/**
 * Descobre dinamicamente os índices `ECNH_USER_<n>_…` presentes no ambiente.
 * Qualquer índice declarado no `.env` é considerado — sem limite fixo.
 */
export function listarIndicesUsuariosEnv(env: NodeJS.ProcessEnv = process.env): number[] {
  const indices = new Set<number>();
  for (const chave of Object.keys(env)) {
    const match = USER_ENV_KEY.exec(chave);
    if (match === null) {
      continue;
    }
    indices.add(Number(match[1]));
  }
  return [...indices].sort((a, b) => a - b);
}
