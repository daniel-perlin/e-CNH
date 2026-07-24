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
    `Profissionais processados: ${resultado.profissionais.length}`,
    `Sucesso: ${resultado.sucessos}`,
    `Falhas: ${resultado.falhas}`,
    `Sucesso geral: ${resultado.sucessoGeral ? 'sim' : 'não'}`,
    `Tempo total: ${formatarDuracao(resultado.duracaoTotalMs)}`,
    ...formatarFalhasPorMotivo(resultado.falhasPorMotivo),
    ''
  ];

  for (const profissional of resultado.profissionais) {
    linhas.push(...formatarProfissional(profissional), '');
  }

  return linhas.join('\n');
}

/**
 * Código de saída do Cron: não derruba o job por falha parcial.
 * - 0: execução concluída com pelo menos um sucesso, ou sem profissionais
 * - 1: lock ocupado / todos falharam / erro não tratado no caller
 */
export function codigoSaidaSincronizacao(resultado: ResultadoSincronizacao): number {
  if (resultado.profissionais.length === 0) {
    return 0;
  }
  if (resultado.sucessos > 0) {
    return 0;
  }
  return 1;
}

function formatarDuracao(duracaoTotalMs: number): string {
  if (!Number.isFinite(duracaoTotalMs) || duracaoTotalMs < 0) {
    return 'n/d';
  }
  const totalSegundos = Math.round(duracaoTotalMs / 1000);
  if (totalSegundos < 60) {
    return `${totalSegundos}s (${duracaoTotalMs}ms)`;
  }
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  return `${minutos}m ${segundos}s (${duracaoTotalMs}ms)`;
}

function formatarFalhasPorMotivo(falhasPorMotivo: Record<string, number>): string[] {
  const entradas = Object.entries(falhasPorMotivo).sort(([a], [b]) => a.localeCompare(b));
  if (entradas.length === 0) {
    return ['Falhas por motivo: (nenhuma)'];
  }
  return [
    'Falhas por motivo:',
    ...entradas.map(([motivo, quantidade]) => `  - ${motivo}: ${quantidade}`)
  ];
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
