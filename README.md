# e-CNH

Base do sincronizador entre o portal e-CNH SP e uma planilha Google Sheets. O produto consulta as agendas dos profissionais e mantém na aba `Agenda` apenas os **pacientes com agendamento ativo** (hoje ou futuro).

> **Fase atual:** 007 — Agendamento automático (cron) (`Concluída`). Daemon `job:agenda` + lock global + `sync:agenda`. MVP do produto concluído. Evoluções futuras em [docs/BACKLOG.md](docs/BACKLOG.md).

## Estado do Projeto

- **MVP concluído** (Fases 000–007)
- **Sistema operacional** (sincronização sob demanda e agendada)
- **Aba Agenda:** cadastro de pacientes ativos (CPF único; remove datas passadas automaticamente)
- **Evoluções futuras** registradas em [docs/BACKLOG.md](docs/BACKLOG.md) (Nice to Have; sem fases obrigatórias após a 007)

## Leitura recomendada

- [Visão do produto](docs/VISAO_DO_PRODUTO.md) — objetivo, usuários, fluxo operacional, MVP, escopo e evolução pós-MVP
- [Arquitetura](docs/ARQUITETURA.md) — camadas técnicas, responsabilidades e limites de integração
- [Roadmap](docs/ROADMAP.md) — construção do MVP (Fases 000–007)
- [Backlog](docs/BACKLOG.md) — evoluções futuras (incrementais e estratégicas)
- [Diagnóstico da autenticação HTTP](docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md) — hipóteses, evidências pendentes e plano para validar a Fase 003A
- [Matriz de divergências da autenticação](docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md) — comparação detalhada entre navegador e `ECNHClient`
- [Auditoria do POST `method=autenticar`](docs/AUDITORIA_POST_AUTENTICAR.md) — payload, headers, cookies, redirects e charset produzidos pelo cliente
- [Evidência HAR da autenticação](docs/EVIDENCIA_HAR_AUTENTICACAO.md) — sequência completa, respostas, hashes e hidden fields
- [Auditoria HTTP/TLS](docs/AUDITORIA_HTTP_TLS_AUTENTICACAO.md) — HTTP/2 versus HTTP/1.1, conexões, TLS e diagnóstico do reset
- [Robustez da autenticação](docs/ROBUSTEZ_AUTENTICACAO_HTTP.md) — keep-alive, agentes, CookieJar, intermitência e plano mínimo
- [Checkpoint da evidência](docs/CHECKPOINT_EVIDENCIA_AUTENTICACAO.md) — distinção entre sucesso reportado e artefatos preservados
- [Validação reproduzível da Fase 003A](docs/VALIDACAO_REPRODUZIVEL_003A.md) — critério, comando e evidências aprovadas

## Problema resolvido

Consolidar agendas de diversos profissionais em uma única planilha reduz consulta manual, dados desatualizados e trabalho repetitivo. A solução será construída incrementalmente, com cada marco isolando uma responsabilidade.

## Arquitetura

O sistema integra o portal diretamente por HTTP: Axios preserva a sessão no CookieJar, `ECNHClient` encapsula o protocolo, Cheerio transforma HTML SSR em objetos tipados e `AgendaSyncService` (Fase 006) orquestra a sincronização. Consulte [a arquitetura](docs/ARQUITETURA.md) e o [fluxo HTTP](docs/FLUXO_HTTP.md) para detalhes.

## Tecnologias

- Node.js 20+ e TypeScript
- npm
- Axios, tough-cookie e http-cookie-agent (integração HTTP, sessão e agentes persistentes)
- Validador `npm run validate:login` com evidências sanitizadas em `docs/evidencias/`
- Validador `npm run validate:agenda` e descoberta `npm run discover:agenda` da navegação autenticada
- Descoberta de logout `npm run discover:logout`
- Cheerio (parsing de HTML SSR da agenda; descoberta/navegação também o utilizam para inventário de formulários)
- Google APIs e dotenv
- Pino para logs estruturados
- node-cron e proper-lockfile (agendamento e lock de arquivo)
- Zod disponível para validação de fronteira quando aplicável

## Estrutura

```text
src/
  client/         Clientes HTTP e APIs externas
  composition/    Wiring compartilhado dos pontos de entrada
  config/         Configuração e ambiente
  jobs/           Disparo agendado, SyncLock e AgendaSyncJob
  models/         Entidades e contratos de domínio
  parsers/        Transformação de HTML em dados tipados
  repositories/   Persistência (Google Sheets)
  scripts/        CLIs e validadores
  services/       Casos de uso (AgendaSyncService)
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

Configure `ECNH_BASE_URL` e ao menos um usuário habilitado (`ECNH_USER_<n>_CPF`, `ECNH_USER_<n>_PASSWORD`, `ECNH_USER_<n>_ENABLED=true`) no `.env` e execute:

```bash
npm run test:login
```

Para a série reproduzível com evidências sanitizadas:

```bash
npm run validate:login
```

O cliente envia exclusivamente o protocolo de login confirmado, mantém cookies com `tough-cookie` e confirma sucesso pela presença de `JSESSIONID` e do marcador HTML observado. O logout envia `GET /gefor/SGU/login.do?method=finalizarLogin` e descarta a sessão local.

Após o login, `listarDatasAgendamento()` e `obterHtmlAgenda({ data, dataReferencia })` reproduzem a consulta `POST method=consultarAgendaPsicologo` e devolvem HTML bruto. `parseAgendaHtml(html, { dataConsulta })` transforma esse HTML em `Agenda` / `ItemAgenda` / `Paciente`.

### Parser da agenda

```bash
npm run test:agenda-parser
npm run validate:agenda-parser
npm run discover:agenda-html
```

### Persistência Google Sheets

```bash
npm run test:sheets
npm run discover:sheets
npm run validate:sheets
```

Configure `GOOGLE_SHEETS_SPREADSHEET_ID`, o caminho do JSON da Service Account e compartilhe a planilha com o e-mail da conta (Editor). A aba `Agenda` deve existir.

Em cada sincronização, a persistência:

- insere pacientes novos (CPF ainda não presente entre os ativos);
- preserva pacientes ativos com o mesmo CPF (sem duplicar);
- remove automaticamente linhas cuja **Data de Agendamento** é anterior a hoje (`America/Sao_Paulo`);
- grava **Data de inclusão** na primeira entrada do paciente no ciclo ativo atual.

### Sincronização sob demanda (Fase 006)

Com portal, profissionais (`ECNH_USER_<n>_ENABLED/NAME/CPF/PASSWORD`) e Sheets configurados:

```bash
npm run sync:agenda
```

O script compõe `criarAgendaSyncRuntime` + `AgendaSyncJob` (com lock global) e executa `sincronizarProfissionais`.

### Agendamento automático (Fase 007)

Defina `AGENDA_SYNC_CRON` (obrigatória) e, opcionalmente, `AGENDA_SYNC_TZ` / `AGENDA_SYNC_LOCK_PATH`.

Padrão recomendado do projeto: uma sincronização diária às 17:00 no fuso `America/Sao_Paulo`:

```bash
# .env
AGENDA_SYNC_CRON=0 17 * * *
AGENDA_SYNC_TZ=America/Sao_Paulo
```

```bash
npm run job:agenda
```

O daemon mantém o processo vivo e dispara o mesmo job nesse horário. Validação local: `npm run validate:agenda-job`.

### Estado da validação real

Em 19/07/2026, a validação reproduzível aprovou autenticação, logout, navegação, extração tipada, persistência Sheets, orquestração multi-profissional (`npm run sync:agenda`) e agendamento automático (`job:agenda` + lock), com evidências em `docs/evidencias/`. As Fases 003A, 003B, 004, 005, 006 e 007 estão `Concluída`.

Para reexecutar:

```bash
npm run validate:login
npm run validate:agenda
npm run validate:agenda-parser
npm run validate:sheets
npm run sync:agenda
npm run validate:agenda-job
```

Consulte [o mapa do protocolo](docs/API.md), a [validação do login](docs/VALIDACAO_REPRODUZIVEL_003A.md), [.fases/003b-navegacao-autenticada.md](.fases/003b-navegacao-autenticada.md), [.fases/004-extracao-agenda.md](.fases/004-extracao-agenda.md), [.fases/005-integracao-google-sheets.md](.fases/005-integracao-google-sheets.md), [.fases/006-orquestracao-sincronizacao.md](.fases/006-orquestracao-sincronizacao.md) e [.fases/007-agendamento-automatico.md](.fases/007-agendamento-automatico.md).

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
npm run test:agenda-parser
npm run format:check
npm run build
```

## Roadmap e próximos passos

MVP do produto **concluído** na Fase **007 — Agendamento automático (cron)** (`Concluída`, [documento](.fases/007-agendamento-automatico.md)).

- [Roadmap](docs/ROADMAP.md): histórico da construção do MVP (Fases 000–007).
- [Backlog](docs/BACKLOG.md): única fonte de evoluções futuras.

### Convenção de status (MVP)

Toda fase da 003A à 007 possui exatamente um status e avançou nesta ordem:

`Planejada` → `Implementada` → `Validada` → `Concluída`

- **Planejada:** escopo documentado, ainda sem implementação finalizada.
- **Implementada:** escopo desenvolvido, com validação pendente.
- **Validada:** critérios executados e sustentados por evidências registradas.
- **Concluída:** validação aprovada, sem pendências bloqueantes no escopo e com documentação atualizada.

O [roadmap](docs/ROADMAP.md) é a fonte de verdade dos estados do MVP. Evoluções pós-MVP seguem o [backlog](docs/BACKLOG.md).

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
