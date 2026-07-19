# Diário de evolução do projeto

> ### 📌 Estado atual
>
> **Fase atual:** Fase 007 — Agendamento automático (cron) (`Concluída`)  
> **Próxima fase:** Fases 008/009 permanecem em `Backlog` (pós-MVP)  
> **Última atualização:** 2026-07-19 11:22 BRT  
> **Última sessão executada:** 19/07/2026 • 11:22 — Padrão de cron diário às 17:00

Este arquivo registra, em ordem cronológica inversa, cada sessão concluída no projeto. O histórico nunca deve ser apagado ou sobrescrito.

> **Recomendação de nomenclatura:** `DIARIO_DE_BORDO.md` representa melhor a função atual do arquivo. O nome `CHANGELOG.md` deve ser mantido por enquanto para preservar referências existentes; uma eventual renomeação deve ocorrer em tarefa própria, com atualização coordenada de toda a documentação.

---

## 📅 19/07/2026 • 11:22

### 🎯 Objetivo

Documentar o padrão recomendado de agendamento: uma sincronização diária às 17:00 (São Paulo).

### ✅ O que mudou

- `.env.example` passou a usar `AGENDA_SYNC_CRON=0 17 * * *` como exemplo padrão.
- README e documento da Fase 007 atualizados com o mesmo padrão recomendado.
- Nenhuma alteração em código, testes ou comportamento do scheduler.

### 🧠 Decisões

- **Decisão:** padrão operacional recomendado do projeto é diário às 17:00 (`America/Sao_Paulo`); a variável continua obrigatória e configurável.

### 📂 Arquivos impactados

- `.env.example`
- `README.md`
- `.fases/007-agendamento-automatico.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 11:16

### 🎯 Objetivo

Validar o agendamento automático e concluir oficialmente a Fase 007 (Passo 6).

### ✅ O que mudou

- `npm test` (43), `validate:agenda-job`, smoke do daemon e `sync:agenda` executados; evidências sanitizadas registradas.
- Fase 007 promovida a `Validada` e `Concluída`; MVP do produto encerrado nesta fase.
- Fases 008/009 permanecem em `Backlog`.

### 🧠 Decisões

- **Evidência confirmada:** lock global impede sobreposição; job ignora com lock ocupado.
- **Evidência confirmada:** daemon inicia/para com `AGENDA_SYNC_CRON`; `sync:agenda` reutiliza o mesmo job+lock.
- **Decisão:** falha parcial tipada em `ECNH_USER_4` não bloqueia conclusão (mesmo padrão da Fase 006).

### 📂 Arquivos impactados

- `docs/evidencias/007-validacao-agendamento-*.json`
- `docs/evidencias/README.md`
- `.fases/007-agendamento-automatico.md`
- `docs/ROADMAP.md`
- `docs/ARQUITETURA.md`
- `docs/VISAO_DO_PRODUTO.md`
- `docs/MODELO_DOMINIO.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 11:15

### 🎯 Objetivo

Implementar Passos 1–5 da Fase 007: contratos, FileSyncLock, AgendaSyncJob, composition, scheduler e daemon.

### ✅ O que mudou

- Criados `SyncLock` / `FileSyncLock`, `AgendaSyncJob`, `AgendaSyncScheduler` e config `AGENDA_SYNC_*`.
- Extraiído `criarAgendaSyncRuntime`; `sync:agenda` e `job:agenda` compartilham wiring + lock.
- Dependências `node-cron` e `proper-lockfile`; testes unitários de lock/job/config; `.env.example` e `.gitignore` atualizados.

### 🧠 Decisões

- **Decisão:** lock ocupado → pular + warn (sem fila); `AGENDA_SYNC_CRON` obrigatória.
- **Decisão:** logs quiet no script manual; Pino real no daemon.
- **Decisão:** client/parser/`AgendaSyncService`/`AgendaRepository` não alterados na regra de sync.

### 📂 Arquivos impactados

- `src/jobs/*`
- `src/composition/agenda-sync-runtime.ts`
- `src/config/agenda-sync-job-config.ts`
- `src/scripts/sync-agenda.ts`
- `src/scripts/job-agenda.ts`
- `src/scripts/validate-agenda-job.ts`
- `package.json` / `package-lock.json`
- `.env.example` / `.gitignore`

---

## 📅 19/07/2026 • 11:11

### 🎯 Objetivo

Iniciar oficialmente a Fase 007 — Agendamento automático (Passo 0: documentação), sem implementar código de produto.

### ✅ O que mudou

- Criado `.fases/007-agendamento-automatico.md` com objetivo, escopo, arquitetura, critérios e progresso.
- Registrado ADR-013 (daemon, `SyncLock`, job fino sobre `AgendaSyncService`).
- ROADMAP, ARQUITETURA, README e DECISOES alinhados; status da fase permanece `Planejada`.

### 🧠 Decisões

- **Decisão:** daemon Node + scheduler interno; lock global atrás de `SyncLock` (arquivo inicialmente).
- **Decisão:** job não contém lógica de sync; wiring compartilhado em `composition`.
- **Decisão:** Fases 008 e 009 permanecem fora do escopo.

### 📂 Arquivos impactados

- `.fases/007-agendamento-automatico.md`
- `docs/DECISOES.md`
- `docs/ROADMAP.md`
- `docs/ARQUITETURA.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 10:52

### 🎯 Objetivo

Validar o fluxo completo de sincronização e concluir oficialmente a Fase 006 (Passo 6).

### ✅ O que mudou

- `npm test` (32) e `npm run sync:agenda` executados; evidência sanitizada registrada.
- Fase 006 promovida a `Validada` e `Concluída` na documentação obrigatória.
- Sem alteração de comportamento do código; Fase 007 não iniciada.

### 🧠 Decisões

- **Evidência confirmada:** orquestração multi-profissional funciona no ambiente real (6/7 ok).
- **Evidência confirmada:** falha parcial tipada (`ECNH_USER_4`, login `erro_desconhecido`, logout executado).
- **Decisão:** `sucessoGeral=false` com falha parcial não impede `Concluída` quando os critérios de orquestração estão atendidos e documentados.

### 📂 Arquivos impactados

- `docs/evidencias/006-validacao-sincronizacao-2026-07-19T13-53-48-274Z.json`
- `docs/evidencias/README.md`
- `.fases/006-orquestracao-sincronizacao.md`
- `docs/ROADMAP.md`
- `docs/ARQUITETURA.md`
- `docs/VISAO_DO_PRODUTO.md`
- `docs/MODELO_DOMINIO.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 10:51

### 🎯 Objetivo

Consolidar a documentação das Fases 008 e 009 como Nice to Have / `Backlog` (parked), sem implementação.

### ✅ O que mudou

- Criados `.fases/008-painel-operacional.md` e `.fases/009-observabilidade-metricas.md` (objetivo, escopo, fora de escopo, critérios preliminares, status `Backlog`).
- `docs/ROADMAP.md`: 008/009 na tabela principal como `Backlog` + links aos documentos da fase.
- `docs/VISAO_DO_PRODUTO.md`: seção **Evoluções pós-MVP** deixando explícito que não integram o MVP.
- Sem alteração de código, arquitetura, domínio, APIs ou ADRs.

### 🧠 Decisões

- **Decisão:** 008/009 permanecem parked até conclusão do MVP (006–007) e nova priorização.
- **Decisão:** desenho técnico fica de fora de `ARQUITETURA.md` / `DECISOES.md` até priorização.

### 📂 Arquivos impactados

- `.fases/008-painel-operacional.md`
- `.fases/009-observabilidade-metricas.md`
- `docs/ROADMAP.md`
- `docs/VISAO_DO_PRODUTO.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 10:48

### 🎯 Objetivo

Criar o script manual de sincronização (`sync:agenda`) como composição pura (Passo 5).

### ✅ O que mudou

- `src/scripts/sync-agenda.ts` resolve profissionais, monta dependências, chama `sincronizarProfissionais` e imprime resumo sem PII.
- Comando `npm run sync:agenda` no `package.json`; teste mínimo do formatador de resumo.
- Sem alterações em client, parser, repositório ou `AgendaSyncService`.

### 🧠 Decisões

- **Decisão:** um `ECNHClient` por profissional via fábrica (sessão isolada).
- **Decisão:** status permanece `Planejada` até validação (Passo 6).

### 📂 Arquivos impactados

- `src/scripts/sync-agenda.ts`
- `src/scripts/sync-agenda-resumo.ts`
- `src/scripts/sync-agenda.test.ts`
- `package.json`
- `README.md`
- `.fases/006-orquestracao-sincronizacao.md`
- `docs/ROADMAP.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 10:46

### 🎯 Objetivo

Isolar a resolução de profissionais habilitados para sincronização (Passo 4), sem acoplar o `AgendaSyncService` ao `.env`.

### ✅ O que mudou

- Criados `resolveEnabledSyncProfessionals`, `paraEntradaSincronizacao` e `resolveEntradasSincronizacao` em `src/config/sync-professionals.ts`.
- Testes de habilitado/desabilitado, config obrigatória ausente e múltiplos profissionais.
- `AgendaSyncService`, client, parser e repositório não alterados.

### 🧠 Decisões

- **Decisão:** `ENABLED=true` exige `NAME`, `CPF` e `PASSWORD`; ausência lança `ConfigurationError`.
- **Decisão:** status da fase permanece `Planejada` (script e validação pendentes).

### 📂 Arquivos impactados

- `src/config/sync-professionals.ts`
- `src/config/sync-professionals.test.ts`
- `.env.example`
- `.fases/006-orquestracao-sincronizacao.md`
- `docs/ROADMAP.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 10:45

### 🎯 Objetivo

Registrar Fases 008 e 009 como backlog Nice to Have (parked), sem implementação.

### ✅ O que mudou

- `docs/ROADMAP.md`: Fases 008 (Painel Operacional) e 009 (Observabilidade e Métricas) com status `Backlog`; observação de que o MVP termina na 007.
- `docs/VISAO_DO_PRODUTO.md`: mesma observação e entradas no backlog funcional.

### 🧠 Decisões

- **Decisão:** 008/009 ficam estacionadas até nova priorização; não entram na progressão `Planejada` → `Concluída` do MVP.
- **Decisão:** nenhuma alteração de código, arquitetura ou testes nesta sessão.

### 📂 Arquivos impactados

- `docs/ROADMAP.md`
- `docs/VISAO_DO_PRODUTO.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 10:42

### 🎯 Objetivo

Implementar `sincronizarProfissionais` reutilizando `sincronizarProfissional` (Passo 3).

### ✅ O que mudou

- Loop sequencial com falha parcial e agregação em `ResultadoSincronizacao`.
- Três testes multi-profissional; suíte do serviço atualizada.
- Sem alterações em client, parser, repositório ou contratos do Passo 1.

### 🧠 Decisões

- **Decisão:** `sucessoGeral` exige sucesso de todos os profissionais; lista vazia é sucesso vacuoso.
- **Decisão:** status da fase permanece `Planejada` (config, script e validação pendentes).

### 📂 Arquivos impactados

- `src/services/agenda-sync-service.ts`
- `src/services/agenda-sync-service.test.ts`
- `.fases/006-orquestracao-sincronizacao.md`
- `docs/ROADMAP.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 10:36

### 🎯 Objetivo

Implementar `sincronizarProfissional` no `AgendaSyncService` (Passo 2), com testes unitários via fakes.

### ✅ O que mudou

- Fluxo sequencial: login → listar datas → HTML → parse → persistência → logout (`finally`).
- Testes (9) cobrindo sucesso, falha de login, zero datas, persistência ok/falha, parser com throw e logout sempre.
- `sincronizarProfissionais` permanece não implementado; client/parser/repositório intactos.
- `npm run typecheck`, `npm run lint` e suíte completa (`npm test`, 24 testes) aprovados.

### 🧠 Decisões

- **Decisão:** falha parcial por data continua o loop; `sucesso` do profissional exige todas as datas ok.
- **Decisão:** `dataReferencia = data` (heurística já validada nos scripts).
- **Decisão:** exceção no parser/`obterHtml`/persistência não aborta o `finally` do logout.

### 📂 Arquivos impactados

- `src/services/agenda-sync-service.ts`
- `src/services/agenda-sync-service.test.ts`
- `package.json` (`test:agenda-sync`)
- `.fases/006-orquestracao-sincronizacao.md`
- `docs/ROADMAP.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 10:32

### 🎯 Objetivo

Congelar os contratos tipados de `AgendaSyncService` (Passo 1), sem lógica de sincronização.

### ✅ O que mudou

- Criado `src/services/agenda-sync-service.ts` com API pública, portas injetáveis e tipos `ResultadoSincronizacao*`.
- Métodos `sincronizarProfissional` / `sincronizarProfissionais` apenas com TODOs e erro explícito de não implementado.
- `npm run typecheck` aprovado; `ECNHClient`, parsers e repositories não alterados.

### 🧠 Decisões

- **Decisão:** porta `AgendaSyncPortalClient` (compatível com `ECNHClient`) + parser/`AgendaRepository` injetados.
- **Decisão:** status da fase permanece `Planejada` até a lógica do escopo estar implementada.

### 📂 Arquivos impactados

- `src/services/agenda-sync-service.ts`
- `.fases/006-orquestracao-sincronizacao.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 10:30

### 🎯 Objetivo

Iniciar oficialmente a Fase 006 (Passo 0): documentar escopo, critérios e estrutura proposta de `AgendaSyncService`, sem implementar lógica.

### ✅ O que mudou

- Criado `.fases/006-orquestracao-sincronizacao.md` com objetivo, escopo, fora de escopo, arquitetura, critérios de aceite e plano incremental.
- `docs/ROADMAP.md` atualizado: situação da Fase 006 iniciada; entrega alinhada a `AgendaSyncService`.
- Documentação de visão/arquitetura/domínio/README alinhada; status oficial permanece `Planejada` (convenção do projeto — não existe estado “Em implementação”).
- Nenhuma alteração em `ECNHClient`, parser, `AgendaRepository` ou lógica de serviço.

### 🧠 Decisões

- **Decisão:** camada de casos de uso em `src/services` com nome `AgendaSyncService`.
- **Decisão:** Passo 0 só documentação; código fica para aprovação do próximo passo.
- **Decisão:** fora de escopo — cron (007), API HTTP e mudanças nos componentes existentes.

### 📂 Arquivos impactados

- `.fases/006-orquestracao-sincronizacao.md`
- `docs/ROADMAP.md`
- `docs/ARQUITETURA.md`
- `docs/MODELO_DOMINIO.md`
- `docs/VISAO_DO_PRODUTO.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 10:29

### 🎯 Objetivo

Sincronizar a documentação para refletir a Fase 005 oficialmente `Concluída`, sem alterar código, testes ou evidências.

### ✅ O que mudou

- `docs/ROADMAP.md`: entrega da 005 atualizada com validação real concluída; seção “Situação da Fase 005” deixa explícito que não há pendência de credenciais nem de validação.
- `docs/ARQUITETURA.md`, `docs/DECISOES.md` e `docs/VISAO_DO_PRODUTO.md` alinhados ao status `Concluída` (sem linguagem de fase em andamento ou backlog de 003B–005).
- Sessão histórica de 09:55 permanece intacta (registrava `Implementada` e bloqueio por credenciais naquele momento); o estado atual do projeto é o da sessão 10:23 e desta sincronização.

### 🧠 Decisões

- **Evidência confirmada:** o status vigente da Fase 005 é `Concluída`; menções a “aguardando validação/credenciais” não descrevem mais o estado atual.
- **Decisão:** não reescrever sessões anteriores do diário; apenas alinhar documentos de estado e registrar esta sincronização.

### 📂 Arquivos impactados

- `docs/ROADMAP.md`
- `docs/ARQUITETURA.md`
- `docs/DECISOES.md`
- `docs/VISAO_DO_PRODUTO.md`
- `docs/API.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 10:23

### 🎯 Objetivo

Validar a persistência real no Google Sheets e concluir a Fase 005.

### ✅ O que mudou

- `npm run discover:sheets` aprovado: Service Account autenticou; planilha e aba `Agenda` encontradas.
- `npm run validate:sheets` aprovado: escrita de 2 linhas sintéticas, leitura de volta e limpeza.
- Evidências sanitizadas registradas em `docs/evidencias/`.
- Documentação obrigatória atualizada; Fase 005 promovida a `Validada` e `Concluída`.

### 🧠 Decisões

- **Evidência confirmada:** autenticação Service Account + escopo Sheets funciona neste ambiente.
- **Evidência confirmada:** `GoogleSheetsAgendaRepository` grava e recupera via aba `Agenda` sem PII na evidência.
- **ADR-012:** persistência atrás de `AgendaRepository` com mapper puro e chave `Data`+`Profissional`.

### 📂 Arquivos impactados

- `docs/evidencias/005-descoberta-conexao-sheets-2026-07-19T13-23-22-770Z.json`
- `docs/evidencias/005-validacao-sheets-2026-07-19T13-23-24-530Z.json`
- `.fases/005-integracao-google-sheets.md`
- `docs/ROADMAP.md`
- `docs/ARQUITETURA.md`
- `docs/MODELO_DOMINIO.md`
- `docs/DECISOES.md`
- `docs/VISAO_DO_PRODUTO.md`
- `docs/API.md`
- `docs/evidencias/README.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 09:55

### 🎯 Objetivo

Implementar a camada de persistência Google Sheets (Fase 005), sem orquestração nem regras de negócio.

### ✅ O que mudou

- Criados `AgendaRepository` (interface), `AgendaSheetMapper` (puro) e `GoogleSheetsAgendaRepository`.
- Encapsulado `googleapis` em `GoogleSheetsClient` com port injetável para testes.
- Layout da aba `Agenda` com coluna `Profissional`; substituição idempotente por `Data` + `Profissional`.
- Configuração via `GOOGLE_SHEETS_*` / `GOOGLE_APPLICATION_CREDENTIALS`.
- Testes unitários (9) aprovados sem rede; scripts `discover:sheets` e `validate:sheets`.
- Fase 005 promovida a `Implementada`; validação real bloqueada por ausência de credenciais no `.env`.

### 🧠 Decisões

- **Decisão:** consumidores dependem só de `AgendaRepository`; Sheets fica atrás da implementação.
- **Decisão:** mapper puro separado do repositório (domínio ↔ linhas).
- **Decisão:** chave de substituição = `dataConsulta` + `profissional` (preserva outros profissionais na mesma data).
- **Pendência de validação:** conexão real Service Account + planilha ainda não executada neste ambiente.

### 📂 Arquivos impactados

- `src/repositories/agenda-repository.ts`
- `src/repositories/agenda-sheet-headers.ts`
- `src/repositories/agenda-sheet-mapper.ts`
- `src/repositories/agenda-sheet-mapper.test.ts`
- `src/repositories/google-sheets-agenda-repository.ts`
- `src/repositories/google-sheets-agenda-repository.test.ts`
- `src/repositories/in-memory-google-sheets-values.ts`
- `src/client/google-sheets-client.ts`
- `src/config/google-sheets-config.ts`
- `src/scripts/discover-sheets.ts`
- `src/scripts/validate-sheets.ts`
- `package.json`
- `.env.example`
- `.gitignore`
- `docs/evidencias/005-descoberta-api-sheets-2026-07-19.json`
- `.fases/005-integracao-google-sheets.md`
- `docs/ROADMAP.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 08:40

### 🎯 Objetivo

Transformar o HTML bruto da agenda em modelos de domínio tipados (Fase 004).

### ✅ O que mudou

- Inventariada a estrutura do HTML de resultado: tabela `table#agenda` com nove cabeçalhos confirmados.
- Classificado o domínio (`Paciente`, `ItemAgenda`, `Agenda`) versus apresentação (Bootstrap, `list_titulo`, `style`, layout).
- Criados modelos em `src/models/agenda.ts` e parser `parseAgendaHtml` em `src/parsers/agenda-parser.ts`.
- Seletores robustos: `table#agenda` + ligação por texto do `th`; `dataConsulta` via contexto do chamador.
- Testes unitários (`npm run test:agenda-parser`) com fixtures sanitizadas em `fixtures/agenda/`.
- Validação real (`npm run validate:agenda-parser`) aprovada com 8 itens e evidência sanitizada.
- Fase 004 promovida a `Concluída`.

### 🧠 Decisões

- **Evidência confirmada:** id `agenda` é o seletor primário da tabela de resultado (ADR-011).
- **Evidência confirmada:** as nove colunas são atributos de domínio; classes CSS não entram no modelo.
- **Evidência confirmada:** a data consultada não permanece confiável no formulário pós-POST; o parser a recebe como contexto.
- Sem Google Sheets, sync, multi-profissional ou cron nesta fase.

### 📂 Arquivos impactados

- `src/models/agenda.ts`
- `src/parsers/agenda-parser.ts`
- `src/parsers/agenda-parser.test.ts`
- `src/scripts/discover-agenda-html.ts`
- `src/scripts/validate-agenda-parser.ts`
- `fixtures/agenda/`
- `package.json`
- `tsconfig.json`
- `docs/evidencias/`
- `docs/MODELO_DOMINIO.md`
- `docs/API.md`
- `docs/FLUXO_HTTP.md`
- `docs/DECISOES.md`
- `docs/ROADMAP.md`
- `docs/ARQUITETURA.md`
- `docs/VISAO_DO_PRODUTO.md`
- `.fases/004-extracao-agenda.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 08:25

### 🎯 Objetivo

Descobrir e reproduzir a navegação autenticada até o HTML bruto da agenda (Fase 003B).

### ✅ O que mudou

- Criado `npm run discover:agenda` para inventariar formulário, scripts, consulta HTML e refreshes JSON.
- Confirmado `POST /gefor/GFR/divisao/divisaoEquitativa.do` com `method=consultarAgendaPsicologo`.
- Confirmados refreshes JSON `refreshMedicosByUnidadeTransito` e `refreshAgendaMedicaByMedico`.
- Implementados `ECNHAgendaProtocol`, `listarDatasAgendamento()` e `obterHtmlAgenda()` no `ECNHClient`.
- Criados `npm run test:agenda` e `npm run validate:agenda` com evidência sanitizada aprovada.
- Fase 003B promovida a `Concluída`.

### 🧠 Decisões

- **Evidência confirmada:** o HTML pós-login já contém `DivisaoEquitativaForm` e datas em `#agendamentos`.
- **Evidência confirmada:** a consulta devolve legend `Resultado`, `method=agendaMedico` e cabeçalhos da tabela de agenda.
- Sem contrato público de domínio para agenda nesta fase; retorno continua sendo HTML bruto (ADR-010).
- Sem parsing de pacientes (escopo da Fase 004).

### 📂 Arquivos impactados

- `src/client/ecnh-agenda-protocol.ts`
- `src/client/ecnh-auth-protocol.ts`
- `src/client/ecnh-client.ts`
- `src/scripts/discover-agenda-navigation.ts`
- `src/scripts/test-agenda.ts`
- `src/scripts/validate-agenda.ts`
- `package.json`
- `docs/evidencias/`
- `docs/API.md`
- `docs/FLUXO_HTTP.md`
- `docs/DECISOES.md`
- `docs/ROADMAP.md`
- `docs/ARQUITETURA.md`
- `docs/VISAO_DO_PRODUTO.md`
- `docs/MODELO_DOMINIO.md`
- `.fases/003b-navegacao-autenticada.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 08:05

### 🎯 Objetivo

Descobrir o logout HTTP do portal e concluir a Fase 003A.

### ✅ O que mudou

- Criado `npm run discover:logout` para varrer HTML autenticado e o menu dinâmico.
- Confirmado `GET /gefor/SGU/login.do?method=finalizarLogin` a partir de `menu_items.jsp` (item "Sair").
- Implementado logout HTTP em `ECNHClient` / protocolo, com limpeza local obrigatória.
- Registradas evidências em `docs/evidencias/003a-consolidacao-logout-2026-07-19.json`.
- Fase 003A promovida a `Concluída`.

### 🧠 Decisões

- **Evidência confirmada:** o menu "Sair" chama `method=finalizarLogin`.
- **Evidência confirmada:** a resposta devolve o formulário de login e permite re-login imediato.
- Não confundir com `forceLogout` da tela de autenticação (ADR-009).

### 📂 Arquivos impactados

- `src/scripts/discover-logout.ts`
- `src/client/ecnh-auth-protocol.ts`
- `src/client/ecnh-client.ts`
- `src/scripts/test-login.ts`
- `src/scripts/validate-login.ts`
- `package.json`
- `docs/evidencias/`
- `docs/DECISOES.md`
- `docs/ROADMAP.md`
- `docs/API.md`
- `docs/FLUXO_HTTP.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 07:45

### 🎯 Objetivo

Concluir a validação reproduzível da Fase 003A com evidência sanitizada, durável e repetível.

### ✅ O que mudou

- Adaptados `test:login` e `validate:login` ao `.env` multi-usuário (`ECNH_USER_<n>_`).
- Formatado o CPF como `DDD.DDD.DDD-DD` conforme o HAR.
- Mantidos agentes HTTP persistentes com keep-alive.
- Aprovadas cinco autenticações distintas do `ECNHClient` com hashes e sinais estruturais.
- Consolidada a evidência oficial em `docs/evidencias/003a-consolidacao-validacao-2026-07-19.json`.
- Documentado que o portal rejeita re-login imediato da mesma conta.

### 🧠 Decisões

- **Evidência confirmada:** cinco logins reais distintos atenderam ao critério de sucesso com artefatos sanitizados.
- **Evidência confirmada:** o HAR envia CPF mascarado; o cliente agora reproduz esse formato.
- **Evidência confirmada:** re-login imediato da mesma conta tende a falhar; a série oficial usa credenciais distintas.
- A Fase 003A avança para `Validada`.
- A Fase 003A não avança para `Concluída` enquanto o logout HTTP não for identificado.

### 📂 Arquivos impactados

- `src/utils/cpf.ts`
- `src/config/login-credentials.ts`
- `src/client/ecnh-client.ts`
- `src/scripts/test-login.ts`
- `src/scripts/validate-login.ts`
- `.env.example`
- `docs/VALIDACAO_REPRODUZIVEL_003A.md`
- `docs/evidencias/`
- `docs/DECISOES.md`
- `docs/ROADMAP.md`
- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/VISAO_DO_PRODUTO.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 20:40

### 🎯 Objetivo

Verificar se a execução histórica classificada como sucesso possui evidência durável e reproduzível suficiente para sustentar o status `Validada`.

### ✅ O que mudou

- Localizada a execução temporária de `ECNHClient.login()` que imprimiu `status=sucesso`.
- Confirmado que o critério do código exigia conjuntamente `JSESSIONID` e o marcador autenticado.
- Verificada a ausência de log durável, HTML, hash e arquivo dessa execução.
- Separado o resultado do cliente de um HTML autenticado anterior salvo por diagnóstico direto de `AuthTransport`.
- Verificado que o cliente marcou uma sessão interna, mas não executou navegação protegida posterior.
- Consolidado o checkpoint em documento próprio.
- Nenhum código ou protocolo foi alterado.

### 🧠 Decisões

- **Evidência confirmada:** o `ECNHClient` retornou `sucesso` uma vez e marcou estado interno autenticado.
- **Limite:** a resposta dessa execução não foi preservada e o marcador somente pode ser inferido pelo caminho do código.
- **Evidência confirmada:** `/tmp/ecnh-login-before.html` contém marcador e formulário protegido, mas pertence a um POST direto antigo e não ao `ECNHClient`.
- **Evidência confirmada:** o resultado `sucesso` não foi reproduzido em três tentativas instrumentadas nem na bateria de vinte.
- A evidência não atende ao requisito auditável de `Validada`.
- A Fase 003A retorna para `Implementada`.

### 📂 Arquivos impactados

- `docs/CHECKPOINT_EVIDENCIA_AUTENTICACAO.md`
- `docs/AUDITORIA_HTTP_TLS_AUTENTICACAO.md`
- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/ROBUSTEZ_AUTENTICACAO_HTTP.md`
- `docs/API.md`
- `docs/FLUXO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/ROADMAP.md`
- `docs/VISAO_DO_PRODUTO.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 20:28

### 🎯 Objetivo

Implementar exclusivamente agentes persistentes com keep-alive e medir vinte execuções consecutivas do login.

### ✅ O que mudou

- Criados um `HttpCookieAgent` e um `HttpsCookieAgent` por `AuthTransport`.
- Configurados `keepAlive=true` e `maxSockets=1`.
- Reutilizados os mesmos agentes, CookieJar e socket nas três etapas.
- Substituído o wrapper que recriava agentes pelo uso direto de `http-cookie-agent`.
- Preservados protocolo, payload, headers e sequência GET → POST → POST.
- Executados `typecheck`, `lint`, `build` e vinte `npm run test:login` consecutivos.
- Confirmados `reusedSocket=true` e o mesmo identificador de socket nos dois POSTs.

### 🧠 Decisões

- **Antes:** 1 sucesso em 6 registros disponíveis, taxa de 16,67%, com 3 `ECONNRESET`.
- **Depois:** 0 sucessos em 20, taxa de 0%, com 0 `ECONNRESET`.
- **Tempos depois:** média de 582 ms, mínimo de 469 ms e máximo de 793 ms.
- **Evidência confirmada:** a conexão persistente eliminou o reset na bateria.
- **Evidência confirmada:** a conexão persistente não estabilizou a autenticação.
- Nenhum retry, workaround ou alteração adicional foi implementado.
- A Fase 003A permanece `Validada`, não `Concluída`.

### 📂 Arquivos impactados

- `src/client/auth-transport.ts`
- `package.json`
- `package-lock.json`
- `docs/ROBUSTEZ_AUTENTICACAO_HTTP.md`
- `docs/AUDITORIA_HTTP_TLS_AUTENTICACAO.md`
- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/API.md`
- `docs/ARQUITETURA.md`
- `docs/DECISOES.md`
- `docs/ROADMAP.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 20:18

### 🎯 Objetivo

Investigar exclusivamente a intermitência entre autenticação bem-sucedida e `ECONNRESET`, sem reabrir a engenharia reversa nem alterar o protocolo.

### ✅ O que mudou

- Auditado o ciclo de Axios, CookieJar, agentes HTTP/HTTPS, sockets, timeout e execução sequencial.
- Inspecionados `axios-cookiejar-support`, `http-cookie-agent`, Axios e `follow-redirects`.
- Comparadas execuções bem-sucedidas e resetadas até o primeiro ponto de divergência.
- Classificadas hipóteses confirmadas, eliminadas e ainda não comprovadas.
- Criado um plano mínimo para isolar keep-alive e reutilização de conexão antes de considerar retry.
- Nenhum código de produção foi alterado.

### 🧠 Decisões

- **Evidência confirmada:** a instância Axios e o CookieJar são reutilizados nas três etapas.
- **Evidência confirmada:** o wrapper cria novos `HttpCookieAgent` e `HttpsCookieAgent` em cada request, com `keepAlive=false`.
- **Evidência confirmada:** não existe retry automático, timeout envolvido, concorrência entre etapas ou descarte prematuro do CookieJar.
- **Evidência confirmada:** sucesso e reset são equivalentes até `request.finish`; a divergência surge antes dos headers de resposta.
- **Hipótese mais provável:** a abertura de três conexões TLS independentes reduz afinidade no caminho remoto e expõe comportamento intermitente de borda ou backend.
- **Plano mínimo:** preservar um único par de agentes com keep-alive e medir essa variável isoladamente; não repetir isoladamente o POST final.
- A Fase 003A permanece `Validada`.

### 📂 Arquivos impactados

- `docs/ROBUSTEZ_AUTENTICACAO_HTTP.md`
- `docs/AUDITORIA_HTTP_TLS_AUTENTICACAO.md`
- `docs/ROADMAP.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 20:08

### 🎯 Objetivo

Auditar exclusivamente a camada HTTP/TLS do fluxo autenticador, comparando Axios e HAR e localizando o `ECONNRESET` sem alterar código de produção.

### ✅ O que mudou

- Instrumentados temporariamente e de forma sanitizada os eventos de `ClientRequest` e `TLSSocket`.
- Comparados versão HTTP, headers, payloads, agentes, keep-alive, reutilização de socket, ALPN, TLS e ponto da falha.
- Registrados `error.code`, `error.cause`, `syscall`, `errno` e stacks completos sem dados sensíveis.
- Reproduzido o `ECONNRESET` no POST `method=autenticar`.
- Confirmada autenticação real em uma execução instrumentada sem alteração do código.
- Criada a auditoria técnica completa e atualizada a documentação da fase.

### 🧠 Decisões

- **Evidência confirmada:** o Chrome usa HTTP/2 e reutiliza uma conexão; o Axios usa HTTP/1.1 e abre um socket TLS novo por etapa.
- **Evidência confirmada:** o agente efetivo é `CookieAgent`, com keep-alive desabilitado e sem reutilização de sessão TLS.
- **Evidência confirmada:** o reset ocorreu depois de `secureConnect` e `request.finish`, mas antes de qualquer header de resposta.
- **Evidência confirmada:** o erro Axios e sua causa possuem `code=ECONNRESET`; `syscall` e `errno` estão ausentes.
- **Limite:** não é possível identificar por essa evidência se portal, CDN, WAF, balanceador ou backend encerrou a conexão.
- **Limite:** a divergência HTTP/2 versus HTTP/1.1 não pode ser classificada como causa porque o mesmo cliente também obteve sucesso.
- A Fase 003A avança para `Validada`; a intermitência impede `Concluída`.

### 📂 Arquivos impactados

- `docs/AUDITORIA_HTTP_TLS_AUTENTICACAO.md`
- `docs/API.md`
- `docs/FLUXO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/ROADMAP.md`
- `docs/VISAO_DO_PRODUTO.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 20:00

### 🎯 Objetivo

Implementar a sequência completa de autenticação observada no HAR, preservando o mesmo CookieJar e sem alterar a arquitetura.

### ✅ O que mudou

- Auditado o HAR de forma sanitizada, sem registrar CPF, senha, cookies ou identificadores pessoais.
- Confirmada a sequência `GET iniciarLogin` → `POST iniciarLoginAgenda` → `POST autenticar`.
- Registrados status, tamanhos, hashes SHA-256 e hidden fields das três respostas.
- Confirmado que os dez hidden fields da etapa 2 reaparecem na etapa 3 com valores estáticos e sem token dinâmico.
- Implementados os três requests, os payloads na ordem observada, a duplicidade de `codigo` na etapa 2, os headers por etapa e a decodificação ISO-8859-1.
- Mantidos o mesmo `AuthTransport`, CookieJar, arquitetura e critérios de sucesso.
- Restringido o log de erro HTTP a nome, código e mensagem para impedir serialização de credenciais e cookies pelo Axios.
- Executados `typecheck`, `lint`, `build` e duas tentativas de `npm run test:login`.

### 🧠 Decisões

- **Evidência confirmada:** as três respostas do HAR foram HTTP 200 e não houve redirects.
- **Evidência confirmada:** nenhum valor dinâmico da etapa 2 exige parser HTML; os dez hidden fields são constantes.
- **Evidência confirmada:** o HAR não preservou cookies, portanto nomes e rotação não podem ser comparados.
- **Validação real:** a primeira tentativa encontrou `ECONNRESET` na etapa 2; a segunda alcançou HTTP 200 nas etapas 1 e 2 e encontrou `ECONNRESET` na etapa 3.
- A autenticação não recebeu resposta final conclusiva e a Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `src/client/ecnh-auth-protocol.ts`
- `src/client/auth-transport.ts`
- `docs/EVIDENCIA_HAR_AUTENTICACAO.md`
- `docs/API.md`
- `docs/FLUXO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/ROADMAP.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 19:26

### 🎯 Objetivo

Auditar exclusivamente requisições, redirects, submissões e mudanças de estado anteriores ao POST `method=autenticar`.

### ✅ O que mudou

- Analisados o HTML de login, `login.js` e os scripts globais carregados pela página.
- Separadas diferenças comprovadas de efeitos sem evidência sobre a sessão.
- Documentados a chamada a `/GFR/release.json` e o cookie visual `style1`.
- Confirmada a ausência de `meta refresh`, iframe com `src`, submit automático e redirect automático no código auditado.

### 🧠 Decisões

- **Diferença comprovada:** o Chrome recebe o documento HTML antes do clique; o cliente inicia diretamente pelo POST.
- **Diferença comprovada:** a página chama `fetch('/GFR/release.json')`; o cliente não.
- **Diferença comprovada:** `styleswitcher.js` mantém o cookie visual `style1`; o cliente não.
- Não há evidência de que essas diferenças criem estado de autenticação, alterem `JSESSIONID` ou sejam obrigatórias.
- A primeira URL, redirects e cookies de servidor anteriores ao POST continuam sem captura Network.
- Nenhuma alteração de código foi realizada e a Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `docs/FLUXO_HTTP.md`
- `.fases/003-login-http.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 19:13

### 🎯 Objetivo

Determinar o estado do cliente e as evidências disponíveis sobre o navegador antes do POST `method=autenticar`.

### ✅ O que mudou

- Auditado o encadeamento entre `ECNHClient`, protocolo, transporte, sessão e CookieJar.
- Confirmado que o cliente não executa GET antes do POST.
- Confirmado que a primeira requisição é `POST /gefor/SGU/login.do`.
- Registrada a ausência de captura da navegação inicial do Chrome.
- Atualizados fluxo HTTP, diagnóstico e documento da fase.

### 🧠 Decisões

- **Evidência confirmada:** cada cliente novo começa com CookieJar vazio e não recebe cookies antes do POST.
- **Evidência confirmada:** `JSESSIONID` é recebido somente na resposta do POST direto.
- **Pendência de validação:** primeira URL, GETs, redirects e cookies anteriores do Chrome não foram preservados.
- Um GET genérico já testado não reproduziu login; nenhuma navegação inicial será implementada sem captura real.
- Para avançar, é necessário registrar o fluxo manual desde uma sessão limpa, validar a autenticação e concluir documentalmente a Fase 003A.

### 📂 Arquivos impactados

- `docs/FLUXO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `.fases/003-login-http.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 19:04

### 🎯 Objetivo

Testar se os principais headers de navegação do Chrome alteram o tratamento do POST de autenticação.

### ✅ O que mudou

- Configurados `Accept`, `Accept-Language`, `Origin`, `Referer`, `Upgrade-Insecure-Requests` e `User-Agent` no `AuthTransport`.
- Preservados payload, arquitetura, CookieJar, redirects, fluxo e critério de sucesso.
- Confirmados os headers efetivamente enviados pelo Axios.
- Executados `typecheck`, `lint`, `build` e `npm run test:login`.
- Comparadas byte a byte as respostas anterior e posterior ao ajuste.

### 🧠 Decisões

- **Evidência confirmada:** os seis headers estavam presentes no request real.
- **Evidência confirmada:** a resposta permaneceu com 28.696 bytes e SHA-256 `6baae6f28e5e48bda015544c007143bd96cfaf666866977b017be8ff5228be63`.
- **Evidência confirmada:** `LoginActionForm` permaneceu presente e o marcador autenticado permaneceu ausente.
- O perfil principal testado não altera a resposta e não explica isoladamente a falha de autenticação.
- Os valores exatos do Chrome usado em um login manual bem-sucedido continuam pendentes de captura.
- A Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `src/client/auth-transport.ts`
- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `docs/API.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 18:54

### 🎯 Objetivo

Reproduzir fielmente no cliente os campos, valores estáticos e ordem do formulário HTML de autenticação.

### ✅ O que mudou

- Reordenado o payload conforme o formulário "Acesso à Agenda Diária do Perito".
- Incluídos `novaSenha`, `novaSenha1` e `msgPublicacao` com string vazia.
- Alterado `idCFC` de `-1` para string vazia.
- Preservados arquitetura, fluxo, CookieJar, redirects e critério de sucesso.
- Executados `typecheck`, `lint`, `build` e `npm run test:login`.
- Comparadas estruturalmente as respostas anterior e posterior ao ajuste.

### 🧠 Decisões

- **Evidência confirmada:** antes do ajuste, uma execução diagnóstica retornou o marcador autenticado e não continha `LoginActionForm`.
- **Evidência confirmada:** após o ajuste, o portal retornou HTTP 200 e `JSESSIONID`, mas a página continha `LoginActionForm` e não continha o marcador autenticado.
- **Evidência confirmada:** o HTML mudou de 72.162 para 28.696 caracteres.
- **Limite da evidência:** as requisições foram sequenciais contra estado externo; a diferença não pode ser atribuída exclusivamente ao payload.
- A Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `src/client/ecnh-auth-protocol.ts`
- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `docs/API.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 18:49

### 🎯 Objetivo

Incorporar o HTML completo do formulário "Acesso à Agenda Diária do Perito" à reconstrução do fluxo de autenticação.

### ✅ O que mudou

- Confirmado que "Acessar" é um link `<a>` com `onclick="login();"`.
- Confirmados o formulário, seu `action`, método, handler `onsubmit` e hidden `method=autenticar`.
- Documentados os handlers `onfocus` e `onblur` que removem e reaplicam a máscara do CPF.
- Confirmado que o DOM fornecido não possui os IDs exigidos por `onEnter()` e suas funções alternativas.
- Identificadas diferenças objetivas entre os controles do formulário e o payload do cliente.
- Atualizados auditoria, diagnóstico e matriz de divergências.

### 🧠 Decisões

- A ausência de transformação dentro de `login()` não significa ausência de transformação no ciclo completo do campo CPF.
- O HTML confirma `novaSenha`, `novaSenha1` e `msgPublicacao` vazios, ausentes no cliente.
- O formulário contém `idCFC` vazio, enquanto o cliente envia `idCFC=-1`.
- A representação efetivamente submetida do CPF ainda depende da sequência de eventos e deve ser preservada no Network.
- No DOM estático fornecido, o ENTER interrompe antes de qualquer submit porque `isCyberarkValue` não existe.
- Nenhum código foi alterado e a Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 18:43

### 🎯 Objetivo

Reconstruir, apenas com evidências de código, as cadeias executadas pelo clique em "Acessar" e pela tecla ENTER.

### ✅ O que mudou

- Documentada a sequência `onclick` → `login()` → validações → espera → `form.submit()`.
- Confirmado que o caminho do clique não altera o formulário no código disponível.
- Documentado separadamente o caminho de ENTER por `onEnter()`.
- Corrigidas a matriz de divergências e o diagnóstico para eliminar a hipótese de transformação por `login()`.

### 🧠 Decisões

- **Evidência confirmada:** clique e ENTER executam funções diferentes.
- **Evidência confirmada:** `submitAutenticar()` e `submitVerificarCyberark()`, usados pelo ENTER conforme `isCyberark`, alteram `form.action`.
- **Evidência confirmada:** `login()` não altera `action`, hidden `method`, CPF, senha ou outros campos.
- **Limite da evidência:** a tag HTML completa do elemento "Acessar" e o script inline exatamente da resposta intermediária não foram preservados.
- Nenhum código foi alterado e a Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 18:36

### 🎯 Objetivo

Determinar, exclusivamente pelo JavaScript do portal, como o navegador prepara o submit de `method=autenticar`.

### ✅ O que mudou

- Auditado `/GFR/js/app/sgu/login.js` e suas dependências declaradas e de validação.
- Confirmado que `login()` apenas valida, exibe a espera e chama o submit nativo.
- Catalogadas as submissões e mutações pertencentes a fluxos alternativos.
- Atualizada a auditoria técnica com as evidências coletadas.

### 🧠 Decisões

- **Evidência confirmada:** `login()` não altera CPF, senha, hidden fields, `action`, método HTTP ou `enctype`.
- **Evidência confirmada:** o fluxo normal não adiciona campos nem escreve `Origin`, `Referer` ou headers customizados.
- **Evidência confirmada:** `submitAutenticar()`, acionado pelo caminho alternativo de Enter, apenas aplica `encodeURIComponent` à senha usada na query string e não normaliza o CPF.
- As mutações de formulário encontradas em CyberArk, nova sessão, force logout e agenda não são chamadas por `login()`.
- Nenhum código foi alterado e a Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 18:23

### 🎯 Objetivo

Abandonar, por falta de evidência, a participação de `iniciarLoginAgenda` e auditar rigorosamente o POST `method=autenticar` produzido pelo cliente.

### ✅ O que mudou

- Criado `docs/AUDITORIA_POST_AUTENTICAR.md`.
- Documentados payload, ordem dos campos, headers efetivos, cookies, CookieJar, redirects e charset do cliente.
- Executada captura local com dados fictícios para observar o request produzido por Axios 1.18.1, sem acessar credenciais reais.
- Atualizados diagnóstico, matriz, API, README e documento da fase para remover `iniciarLoginAgenda` do fluxo considerado.
- Mantido o foco no POST comprovado pelo navegador.

### 🧠 Decisões

- Uma função sem chamador identificado não constitui evidência de execução.
- O cliente coincide com método, caminho, Content-Type e os nove campos documentados do navegador.
- A equivalência integral ainda não pode ser afirmada porque cookies enviados, headers e eventuais campos adicionais do POST bem-sucedido não foram preservados.
- O charset ISO-8859-1 é a única divergência concreta já demonstrada no processamento da resposta; ele não explica sozinho o retorno estrutural ao formulário.
- Nenhum código foi alterado e a Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/API.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 18:10

### 🎯 Objetivo

Avaliar se `/GFR/js/app/sgu/login.js` concentra a lógica que transforma o formulário intermediário no POST `method=autenticar`.

### ✅ O que mudou

- Analisada a nova evidência de que o formulário já contém `method=autenticar`.
- Reavaliada a necessidade de hidden fields e tokens dinâmicos na resposta intermediária.
- Priorizada a coleta de `login.js` para identificar a transformação executada por `onclick="login()"`.
- Nenhum código ou documento técnico foi modificado.

### 🧠 Decisões

- `login.js` provavelmente concentra a orquestração client-side da submissão final, mas não toda a lógica do protocolo, que também depende do estado mantido pelo servidor.
- A hipótese de que o HTML precisa fornecer dinamicamente o valor de `method` foi eliminada.
- A ausência de tokens aparentes reduz, mas não elimina, a hipótese de dados dinâmicos criados pelo script.
- A coleta de `login.js` passa a ter prioridade sobre uma análise adicional do corpo HTML já conhecido; cookies, redirects e o request efetivamente enviado continuam sendo evidências indispensáveis.
- A Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `CHANGELOG.md`

---

## 📅 18/07/2026 • 18:06

### 🎯 Objetivo

Determinar se a resposta do POST `method=iniciarLoginAgenda` precisa ser conhecida antes de reproduzir o fluxo confirmado do navegador.

### ✅ O que mudou

- Analisada a suficiência da sequência GET `verificarUsuarioCyberark` → POST `iniciarLoginAgenda` → POST `autenticar`.
- Identificadas as informações intermediárias que ainda podem alterar a construção do segundo POST.
- Nenhum código ou documento técnico foi modificado.

### 🧠 Decisões

- A resposta do primeiro POST é indispensável para concluir a descoberta do protocolo.
- Isso não implica que o código de produção necessariamente precisará interpretar seu HTML.
- O parsing só será necessário se a resposta fornecer hidden fields ou tokens usados pelo POST `autenticar`.
- Se a resposta apenas atualizar cookies, redirects ou estado de servidor, a sequência com o mesmo CookieJar poderá ser suficiente.
- A Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `CHANGELOG.md`

---

## 📅 18/07/2026 • 17:50

### 🎯 Objetivo

Criar uma comparação detalhada entre o fluxo HTTP do navegador e o `ECNHClient`, classificando cada diferença conforme a evidência disponível.

### ✅ O que mudou

- Criado `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`.
- Comparados sequência, GETs, POSTs, cookies, CookieJar, payload, campos ocultos, headers, redirects, charset, HTML e marcador autenticado.
- Cada item foi classificado como `Confirmada`, `Hipótese` ou `Eliminada`.
- As divergências foram ordenadas por probabilidade de impedir o login.
- A matriz foi referenciada pelo diagnóstico, fluxo HTTP, README e documento da fase.

### 🧠 Decisões

- A diferença a investigar primeiro é a existência e a função dos dois requests `login.do` do navegador.
- Preservação do CookieJar, método, caminho, Content-Type e payload principal conhecido foram eliminados como causas isoladas.
- GET genérico no próprio `login.do` também foi eliminado como correção suficiente.
- Charset ISO-8859-1 permanece uma divergência confirmada paralela: pode impedir a detecção de sucesso, mas não explica o retorno ao formulário.
- Nenhuma correção foi implementada e a Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `docs/FLUXO_HTTP.md`
- `README.md`
- `.fases/003-login-http.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 17:46

### 🎯 Objetivo

Comparar o protocolo implementado com as evidências do login manual e ordenar as causas prováveis da divergência, sem implementar correções.

### ✅ O que mudou

- Criado `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`.
- Documentadas hipóteses sobre os dois requests `login.do`, sessão inicial, cookies, campos ocultos, headers, redirects, credenciais e charset.
- Separadas evidências confirmadas, evidências contrárias e pendências de coleta para cada hipótese.
- Definido um plano de captura DevTools e comparação request a request.
- Adicionadas referências ao diagnóstico no README, no mapa de API, no roadmap e no documento da fase.

### 🧠 Decisões

- A principal hipótese é que o navegador executa um protocolo de duas etapas que foi consolidado incorretamente como um único POST.
- Um GET genérico no próprio `login.do` e campos ocultos estáticos não resolveram a autenticação, portanto não devem ser implementados como correção.
- A codificação ISO-8859-1 é um risco confirmado para o detector do marcador, mas não explica o retorno estrutural do formulário de login.
- Nenhuma alteração de código será feita antes de preservar separadamente os dois requests do navegador em uma captura sanitizada.
- A Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `docs/API.md`
- `.fases/003-login-http.md`
- `README.md`
- `docs/ROADMAP.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 17:38

### 🎯 Objetivo

Validar a implementação da Fase 003A contra o portal real do e-CNH, sem iniciar navegação autenticada ou funcionalidades de fases posteriores.

### ✅ O que mudou

- Executado `npm run test:login` com configuração local autorizada.
- Confirmados carregamento das variáveis, envio do POST URL-encoded, resposta HTTP 200 e preservação de `JSESSIONID` no CookieJar.
- Confirmado que o HTML retornou o formulário de login, com título "eCNHsp - DETRAN - São Paulo", sem o marcador "Imprimir Agenda Diária do Psicólogo".
- Registradas as evidências e pendências da validação na documentação técnica e no documento da fase.
- Mantido o status da Fase 003A como `Implementada`.

### 🧠 Decisões

- `JSESSIONID` isoladamente comprova sessão HTTP, não autenticação.
- O login continua exigindo conjuntamente `JSESSIONID` e o marcador HTML confirmado.
- Nenhum código foi alterado porque a resposta não fornece evidência suficiente para distinguir credenciais rejeitadas, campo ausente, cabeçalho obrigatório ou estado prévio do portal.
- A próxima ação segura é comparar o cliente com uma captura DevTools sanitizada de login manual bem-sucedido.
- A Fase 003B não deve começar enquanto a 003A não estiver `Concluída`.

### 📂 Arquivos impactados

- `.fases/003-login-http.md`
- `README.md`
- `docs/API.md`
- `docs/FLUXO_HTTP.md`
- `docs/ROADMAP.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 17:23

### 🎯 Objetivo

Criar uma convenção permanente e inequívoca para representar o estado de cada fase do projeto.

### ✅ O que mudou

- Definidos os estados únicos `Planejada`, `Implementada`, `Validada` e `Concluída`.
- Formalizada a progressão obrigatória entre os estados.
- Adicionado o status de cada fase ao roadmap.
- Documentada a convenção para contribuidores, desenvolvedores e agentes de IA.
- A Fase 003A foi registrada como `Implementada`; as Fases 003B a 007 permanecem `Planejada`.

### 🧠 Decisões

- `docs/ROADMAP.md` é a fonte de verdade dos estados.
- Nenhuma fase pode pular estados ou mudar de status sem evidência registrada.
- `Validada` exige execução dos critérios no ambiente adequado.
- `Concluída` exige validação, ausência de pendências bloqueantes no escopo e atualização documental.
- A Fase 003A não avançou para `Validada`, pois a autenticação no portal real ainda não foi confirmada.

### 📂 Arquivos impactados

- `AGENTS.md`
- `README.md`
- `docs/ROADMAP.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 17:05

### 🎯 Objetivo

Transformar visualmente o `CHANGELOG.md` em um diário contínuo, com leitura rápida do estado do projeto e sessões padronizadas.

### ✅ O que mudou

- Removida a seção `[Unreleased]`.
- Criado um dashboard com fase atual, próxima fase, última atualização e última sessão executada.
- Adotado o título de sessão `## 📅 DD/MM/YYYY • HH:mm`.
- Definida a estrutura interna de objetivo, mudanças, decisões e arquivos impactados.
- Atualizada a regra permanente em `AGENTS.md`.

### 🧠 Decisões

- As sessões são exibidas em ordem cronológica inversa.
- Registros anteriores sem data comprovada permanecem em uma área de histórico legado.
- Recomenda-se futuramente o nome `DIARIO_DE_BORDO.md`, mas o arquivo não foi renomeado nesta tarefa.

### 📂 Arquivos impactados

- `AGENTS.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 17:01

### 🎯 Objetivo

Transformar o `CHANGELOG.md` em um diário permanente da evolução do projeto.

### ✅ O que mudou

- Foram estabelecidos os campos `Última atualização` e `Fase atual`.
- Foi criada inicialmente a área `[Unreleased]` com sessões datadas.
- A atualização obrigatória do diário ao concluir qualquer tarefa foi formalizada em `AGENTS.md`.

### 🧠 Decisões

- Cada conclusão deve acrescentar uma sessão com data e hora em BRT.
- Sessões e histórico anteriores nunca podem ser sobrescritos ou apagados.
- O uso de `[Unreleased]` foi posteriormente substituído pelo formato direto de sessões registrado em 18/07/2026 às 17:05.

### 📂 Arquivos impactados

- `AGENTS.md`
- `CHANGELOG.md`

---

## 🗂️ Histórico anterior ao diário

Os registros abaixo foram preservados sem datas ou horários porque essas informações não foram documentadas no momento das alterações.

### Refinamento documental — Roadmap

- **Objetivo:** padronizar a nomenclatura das fases futuras e alinhar o roadmap à separação arquitetural do sistema.
- **Principais alterações:** fases 003A–007 renomeadas e reordenadas (006 — Orquestração multi-profissionais; 007 — Agendamento automático); tabela de alinhamento arquitetural adicionada em `docs/ROADMAP.md`; referências atualizadas em README, visão do produto e documentação técnica.
- **Decisões:** observabilidade deixa de ser fase numerada — logs estruturados permanecem padrão transversal desde a Fase 000; cron passa a ser responsabilidade exclusiva da Fase 007.
- **Arquivos impactados:** `docs/ROADMAP.md`, `README.md`, `docs/VISAO_DO_PRODUTO.md`, `docs/ARQUITETURA.md`, `docs/API.md`, `.fases/003-login-http.md`, `CHANGELOG.md`.

### Refinamento documental — Visão do produto

- **Objetivo:** separar a documentação funcional da documentação técnica, facilitando onboarding de desenvolvedores e agentes de IA.
- **Principais alterações:** criado `docs/VISAO_DO_PRODUTO.md` com objetivo, usuários, fluxo operacional, MVP, arquitetura funcional, backlog, escopo e itens fora do escopo; README atualizado com seção de leitura recomendada.
- **Decisões:** visão funcional permanece em documento próprio; detalhes de integração HTTP, domínio e ADRs continuam nos documentos técnicos existentes.
- **Arquivos impactados:** `docs/VISAO_DO_PRODUTO.md`, `README.md`, `CHANGELOG.md`.

### Fase 003A — Autenticação HTTP

- **Objetivo:** entregar o MVP de autenticação HTTP, sessão e teste automatizado sem navegar na agenda.
- **Principais alterações:** `ECNHClient` envia o POST de login confirmado; Axios usa `tough-cookie` e `axios-cookiejar-support`; criado exemplo mínimo em `examples/login.ts`.
- **Decisões:** sucesso exige `JSESSIONID` e marcador HTML confirmados; estados sem sinal comprovado não usam heurísticas; logout descarta somente a sessão local enquanto seu endpoint é desconhecido.
- **Arquivos impactados:** `package.json`, `package-lock.json`, `.env.example`, `src/client/`, `src/types/auth.ts`, `src/scripts/test-login.ts`, `examples/login.ts`, `README.md`, `docs/API.md`, `docs/ARQUITETURA.md`, `docs/MODELO_DOMINIO.md`, `.fases/003-login-http.md`.

### Fase 002.3 — Modelagem do domínio

- **Objetivo:** documentar os contratos conceituais compartilhados entre cliente, parser, serviços e Google Sheets.
- **Principais alterações:** modelos de Profissional, Paciente, Agenda, ResultadoLogin e ResultadoConsultaAgenda; diretrizes de privacidade e limites de evidência.
- **Decisões:** resultados lógicos não são associados a HTTP/HTML até confirmação; senhas são efêmeras e dados pessoais não são expostos.
- **Arquivos impactados:** `docs/MODELO_DOMINIO.md`, `docs/ARQUITETURA.md`, `CHANGELOG.md`, `.fases/002.3-modelagem-dominio.md`.

### Fase 002.2 — Refinamento da arquitetura para autenticação

- **Objetivo:** dividir a implementação de autenticação em etapas pequenas e independentes.
- **Principais alterações:** Fase 003 separada em 003A (autenticação HTTP e sessão) e 003B (navegação autenticada); `ECNHClient` documentado como fronteira única do portal.
- **Decisões:** resultado de login será explicitamente modelado; parser, serviços e Sheets não fazem HTTP direto ao e-CNH.
- **Arquivos impactados:** `CHANGELOG.md`, `docs/ROADMAP.md`, `docs/ARQUITETURA.md`, `docs/DECISOES.md`, `.fases/003-login-http.md`, `.fases/002.2-refinamento-autenticacao.md`.

### Fase 002.1 — Consolidar regras permanentes

- **Objetivo:** tornar `AGENTS.md` a fonte permanente de instruções do repositório.
- **Principais alterações:** regras de idioma, ciclo de fases, atualização documental obrigatória, padrão de evidências, CHANGELOG e ordem de trabalho.
- **Decisões:** documentação e arquitetura antecedem implementação; cada fase concluída possui registro próprio.
- **Arquivos impactados:** `AGENTS.md`, `CHANGELOG.md`, `.fases/`.

### Fase 002 — Consolidação arquitetural

- **Objetivo:** consolidar documentação e arquitetura com evidências do DevTools.
- **Principais alterações:** registro de `POST /gefor/SGU/login.do`, formulário URL-encoded, `JSESSIONID`, HTML SSR e fluxo HTTP.
- **Decisões:** ADR-002 estabelece HTTP direto como estratégia principal; Playwright fica para investigação e depuração.
- **Arquivos impactados:** `README.md`, `docs/API.md`, `docs/ARQUITETURA.md`, `docs/DECISOES.md`, `docs/FLUXO_HTTP.md`, `docs/ROADMAP.md`.

### Fase 001 — Engenharia reversa

- **Objetivo:** preparar o mapa de investigação do portal e-CNH sem implementar integração.
- **Principais alterações:** documentação de autenticação, sessão, navegação, riscos e checklist de captura autorizada.
- **Decisões:** fatos e hipóteses devem ser separados; nenhum contrato externo é inferido sem evidência.
- **Arquivos impactados:** `docs/API.md`, `docs/ARQUITETURA.md`, `docs/DECISOES.md`, `.fases/001-engenharia-reversa.md`.

### Fase 000 — Foundation

- **Objetivo:** criar estrutura, convenções e documentação base do projeto.
- **Principais alterações:** configuração TypeScript, organização de pastas, scripts de qualidade e documentação inicial.
- **Decisões:** TypeScript estrito e arquitetura por responsabilidades técnicas.
- **Arquivos impactados:** `package.json`, `tsconfig.json`, `.env.example`, `README.md`, `docs/`.
