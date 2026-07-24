# Arquitetura de integração e-CNH

## Estratégia principal

O portal e-CNH é integrado diretamente por HTTP. A evidência observada mostra respostas HTML SSR e navegação por formulários, não uma API REST. Portanto, o fluxo de produção usará Node.js, TypeScript, Axios, tough-cookie, http-cookie-agent e Cheerio.

```text
Portal e-CNH
        ▲
        │ HTTP
Axios + CookieJar
        ▲
        │ transporte e sessão
        │
   ECNHClient
        ▲
        │ HTML e contratos de navegação
        │
AgendaSyncJob / SyncLock (Fase 007)
        │
AgendaSyncService ──> parseAgendaHtml (Cheerio)
        │
        ├──> AgendaRepository ──> Google Sheets (operacional; B004/B005)
        └──> PessoaRepository ──> SQLite/Postgres (histórico; best-effort; ADR-022)
```

`ECNHClient` é o centro da integração com o portal: autenticação, manutenção de sessão, transporte HTTP e navegação autenticada. Nenhuma outra camada realiza chamadas HTTP diretamente ao e-CNH. Parser e integração com Sheets trabalham sobre dados/HTML entregues pelos contratos do cliente e do serviço, sem conhecer Axios, cookies ou endpoints.

A camada `src/db/` é a persistência relacional **genérica** da aplicação (schemas + client). O primeiro consumidor é `PessoaRepository`; repositórios futuros (profissional, agendamento, sync_run) compartilham o mesmo client sem acoplar o serviço ao SQL.

A **Fase 003A — Autenticação HTTP** trata exclusivamente login e sessão. A **Fase 003B — Navegação autenticada** adiciona navegação pós-login e entrega HTML de agenda. A **Fase 004 — Extração de dados da agenda** converte esse HTML em modelos tipados via Cheerio. A **Fase 005 — Integração Google Sheets** persiste os modelos via `AgendaRepository` / `GoogleSheetsAgendaRepository`. A **Fase 006 — Orquestração multi-profissionais** entrega `AgendaSyncService` e o script `npm run sync:agenda` (`Concluída`). A **Fase 007 — Agendamento automático (cron)** entrega daemon, `SyncLock` e `AgendaSyncJob` sobre o serviço existente (`Concluída`, ADR-013).

**Pós-MVP:**

- a **Fase 003C / B012** (`Concluída`) entregou a arquitetura de **perfis profissionais do portal** (`PerfilProfissionalPortal`, ADR-014): o `ECNHClient` resolve o perfil pelo HTML (e opcionalmente por config), permitindo Médico e **perfis futuros** com mínimo impacto em parser, repositório, serviços e jobs. Validada com profissional Médico real (Italo).
- a **Fase 003D / B011** (`Concluída`) entregou a escolha genérica de **unidade/visão** (`EscolhaUnidadePortal`, ADR-015): ramo opcional pós-`autenticar` (`openDialogChoice` → `openChoice` → segundo `autenticar` com `idUnidTransito` via `UNIDADE`/`UNID_TRANSITO`), isolado de B012. Validada com profissional multi-unidade real.

Os contratos conceituais entre essas camadas estão em [MODELO_DOMINIO.md](MODELO_DOMINIO.md). Eles orientam a evolução sem antecipar tipos, campos obrigatórios ou respostas HTTP ainda não confirmadas.

## Responsabilidades

| Camada         | Responsabilidade                                                          | Não deve fazer                                      |
| -------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| `client`       | `ECNHClient` (portal) e `GoogleSheetsClient` (Sheets API).                | Interpretar agenda ou decidir regra de negócio.     |
| `parsers`      | Converter HTML recebido pelo fluxo do `ECNHClient` em estruturas tipadas. | Fazer requests ou reter sessão.                     |
| `repositories` | `AgendaRepository` (Sheets) e `PessoaRepository` (banco); portas sem expor SDK/SQL. | Expor Axios/Cheerio/`googleapis`/Drizzle aos serviços. |
| `domain`       | Políticas de negócio (ex.: `AgendaOperacionalPolicy`).                            | HTTP, SQL, Sheets API.                                  |
| `db`           | Client e schemas da persistência relacional (SQLite/Postgres).                    | Regras de sincronização ou HTML.                        |
| `services`     | Coordenar casos de uso usando `ECNHClient`; fornecer HTML ao parser.      | Conhecer cookies, campos ou seletores HTML.         |
| `jobs`         | Disparo agendado, `SyncLock` e chamada ao serviço (Fase 007).             | Incluir autenticação, parsing ou regras de negócio. |

## Sessão

`JSESSIONID` foi observado no DevTools. A sessão é preservada por um CookieJar `tough-cookie` durante toda a navegação autenticada, conectado ao Axios por instâncias persistentes de `HttpCookieAgent` e `HttpsCookieAgent`. A estratégia evita dependência de estado de navegador e mantém cookies e agentes encapsulados no cliente.

## Resultado explícito de autenticação

A Fase 003A — Autenticação HTTP modela um resultado de login explícito, em vez de reduzir toda falha a uma exceção genérica. Os estados conceituais são: sucesso, senha inválida, usuário bloqueado, erro do sistema e erro desconhecido. A associação entre resposta HTTP/HTML e cada estado só será definida com evidência observada; por enquanto trata-se de uma decisão de modelagem, não de um contrato do portal.

## Papel do Playwright

Playwright não é tecnologia principal e não será usado no fluxo produtivo normal. Poderá ser usado somente para depuração, investigação de fluxos novos ou caso futuro em que JavaScript de navegador seja comprovadamente necessário para completar uma operação.

## Limites confirmados

- A Fase 005 está `Concluída`: persistência via `AgendaRepository` / Google Sheets foi implementada e validada no ambiente real.
- A implementação Sheets mantém **pacientes ativos** via `AgendaOperacionalPolicy` (AGENDAMENTO DO DETRAN **hoje ou futuro**): remove automaticamente registros cuja data já passou e usa **CPF** como chave única enquanto o paciente permanece ativo (B004/B005). O CPF continua sendo a identidade de negócio; apenas deixa de constar no contrato visual das colunas operacionais.
- A Fase 006 está `Concluída`: `AgendaSyncService` orquestra multi-profissional sob demanda (`npm run sync:agenda`).
- A Fase 007 está `Concluída`: jobs disparam o serviço via lock global (`npm run job:agenda`); o serviço não conhece cron nem arquivo de lock.
- O `ECNHClient` continua responsável apenas por HTTP/sessão/HTML bruto; o parser não conhece Axios nem cookies; o domínio não conhece `googleapis`.
- Credenciais, tokens e valores de cookies não podem ser persistidos ou registrados em logs.

## Limitações conhecidas do portal (homologação)

1. **Sessão já autenticada** — `openDialogNewSession` → `POST autenticar` com `forceLogout=true` no mesmo CookieJar. **Automatizado**. Backlog `B010` / Fase 003E.
2. **Escolha de Perfil / Visão (unidade)** — **automatizada (B011 / Fase 003D)**: `openDialogChoice` → `openChoice` → segundo `autenticar` com `idUnidTransito` via config `UNIDADE`/`UNID_TRANSITO`. Conceito distinto do `PerfilProfissionalPortal` (B012).

Detalhes: [COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md](COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md). Fluxo feliz: [API.md](API.md) / [FLUXO_HTTP.md](FLUXO_HTTP.md). Catálogo: [BACKLOG.md](BACKLOG.md).
