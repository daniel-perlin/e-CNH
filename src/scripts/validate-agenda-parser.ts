import 'dotenv/config';

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

import { ECNHClient } from '../client/ecnh-client.js';
import { ConfigurationError } from '../client/errors.js';
import {
  listEnabledLoginCredentials,
  resolveLoginCredentials
} from '../config/login-credentials.js';
import { parseAgendaHtml } from '../parsers/agenda-parser.js';

const EVIDENCE_DIRECTORY = 'docs/evidencias';

/**
 * Validação reproduzível: HTML real → parser → evidência sanitizada (sem PII).
 */
async function main(): Promise<void> {
  const baseUrl = process.env.ECNH_BASE_URL;
  if (baseUrl === undefined || baseUrl.trim().length === 0) {
    throw new ConfigurationError(
      'Defina ECNH_BASE_URL no arquivo .env antes de executar a validação.'
    );
  }

  const credentials =
    listEnabledLoginCredentials().find((item) => item.source.length > 0) ??
    resolveLoginCredentials();

  const startedAt = new Date();
  const client = new ECNHClient({
    baseUrl,
    logger: createQuietLogger()
  });

  const loginResult = await client.login(credentials.cpf, credentials.password);
  if (loginResult.status !== 'sucesso') {
    await saveEvidence({
      approved: false,
      credentialsSource: credentials.source,
      finishedAt: new Date().toISOString(),
      kind: 'validacao-parser-agenda',
      loginStatus: loginResult.status,
      nodeVersion: process.version,
      phase: '004',
      schemaVersion: 1,
      startedAt: startedAt.toISOString(),
      summary: { note: 'Login não confirmado; validação do parser abortada.' }
    });
    throw new ConfigurationError(`Login não confirmado: ${loginResult.status}`);
  }

  const datesAvailable = client.listarDatasAgendamento();
  const data = datesAvailable[0];
  if (data === undefined) {
    await client.logout();
    throw new ConfigurationError('Nenhuma data disponível para validar o parser.');
  }

  const html = await client.obterHtmlAgenda({ data, dataReferencia: data });
  const parseResult = parseAgendaHtml(html, { dataConsulta: data });
  await client.logout();

  const itemCount = parseResult.agenda?.itens.length ?? 0;
  const fieldPresence = summarizeFieldPresence(parseResult);

  const approved =
    parseResult.sucesso === true &&
    parseResult.agenda !== undefined &&
    parseResult.agenda.dataConsulta === data &&
    itemCount >= 0 &&
    (itemCount === 0 || fieldPresence.horarioPresentOnAllItems);

  const evidencePath = await saveEvidence({
    approved,
    credentialsSource: credentials.source,
    finishedAt: new Date().toISOString(),
    kind: 'validacao-parser-agenda',
    loginStatus: 'sucesso',
    nodeVersion: process.version,
    phase: '004',
    schemaVersion: 1,
    startedAt: startedAt.toISOString(),
    steps: {
      consultation: {
        bodyBytes: Buffer.byteLength(html, 'latin1'),
        bodySha256: sha256(html),
        dataKind: 'date'
      },
      logoutCompleted: true,
      parse: {
        dataConsultaAttached: parseResult.agenda?.dataConsulta !== undefined,
        fieldPresence,
        itemCount,
        motivoFalha: parseResult.motivoFalha ?? null,
        sucesso: parseResult.sucesso
      }
    },
    summary: {
      note: approved
        ? 'Parser extraiu agenda tipada a partir do HTML real, sem registrar dados pessoais.'
        : 'Validação do parser não atendeu aos critérios estruturais.'
    }
  });

  console.log(
    JSON.stringify(
      {
        approved,
        evidencePath,
        itemCount,
        motivoFalha: parseResult.motivoFalha ?? null,
        sucesso: parseResult.sucesso
      },
      null,
      2
    )
  );

  if (!approved) {
    process.exitCode = 1;
  }
}

function summarizeFieldPresence(parseResult: ReturnType<typeof parseAgendaHtml>): {
  categoriaPresentCount: number;
  cpfPresentCount: number;
  emailPresentCount: number;
  horarioPresentOnAllItems: boolean;
  nomePresentCount: number;
  statusExameMedicoPresentCount: number;
  statusExamePsicologicoPresentCount: number;
  telefonePresentCount: number;
  tipoProcessoPresentCount: number;
} {
  const itens = parseResult.agenda?.itens ?? [];
  const count = (predicate: (item: (typeof itens)[number]) => boolean): number =>
    itens.filter(predicate).length;

  return {
    categoriaPresentCount: count((item) => item.categoria !== undefined),
    cpfPresentCount: count((item) => item.paciente.cpf !== undefined),
    emailPresentCount: count((item) => item.paciente.email !== undefined),
    horarioPresentOnAllItems:
      itens.length === 0 || itens.every((item) => item.horario !== undefined),
    nomePresentCount: count((item) => item.paciente.nome !== undefined),
    statusExameMedicoPresentCount: count((item) => item.statusExameMedico !== undefined),
    statusExamePsicologicoPresentCount: count(
      (item) => item.statusExamePsicologico !== undefined
    ),
    telefonePresentCount: count((item) => item.paciente.telefone !== undefined),
    tipoProcessoPresentCount: count((item) => item.tipoProcesso !== undefined)
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'latin1').digest('hex');
}

function createQuietLogger() {
  const noop = (): void => undefined;
  return { debug: noop, error: noop, info: noop, warn: noop };
}

async function saveEvidence(evidence: Record<string, unknown>): Promise<string> {
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
  const startedAt =
    typeof evidence.startedAt === 'string' ? evidence.startedAt : new Date().toISOString();
  const timestamp = startedAt.replaceAll(':', '-').replaceAll('.', '-');
  const path = `${EVIDENCE_DIRECTORY}/004-validacao-parser-${timestamp}.json`;
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return path;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`Validação do parser de agenda falhou: ${message}`);
  process.exitCode = 1;
});
