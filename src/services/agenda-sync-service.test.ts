import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Agenda, ResultadoExtracaoAgenda } from '../models/agenda.js';
import type {
  AgendaRepository,
  ContextoPersistenciaAgenda,
  ResultadoPersistenciaAgenda
} from '../repositories/agenda-repository.js';
import type { LoginResult } from '../types/auth.js';

import {
  AgendaSyncPortalClient,
  AgendaSyncService,
  EntradaSincronizacaoProfissional
} from './agenda-sync-service.js';

interface FakeClientOptions {
  datas?: string[];
  loginResult?: LoginResult;
  obterHtml?: (data: string) => Promise<string>;
  logoutError?: Error;
}

class FakePortalClient implements AgendaSyncPortalClient {
  public readonly calls: {
    listarDatas: number;
    login: number;
    logout: number;
    obterHtml: string[];
  } = {
    listarDatas: 0,
    login: 0,
    logout: 0,
    obterHtml: []
  };

  private readonly datas: string[];
  private readonly loginResult: LoginResult;
  private readonly obterHtmlImpl: (data: string) => Promise<string>;
  private readonly logoutError: Error | undefined;

  public constructor(options: FakeClientOptions = {}) {
    this.datas = options.datas ?? ['13/07/2026'];
    this.loginResult = options.loginResult ?? {
      status: 'sucesso',
      session: {
        authenticatedAt: new Date('2026-07-19T12:00:00.000Z'),
        perfilId: 'psicologo'
      }
    };
    this.obterHtmlImpl =
      options.obterHtml ?? (async (data) => `<html data-consulta="${data}"></html>`);
    this.logoutError = options.logoutError;
  }

  public async login(cpf: string, password: string): Promise<LoginResult> {
    void cpf;
    void password;
    this.calls.login += 1;
    return this.loginResult;
  }

  public listarDatasAgendamento(): string[] {
    this.calls.listarDatas += 1;
    return [...this.datas];
  }

  public async obterHtmlAgenda(params: {
    data: string;
    dataReferencia: string;
  }): Promise<string> {
    this.calls.obterHtml.push(params.data);
    assert.equal(params.dataReferencia, params.data);
    return this.obterHtmlImpl(params.data);
  }

  public async logout(): Promise<void> {
    this.calls.logout += 1;
    if (this.logoutError !== undefined) {
      throw this.logoutError;
    }
  }
}

class FakeAgendaRepository implements AgendaRepository {
  public readonly salvos: Array<{ agenda: Agenda; contexto: ContextoPersistenciaAgenda }> = [];
  private readonly resultado: ResultadoPersistenciaAgenda | ((agenda: Agenda) => ResultadoPersistenciaAgenda);
  private readonly throwOnSave: Error | undefined;

  public constructor(options: {
    resultado?: ResultadoPersistenciaAgenda | ((agenda: Agenda) => ResultadoPersistenciaAgenda);
    throwOnSave?: Error;
  } = {}) {
    this.resultado = options.resultado ?? {
      sucesso: true,
      linhasGravadas: 1,
      linhasRemovidas: 0
    };
    this.throwOnSave = options.throwOnSave;
  }

  public async salvarAgenda(
    agenda: Agenda,
    contexto: ContextoPersistenciaAgenda
  ): Promise<ResultadoPersistenciaAgenda> {
    if (this.throwOnSave !== undefined) {
      throw this.throwOnSave;
    }
    this.salvos.push({ agenda, contexto });
    return typeof this.resultado === 'function' ? this.resultado(agenda) : this.resultado;
  }

  public async listarPorData(): Promise<Agenda | null> {
    return null;
  }
}

const entradaBase: EntradaSincronizacaoProfissional = {
  cpf: '000.000.000-00',
  password: 'senha-sintetica',
  profissional: 'Profissional Teste',
  identificadorSeguro: 'ECNH_USER_TEST',
  unidadeOperacional: 'LIMÃO'
};

function parserComAgenda(itens = 1): (html: string, contexto?: { dataConsulta?: string }) => ResultadoExtracaoAgenda {
  return (_html, contexto) => ({
    sucesso: true,
    agenda: {
      dataConsulta: contexto?.dataConsulta,
      itens: Array.from({ length: itens }, (_, index) => ({
        horario: `0${index + 8}:00`,
        paciente: { nome: `PACIENTE ${index + 1}` }
      }))
    }
  });
}

describe('AgendaSyncService.sincronizarProfissional', () => {
  it('login com sucesso sincroniza datas sequencialmente e persiste', async () => {
    const client = new FakePortalClient({ datas: ['13/07/2026', '14/07/2026'] });
    const repository = new FakeAgendaRepository({
      resultado: (agenda) => ({
        sucesso: true,
        linhasGravadas: agenda.itens.length,
        linhasRemovidas: 0
      })
    });
    const service = new AgendaSyncService({
      client,
      agendaRepository: repository,
      parseAgendaHtml: parserComAgenda(2)
    });

    const resultado = await service.sincronizarProfissional(entradaBase);

    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.loginStatus, 'sucesso');
    assert.equal(resultado.logoutExecutado, true);
    assert.equal(resultado.identificadorSeguro, 'ECNH_USER_TEST');
    assert.equal(resultado.datas.length, 2);
    assert.deepEqual(
      resultado.datas.map((item) => item.dataConsulta),
      ['13/07/2026', '14/07/2026']
    );
    assert.equal(resultado.datas[0]?.sucesso, true);
    assert.equal(resultado.datas[0]?.itensExtraidos, 2);
    assert.equal(resultado.datas[0]?.linhasGravadas, 2);
    assert.equal(client.calls.login, 1);
    assert.equal(client.calls.listarDatas, 1);
    assert.deepEqual(client.calls.obterHtml, ['13/07/2026', '14/07/2026']);
    assert.equal(client.calls.logout, 1);
    assert.equal(repository.salvos.length, 2);
    assert.equal(repository.salvos[0]?.contexto.profissional, 'Profissional Teste');
    assert.equal(repository.salvos[0]?.contexto.perfilId, 'psicologo');
    assert.equal(repository.salvos[0]?.contexto.unidadeOperacional, 'LIMÃO');
  });

  it('login com falha interrompe o fluxo sem consultar datas', async () => {
    const client = new FakePortalClient({
      loginResult: { status: 'senha_invalida', message: 'credencial rejeitada' }
    });
    const repository = new FakeAgendaRepository();
    let parserChamado = false;
    const service = new AgendaSyncService({
      client,
      agendaRepository: repository,
      parseAgendaHtml: () => {
        parserChamado = true;
        return { sucesso: true, agenda: { itens: [] } };
      }
    });

    const resultado = await service.sincronizarProfissional(entradaBase);

    assert.equal(resultado.sucesso, false);
    assert.equal(resultado.loginStatus, 'senha_invalida');
    assert.equal(resultado.logoutExecutado, true);
    assert.equal(resultado.datas.length, 0);
    assert.equal(client.calls.login, 1);
    assert.equal(client.calls.listarDatas, 0);
    assert.equal(client.calls.obterHtml.length, 0);
    assert.equal(client.calls.logout, 1);
    assert.equal(repository.salvos.length, 0);
    assert.equal(parserChamado, false);
  });

  it('nenhuma data disponível conclui com sucesso e lista vazia', async () => {
    const client = new FakePortalClient({ datas: [] });
    const repository = new FakeAgendaRepository();
    const service = new AgendaSyncService({
      client,
      agendaRepository: repository,
      parseAgendaHtml: parserComAgenda()
    });

    const resultado = await service.sincronizarProfissional(entradaBase);

    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.loginStatus, 'sucesso');
    assert.equal(resultado.logoutExecutado, true);
    assert.equal(resultado.datas.length, 0);
    assert.equal(client.calls.obterHtml.length, 0);
    assert.equal(repository.salvos.length, 0);
  });

  it('persistência bem-sucedida registra contagens no resultado da data', async () => {
    const client = new FakePortalClient({ datas: ['13/07/2026'] });
    const repository = new FakeAgendaRepository({
      resultado: { sucesso: true, linhasGravadas: 3, linhasRemovidas: 1 }
    });
    const service = new AgendaSyncService({
      client,
      agendaRepository: repository,
      parseAgendaHtml: parserComAgenda(3)
    });

    const resultado = await service.sincronizarProfissional(entradaBase);

    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.datas[0]?.sucesso, true);
    assert.equal(resultado.datas[0]?.itensExtraidos, 3);
    assert.equal(resultado.datas[0]?.linhasGravadas, 3);
    assert.equal(resultado.datas[0]?.linhasRemovidas, 1);
  });

  it('persistência com falha marca a data e continua o profissional como não sucesso', async () => {
    const client = new FakePortalClient({ datas: ['13/07/2026', '14/07/2026'] });
    const repository = new FakeAgendaRepository({
      resultado: (agenda) =>
        agenda.dataConsulta === '13/07/2026'
          ? { sucesso: false, motivoFalha: 'erro-infraestrutura' }
          : { sucesso: true, linhasGravadas: 1, linhasRemovidas: 0 }
    });
    const service = new AgendaSyncService({
      client,
      agendaRepository: repository,
      parseAgendaHtml: parserComAgenda(1)
    });

    const resultado = await service.sincronizarProfissional(entradaBase);

    assert.equal(resultado.sucesso, false);
    assert.equal(resultado.logoutExecutado, true);
    assert.equal(resultado.datas[0]?.sucesso, false);
    assert.equal(resultado.datas[0]?.motivoFalhaPersistencia, 'erro-infraestrutura');
    assert.equal(resultado.datas[1]?.sucesso, true);
    assert.equal(repository.salvos.length, 2);
  });

  it('parser lançando erro falha a data sem impedir o logout', async () => {
    const client = new FakePortalClient({ datas: ['13/07/2026'] });
    const repository = new FakeAgendaRepository();
    const service = new AgendaSyncService({
      client,
      agendaRepository: repository,
      parseAgendaHtml: () => {
        throw new Error('falha sintética no parser');
      }
    });

    const resultado = await service.sincronizarProfissional(entradaBase);

    assert.equal(resultado.sucesso, false);
    assert.equal(resultado.logoutExecutado, true);
    assert.equal(resultado.datas[0]?.sucesso, false);
    assert.equal(resultado.datas[0]?.motivoFalhaExtracao, 'estrutura-invalida');
    assert.equal(repository.salvos.length, 0);
    assert.equal(client.calls.logout, 1);
  });

  it('logout é executado sempre no finally após login com sucesso', async () => {
    const client = new FakePortalClient({ datas: ['13/07/2026'] });
    const repository = new FakeAgendaRepository({
      throwOnSave: new Error('falha sintética na persistência')
    });
    const service = new AgendaSyncService({
      client,
      agendaRepository: repository,
      parseAgendaHtml: parserComAgenda()
    });

    const resultado = await service.sincronizarProfissional(entradaBase);

    assert.equal(resultado.logoutExecutado, true);
    assert.equal(client.calls.logout, 1);
    assert.equal(resultado.sucesso, false);
  });

  it('logout é executado no finally mesmo quando o login falha', async () => {
    const client = new FakePortalClient({
      loginResult: { status: 'erro_desconhecido', message: 'falha sintética' }
    });
    const service = new AgendaSyncService({
      client,
      agendaRepository: new FakeAgendaRepository(),
      parseAgendaHtml: parserComAgenda()
    });

    const resultado = await service.sincronizarProfissional(entradaBase);

    assert.equal(resultado.loginStatus, 'erro_desconhecido');
    assert.equal(resultado.logoutExecutado, true);
    assert.equal(client.calls.logout, 1);
  });
});

describe('AgendaSyncService.sincronizarProfissionais', () => {
  it('percorre profissionais em sequência e agrega sucessos', async () => {
    const clients: FakePortalClient[] = [];
    const repository = new FakeAgendaRepository({
      resultado: { sucesso: true, linhasGravadas: 1, linhasRemovidas: 0 }
    });
    const service = new AgendaSyncService({
      client: () => {
        const client = new FakePortalClient({ datas: ['13/07/2026'] });
        clients.push(client);
        return client;
      },
      agendaRepository: repository,
      parseAgendaHtml: parserComAgenda(1)
    });

    const entradas: EntradaSincronizacaoProfissional[] = [
      {
        ...entradaBase,
        identificadorSeguro: 'ECNH_USER_1',
        profissional: 'Profissional Um'
      },
      {
        ...entradaBase,
        identificadorSeguro: 'ECNH_USER_2',
        profissional: 'Profissional Dois'
      }
    ];

    const resultado = await service.sincronizarProfissionais(entradas);

    assert.equal(resultado.sucessoGeral, true);
    assert.equal(resultado.profissionais.length, 2);
    assert.equal(resultado.profissionais[0]?.identificadorSeguro, 'ECNH_USER_1');
    assert.equal(resultado.profissionais[1]?.identificadorSeguro, 'ECNH_USER_2');
    assert.equal(resultado.profissionais[0]?.sucesso, true);
    assert.equal(resultado.profissionais[1]?.sucesso, true);
    assert.equal(clients.length, 2);
    assert.equal(clients[0]?.calls.login, 1);
    assert.equal(clients[1]?.calls.login, 1);
    assert.equal(clients[0]?.calls.logout, 1);
    assert.equal(clients[1]?.calls.logout, 1);
    assert.equal(repository.salvos.length, 2);
    assert.deepEqual(
      repository.salvos.map((item) => item.contexto.profissional),
      ['Profissional Um', 'Profissional Dois']
    );
    assert.equal(JSON.stringify(resultado).includes('000.000.000-00'), false);
    assert.equal(JSON.stringify(resultado).includes('senha-sintetica'), false);
  });

  it('continua após falha parcial de um profissional', async () => {
    let indice = 0;
    const repository = new FakeAgendaRepository();
    const service = new AgendaSyncService({
      client: () => {
        const atual = indice;
        indice += 1;
        return new FakePortalClient({
          datas: ['13/07/2026'],
          loginResult:
            atual === 0
              ? { status: 'senha_invalida', message: 'credencial rejeitada' }
              : {
                  status: 'sucesso',
                  session: {
                    authenticatedAt: new Date('2026-07-19T12:00:00.000Z'),
                    perfilId: 'psicologo'
                  }
                }
        });
      },
      agendaRepository: repository,
      parseAgendaHtml: parserComAgenda(1)
    });

    const resultado = await service.sincronizarProfissionais([
      { ...entradaBase, identificadorSeguro: 'ECNH_USER_1', profissional: 'Alpha' },
      { ...entradaBase, identificadorSeguro: 'ECNH_USER_2', profissional: 'Beta' }
    ]);

    assert.equal(resultado.sucessoGeral, false);
    assert.equal(resultado.profissionais.length, 2);
    assert.equal(resultado.profissionais[0]?.sucesso, false);
    assert.equal(resultado.profissionais[0]?.loginStatus, 'senha_invalida');
    assert.equal(resultado.profissionais[1]?.sucesso, true);
    assert.equal(resultado.profissionais[1]?.loginStatus, 'sucesso');
    assert.equal(repository.salvos.length, 1);
    assert.equal(repository.salvos[0]?.contexto.profissional, 'Beta');
  });

  it('lista vazia devolve sucessoGeral verdadeiro sem profissionais', async () => {
    const service = new AgendaSyncService({
      client: new FakePortalClient(),
      agendaRepository: new FakeAgendaRepository(),
      parseAgendaHtml: parserComAgenda()
    });

    const resultado = await service.sincronizarProfissionais([]);

    assert.equal(resultado.sucessoGeral, true);
    assert.equal(resultado.profissionais.length, 0);
  });
});
