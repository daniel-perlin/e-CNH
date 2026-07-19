import 'dotenv/config';

import { ECNHClient } from '../client/ecnh-client.js';
import { resolveLoginCredentials } from '../config/login-credentials.js';

async function main(): Promise<void> {
  const baseUrl = process.env.ECNH_BASE_URL;
  if (baseUrl === undefined || baseUrl.trim().length === 0) {
    throw new Error('Defina ECNH_BASE_URL no arquivo .env antes de executar o teste.');
  }

  const credentials = resolveLoginCredentials();
  const client = new ECNHClient({ baseUrl });
  const result = await client.login(credentials.cpf, credentials.password);

  if (result.status !== 'sucesso') {
    console.error(`Login não confirmado: ${result.status}. ${result.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Autenticação confirmada (${credentials.source}); sessão mantida no CookieJar.`);
  await client.logout();
  console.log('Sessão local encerrada com sucesso.');
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`Teste de autenticação falhou: ${message}`);
  process.exitCode = 1;
});
