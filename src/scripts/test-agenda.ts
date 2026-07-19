import 'dotenv/config';

import { ECNHClient } from '../client/ecnh-client.js';
import { ConfigurationError } from '../client/errors.js';
import { resolveLoginCredentials } from '../config/login-credentials.js';

async function main(): Promise<void> {
  const baseUrl = process.env.ECNH_BASE_URL;
  if (baseUrl === undefined || baseUrl.trim().length === 0) {
    throw new ConfigurationError('Defina ECNH_BASE_URL no arquivo .env.');
  }

  const credentials = resolveLoginCredentials();
  const client = new ECNHClient({
    baseUrl,
    perfilEsperado: credentials.perfilEsperado,
    unidadeDesejada: credentials.unidadeDesejada
  });

  const loginResult = await client.login(credentials.cpf, credentials.password);
  console.log(`login=${loginResult.status}`);
  if (loginResult.status !== 'sucesso') {
    process.exitCode = 1;
    return;
  }

  console.log(`perfilId=${loginResult.session.perfilId}`);

  try {
    const dates = client.listarDatasAgendamento();
    console.log(`datasDisponiveis=${dates.length}`);
    if (dates.length === 0) {
      console.log('consulta=ignorada (sem datas no HTML pós-login)');
      process.exitCode = 1;
      return;
    }

    const data = dates[0];
    const html = await client.obterHtmlAgenda({ data, dataReferencia: data });
    const hasResultado = html.includes('Resultado');
    const hasAgendaMedico = html.includes('agendaMedico');
    const hasLoginForm = html.includes('LoginActionForm');

    console.log(
      [
        `consulta=ok`,
        `htmlBytes=${Buffer.byteLength(html, 'latin1')}`,
        `resultado=${hasResultado}`,
        `agendaMedico=${hasAgendaMedico}`,
        `loginForm=${hasLoginForm}`
      ].join(' ')
    );

    if (!hasResultado || !hasAgendaMedico || hasLoginForm) {
      process.exitCode = 1;
    }
  } finally {
    await client.logout();
    console.log('logout=ok');
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'erro desconhecido';
  console.error(`test:agenda falhou: ${message}`);
  process.exitCode = 1;
});
