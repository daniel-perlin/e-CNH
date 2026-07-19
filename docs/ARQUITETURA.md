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
AgendaService ──> AgendaParser (Cheerio) ──> Google Sheets
```

`ECNHClient` é o centro da integração com o portal: autenticação, manutenção de sessão, transporte HTTP e navegação autenticada. Nenhuma outra camada realiza chamadas HTTP diretamente ao e-CNH. Parser e integração com Sheets trabalham sobre dados/HTML entregues pelos contratos do cliente e do serviço, sem conhecer Axios, cookies ou endpoints.

A **Fase 003A — Autenticação HTTP** trata exclusivamente login e sessão. A **Fase 003B — Navegação autenticada** adiciona navegação pós-login e entrega HTML de agenda. A **Fase 004 — Extração de dados da agenda** converte esse HTML em modelos tipados via Cheerio. As fases **005 — Integração Google Sheets**, **006 — Orquestração multi-profissionais** e **007 — Agendamento automático (cron)** evoluem repositório, serviços e jobs, respectivamente, sem antecipar escopo.

Os contratos conceituais entre essas camadas estão em [MODELO_DOMINIO.md](MODELO_DOMINIO.md). Eles orientam a evolução sem antecipar tipos, campos obrigatórios ou respostas HTTP ainda não confirmadas.

## Responsabilidades

| Camada         | Responsabilidade                                                          | Não deve fazer                                      |
| -------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| `client`       | `ECNHClient`: autenticação, sessão, transporte e navegação autenticada.   | Interpretar agenda ou decidir regra de negócio.     |
| `parsers`      | Converter HTML recebido pelo fluxo do `ECNHClient` em estruturas tipadas. | Fazer requests ou reter sessão.                     |
| `repositories` | Traduzir operações externas em contratos internos.                        | Expor Axios/Cheerio aos serviços.                   |
| `services`     | Coordenar casos de uso usando `ECNHClient`; fornecer HTML ao parser.      | Conhecer cookies, campos ou seletores HTML.         |
| `jobs`         | Disparar processos no futuro.                                             | Incluir autenticação, parsing ou regras de negócio. |

## Sessão

`JSESSIONID` foi observado no DevTools. A sessão é preservada por um CookieJar `tough-cookie` durante toda a navegação autenticada, conectado ao Axios por instâncias persistentes de `HttpCookieAgent` e `HttpsCookieAgent`. A estratégia evita dependência de estado de navegador e mantém cookies e agentes encapsulados no cliente.

## Resultado explícito de autenticação

A Fase 003A — Autenticação HTTP modela um resultado de login explícito, em vez de reduzir toda falha a uma exceção genérica. Os estados conceituais são: sucesso, senha inválida, usuário bloqueado, erro do sistema e erro desconhecido. A associação entre resposta HTTP/HTML e cada estado só será definida com evidência observada; por enquanto trata-se de uma decisão de modelagem, não de um contrato do portal.

## Papel do Playwright

Playwright não é tecnologia principal e não será usado no fluxo produtivo normal. Poderá ser usado somente para depuração, investigação de fluxos novos ou caso futuro em que JavaScript de navegador seja comprovadamente necessário para completar uma operação.

## Limites confirmados

- A Fase 004 implementou parser e modelos tipados de agenda; Sheets (005), orquestração multi-profissionais (006) e cron (007) permanecem pendentes.
- O `ECNHClient` continua responsável apenas por HTTP/sessão/HTML bruto; o parser não conhece Axios nem cookies.
- Credenciais, tokens e valores de cookies não podem ser persistidos ou registrados em logs.
