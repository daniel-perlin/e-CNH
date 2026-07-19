# e-CNH

Base do sincronizador entre o portal e-CNH SP e uma planilha Google Sheets. O produto buscará as agendas futuras dos profissionais e manterá a aba `Agenda` atualizada de forma automatizada.

> **Fase atual:** 003A — Autenticação HTTP (`Implementada`). O único `status=sucesso` não possui resposta preservada e não foi reproduzido. A bateria eliminou `ECONNRESET`, mas obteve 0 sucessos em 20 execuções. A Fase 003B — Navegação autenticada permanece `Planejada`.

## Leitura recomendada

- [Visão do produto](docs/VISAO_DO_PRODUTO.md) — objetivo, usuários, fluxo operacional, MVP, escopo e backlog funcional
- [Arquitetura](docs/ARQUITETURA.md) — camadas técnicas, responsabilidades e limites de integração
- [Roadmap](docs/ROADMAP.md) — sequência de fases e critérios de avanço
- [Diagnóstico da autenticação HTTP](docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md) — hipóteses, evidências pendentes e plano para validar a Fase 003A
- [Matriz de divergências da autenticação](docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md) — comparação detalhada entre navegador e `ECNHClient`
- [Auditoria do POST `method=autenticar`](docs/AUDITORIA_POST_AUTENTICAR.md) — payload, headers, cookies, redirects e charset produzidos pelo cliente
- [Evidência HAR da autenticação](docs/EVIDENCIA_HAR_AUTENTICACAO.md) — sequência completa, respostas, hashes e hidden fields
- [Auditoria HTTP/TLS](docs/AUDITORIA_HTTP_TLS_AUTENTICACAO.md) — HTTP/2 versus HTTP/1.1, conexões, TLS e diagnóstico do reset
- [Robustez da autenticação](docs/ROBUSTEZ_AUTENTICACAO_HTTP.md) — keep-alive, agentes, CookieJar, intermitência e plano mínimo
- [Checkpoint da evidência](docs/CHECKPOINT_EVIDENCIA_AUTENTICACAO.md) — distinção entre sucesso reportado e artefatos preservados

## Problema resolvido

Consolidar agendas de diversos profissionais em uma única planilha reduz consulta manual, dados desatualizados e trabalho repetitivo. A solução será construída incrementalmente, com cada marco isolando uma responsabilidade.

## Arquitetura

O sistema integra o portal diretamente por HTTP: Axios preserva a sessão no CookieJar, `ECNHClient` encapsula o protocolo, Cheerio transforma HTML SSR em objetos tipados e os serviços coordenam a sincronização futura. Consulte [a arquitetura](docs/ARQUITETURA.md) e o [fluxo HTTP](docs/FLUXO_HTTP.md) para detalhes.

## Tecnologias

- Node.js 20+ e TypeScript
- npm
- Axios, tough-cookie e http-cookie-agent (integração HTTP, sessão e agentes persistentes)
- Cheerio (parsing futuro de HTML SSR)
- Google APIs e dotenv
- Pino para logs estruturados
- Zod para validação futura de configuração e dados de fronteira

## Estrutura

```text
src/
  client/         Clientes HTTP e APIs externas
  config/         Configuração e ambiente
  jobs/           Orquestração agendada
  models/         Entidades e contratos de domínio
  parsers/        Transformação de HTML em dados tipados
  repositories/   Acesso a fontes e destinos de dados
  services/       Casos de uso e regras de aplicação
  types/          Tipos compartilhados
  utils/          Utilitários pequenos e puros
docs/             Documentação de arquitetura e evolução
```

## Instalação

```bash
npm install
cp .env.example .env
```

Preencha `.env` somente quando as fases correspondentes forem implementadas. Nunca versione credenciais.

## Execução

```bash
npm run dev
```

### Teste de autenticação

Configure `ECNH_BASE_URL`, `ECNH_CPF` e `ECNH_PASSWORD` no `.env` e execute:

```bash
npm run test:login
```

O teste envia exclusivamente o protocolo de login confirmado, mantém cookies com `tough-cookie` e confirma sucesso pela presença de `JSESSIONID` e do marcador HTML observado. O endpoint de logout ainda não foi identificado; por isso, o método atual descarta apenas a sessão local.

### Estado da validação real

Em 18/07/2026, um HAR completo confirmou `GET method=iniciarLogin` → `POST method=iniciarLoginAgenda` → `POST method=autenticar`, sem redirects. Uma execução instrumentada do cliente retornou `sucesso`, mas não preservou log, HTML, hash ou arquivo da resposta e não foi reproduzida. O HTML autenticado existente pertence a outro diagnóstico. A Fase 003A está `Implementada`.

É necessário esclarecer ou estabilizar o encerramento intermitente da conexão antes de concluir a fase. Consulte [o mapa do protocolo](docs/API.md).

A implementação passou a preservar um único par de agentes com keep-alive e um socket durante as três etapas. Em vinte execuções, `ECONNRESET` caiu para zero, mas nenhuma autenticação foi confirmada. A hipótese estabilizou o transporte, não o resultado funcional.

## Arquitetura definitiva

```text
Autenticação HTTP
  ↓
Sessão (cookies)
  ↓
Consulta da agenda
  ↓
Download do HTML
  ↓
Parser HTML
  ↓
Objetos TypeScript
  ↓
Google Sheets
```

O portal e-CNH é orientado a HTML renderizado no servidor (SSR), e não a uma API REST observada. A estratégia principal será HTTP direto com Axios e CookieJar. Playwright não será utilizado na produção: fica restrito à depuração, investigação de fluxos novos e casos futuros que comprovadamente exijam JavaScript no navegador.

Comandos de qualidade:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run build
```

## Roadmap e próximos passos

Próximas fases: **003B — Navegação autenticada**, **004 — Extração de dados da agenda**, **005 — Integração Google Sheets**, **006 — Orquestração multi-profissionais** e **007 — Agendamento automático (cron)**. Veja o [roadmap detalhado](docs/ROADMAP.md).

### Convenção de status

Toda fase da 003A à 007 possui exatamente um status e avança nesta ordem:

`Planejada` → `Implementada` → `Validada` → `Concluída`

- **Planejada:** escopo documentado, ainda sem implementação finalizada.
- **Implementada:** escopo desenvolvido, com validação pendente.
- **Validada:** critérios executados e sustentados por evidências registradas.
- **Concluída:** validação aprovada, sem pendências bloqueantes no escopo e com documentação atualizada.

O [roadmap](docs/ROADMAP.md) é a fonte de verdade dos estados.

## Convenções

- TypeScript estrito; não usar `any`.
- Uma responsabilidade clara por módulo.
- Dependências externas ficam atrás de clientes ou repositórios.
- Dados de fronteira são validados antes de entrar no domínio.
- Logs são estruturados e erros preservam causa e contexto.
- Alterações arquiteturais relevantes atualizam `docs/DECISOES.md`.
- Valores de CPF, senha, cookies e tokens nunca são registrados em logs.

## Filosofia de desenvolvimento

Simplicidade antes de complexidade; automação antes de trabalho manual; código legível antes de código esperto. O projeto evolui por entregas pequenas, documentadas e testáveis, priorizando manutenção em vez de otimização prematura.

As regras permanentes para contribuições humanas e de IA estão em [AGENTS.md](AGENTS.md).
