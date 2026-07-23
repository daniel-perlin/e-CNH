import { readFileSync, writeFileSync } from 'node:fs';

import { ConfigurationError } from '../client/errors.js';
import { formatCpfForPortal } from '../utils/cpf.js';

/**
 * Persistência das credenciais oficiais do projeto no arquivo `.env`.
 * Atualiza apenas `ECNH_USER_<n>_CPF` e `ECNH_USER_<n>_PASSWORD`.
 * Nunca registra valores em logs.
 */
export interface EnvCredentialStore {
  atualizarCredencialUsuario(params: {
    cpf: string;
    indice: number;
    senha: string;
  }): void;
}

export function criarEnvFileCredentialStore(options: {
  caminhoEnv?: string;
}): EnvCredentialStore {
  const caminhoEnv = options.caminhoEnv ?? '.env';

  return {
    atualizarCredencialUsuario({ indice, cpf, senha }): void {
      const cpfFormatado = formatCpfForPortal(cpf);
      if (cpfFormatado === undefined) {
        throw new ConfigurationError(
          `CPF inválido ao persistir ECNH_USER_${indice}_CPF (exige 11 dígitos).`
        );
      }
      if (senha.length === 0) {
        throw new ConfigurationError(
          `Senha vazia ao persistir ECNH_USER_${indice}_PASSWORD.`
        );
      }

      let conteudo: string;
      try {
        conteudo = readFileSync(caminhoEnv, 'utf8');
      } catch (error) {
        const detalhe = error instanceof Error ? error.message : 'erro de leitura';
        throw new ConfigurationError(
          `Não foi possível ler ${caminhoEnv} para persistir credenciais: ${detalhe}`
        );
      }

      const chaveCpf = `ECNH_USER_${indice}_CPF`;
      const chaveSenha = `ECNH_USER_${indice}_PASSWORD`;

      let atualizado = substituirOuInserirChaveEnv(conteudo, chaveCpf, cpfFormatado);
      atualizado = substituirOuInserirChaveEnv(atualizado, chaveSenha, senha);

      if (atualizado === conteudo) {
        throw new ConfigurationError(
          `Nenhuma alteração aplicada em ${caminhoEnv} para ECNH_USER_${indice}.`
        );
      }

      writeFileSync(caminhoEnv, atualizado, 'utf8');
    }
  };
}

/**
 * Substitui linha existente `KEY=...` ou anexa ao final.
 * Valores com caracteres especiais são gravados entre aspas duplas.
 */
export function substituirOuInserirChaveEnv(
  conteudo: string,
  chave: string,
  valor: string
): string {
  const linha = `${chave}=${serializarValorEnv(valor)}`;
  const padrao = new RegExp(`^${escapeRegExp(chave)}=.*$`, 'm');

  if (padrao.test(conteudo)) {
    return conteudo.replace(padrao, linha);
  }

  const separador = conteudo.endsWith('\n') || conteudo.length === 0 ? '' : '\n';
  return `${conteudo}${separador}${linha}\n`;
}

export function serializarValorEnv(valor: string): string {
  // Aspas quando há qualquer caractere fora de [A-Za-z0-9._-] (ex.: @ # $ * espaços).
  if (/^[A-Za-z0-9._-]+$/.test(valor)) {
    return valor;
  }
  const escapado = valor.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escapado}"`;
}

function escapeRegExp(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Extrai o índice numérico de `ECNH_USER_<n>`. */
export function extrairIndiceUsuarioSeguro(identificadorSeguro: string): number | undefined {
  const match = /^ECNH_USER_(\d+)$/.exec(identificadorSeguro);
  if (match?.[1] === undefined) {
    return undefined;
  }
  return Number.parseInt(match[1], 10);
}
