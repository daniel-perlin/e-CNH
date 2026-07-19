/**
 * Variações de protocolo do portal por perfil profissional.
 * Separado do Profissional de domínio (pessoa + credenciais + nome na planilha).
 */
export type PerfilProfissionalId = 'psicologo' | 'medico';

export interface PerfilProfissionalPortal {
  readonly id: PerfilProfissionalId;
  readonly marcadorAutenticado: string;
  readonly methodConsultarAgenda: string;
}

/** Evidência confirmada (HAR/homologação): agenda do psicólogo. */
export const perfilPsicologo: PerfilProfissionalPortal = {
  id: 'psicologo',
  marcadorAutenticado: 'Imprimir Agenda Diária do Psicólogo',
  methodConsultarAgenda: 'consultarAgendaPsicologo'
};

/**
 * Evidência relatada na homologação (HAR/testes): agenda do médico.
 * Pendência: consolidar evidência sanitizada durável no repositório.
 */
export const perfilMedico: PerfilProfissionalPortal = {
  id: 'medico',
  marcadorAutenticado: 'Imprimir Agenda Diária do Médico',
  methodConsultarAgenda: 'consultarAgendaMedico'
};

/**
 * Ordem de resolução quando mais de um marcador puder existir.
 * Psicólogo primeiro preserva o comportamento histórico do MVP.
 */
export const REGISTRO_PERFIS_PORTAL: readonly PerfilProfissionalPortal[] = [
  perfilPsicologo,
  perfilMedico
];

/** Resolve o perfil pelo marcador HTML pós-login. */
export function resolverPerfilNoHtml(html: string): PerfilProfissionalPortal | undefined {
  for (const perfil of REGISTRO_PERFIS_PORTAL) {
    if (html.includes(perfil.marcadorAutenticado)) {
      return perfil;
    }
  }
  return undefined;
}

/** Indica se o HTML contém o marcador de algum perfil conhecido. */
export function htmlContemMarcadorAutenticado(html: string): boolean {
  return resolverPerfilNoHtml(html) !== undefined;
}

/**
 * Interpreta valor de configuração (`PROFILE` / `ROLE`) para id de perfil.
 * Aceita `psicologo`/`medico` e rótulos `Psicologo`/`Medico`.
 */
export function parsePerfilProfissionalId(value: string | undefined): PerfilProfissionalId | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return undefined;
  }

  if (normalized === 'psicologo' || normalized === 'psicólogo') {
    return 'psicologo';
  }
  if (normalized === 'medico' || normalized === 'médico') {
    return 'medico';
  }

  return undefined;
}

export function obterPerfilPorId(id: PerfilProfissionalId): PerfilProfissionalPortal {
  const perfil = REGISTRO_PERFIS_PORTAL.find((item) => item.id === id);
  if (perfil === undefined) {
    throw new Error(`Perfil de portal desconhecido: ${id}`);
  }
  return perfil;
}
