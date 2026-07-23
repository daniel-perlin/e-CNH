import type { PerfilProfissionalId } from '../client/perfil-profissional-portal.js';

/**
 * Rótulo operacional do tipo profissional na coluna PROFISSIONAL.
 * Fonte: domínio de perfil do portal — sem heurística por nome.
 */
export function rotuloTipoProfissional(perfilId: PerfilProfissionalId): string {
  switch (perfilId) {
    case 'psicologo':
      return 'Psicólogo';
    case 'medico':
      return 'Médico';
  }
}

/**
 * Formata o profissional para a coluna PROFISSIONAL:
 * `<tipo>: <PRIMEIRO> <SEGUNDO>` em caixa alta (pt-BR), preservando acentos.
 * Com um único token, grava só o primeiro nome.
 */
export function formatProfessionalDisplayName(
  nomeCompleto: string,
  perfilId: PerfilProfissionalId
): string {
  const tokens = nomeCompleto
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .slice(0, 2)
    .map((token) => token.toLocaleUpperCase('pt-BR'));

  const nomes = tokens.join(' ');
  return `${rotuloTipoProfissional(perfilId)}: ${nomes}`.trimEnd();
}
