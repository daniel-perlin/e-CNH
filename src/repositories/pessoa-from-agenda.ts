import type { Agenda, Paciente } from '../models/agenda.js';

import type { PessoaParaPersistencia } from './pessoa-repository.js';

/** Extrai candidatos a persistência a partir do domínio `Agenda` (sem conhecer SQL/Sheets). */
export function pessoasDaAgenda(agenda: Agenda): PessoaParaPersistencia[] {
  const resultado: PessoaParaPersistencia[] = [];
  for (const item of agenda.itens) {
    const pessoa = pacienteParaPessoa(item.paciente);
    if (pessoa !== undefined) {
      resultado.push(pessoa);
    }
  }
  return resultado;
}

export function pacienteParaPessoa(paciente: Paciente): PessoaParaPersistencia | undefined {
  const cpf = paciente.cpf?.trim();
  if (cpf === undefined || cpf.length === 0) {
    return undefined;
  }
  return {
    cpf,
    nome: paciente.nome,
    email: paciente.email,
    telefone: paciente.telefone
  };
}
