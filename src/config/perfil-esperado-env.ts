import { ConfigurationError } from '../client/errors.js';
import {
  type PerfilProfissionalId,
  parsePerfilProfissionalId
} from '../client/perfil-profissional-portal.js';

/**
 * Resolve `ECNH_USER_<n>_PROFILE` ou `ROLE` opcional.
 * Precedência: PROFILE preenchido > ROLE.
 */
export function resolvePerfilEsperadoEnv(
  env: NodeJS.ProcessEnv,
  index: number
): PerfilProfissionalId | undefined {
  const profileRaw = env[`ECNH_USER_${index}_PROFILE`];
  const roleRaw = env[`ECNH_USER_${index}_ROLE`];
  const raw = profileRaw !== undefined && profileRaw.trim().length > 0 ? profileRaw : roleRaw;
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }

  const parsed = parsePerfilProfissionalId(raw);
  if (parsed === undefined) {
    throw new ConfigurationError(
      `ECNH_USER_${index}_PROFILE/ROLE inválido: use psicologo ou medico.`
    );
  }
  return parsed;
}
