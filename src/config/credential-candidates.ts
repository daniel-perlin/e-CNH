import { readFileSync } from 'node:fs';

import { ConfigurationError } from '../client/errors.js';
import { formatCpfForPortal, normalizeCpfKey } from '../utils/cpf.js';

/**
 * Candidata genérica a credencial atualizada.
 * Não amarra a índices `ECNH_USER_<n>`; o matching é por CPF e/ou nome.
 */
export interface CredencialCandidata {
  /** CPF (qualquer máscara com 11 dígitos). */
  cpf: string;
  /** Nome para matching e resumo (sem PII além do já operacional). */
  nome: string;
  /** Senha candidata (nunca logar). */
  senha: string;
}

interface CredencialCandidataArquivo {
  cpf?: unknown;
  nome?: unknown;
  senha?: unknown;
}

export interface CatalogoCredenciaisCandidatas {
  /** Caminho de origem (para logs, sem conteúdo). */
  origem: string;
  candidatas: CredencialCandidata[];
}

/** Normaliza nome para comparação (trim, lowercase, colapsa espaços). */
export function normalizarNomeProfissional(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Carrega catálogo JSON: `{ "candidatas": [ { "nome", "cpf", "senha" }, ... ] }`
 * ou array raiz `[...]`.
 */
export function carregarCredenciaisCandidatasDoArquivo(
  caminho: string
): CatalogoCredenciaisCandidatas {
  let bruto: unknown;
  try {
    bruto = JSON.parse(readFileSync(caminho, 'utf8')) as unknown;
  } catch (error) {
    const detalhe = error instanceof Error ? error.message : 'erro de leitura';
    throw new ConfigurationError(
      `Não foi possível ler o catálogo de credenciais candidatas em ${caminho}: ${detalhe}`
    );
  }

  const lista = extrairListaCandidatas(bruto, caminho);
  const candidatas: CredencialCandidata[] = [];

  for (const [i, item] of lista.entries()) {
    const nome = typeof item.nome === 'string' ? item.nome.trim() : '';
    const cpfRaw = typeof item.cpf === 'string' ? item.cpf.trim() : '';
    const senha = typeof item.senha === 'string' ? item.senha : '';

    if (nome.length === 0 || cpfRaw.length === 0 || senha.length === 0) {
      throw new ConfigurationError(
        `Candidata inválida no índice ${i} de ${caminho}: exige nome, cpf e senha não vazios.`
      );
    }

    const cpfFormatado = formatCpfForPortal(cpfRaw);
    if (cpfFormatado === undefined) {
      throw new ConfigurationError(
        `Candidata inválida no índice ${i} de ${caminho}: CPF deve conter exatamente 11 dígitos.`
      );
    }

    candidatas.push({ cpf: cpfFormatado, nome, senha });
  }

  return { candidatas, origem: caminho };
}

function extrairListaCandidatas(
  bruto: unknown,
  caminho: string
): CredencialCandidataArquivo[] {
  if (Array.isArray(bruto)) {
    return bruto as CredencialCandidataArquivo[];
  }
  if (
    bruto !== null &&
    typeof bruto === 'object' &&
    Array.isArray((bruto as { candidatas?: unknown }).candidatas)
  ) {
    return (bruto as { candidatas: CredencialCandidataArquivo[] }).candidatas;
  }
  throw new ConfigurationError(
    `Catálogo em ${caminho} deve ser um array ou um objeto com propriedade "candidatas".`
  );
}

/**
 * Resolve candidata para um profissional atual.
 * Precedência: CPF (dígitos) → nome normalizado.
 * Ignora candidata idêntica (mesmo CPF + mesma senha).
 */
export function resolverCredencialCandidata(params: {
  candidatas: readonly CredencialCandidata[];
  cpfAtual: string;
  nomeAtual: string;
  senhaAtual: string;
}): CredencialCandidata | undefined {
  const cpfKey = normalizeCpfKey(params.cpfAtual);
  const nomeKey = normalizarNomeProfissional(params.nomeAtual);

  let porCpf: CredencialCandidata | undefined;
  let porNome: CredencialCandidata | undefined;

  for (const candidata of params.candidatas) {
    const candidataCpfKey = normalizeCpfKey(candidata.cpf);
    if (cpfKey !== undefined && candidataCpfKey === cpfKey) {
      porCpf = candidata;
      break;
    }
  }

  if (porCpf === undefined) {
    for (const candidata of params.candidatas) {
      if (normalizarNomeProfissional(candidata.nome) === nomeKey) {
        porNome = candidata;
        break;
      }
    }
  }

  const escolhida = porCpf ?? porNome;
  if (escolhida === undefined) {
    return undefined;
  }

  const mesmaCredencial =
    normalizeCpfKey(escolhida.cpf) === cpfKey && escolhida.senha === params.senhaAtual;
  if (mesmaCredencial) {
    return undefined;
  }

  return escolhida;
}

/** Caminho padrão (gitignored). Sobrescreva com `ECNH_CREDENTIAL_CANDIDATES_PATH`. */
export const CAMINHO_PADRAO_CREDENCIAIS_CANDIDATAS =
  'secrets/credenciais-candidatas.json';

export function resolveCaminhoCredenciaisCandidatas(
  env: NodeJS.ProcessEnv = process.env
): string {
  const configurado = env.ECNH_CREDENTIAL_CANDIDATES_PATH?.trim();
  if (configurado !== undefined && configurado.length > 0) {
    return configurado;
  }
  return CAMINHO_PADRAO_CREDENCIAIS_CANDIDATAS;
}
