# Integração e-CNH: mapa de protocolo

## Status da evidência

As informações identificadas como **fato observado** foram vistas diretamente no Chrome DevTools durante a engenharia reversa. Itens identificados como **pendente de confirmação** não devem ser usados para criar contratos ou código de produção.

## Regras para a descoberta autorizada

- Use somente uma conta autorizada e o ambiente oficial indicado pelo responsável do projeto.
- Preserve uma cópia local do HAR sanitizado: remova valores de `Cookie`, `Set-Cookie`, `Authorization`, CPF, senha, paciente e qualquer identificador pessoal.
- Documente método, caminho, nomes de parâmetros, códigos de resposta, redirecionamentos e atributos de cookie; nunca valores sensíveis.

## Autenticação

### Fatos observados

```text
GET  /gefor/SGU/login.do?method=iniciarLogin
POST /gefor/SGU/login.do • method=iniciarLoginAgenda
POST /gefor/SGU/login.do • method=autenticar
  -> três respostas HTTP 200 sem redirects
  -> HTML "Imprimir Agenda Diária do Psicólogo" na resposta final
```

| Elemento                 | Fato observado                                                                                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Método e caminho         | sequência GET → POST → POST em `/gefor/SGU/login.do`                                                                                                                                                                             |
| Corpo                    | `application/x-www-form-urlencoded`                                                                                                                                                                                              |
| Parâmetros observados    | `method=autenticar`, `novaSenha=`, `novaSenha1=`, `alteraSenha=false`, `idGrupoUsuario=-1`, `idCFC=`, `idUnidTransito=-1`, `msgPublicacao=`, `consultaAgenda=true`, `autenticadoCyberark=false`, `codigo=<cpf>`, `senha=<senha>` |
| Resposta                 | HTML completo, não JSON                                                                                                                                                                                                          |
| Estilo de integração     | SSR e navegação por formulários HTML tradicionais                                                                                                                                                                                |
| Página após autenticação | contém "Imprimir Agenda Diária do Psicólogo"                                                                                                                                                                                     |

O cliente reproduz as três etapas, os corpos URL-encoded e a ordem observada. Consulte a [evidência HAR](EVIDENCIA_HAR_AUTENTICACAO.md).

### Headers de navegação configurados

O `AuthTransport` reproduz os seguintes headers principais de um Chrome em navegação HTML:

- `Accept`: formatos aceitos por uma navegação de documento;
- `Accept-Language: en-US,en;q=0.9`, conforme o HAR;
- `Origin`: derivado de `ECNH_BASE_URL`;
- `Referer`: valor específico de cada uma das três etapas;
- `Upgrade-Insecure-Requests: 1`;
- `User-Agent`: identificador reduzido do Chrome 150 em macOS.

O HAR confirmou os valores do Chrome. `Origin` está ausente no GET e presente nos dois POSTs.

### Pendências para a Fase 003A — Autenticação HTTP

| Item                                                     | Estado                             |
| -------------------------------------------------------- | ---------------------------------- |
| URL base oficial, página de entrada e redirecionamentos  | Confirmados no HAR                 |
| Todos os campos do formulário e valores ocultos          | Confirmados no HAR e implementados |
| Token CSRF ou hidden dinâmico entre as etapas            | Não observado no HAR               |
| Critério verificável de sucesso além do título observado | Confirmado: `JSESSIONID` + marcador autenticado |
| Formato do CPF no POST `autenticar`                      | Confirmado: `DDD.DDD.DDD-DD`        |
| Respostas para credenciais inválidas e sessão expirada   | Pendente de confirmação            |
| Endpoint, método e efeito do logout                      | Confirmado: `GET method=finalizarLogin` |

## Sessão e cookies

**Fato observado:** o portal usa sessão baseada em cookies e foi observado o cookie `JSESSIONID`. Todo fluxo de navegação futuro deverá preservar o mesmo CookieJar entre requisições relacionadas.

Ainda devem ser confirmados domínio, `Path`, `Secure`, `HttpOnly`, `SameSite`, expiração, rotação e o comportamento de sessão expirada. Não inferir esses atributos a partir do nome do cookie.

## Endpoints identificados

| Operação                  | Método     | Caminho                                      | Parâmetros obrigatórios                                                                 | Resposta                          | Estado         |
| ------------------------- | ---------- | -------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------- | -------------- |
| Início do login           | `GET`      | `/gefor/SGU/login.do?method=iniciarLogin`    | `method=iniciarLogin`                                                                   | HTML completo SSR                 | Fato observado |
| Início do login da agenda | `POST`     | `/gefor/SGU/login.do`                        | `method=iniciarLoginAgenda` e formulário                                                | HTML completo SSR                 | Fato observado |
| Autenticação              | `POST`     | `/gefor/SGU/login.do`                        | `method=autenticar`, CPF, senha e formulário                                            | HTML completo SSR                 | Fato observado |
| Página protegida inicial  | —          | (resposta do `method=autenticar`)            | —                                                                                       | HTML com `DivisaoEquitativaForm`  | Fato observado |
| Refresh de profissionais  | `POST`     | `/gefor/GFR/divisao/divisaoEquitativa.do`    | `method=refreshMedicosByUnidadeTransito`, `idUnidadeTransitoConsulta`                   | JSON `[{ value, label }]`         | Fato observado |
| Refresh de datas          | `POST`     | `/gefor/GFR/divisao/divisaoEquitativa.do`    | `method=refreshAgendaMedicaByMedico`, `idUsuarioMedicoConsulta`, `dataReferencia`       | JSON `[{ value, label }]`         | Fato observado |
| Consulta de agenda        | `POST`     | `/gefor/GFR/divisao/divisaoEquitativa.do`    | `method=consultarAgendaPsicologo`, unidade, usuário, `dataReferencia`, `data`           | HTML com legend `Resultado`       | Fato observado |
| Logout                    | `GET`      | `/gefor/SGU/login.do?method=finalizarLogin`  | `method=finalizarLogin`                                                                 | HTML de login                     | Fato observado |

## Navegação e HTML

**Fato observado:** depois da autenticação bem-sucedida, o próprio HTML retornado contém a página "Imprimir Agenda Diária do Psicólogo" com o formulário `DivisaoEquitativaForm`.

**Fato observado (Fase 003B):** a consulta da agenda é um `POST` URL-encoded para `/gefor/GFR/divisao/divisaoEquitativa.do` com `method=consultarAgendaPsicologo`. O botão PESQUISAR chama `pesquisar()`, que valida os campos e submete o formulário. As datas disponíveis aparecem no select `#agendamentos` (`name="data"`, valores `DD/MM/YYYY`); também podem ser recarregadas via JSON `refreshAgendaMedicaByMedico`.

**Fato observado:** a resposta da consulta mantém o marcador autenticado, troca o hidden `method` para `agendaMedico`, inclui a legend `Resultado` e a tabela `table#agenda` com cabeçalhos Hora, CPF, Nome, Telefone, E-mail, Tipo de Processo, Categoria, Status do Exame Médico e Status do Exame Psicológico.

**Fato observado (Fase 004):** `parseAgendaHtml` localiza `table#agenda`, liga colunas pelo texto do `th` e devolve `ResultadoExtracaoAgenda` tipado. A data da consulta é contexto do chamador; não é lida de forma confiável do formulário pós-POST.

## Pontos de falha a tratar

- credenciais inválidas, bloqueio temporário ou desafio adicional de autenticação;
- campos ocultos/CSRF ausentes, expirados ou alterados;
- sessão expirada, cookie rotacionado ou resposta de login disfarçada como `200 OK`;
- redirecionamentos inesperados e mudança de domínio;
- limites de taxa, timeout e indisponibilidade do portal;
- alteração de HTML, texto, IDs ou estrutura de tabelas;
- conteúdo pessoal em logs, erros, HARs ou fixtures.

## Comportamentos observados na homologação (sem automação)

**Limitações conhecidas** (evidência confirmada em homologação manual; ainda sem automação). Detalhes: [COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md](COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md). Também em [ARQUITETURA.md](ARQUITETURA.md).

| Caso | Comportamento | Estado no sistema | Backlog | Impacto observado |
| ---- | ------------- | ----------------- | ------- | ----------------- |
| Sessão já autenticada | Popup pedindo encerrar a sessão anterior antes de autenticar | Não tratado | B010 | Bloqueia sync do Italo |
| Múltiplas unidades | Tela "Escolha de Perfil e/ou Visão" (Caio → CIR-SAO PAULO → ENVIAR) | Não tratado | B011 | Bloqueia sync do Caio |

Não inferir endpoints, payloads ou seletores destes fluxos até nova descoberta autorizada com evidência HTTP.

## Implementação da Fase 003A

O `ECNHClient` implementa a sequência GET → POST → POST confirmada no HAR. Os dois POSTs usam `Content-Type` URL-encoded. `tough-cookie`, `HttpCookieAgent` e `HttpsCookieAgent` preservam o mesmo CookieJar e os mesmos agentes entre as três requisições.

O login só é classificado como sucesso quando os dois sinais confirmados estão presentes: cookie `JSESSIONID` e o marcador HTML "Imprimir Agenda Diária do Psicólogo". Ausência desses sinais é retornada como `erro desconhecido`; senha inválida e usuário bloqueado continuam sem mapeamento porque seus sinais HTTP/HTML não foram confirmados.

O CPF é normalizado para `DDD.DDD.DDD-DD` na fronteira de autenticação, conforme o HAR.

O logout envia `GET /gefor/SGU/login.do?method=finalizarLogin`, conforme o item "Sair" de `/gefor/global/menu_items.jsp`, e em seguida descarta a sessão local.

## Validação reproduzível da Fase 003A em 19/07/2026

**Evidências confirmadas:**

- `npm run validate:login` executou a sequência GET → POST → POST com agentes persistentes;
- cinco autenticações distintas retornaram `status=sucesso` com `JSESSIONID`, marcador autenticado, `DivisaoEquitativaForm` e ausência de `LoginActionForm`;
- hashes SHA-256 e metadados sanitizados foram preservados em `docs/evidencias/`;
- a consolidação oficial está em `docs/evidencias/003a-consolidacao-validacao-2026-07-19.json`;
- `npm run discover:logout` confirmou `GET method=finalizarLogin` via menu dinâmico;
- o probe de logout devolveu `LoginActionForm` e permitiu re-login imediato.

A Fase 003A está `Concluída`.

Critério, comando e limitações estão em [VALIDACAO_REPRODUZIVEL_003A.md](VALIDACAO_REPRODUZIVEL_003A.md). O histórico de tentativas anteriores permanece no [diagnóstico da autenticação](DIAGNOSTICO_AUTENTICACAO_HTTP.md) e na [auditoria do POST `method=autenticar`](AUDITORIA_POST_AUTENTICAR.md).

## Implementação da Fase 003B

O `ECNHClient` preserva o HTML autenticado após o login e expõe:

- `listarDatasAgendamento()` — lê opções `DD/MM/YYYY` do select pós-login;
- `obterHtmlAgenda({ data, dataReferencia })` — envia o POST `consultarAgendaPsicologo` e devolve o HTML bruto.

Não há parser de pacientes nesta fase. Comandos: `npm run discover:agenda`, `npm run test:agenda`, `npm run validate:agenda`.

## Validação reproduzível da Fase 003B em 19/07/2026

**Evidências confirmadas:**

- `npm run discover:agenda` inventariou o formulário, os scripts e confirmou consulta HTML + refresh JSON;
- `npm run validate:agenda` reproduziu login → consulta → logout via `ECNHClient` com legend `Resultado`, `method=agendaMedico` e cabeçalhos esperados;
- artefatos sanitizados em `docs/evidencias/003b-descoberta-navegacao-*.json` e `docs/evidencias/003b-validacao-navegacao-*.json`.

A Fase 003B está `Concluída`. Detalhes em [.fases/003b-navegacao-autenticada.md](../.fases/003b-navegacao-autenticada.md).

## Implementação da Fase 004

`parseAgendaHtml(html, contexto?)` em `src/parsers/agenda-parser.ts` converte o HTML bruto em `ResultadoExtracaoAgenda` (`src/models/agenda.ts`).

Seletores: `table#agenda` (primário); fallback por legend `Resultado` + cabeçalhos. Colunas ligadas pelo texto do `th`.

Comandos: `npm run discover:agenda-html`, `npm run test:agenda-parser`, `npm run validate:agenda-parser`.

## Validação reproduzível da Fase 004 em 19/07/2026

**Evidências confirmadas:**

- descoberta HTML e domínio em `docs/evidencias/004-descoberta-*.json`;
- seis testes unitários com fixtures em `fixtures/agenda/`;
- `npm run validate:agenda-parser` extraiu 8 itens do HTML real com evidência sanitizada.

A Fase 004 está `Concluída`. Detalhes em [.fases/004-extracao-agenda.md](../.fases/004-extracao-agenda.md).

## Implementação e conclusão da Fase 005

`AgendaRepository` persiste e recupera `Agenda` tipada. A implementação `GoogleSheetsAgendaRepository` usa Service Account (`googleapis` Sheets v4), `AgendaSheetMapper` puro e a aba `Agenda`.

Comandos: `npm run test:sheets`, `npm run discover:sheets`, `npm run validate:sheets`.

A Fase 005 está `Concluída` (implementação + validação real).

## Validação reproduzível da Fase 005 em 19/07/2026

**Evidências confirmadas:**

- descoberta de conexão: `docs/evidencias/005-descoberta-conexao-sheets-2026-07-19T13-23-22-770Z.json` (`hasAgendaSheet=true`);
- validação: `docs/evidencias/005-validacao-sheets-2026-07-19T13-23-24-530Z.json` (escrita 2 linhas, leitura e limpeza);
- nove testes unitários de mapper/repositório aprovados sem rede.

A Fase 005 está `Concluída`. Detalhes em [.fases/005-integracao-google-sheets.md](../.fases/005-integracao-google-sheets.md).
