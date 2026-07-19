import type {
  ResultadoSincronizacao,
  ResultadoSincronizacaoData,
  ResultadoSincronizacaoProfissional
} from '../services/agenda-sync-service.js';

/** Resumo operacional sem CPF, senha ou dados de pacientes. */
export function formatarResumoSincronizacao(resultado: ResultadoSincronizacao): string {
  const linhas: string[] = [
    '',
    '=== Resumo da sincronização ===',
    `Sucesso geral: ${resultado.sucessoGeral ? 'sim' : 'não'}`,
    `Profissionais: ${resultado.profissionais.length}`,
    ''
  ];

  for (const profissional of resultado.profissionais) {
    linhas.push(...formatarProfissional(profissional), '');
  }

  return linhas.join('\n');
}

function formatarProfissional(profissional: ResultadoSincronizacaoProfissional): string[] {
  const itens = profissional.datas.reduce(
    (total, data) => total + (data.itensExtraidos ?? 0),
    0
  );
  const datasOk = profissional.datas.filter((data) => data.sucesso).length;

  return [
    `- ${profissional.identificadorSeguro}`,
    `  login: ${profissional.loginStatus ?? 'n/d'}`,
    `  sucesso: ${profissional.sucesso ? 'sim' : 'não'}`,
    `  logout: ${profissional.logoutExecutado ? 'sim' : 'não'}`,
    `  datas: ${datasOk}/${profissional.datas.length} ok · itens extraídos: ${itens}`,
    ...profissional.datas.map((data) => `  · ${formatarData(data)}`)
  ];
}

function formatarData(data: ResultadoSincronizacaoData): string {
  if (data.sucesso) {
    return `${data.dataConsulta}: ok (gravadas=${data.linhasGravadas ?? 0}, removidas=${data.linhasRemovidas ?? 0})`;
  }

  const motivo =
    data.motivoFalhaExtracao ?? data.motivoFalhaPersistencia ?? 'falha-nao-classificada';
  return `${data.dataConsulta}: falha (${motivo})`;
}
