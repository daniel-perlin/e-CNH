/**
 * Escolha de Perfil e/ou Visão (unidade) no portal — B011 / Fase 003D.
 * Isolado de `PerfilProfissionalPortal` (B012): não conhece Psicólogo/Médico nem agenda.
 */

/** Opção do `<select name="idUnidTransito">`. */
export interface OpcaoUnidadePortal {
  readonly label: string;
  readonly value: string;
}

/**
 * Unidade desejada vinda da configuração do profissional.
 * Precedência na resolução: `idUnidTransito` > `label`.
 */
export interface UnidadeDesejadaConfig {
  /** Value do `<option>` (`ECNH_USER_<n>_UNID_TRANSITO`). */
  readonly idUnidTransito?: string;
  /** Rótulo do `<option>` (`ECNH_USER_<n>_UNIDADE`). */
  readonly label?: string;
}

export type ResolucaoUnidadePortal =
  | { readonly opcao: OpcaoUnidadePortal; readonly status: 'ok' }
  | { readonly motivo: string; readonly status: 'erro' };

/** Detecta o ramo JS pós-`autenticar` que abre a escolha de unidade. */
export function htmlRequerEscolhaUnidade(html: string): boolean {
  return /openDialogChoice\s*\(/.test(html);
}

/** Indica se o HTML é a tela openChoice com o select de unidade. */
export function htmlContemFormularioEscolhaUnidade(html: string): boolean {
  const lower = html.toLowerCase();
  const temTitulo =
    lower.includes('escolha de perfil') ||
    lower.includes('perfil e/ou visão') ||
    lower.includes('perfil e/ou visao');
  return temTitulo && /name=["']idUnidTransito["']/i.test(html);
}

/**
 * Extrai o argumento `autenticadoCyberark` de `openDialogChoice('false', ...)`.
 * Evidência: primeiro parâmetro da chamada injetada no HTML pós-autenticar.
 */
export function extrairAutenticadoCyberarkDeOpenDialogChoice(html: string): string {
  const match = html.match(/openDialogChoice\s*\(\s*['"]([^'"]*)['"]/);
  if (match?.[1] !== undefined && match[1].length > 0) {
    return match[1];
  }
  return 'false';
}

/** Lista opções não vazias de `select[name=idUnidTransito]`. */
export function parseOpcoesUnidadeTransito(html: string): OpcaoUnidadePortal[] {
  const selectMatch = html.match(
    /<select[^>]*name=["']idUnidTransito["'][^>]*>([\s\S]*?)<\/select>/i
  );
  if (selectMatch?.[1] === undefined) {
    return [];
  }

  const opcoes: OpcaoUnidadePortal[] = [];
  for (const optionMatch of selectMatch[1].matchAll(
    /<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi
  )) {
    const value = optionMatch[1] ?? '';
    const label = (optionMatch[2] ?? '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .trim()
      .replace(/\s+/g, ' ');
    if (value.length === 0) {
      continue;
    }
    opcoes.push({ label, value });
  }
  return opcoes;
}

/**
 * Resolve a unidade configurada entre as opções do portal.
 * Sem config → erro (quando o diálogo exige escolha).
 * Com `idUnidTransito` → match por value; senão por label normalizado.
 */
export function resolverUnidadeConfigurada(
  opcoes: readonly OpcaoUnidadePortal[],
  config: UnidadeDesejadaConfig | undefined
): ResolucaoUnidadePortal {
  const id = config?.idUnidTransito?.trim();
  const label = config?.label !== undefined ? normalizarRotuloUnidade(config.label) : '';

  if ((id === undefined || id.length === 0) && label.length === 0) {
    return {
      status: 'erro',
      motivo:
        'O portal exigiu escolha de unidade, mas UNIDADE/UNID_TRANSITO não foram configurados para o profissional.'
    };
  }

  if (opcoes.length === 0) {
    return {
      status: 'erro',
      motivo: 'Formulário de escolha de unidade sem opções em idUnidTransito.'
    };
  }

  if (id !== undefined && id.length > 0) {
    const porId = opcoes.find((opcao) => opcao.value === id);
    if (porId === undefined) {
      return {
        status: 'erro',
        motivo: `UNID_TRANSITO configurado (${id}) não corresponde a nenhuma opção do portal.`
      };
    }
    return { status: 'ok', opcao: porId };
  }

  const porLabel = opcoes.find(
    (opcao) => normalizarRotuloUnidade(opcao.label) === label
  );
  if (porLabel === undefined) {
    return {
      status: 'erro',
      motivo: `UNIDADE configurada não corresponde a nenhuma opção do portal.`
    };
  }
  return { status: 'ok', opcao: porLabel };
}

/** Indica se há ao menos um critério de unidade na config. */
export function unidadeDesejadaDefinida(
  config: UnidadeDesejadaConfig | undefined
): boolean {
  if (config === undefined) {
    return false;
  }
  const id = config.idUnidTransito?.trim() ?? '';
  const label = config.label?.trim() ?? '';
  return id.length > 0 || label.length > 0;
}

export function normalizarRotuloUnidade(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}
