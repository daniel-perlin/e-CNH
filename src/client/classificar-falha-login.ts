/**
 * Classificação de falha pós-`autenticar` quando o sucesso B012 não é alcançado.
 *
 * **Evidência confirmada:** sucesso = `JSESSIONID` + marcador de perfil.
 * **Heurística operacional (ADR-019):** formulário de login ainda presente,
 * sem ramos B010/B011 e sem marcador autenticado → `senha_invalida`.
 * Textos literais de “senha incorreta” no HTML do portal permanecem
 * **pendência de validação** e não são pré-requisito desta heurística.
 */

import { htmlRequerEscolhaUnidade } from './escolha-unidade-portal.js';
import { htmlContemMarcadorAutenticado } from './perfil-profissional-portal.js';
import { htmlRequerEncerramentoSessaoExistente } from './sessao-existente-portal.js';
import type { LoginResult } from '../types/auth.js';

export function htmlContemFormularioLogin(html: string): boolean {
  return html.includes('LoginActionForm');
}

/**
 * Classifica HTML pós-fluxo de autenticação (após ramos B010/B011, se houver)
 * quando cookie/perfil de sucesso não foram confirmados.
 */
export function classificarFalhaAutenticacaoHtml(
  html: string
): Exclude<LoginResult, { status: 'sucesso' }> {
  if (htmlRequerEncerramentoSessaoExistente(html) || htmlRequerEscolhaUnidade(html)) {
    return {
      message:
        'O portal permaneceu em diálogo de sessão/unidade sem concluir a autenticação.',
      status: 'erro_desconhecido'
    };
  }

  if (htmlContemMarcadorAutenticado(html)) {
    return {
      message:
        'Marcador autenticado presente, mas a sessão ou o perfil não puderam ser confirmados.',
      status: 'erro_desconhecido'
    };
  }

  if (htmlContemFormularioLogin(html)) {
    return {
      message:
        'O portal manteve o formulário de login sem marcador autenticado — credencial provavelmente rejeitada.',
      status: 'senha_invalida'
    };
  }

  return {
    message:
      'O portal respondeu ao login, mas os sinais de autenticação confirmados não foram encontrados.',
    status: 'erro_desconhecido'
  };
}
