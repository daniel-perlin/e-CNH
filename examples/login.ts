import 'dotenv/config';

import { ECNHClient } from '../src/client/ecnh-client.js';

async function main(): Promise<void> {
  const client = new ECNHClient({ baseUrl: process.env.ECNH_BASE_URL ?? '' });
  const result = await client.login(process.env.ECNH_CPF ?? '', process.env.ECNH_PASSWORD ?? '');

  if (result.status !== 'sucesso') {
    console.error(`Login não confirmado: ${result.status}.`);
    process.exitCode = 1;
    return;
  }

  console.log('Login confirmado e sessão criada.');
  await client.logout();
}

void main();
