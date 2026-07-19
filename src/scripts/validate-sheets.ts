import 'dotenv/config';

import { mkdir, writeFile } from 'node:fs/promises';

import { GoogleSheetsClient } from '../client/google-sheets-client.js';
import { ConfigurationError } from '../client/errors.js';
import { resolveGoogleSheetsConfig } from '../config/google-sheets-config.js';
import type { Agenda } from '../models/agenda.js';
import { GoogleSheetsAgendaRepository } from '../repositories/google-sheets-agenda-repository.js';

const EVIDENCE_DIRECTORY = 'docs/evidencias';
const PROFISSIONAL_VALIDACAO = 'VALIDACAO_FASE_005';
const DATA_VALIDACAO = '01/01/2099';

/**
 * Validação reproduzível: grava fixture sintética futura, lê de volta e confirma
 * deduplicação por CPF entre pacientes ativos. Não registra PII na evidência.
 */
async function main(): Promise<void> {
  const startedAt = new Date();
  const config = resolveGoogleSheetsConfig();
  const client = new GoogleSheetsClient({
    credentialsPath: config.credentialsPath,
    spreadsheetId: config.spreadsheetId
  });
  const repository = new GoogleSheetsAgendaRepository({
    sheets: client,
    sheetName: config.sheetName
  });

  const fixture: Agenda = {
    dataConsulta: DATA_VALIDACAO,
    itens: [
      {
        horario: '08:00',
        paciente: {
          cpf: '000.000.000-00',
          nome: 'PACIENTE VALIDACAO SINTETICO',
          telefone: '(11) 90000-0000',
          email: 'validacao@example.test'
        },
        tipoProcesso: 'Primeira Habilitação',
        categoria: 'B',
        statusExameMedico: 'Apto',
        statusExamePsicologico: 'Pendente'
      },
      {
        horario: '09:00',
        paciente: {
          cpf: '111.111.111-11',
          nome: 'PACIENTE VALIDACAO SINTETICO DOIS'
        },
        categoria: 'A'
      }
    ]
  };

  const escrita = await repository.salvarAgenda(fixture, {
    profissional: PROFISSIONAL_VALIDACAO,
    unidadeOperacional: 'LIMÃO'
  });

  const leitura = await repository.listarPorData(DATA_VALIDACAO, {
    profissional: PROFISSIONAL_VALIDACAO,
    unidadeOperacional: 'LIMÃO'
  });

  const deduplicacao = await repository.salvarAgenda(fixture, {
    profissional: PROFISSIONAL_VALIDACAO,
    unidadeOperacional: 'LIMÃO'
  });

  const agendaVazia = await repository.salvarAgenda(
    { dataConsulta: DATA_VALIDACAO, itens: [] },
    { profissional: PROFISSIONAL_VALIDACAO, unidadeOperacional: 'LIMÃO' }
  );

  const aposAgendaVazia = await repository.listarPorData(DATA_VALIDACAO, {
    profissional: PROFISSIONAL_VALIDACAO,
    unidadeOperacional: 'LIMÃO'
  });

  const approved =
    escrita.sucesso === true &&
    (escrita.linhasGravadas === 2 || escrita.linhasGravadas === 0) &&
    leitura !== null &&
    leitura.itens.length === 2 &&
    leitura.itens[0]?.horario === '08:00' &&
    leitura.itens[1]?.horario === '09:00' &&
    deduplicacao.sucesso === true &&
    deduplicacao.linhasGravadas === 0 &&
    agendaVazia.sucesso === true &&
    agendaVazia.linhasRemovidas === 0 &&
    aposAgendaVazia !== null &&
    aposAgendaVazia.itens.length === 2;

  const evidencePath = await saveEvidence({
    approved,
    finishedAt: new Date().toISOString(),
    kind: 'validacao-persistencia-google-sheets',
    nodeVersion: process.version,
    phase: '005',
    schemaVersion: 2,
    startedAt: startedAt.toISOString(),
    steps: {
      emptyAgendaKeepsPatients: {
        linhasRemovidas: agendaVazia.linhasRemovidas ?? null,
        aindaPresente: aposAgendaVazia !== null,
        sucesso: agendaVazia.sucesso
      },
      dedupe: {
        linhasGravadas: deduplicacao.linhasGravadas ?? null,
        sucesso: deduplicacao.sucesso
      },
      readBack: {
        itemCount: leitura?.itens.length ?? 0,
        present: leitura !== null
      },
      write: {
        linhasGravadas: escrita.linhasGravadas ?? null,
        motivoFalha: escrita.motivoFalha ?? null,
        sucesso: escrita.sucesso
      }
    },
    summary: {
      note: approved
        ? 'Persistência Sheets validada (pacientes ativos por CPF); evidência sem PII nem conteúdo de células.'
        : 'Validação de persistência Sheets não atendeu aos critérios estruturais.'
    }
  });

  console.log(
    JSON.stringify(
      {
        approved,
        evidencePath,
        itemCount: leitura?.itens.length ?? 0,
        writeSuccess: escrita.sucesso
      },
      null,
      2
    )
  );

  if (!approved) {
    process.exitCode = 1;
  }
}

async function saveEvidence(evidence: Record<string, unknown>): Promise<string> {
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
  const startedAt =
    typeof evidence.startedAt === 'string' ? evidence.startedAt : new Date().toISOString();
  const timestamp = startedAt.replaceAll(':', '-').replaceAll('.', '-');
  const path = `${EVIDENCE_DIRECTORY}/005-validacao-sheets-${timestamp}.json`;
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return path;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  if (error instanceof ConfigurationError) {
    console.error(`Validação Sheets bloqueada por configuração: ${message}`);
  } else {
    console.error(`Validação Sheets falhou: ${message}`);
  }
  process.exitCode = 1;
});
