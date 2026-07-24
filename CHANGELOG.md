# Diário de evolução do projeto

> ### 📌 Estado atual
>
> **Fase atual:** Infraestrutura Railway (Cron efêmero 16:00 BRT)
> **Próxima prioridade:** Validar sync no Railway após retry Sheets / menos writes
> **Última atualização:** 2026-07-23 21:30 BRT
> **Última sessão executada:** 23/07/2026 • 21:30 — Ativos só com data > hoje

Este arquivo registra, em ordem cronológica inversa, cada sessão concluída no projeto. O histórico nunca deve ser apagado ou sobrescrito.

> **Recomendação de nomenclatura:** `DIARIO_DE_BORDO.md` representa melhor a função atual do arquivo. O nome `CHANGELOG.md` deve ser mantido por enquanto para preservar referências existentes; uma eventual renomeação deve ocorrer em tarefa própria, com atualização coordenada de toda a documentação.

---

## 📅 23/07/2026 • 21:30

### 🎯 Objetivo

Ajustar a regra de pacientes ativos: permanecem apenas agendamentos com data **estritamente maior** que hoje (calendário `America/Sao_Paulo`).

### ✅ O que mudou

- `isDataAgendamentoAtiva`: comparação `>=` → `>`.
- Testes: ontem/hoje removidos; amanhã mantido.

### 🧠 Decisões

- **Decisão:** menor alteração possível na função existente; demais regras intactas.

### 📂 Arquivos impactados

- `src/utils/agenda-date.ts`, `src/utils/agenda-date.test.ts`
- `src/repositories/google-sheets-agenda-repository.ts` (comentário)
- `src/repositories/google-sheets-agenda-repository.test.ts`
- `docs/MODELO_DOMINIO.md`, `docs/ARQUITETURA.md`, `docs/BACKLOG.md`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 21:25

### 🎯 Objetivo

Corrigir dessincronização de índice em `hidratarCpfTecnico` que fazia pacientes existentes serem classificados como novos e receberem nova `DATA DE INCLUSÃO`.

### ✅ O que mudou

- `linhasParaRegistros` passa a gravar `rowIndex` da linha original.
- `hidratarCpfTecnico` usa `registro.rowIndex` (não o índice do array filtrado).
- Teste de regressão com linha vazia entre A e B.

### 🧠 Decisões

- **Decisão:** menor correção possível; sem mudar dedupe, Sheets, retry ou pipeline.

### 📂 Arquivos impactados

- `src/repositories/agenda-sheet-mapper.ts`
- `src/repositories/agenda-sheet-mapper.test.ts`
- `src/repositories/google-sheets-agenda-repository.ts`
- `src/repositories/google-sheets-agenda-repository.test.ts`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 21:20

### 🎯 Objetivo

Diagnosticar por que registros existentes podem receber nova `DATA DE INCLUSÃO` — **somente observabilidade**, sem corrigir ainda.

### ✅ O que mudou

- Logs `agenda.sheets.classificacao.*` e `agenda.sheets.hidratar_cpf.indice_dessincronizado` (CPF mascarado).
- Evidência de dessincronização `corpo[index]` vs registros após skip do mapper.

### 🧠 Decisões

- **Evidência:** `hidratarCpfTecnico` usa índice do array parseado, não da linha original do corpo.
- **Pendência:** correção mínima a decidir após revisar logs no Railway.

### 📂 Arquivos impactados

- `src/repositories/google-sheets-agenda-repository.ts`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 21:15

### 🎯 Objetivo

Tornar a persistência Google Sheets resiliente à cota de writes (HTTP 429) observada no Railway, sem mascarar erros permanentes e sem derrubar o Cron por falha parcial.

### ✅ O que mudou

- Retry com backoff + `Retry-After` centralizado em `GoogleSheetsClient` (`agenda.sheets.retry.*`).
- Reescrita: `update` + clear só da cauda (quando encolhe); skip quando não há mudança.
- Resumo: processados/sucessos/falhas/tempo/`falhasPorMotivo`; exit code 0 em sucesso parcial.
- ADR-021 + `GOOGLE_SHEETS_MAX_ATTEMPTS`.

### 🧠 Decisões

- **Evidência:** falha em `PERSIST_AGENDA` / `updateValues`|`clearValues` com quota “Write requests per minute per user”.
- **Decisão:** ADR-021 — retry só transitório; menos writes; Cron não crasha por falha parcial.

### 📂 Arquivos impactados

- `src/client/google-sheets-client.ts`, `src/client/google-sheets-retry.ts` (+ testes)
- `src/repositories/google-sheets-agenda-repository.ts`
- `src/services/agenda-sync-service.ts`, `src/scripts/sync-agenda*.ts`
- `src/config/google-sheets-config.ts`, `src/composition/agenda-sync-runtime.ts`
- `docs/DECISOES.md`, `.env.example`, `CHANGELOG.md`

---

## 📅 23/07/2026 • 20:55

### 🎯 Objetivo

Instrumentar o pipeline após `ecnh.login.flow.completed` até Google Sheets e logout — **somente observabilidade**, sem alterar regras de negócio.

### ✅ O que mudou

- Helper `PipelineStepTracker` com `lastSuccessfulPipelineStep`, duração, contagens e stack.
- Etapas: perfil pós-login, listar datas, fetch HTML, parse, transform, persistência, Sheets API, logout.
- Logs em `warn`/`error` (visíveis no Cron Railway com `level: warn`).
- `catch` do Sheets agora registra o erro real (antes engolia sem log).

### 🧠 Decisões

- **Decisão:** eventos `agenda.pipeline.step.*` / `agenda.pipeline.flow.*` espelham o padrão do login.
- **Decisão:** não logar CPF, senha, cookies nem conteúdo de células.

### 📂 Arquivos impactados

- `src/utils/pipeline-observability.ts`
- `src/services/agenda-sync-service.ts`
- `src/client/ecnh-client.ts`
- `src/client/ecnh-agenda-protocol.ts`
- `src/repositories/google-sheets-agenda-repository.ts`
- `src/jobs/agenda-sync-job.ts`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 20:50

### 🎯 Objetivo

Instrumentar o fluxo completo de autenticação e-CNH (etapas + redirects) com logs estruturados seguros — **sem** alterar regras de login, cookies, retries ou negócio.

### ✅ O que mudou

- `AuthTransport`: `loginStep`, contagens de cookies, Location, bodyBytes, responseUrl, evento `ecnh.http.redirect`.
- `ECNHAuthenticationProtocol`: eventos `ecnh.login.step.*` / `ecnh.login.flow.*` com `lastSuccessfulLoginStep`.
- `ECNHClient` repassa o logger ao protocolo.

### 🧠 Decisões

- **Decisão:** observabilidade apenas; classificação de erro e sequência HTTP inalteradas.
- **Decisão:** nunca logar CPF, senha, Cookie ou Authorization.

### 📂 Arquivos impactados

- `src/client/auth-transport.ts`
- `src/client/ecnh-auth-protocol.ts`
- `src/client/ecnh-client.ts`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 20:40

### 🎯 Objetivo

Modo diagnóstico permanente via `RUN_CONNECTIVITY_PROBE`, sem trocar o Start Command do Railway e sem alterar regras de sync.

### ✅ O que mudou

- `resolveEntrypointMode` + `runEcnhConnectivityProbe` em `src/diagnostics/`.
- `src/index.ts`: se probe ativo → só GET isolado; senão → `sync-agenda` (padrão).
- Docs `DEPLOY_RAILWAY.md` / `DEPLOY_CHECKLIST.md` + `.env.example`.
- Testes unitários do modo e do probe sem `ECNH_BASE_URL`.

### 🧠 Decisões

- **Decisão:** Start Command permanece `node dist/index.js`; diagnóstico só por Variable.
- **Decisão:** valores truthy `true|1|yes|on`; default = AgendaSync.

### 📂 Arquivos impactados

- `src/index.ts`
- `src/diagnostics/entrypoint-mode.ts` (+ testes)
- `src/diagnostics/ecnh-connectivity-probe.ts` (+ testes)
- `src/scripts/test-ecnh-connectivity.ts`
- `docs/DEPLOY_RAILWAY.md` / `docs/DEPLOY_CHECKLIST.md`
- `.env.example` / `CHANGELOG.md`

---

## 📅 23/07/2026 • 20:35

### 🎯 Objetivo

Máxima observabilidade do transporte HTTP do portal (ECONNRESET no Railway) e script isolado de conectividade — **sem** alterar autenticação, retries, keepAlive ou timeout.

### ✅ O que mudou

- `AuthTransport`: logs com hostname/path/protocolo, statusText, headers sanitizados, fase hipotética (`connectionPhaseHint`), stack/cause.
- Script `npm run test:ecnh-connectivity` — só GET `iniciarLogin` com o mesmo `AuthTransport`.

### 🧠 Decisões

- **Decisão:** nenhuma correção de transporte nesta etapa; só instrumentação + probe.
- **Hipótese dominante (a confirmar com probe):** bloqueio/WAF/egress do datacenter no 1º GET (conexão nova).

### 📂 Arquivos impactados

- `src/client/auth-transport.ts`
- `src/scripts/test-ecnh-connectivity.ts`
- `package.json`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 20:30

### 🎯 Objetivo

Instrumentar o transporte HTTP do e-CNH com logs detalhados para diagnosticar `ECONNRESET` / `socket hang up` no primeiro `GET method=iniciarLogin` a partir do Railway — **sem** alterar a lógica de autenticação/sync.

### ✅ O que mudou

- `AuthTransport.request`: logs `warn`/`error` com URL absoluta, headers seguros, duração, keepAlive/timeout e stack completa do erro.
- Nível `warn` para aparecer no sync de produção (logger em `warn`).

### 🧠 Decisões

- **Diagnóstico:** o GET ocorre em `ECNHAuthenticationProtocol.login` (1ª etapa); `ECONNRESET` no 1º profissional indica falha de conexão nova (não reuse de keep-alive).
- **Decisão:** ainda sem retry/keepAlive=false — só observabilidade nesta etapa.

### 📂 Arquivos impactados

- `src/client/auth-transport.ts`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 20:05

### 🎯 Objetivo

Corrigir o entrypoint de produção: Railway executava `node dist/index.js` (stub vazio) e encerrava sem sincronizar.

### ✅ O que mudou

- `src/index.ts` passa a importar `scripts/sync-agenda.js` (mesmo fluxo E2E).
- `package.json` / `railway.toml` / `nixpacks.toml`: Start = `node dist/index.js`.
- Docs de deploy alinhados.

### 🧠 Decisões

- **Causa raiz:** Start Command no Railway apontava para `dist/index.js`, que era stub (`export {}`) e não disparava o sync.
- **Decisão:** tornar `dist/index.js` o entrypoint canônico que delega ao sync (compatível com detecção Nixpacks e override do painel).

### 📂 Arquivos impactados

- `src/index.ts`
- `package.json`
- `railway.toml` / `nixpacks.toml`
- `docs/DEPLOY_RAILWAY.md` / `docs/DEPLOY_CHECKLIST.md`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 19:25

### 🎯 Objetivo

Revisar a preparação Railway (ADR-020), eliminar riscos de processo que não encerra, documentar checklist e garantir execução só com variáveis de ambiente — **sem deploy**.

### ✅ O que mudou

- `sync-agenda` chama `process.exit` após o sync (Cron efêmero + HTTP keep-alive).
- `docs/DEPLOY_CHECKLIST.md` criado.
- `docs/DEPLOY_RAILWAY.md` reescrito como guia passo a passo.
- `nixpacks.toml` alinhado ao build/start.
- Mensagens de config citam Railway Variables (não só `.env`).

### 🧠 Decisões

- **Decisão:** lock em `.data/` permanece (FS efêmero auto-criado); sem volume obrigatório.
- **Decisão:** `node-cron` / `job:agenda` continuam só para uso local; Start de produção é one-shot.

### 📂 Arquivos impactados

- `src/scripts/sync-agenda.ts`
- `src/config/google-sheets-config.ts`
- `src/composition/agenda-sync-runtime.ts`
- `docs/DEPLOY_CHECKLIST.md`
- `docs/DEPLOY_RAILWAY.md`
- `nixpacks.toml`
- `README.md` / `CHANGELOG.md`

---

## 📅 23/07/2026 • 19:15

### 🎯 Objetivo

Preparar a infraestrutura para execução automática diária às 16:00 BRT no Railway, sem alterar regras de negócio da sincronização.

### ✅ O que mudou

- Arquitetura **Opção A**: Railway Cron → `npm start` (`dist/scripts/sync-agenda.js`) → encerra.
- `GOOGLE_SERVICE_ACCOUNT_JSON` para Service Account sem arquivo no disco.
- `railway.toml`, `docs/DEPLOY_RAILWAY.md`, ADR-020.
- Scripts `sync:agenda:prod` / `job:agenda:prod`; `start` aponta para o sync one-shot.

### 🧠 Decisões

- **Decisão (ADR-020):** Cron efêmero em vez de daemon 24/7; horário `0 19 * * *` UTC ≡ 16:00 `America/Sao_Paulo`.
- **Decisão:** `job:agenda` permanece para uso local; não é o start do serviço Cron.

### 📂 Arquivos impactados

- `src/config/google-sheets-config.ts` (+ testes)
- `src/client/google-sheets-client.ts`
- `src/composition/agenda-sync-runtime.ts`
- `src/scripts/validate-sheets.ts` / `discover-sheets.ts`
- `package.json` / `railway.toml`
- `docs/DEPLOY_RAILWAY.md` / `docs/DECISOES.md`
- `.env.example` / `CHANGELOG.md` / `README.md`

---

## 📅 23/07/2026 • 18:55

### 🎯 Objetivo

Validar E2E que a nova formatação de PACIENTE e PROFISSIONAL chega ao Google Sheets sem alterar regras de sincronização, autenticação ou parser.

### ✅ O que mudou

- Evidência `docs/evidencias/009-validacao-e2e-formatacao-sheets-2026-07-23.md`.
- Índice atualizado em `docs/evidencias/README.md`.
- Resultado: 16/16 profissionais OK; 233/233 linhas no padrão novo; 0 dupla formatação; pronto para commit.

### 🧠 Decisões

- **Evidência confirmada:** formatação aplicada ponta a ponta; `perfilId` do login alimenta o prefixo Psicólogo/Médico.
- **Observação operacional:** `npm run sync:agenda` em rajada pode falhar pontualmente na API Sheets (`erro-infraestrutura`); retry resolve — não é regressão da formatação.

### 📂 Arquivos impactados

- `docs/evidencias/009-validacao-e2e-formatacao-sheets-2026-07-23.md`
- `docs/evidencias/README.md`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 18:45

### 🎯 Objetivo

Alterar apenas a formatação das colunas PACIENTE e PROFISSIONAL na persistência do Google Sheets, sem mudar regras de sincronização, autenticação ou parser.

### ✅ O que mudou

- PACIENTE: apenas o primeiro nome em Title Case (`JOSE EDSON…` → `Jose`).
- PROFISSIONAL: `<tipo>: <PRIMEIRO> <SEGUNDO>` em caixa alta, com tipo do domínio (`Psicólogo` / `Médico`).
- Utilitários `formatPatientName` e `formatProfessionalDisplayName` consumidos pelo mapper; linhas já persistidas não reformata o profissional na regravação.
- `perfilId` do login passa a compor o contexto de persistência.

### 🧠 Decisões

- **Decisão:** formatadores isolados em `utils/`; a camada Sheets só consome.
- **Decisão:** regravação de linhas ativas aplica Title Case no paciente, mas preserva o valor já projetado de PROFISSIONAL (evita reprocessar `"Psicólogo: …"`).

### 📂 Arquivos impactados

- `src/utils/format-patient-name.ts` (+ testes)
- `src/utils/format-professional-display-name.ts` (+ testes)
- `src/repositories/agenda-sheet-mapper.ts` (+ testes)
- `src/repositories/agenda-repository.ts`
- `src/repositories/google-sheets-agenda-repository.ts` (+ testes)
- `src/services/agenda-sync-service.ts` (+ testes)
- `src/scripts/validate-sheets.ts`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 18:30

### 🎯 Objetivo

Registrar oficialmente a validação E2E de credenciais e sincronização de agenda contra o portal real e o Google Sheets, como marco permanente do projeto.

### ✅ O que mudou

- Evidência sanitizada em `docs/evidencias/008-validacao-e2e-credenciais-sync-2026-07-23.md`.
- Índice atualizado em `docs/evidencias/README.md`.
- Resultado confirmado: auditoria 16/17 autenticados; sync E2E 16/16 sucesso; Alessandra excluída (bloqueio portal).

### 🧠 Decisões

- **Decisão:** declarar produção local aprovada e prontidão para deploy Railway, com ressalva operacional da conta bloqueada.
- **Evidência confirmada:** sucesso geral do `npm run sync:agenda` com 16 profissionais habilitados.

### 📂 Arquivos impactados

- `docs/evidencias/008-validacao-e2e-credenciais-sync-2026-07-23.md`
- `docs/evidencias/README.md`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 18:25

### 🎯 Objetivo

Corrigir `.env` (Rodrigo/Priscila) e tornar mensagens da auditoria precisas quando o `ECNH_USER` existe mas a senha não entra no escopo; reexecutar `audit:credenciais`.

### ✅ O que mudou

- `.env` local: senhas de Rodrigo e Priscila entre aspas (valores do catálogo).
- Diagnóstico de fora do escopo: PASSWORD vazia vs `#` sem aspas vs ausência de usuário.
- Mensagem quando candidata é idêntica e o portal rejeita (possível bloqueio).

### 🧠 Decisões

- **Decisão:** apenas observabilidade + correção local de secrets; regras de retry inalteradas.

### 📂 Arquivos impactados

- `.env` (local, não versionado)
- `src/config/credential-audit-scope.ts` (+ testes)
- `src/services/credential-refresh-service.ts`
- `src/scripts/audit-credentials.ts`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 18:20

### 🎯 Objetivo

Adicionar modo `audit` de credenciais: percorrer o catálogo (inclui `ENABLED=false`), validar/atualizar CPF/senha sem sincronizar agenda e sem alterar `ENABLED`.

### ✅ O que mudou

- `npm run audit:credenciais` + `executarAuditoria` reutilizando o fluxo de retry do refresh.
- Escopo catálogo × `.env` (`credential-audit-scope`); resumo próprio de auditoria.
- Refresh (`executar`) permanece inalterado na regra de negócio.

### 🧠 Decisões

- **Decisão:** o catálogo define a varredura; matching por CPF/nome; órfãos sem `ECNH_USER` entram como falha `sem_env`.

### 📂 Arquivos impactados

- `src/config/credential-audit-scope.ts` (+ testes)
- `src/services/credential-refresh-service.ts` (+ testes)
- `src/scripts/audit-credentials.ts`
- `package.json`, `.env.example`, `CHANGELOG.md`

---

## 📅 23/07/2026 • 18:15

### 🎯 Objetivo

Reforçar observabilidade do `refresh:credenciais` (logs por profissional + resumo de auditoria), sem alterar regras de negócio nem expor senhas.

### ✅ O que mudou

- Logs por etapa: início (nome + CPF mascarado), tentativa atual, resultado tipado, busca/retry de candidata, persistência (`cpf`/`senha`/`ambos`).
- Resumo final expandido (mantidos, atualizados, sem candidata, falharam novamente, portal, timeout, erros internos).
- Utilitário `mascararCpf` para auditoria.

### 🧠 Decisões

- **Decisão:** apenas observabilidade; fluxo de retry e critérios de `senha_invalida` inalterados.

### 📂 Arquivos impactados

- `src/services/credential-refresh-service.ts` (+ testes)
- `src/utils/cpf-mask.ts` (+ testes)
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 18:10

### 🎯 Objetivo

Implementar atualização inteligente e genérica de credenciais dos profissionais: manter as que ainda autenticam; só substituir no `.env` quando o login atual for `senha_invalida` e uma candidata do catálogo autenticar.

### ✅ O que mudou

- Classificação de falha de login: heurística `senha_invalida`; transporte tipado como `timeout` / `portal_indisponivel` / `erro_sistema`.
- Catálogo JSON genérico (`secrets/credenciais-candidatas.json`, gitignored) + exemplo em `docs/exemplos/`.
- `CredentialRefreshService` + `npm run refresh:credenciais` com resumo Mantidas/Atualizadas/Falharam (sem PII).
- Persistência apenas de `ECNH_USER_<n>_CPF` / `PASSWORD` no `.env`.
- ADR-019 e testes unitários.

### 🧠 Decisões

- **Decisão:** ADR-019 — retry único só em `senha_invalida`; matching por CPF/nome; sem hard-code de profissionais.
- **Pendência de validação:** textos literais de senha incorreta no HTML do portal ainda sem evidência confirmada; usa-se heurística estrutural (`LoginActionForm`).

### 📂 Arquivos impactados

- `src/types/auth.ts`
- `src/client/classificar-falha-login.ts`
- `src/client/ecnh-auth-protocol.ts`
- `src/config/credential-candidates.ts` (+ testes)
- `src/config/env-credential-store.ts`
- `src/services/credential-refresh-service.ts` (+ testes)
- `src/scripts/refresh-credentials.ts`
- `package.json`, `.env.example`
- `docs/DECISOES.md`, `docs/exemplos/credenciais-candidatas.example.json`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 17:55

### 🎯 Objetivo

Transformar `docs/ROADMAP.md` em documento premium (histórico + planejamento), no mesmo nível visual do README, sem alterar código.

### ✅ O que mudou

- Hero, visão de status, timeline ASCII + Mermaid, cards por fase, pós-MVP, estado atual, próximos passos (só BACKLOG), visão futura ilustrativa, estatísticas verificáveis e navegação.
- Preservadas todas as tabelas/notas oficiais do MVP e das evoluções 003C–003E; registradas fases 008/009 como descontinuadas.

### 🧠 Decisões

- **Decisão:** próximos passos = apenas itens do BACKLOG (B014 / D3) + screenshots docs; sem reintroduzir 008/009.
- **Decisão:** estatísticas apenas com contagens de arquivos/entradas do repositório.

### 📂 Arquivos impactados

- `docs/ROADMAP.md`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 17:50

### 🎯 Objetivo

Refinamento visual final do README como landing page GitHub, sem alterar ordem das seções, arquitetura ou conteúdo técnico.

### ✅ O que mudou

- Hero com `banner-ecnh-ai.png`, logo, título sem emoji, subtítulo reforçado e badges hierarquizados.
- Mermaid em fluxo horizontal (`flowchart LR`) com espaçamento maior; âncoras HTML para navegação.
- Screenshots com aviso explícito de placeholders; Stack com badges + tabela; rodapé enxuto sem banner duplicado.

### 🧠 Decisões

- **Decisão:** apenas apresentação — nenhuma remoção de informação técnica nem mudança de ordem de seções.

### 📂 Arquivos impactados

- `README.md`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 17:45

### 🎯 Objetivo

Elevar o `README.md` ao padrão de landing page de projetos open source premium (Vercel / Railway / Supabase), sem alterar código.

### ✅ O que mudou

- Hero com logo, badges (Node, TS, Axios, Cheerio, Sheets, MVP, License Private) e navegação rápida.
- Seções: Visão, Fluxo Mermaid, Funcionalidades, Screenshots (placeholders), Stack, Estrutura, Execução, Estado, Roadmap, Docs, Segurança.
- Pasta `docs/assets/screenshots/` preparada para capturas futuras.
- Banner vetorial no rodapé; documentação técnica permanece indexada em `docs/` / `.fases/` / ADRs.

### 🧠 Decisões

- **Decisão:** manter stack real (Axios/Cheerio) nos badges — não Playwright.
- **Decisão:** screenshots como placeholders explícitos, sem inventar imagens.

### 📂 Arquivos impactados

- `README.md`
- `docs/assets/screenshots/README.md`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 17:42

### 🎯 Objetivo

Criar banner oficial 1600×400 para o README, com identidade própria de software de automação (não a do portal e-CNH SP).

### ✅ O que mudou

- Banner vetorial (`banner-ecnh.svg`) e PNG renderizado (`banner-ecnh.png`) em `docs/assets/`.
- Variante gerada por IA (`banner-ecnh-ai.png`) como alternativa visual.
- Paleta azul/cinza, pipeline Portal → Automação → Parser → Google Sheets.

### 🧠 Decisões

- **Decisão:** versão oficial = SVG + PNG vetorial (tipografia nítida, proporção exata); IA fica como alternativa.
- **Nota:** o banner lista Playwright conforme brief criativo; o caminho produtivo do código permanece HTTP/Axios.

### 📂 Arquivos impactados

- `docs/assets/banner-ecnh.svg`
- `docs/assets/banner-ecnh.png`
- `docs/assets/banner-ecnh-ai.png`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 17:40

### 🎯 Objetivo

Transformar o `README.md` em landing page visual para o GitHub, sem alterar código nem mover documentação técnica de `docs/`, `.fases/` e ADRs.

### ✅ O que mudou

- README reorganizado: hero com logo, badges, visão geral, funcionalidades, Mermaid, stack, estrutura, execução, estado, roadmap e índice de docs.
- Detalhes técnicos profundos (validadores, protocolo, convenções de fase) apontam para a documentação existente em vez de ocupar a página principal.
- Stack e diagrama alinhados ao caminho real de produção (HTTP/Axios/Cheerio), não Playwright.

### 🧠 Decisões

- **Decisão:** manter Playwright fora de badges/arquitetura de produção; refletir a arquitetura documentada.
- **Decisão:** documentação técnica permanece em `docs/` / `.fases/` / `DECISOES.md` — README só indexa.

### 📂 Arquivos impactados

- `README.md`
- `CHANGELOG.md`

---

## 📅 23/07/2026 • 13:38

### 🎯 Objetivo

Tornar a validação do cabeçalho da aba Agenda robusta a diferenças de formatação (whitespace) e melhorar o diagnóstico de `cabecalho-incompativel`.

### ✅ O que mudou

- Normalização de rótulos (`normalizeTextoCabecalho`) antes da comparação e na resolução de aliases do mapper.
- Aceita quebras de linha / tabs / espaços múltiplos em títulos semanticamente iguais (ex.: `AGENDAMENTO\nDO DETRAN`).
- Log estruturado com cabeçalho esperado, encontrado e coluna divergente.
- `sync:agenda` passa a emitir warns do repositório (Pino `level: warn`) para o diagnóstico de cabeçalho.

### 🧠 Decisões

- **Decisão:** não alterar o contrato visual nem os motivos tipados de falha; apenas comparação e observabilidade.
- **Evidência confirmada (prévia):** planilha real tinha `AGENDAMENTO \nDO DETRAN` na coluna B, rejeitado pelo match estrito.

### 📂 Arquivos impactados

- `src/repositories/agenda-sheet-headers.ts`
- `src/repositories/agenda-sheet-headers.test.ts`
- `src/repositories/agenda-sheet-mapper.ts`
- `src/repositories/google-sheets-agenda-repository.ts`
- `src/repositories/google-sheets-agenda-repository.test.ts`
- `src/composition/agenda-sync-runtime.ts`
- `src/scripts/sync-agenda.ts`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 18:40

### 🎯 Objetivo

Registrar que a coluna técnica de CPF é decisão de implementação da v1.0 (não objetivo arquitetural permanente) e abrir item de backlog para evolução futura.

### ✅ O que mudou

- **B014** (⏳ Pendente, prioridade Baixa): separar projeção operacional de metadados técnicos de sincronização.
- **ADR-018:** documenta a coluna técnica de CPF como solução aceita na v1.0, com evolução futura em B014.
- Nenhuma alteração de código, comportamento ou testes.

### 🧠 Decisões

- Coluna técnica permanece na v1.0; não remover agora.
- Solução futura (aba técnica, store auxiliar, etc.) **não** é escolhida nesta sessão — apenas registrada como possível.

### 📂 Arquivos impactados

- `docs/BACKLOG.md`
- `docs/DECISOES.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 18:35

### 🎯 Objetivo

Alinhar arquitetura/documentação: CPF continua sendo a identidade oficial do paciente (B004/B005); só a projeção visual da planilha omite o CPF.

### ✅ O que mudou

- Removida qualquer noção de identidade PACIENTE+TELEFONE.
- Deduplicação no repositório volta a usar **somente CPF**.
- Documentação (MODELO, README, ARQUITETURA, CHANGELOG) deixa explícito: mudou a projeção, não a regra de negócio.
- Coluna técnica adjacente (fora de `CABECALHOS_ABA_AGENDA`) preserva o CPF entre syncs sem incluí-lo no contrato visual da clínica.

### 🧠 Decisões

- Domínio / sync / deduplicação → CPF (inalterado).
- Planilha operacional → 8 colunas sem CPF no cabeçalho oficial.

### 📂 Arquivos impactados

- `src/repositories/google-sheets-agenda-repository.ts` (+ test)
- `src/repositories/agenda-sheet-headers.ts`
- `docs/MODELO_DOMINIO.md`, `docs/ARQUITETURA.md`, `README.md`, `CHANGELOG.md`

---

## 📅 19/07/2026 • 18:30

### 🎯 Objetivo

Evoluir o contrato da planilha Google Sheets para o layout operacional simplificado (produto), sem alterar domínio nem sincronização.

### ✅ O que mudou

- `CABECALHOS_ABA_AGENDA` passou a ser a única fonte de verdade do layout oficial (8 colunas).
- Mapper grava apenas as 8 colunas de `CABECALHOS_ABA_AGENDA`: UNIDADE, AGENDAMENTO DO DETRAN, HORÁRIO, PACIENTE, TELEFONE, EMAIL, PROFISSIONAL, DATA DE INCLUSÃO.
- CPF e metadados de exame deixam de constar no **contrato visual** da planilha (permanecem no domínio; deduplicação continua por CPF).
- Leitura compatível com layout legado; próxima sync reescreve no layout novo.
- Faixa de escrita derivada do layout oficial (+ coluna técnica de CPF fora do cabeçalho operacional, só para preservar B005).

### 🧠 Decisões

- Mudança apenas na projeção Sheets (`agenda-sheet-headers` / mapper / repositório).
- Domínio, parser e sincronização inalterados: **CPF continua sendo a chave de negócio (B004/B005)** para identidade e deduplicação.
- O contrato visual da clínica (`CABECALHOS_ABA_AGENDA`) não inclui CPF; a identidade não passou a ser PACIENTE+TELEFONE.

### 📂 Arquivos impactados

- `src/repositories/agenda-sheet-headers.ts`
- `src/repositories/agenda-sheet-mapper.ts` (+ test)
- `src/repositories/google-sheets-agenda-repository.ts` (+ test)
- `docs/MODELO_DOMINIO.md`, `README.md`, `CHANGELOG.md`, `docs/DECISOES.md` (nomenclatura UNIDADE)

---

## 📅 19/07/2026 • 17:25

### 🎯 Objetivo

Implementar o ramo genérico B010 (`openDialogNewSession` / `forceLogout`) no `ECNHAuthenticationProtocol`, com testes e validação real.

### ✅ O que mudou

- Módulo `sessao-existente-portal` (detecção + extração de `autenticadoCyberark`).
- Ramo no protocolo: B010 → B011 → B012; `POST autenticar` com `forceLogout=true` no mesmo CookieJar.
- Fixture + testes unitários (funções puras e protocolo com transport fake).
- Validação real: `ECNH_LOGIN_USER_INDEX=3 npm run test:login` → perfil `psicologo`.
- Documentação: BACKLOG, ROADMAP, ADR-017, fase 003E `Concluída`, homologação.

### 🧠 Decisões

- Gatilho exclusivo: marcador HTML `openDialogNewSession` (sem regras por usuário/clínica).
- Sem GreyBox/`GET openDialogNewSession`; sem Playwright; B011/B012/`PerfilProfissionalPortal` intactos.
- `forceLogout=false` passa a figurar explicitamente em todo `buildAutenticarBody` (campo do formulário do portal).

### 📂 Arquivos impactados

- `src/client/sessao-existente-portal.ts` (+ test)
- `src/client/ecnh-auth-protocol.ts` (+ test)
- `fixtures/portal/pos-autenticar-open-dialog-new-session.html`
- `docs/evidencias/003e-consolidacao-force-logout-2026-07-19.json`
- `.fases/003e-sessao-existente-force-logout.md`
- `docs/DECISOES.md`, `docs/BACKLOG.md`, `docs/ROADMAP.md`, `docs/COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md`
- `docs/API.md`, `docs/FLUXO_HTTP.md`, `docs/ARQUITETURA.md`, `docs/VISAO_DO_PRODUTO.md`
- `README.md`, `CHANGELOG.md`

---

## 📅 19/07/2026 • 17:20

### 🎯 Objetivo

Investigar o fluxo de sessão já aberta (`openDialogNewSession` / `forceLogout`) e congelar o contrato HTTP antes de qualquer implementação (disciplina B011).

### ✅ O que mudou

- Reprodução HTTP do primeiro `autenticar` com sessão prévia → marcador `openDialogNewSession`.
- Análise de `login.js`: clique de encerrar → `forceLogout()` → `POST autenticar` com `forceLogout=true`.
- Atalho HTTP (sem GreyBox) validado: área autenticada + marcador B012; sem redirect; sem GET intermediário obrigatório.
- Contrato congelado, relatório técnico, Fase 003E `Planejada`, ADR-017 (contrato aceito; código não alterado).
- Evidência sanitizada (sem CPF/senha/cookies).

### 🧠 Decisões

- Automação futura = detectar `openDialogNewSession` e reenviar `autenticar` com `forceLogout=true` no mesmo CookieJar.
- Não implementar nesta etapa; não usar Playwright; não criar regras por profissional.
- Ordem futura no protocolo: B010 → B011 → B012.

### 📂 Arquivos impactados

- `docs/evidencias/003e-descoberta-force-logout-2026-07-19T20-15-26-238Z.json`
- `docs/evidencias/003e-contrato-congelado-force-logout-2026-07-19.json`
- `docs/evidencias/003e-relatorio-investigacao-force-logout.md`
- `.fases/003e-sessao-existente-force-logout.md`
- `docs/DECISOES.md` (ADR-017)
- `docs/BACKLOG.md`, `docs/ROADMAP.md`, `docs/COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md`
- `docs/API.md`, `docs/FLUXO_HTTP.md`, `docs/ARQUITETURA.md`, `docs/VISAO_DO_PRODUTO.md`
- `README.md`, `CHANGELOG.md`

---

## 📅 19/07/2026 • 15:59

### 🎯 Objetivo

Diagnosticar e corrigir a coluna Unidade vazia após sync bem-sucedido (B013).

### ✅ O que mudou

- Trace: config → sync → mapper → repositório estavam corretos na inserção de **novos** CPF.
- Bug: na regravação de pacientes **já ativos**, usava-se só `registro.unidadeOperacional` (vazio no legado), descartando o valor do contexto do sync.
- Correção: se a unidade armazenada estiver vazia e o profissional da linha for o do sync atual, preencher com `contexto.unidadeOperacional`.
- Teste de regressão com planilha legada sem coluna Unidade.

### 🧠 Decisões

- Correção mínima, só no ponto de perda; sem mudança de contratos.

### 📂 Arquivos impactados

- `src/repositories/google-sheets-agenda-repository.ts`
- `src/repositories/google-sheets-agenda-repository.test.ts`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 15:55

### 🎯 Objetivo

Tornar o resolver de unidade operacional tolerante a variações naturais de escrita de `CLINIC`, sem exigir alteração do `.env`.

### ✅ O que mudou

- `normalizarChaveClinica`: remove acentos, lowercase, troca `/` e `-` por espaço, colapsa espaços e faz trim antes do lookup.
- Testes cobrindo variações de Limão, Capão e Carrão.
- Mensagem de erro deixa explícito que a clínica não possui unidade operacional cadastrada.

### 🧠 Decisões

- Continua um único mapa centralizado; sem ifs por clínica.
- Valores existentes no `.env` permanecem válidos sem mudança.

### 📂 Arquivos impactados

- `src/utils/unidade-operacional.ts`
- `src/utils/unidade-operacional.test.ts`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 15:51

### 🎯 Objetivo

Exibir na planilha a unidade operacional do profissional sincronizado (`CLINIC` → nome operacional), sem acoplar ao HTML da agenda.

### ✅ O que mudou

- Resolver centralizado `resolveNomeUnidadeOperacional` (`src/utils/unidade-operacional.ts`).
- `CLINIC` obrigatório no sync; propaga `unidadeOperacional` até `ContextoPersistenciaAgenda`.
- Nova coluna **Unidade** na aba Agenda (após Profissional).
- Documentação: BACKLOG B013, MODELO_DOMINIO, ADR-016, README, `.env.example`.

### 🧠 Decisões

- Mapeamento único e extensível; sem ifs espalhados.
- Distinto de B011 (`unidadeDesejada` do portal).
- Clínica desconhecida ou vazia falha na fronteira de config.

### 📂 Arquivos impactados

- `src/utils/unidade-operacional.ts` / `.test.ts`
- `src/config/sync-professionals.ts` / `.test.ts`
- `src/services/agenda-sync-service.ts` / `.test.ts`
- `src/repositories/agenda-sheet-headers.ts`, `agenda-sheet-mapper.ts`, `agenda-repository.ts`, `google-sheets-agenda-repository.ts` (+ testes)
- `docs/BACKLOG.md`, `MODELO_DOMINIO.md`, `DECISOES.md`, `README.md`, `.env.example`, `CHANGELOG.md`

---

## 📅 19/07/2026 • 15:44

### 🎯 Objetivo

Executar o Passo D da Sprint 1.0 (S1-03): fixtures HTML sanitizadas + testes unitários das funções puras do protocolo HTTP (D1 + D2).

### ✅ O que mudou

- Criado `fixtures/portal/` com HTML sintético: login, openDialogChoice, openChoice, autenticado psicólogo/médico + README.
- `escolha-unidade-portal.test.ts` e `perfil-profissional-portal.test.ts` passam a carregar essas fixtures (detecção, parse, resolução cruzada entre estados).
- Agenda com tabela continua em `fixtures/agenda/` (já coberta).

### 🧠 Decisões

- **D1 + D2 entregues** nesta sprint (mínimo obrigatório do plano).
- **D3 adiada** (testes de `ECNHAuthenticationProtocol` com `AuthTransport` fake) para sprint futura — exigiria scaffolding de transporte e cresceria além do escopo incremental aprovado.
- Nenhum código de produção alterado; sem mudança de comportamento.

### 📂 Arquivos impactados

- `fixtures/portal/README.md`
- `fixtures/portal/login-form.html`
- `fixtures/portal/pos-autenticar-open-dialog-choice.html`
- `fixtures/portal/open-choice-unidades.html`
- `fixtures/portal/autenticado-psicologo.html`
- `fixtures/portal/autenticado-medico.html`
- `src/client/escolha-unidade-portal.test.ts`
- `src/client/perfil-profissional-portal.test.ts`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 15:42

### 🎯 Objetivo

Executar o Passo C da Sprint 1.0 (S1-04): unificar a duplicação de `resolvePerfilEsperadoEnv` sem alterar comportamento.

### ✅ O que mudou

- Extraída `resolvePerfilEsperadoEnv` para `src/config/perfil-esperado-env.ts`.
- `login-credentials.ts` e `sync-professionals.ts` passam a importar a função compartilhada.
- Removidas as duas cópias privadas idênticas.

### 🧠 Decisões

- Mesma lógica, mensagens de erro e precedência PROFILE > ROLE.
- Sem novas camadas, sem unificar DTOs, sem outros refactors.
- APIs públicas de resolução de login/sync inalteradas.

### 📂 Arquivos impactados

- `src/config/perfil-esperado-env.ts` (novo)
- `src/config/login-credentials.ts`
- `src/config/sync-professionals.ts`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 15:40

### 🎯 Objetivo

Executar o Passo B da Sprint 1.0 (S1-02): alinhar a documentação viva ao estado atual do sistema, sem alterar comportamento.

### ✅ O que mudou

- `docs/API.md`: tabela B010/B011 corrigida (B011 tratado); endpoints `openChoice` e segundo `autenticar`; ramo B011 descrito na autenticação.
- `docs/FLUXO_HTTP.md`: diagrama com ramo opcional B011; desvios B010 vs B011 corretos; seção ECONNRESET substituída por ponte para validação 003A + archive.
- `docs/ARQUITETURA.md`: pós-MVP menciona 003C/B012 e 003D/B011.
- `docs/DECISOES.md`: ADR-015 status atualizado para aceito e implementado (`Concluída`).

### 🧠 Decisões

- Somente alinhamento documental; nenhum código de produção alterado.
- Afirmações “B011 não tratado / sem automação” removidas dos docs vivos.

### 📂 Arquivos impactados

- `docs/API.md`
- `docs/FLUXO_HTTP.md`
- `docs/ARQUITETURA.md`
- `docs/DECISOES.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 15:32

### 🎯 Objetivo

Executar o Passo A da Sprint 1.0 (S1-01): arquivar documentação investigativa da autenticação HTTP, sem alterar comportamento do sistema.

### ✅ O que mudou

- Criada a pasta `docs/archive/autenticacao-003a/` com README explicando o caráter histórico.
- Movidos para o archive: diagnóstico, matriz de divergências, auditorias (POST autenticar e HTTP/TLS), robustez e checkpoint de evidência.
- `docs/EVIDENCIA_HAR_AUTENTICACAO.md` permanece documentação viva (contrato HAR).
- README: leitura recomendada separa SoT operacional do histórico da engenharia reversa 003A.
- Links atualizados em `docs/API.md`, `docs/FLUXO_HTTP.md` e `.fases/003-login-http.md`.

### 🧠 Decisões

- Preferência de pasta: `docs/archive/` (não `docs/arquivo/`).
- HAR permanece vivo; demais docs investigativos de auth vão ao archive.
- Sessões antigas do CHANGELOG não foram reescritas (histórico preservado).

### 📂 Arquivos impactados

- `docs/archive/autenticacao-003a/README.md`
- `docs/archive/autenticacao-003a/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `docs/archive/autenticacao-003a/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/archive/autenticacao-003a/AUDITORIA_POST_AUTENTICAR.md`
- `docs/archive/autenticacao-003a/AUDITORIA_HTTP_TLS_AUTENTICACAO.md`
- `docs/archive/autenticacao-003a/ROBUSTEZ_AUTENTICACAO_HTTP.md`
- `docs/archive/autenticacao-003a/CHECKPOINT_EVIDENCIA_AUTENTICACAO.md`
- `README.md`
- `docs/API.md`
- `docs/FLUXO_HTTP.md`
- `.fases/003-login-http.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 15:02

### 🎯 Objetivo

Validar B011 / Fase 003D em ambiente real (Passo 5) e promover a concluídos.

### ✅ O que mudou

- Validação `ECNH_USER_17`: openDialogChoice → openChoice → CIR-SAO PAULO (`18`) → medico → agenda/parser (49 itens) → sync Sheets (25 linhas futuras).
- Evidência sanitizada registrada.
- B011 e Fase 003D promovidos a `✅ Concluído` / `Concluída`.

### 🧠 Decisões

- **Evidência confirmada:** fluxo genérico B011 funciona ponta a ponta com profissional multi-unidade.
- Config operacional `UNIDADE` pertence ao `.env` do profissional (não ao código).
- B010 permanece pendente.

### 📂 Arquivos impactados

- `docs/evidencias/003d-consolidacao-escolha-unidade-2026-07-19.json`
- `docs/evidencias/README.md`
- `.fases/003d-escolha-unidade-visao.md`
- `docs/BACKLOG.md`
- `docs/ROADMAP.md`
- `docs/DECISOES.md`
- `docs/COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md`
- `docs/VISAO_DO_PRODUTO.md`
- `docs/ARQUITETURA.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 14:56

### 🎯 Objetivo

Implementar B011 de forma genérica (contratos, protocolo HTTP e config), preservando B012.

### ✅ O que mudou

- Módulo `escolha-unidade-portal` (detectar, parse, match) com testes.
- `ECNHAuthenticationProtocol`: ramo pós-`autenticar` → `openChoice` → segundo `autenticar` com `idUnidTransito`.
- Config `ECNH_USER_<n>_UNIDADE` / `UNID_TRANSITO` em login e sync; wire no `ECNHClient`.
- Fase 003D promovida a `Implementada`.

### 🧠 Decisões

- B012 isolado; unidade não entra em `PerfilProfissionalPortal`.
- Sem hardcode de profissional ou de id de unidade.
- Validação real fica para o Passo 5.

### 📂 Arquivos impactados

- `src/client/escolha-unidade-portal.ts`
- `src/client/escolha-unidade-portal.test.ts`
- `src/client/ecnh-auth-protocol.ts`
- `src/client/ecnh-client.ts`
- `src/config/login-credentials.ts`
- `src/config/sync-professionals.ts`
- `src/config/sync-professionals.test.ts`
- `src/services/agenda-sync-service.ts`
- `src/composition/agenda-sync-runtime.ts`
- `src/scripts/test-login.ts` / `test-agenda.ts` / `validate-*.ts` / `discover-agenda-html.ts`
- `.fases/003d-escolha-unidade-visao.md`
- `docs/BACKLOG.md` / `docs/ROADMAP.md` / `README.md` / `.env.example`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 14:52

### 🎯 Objetivo

Congelar o contrato HTTP do fluxo “Escolha de Perfil e/ou Visão” (Passo 1), sem código de produção.

### ✅ O que mudou

- Descoberta: `enviar()` em `choice.js` não POSTA `openChoice`; reenvia `method=autenticar` no form pai com `idUnidTransito`.
- Após o segundo `autenticar`, HTML autenticado com marcador Médico (B012 aplicável).
- Evidência sanitizada registrada.

### 🧠 Decisões

- **Contrato congelado** para implementação dos Passos 2–3.
- Seleção de unidade na implementação continua via config genérica (`UNIDADE` / `UNID_TRANSITO`), não hardcode.

### 📂 Arquivos impactados

- `docs/evidencias/003d-descoberta-enviar-escolha-unidade-2026-07-19.json`
- `docs/evidencias/README.md`
- `.fases/003d-escolha-unidade-visao.md`
- `docs/DECISOES.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 14:47

### 🎯 Objetivo

Iniciar B011 / Fase 003D com documentação e ADR (Passo 0), sem código de produção.

### ✅ O que mudou

- Criada Fase 003D (`Planejada`) para suporte genérico à escolha de unidade/visão.
- Registrado ADR-015.
- B011 promovido a 🚧 Em andamento no backlog; foco atual do projeto.
- ROADMAP atualizado com 003D / B011.

### 🧠 Decisões

- Implementação genérica: nenhuma regra por profissional/nome/índice/`idUnidTransito` hardcoded.
- Config por profissional: `UNIDADE` + `UNID_TRANSITO` opcional; B012 permanece isolado.
- Contrato do POST ENVIAR fica para o Passo 1 (descoberta com evidência).

### 📂 Arquivos impactados

- `.fases/003d-escolha-unidade-visao.md`
- `docs/DECISOES.md`
- `docs/BACKLOG.md`
- `docs/ROADMAP.md`
- `README.md`
- `.env.example`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 14:34

### 🎯 Objetivo

Promover B012 / Fase 003C a concluídos após validação real com profissional Médico (Italo).

### ✅ O que mudou

- Validação isolada e sync completo confirmados para `ECNH_USER_16` (Italo): login `medico`, consulta `consultarAgendaMedico`, sync OK.
- Evidência sanitizada em `docs/evidencias/003c-consolidacao-perfil-medico-2026-07-19.json`.
- B012 e Fase 003C promovidos a `✅ Concluído` / `Concluída`.
- BACKLOG, ROADMAP, README e docs correlatos atualizados.

### 🧠 Decisões

- **Evidência confirmada:** arquitetura de perfis validada com Médico real (login, perfil, agenda, sync).
- B010/B011 seguem pendentes para reavaliação (não bloqueiam B012).

### 📂 Arquivos impactados

- `docs/evidencias/003c-consolidacao-perfil-medico-2026-07-19.json`
- `.fases/003c-perfis-profissionais-portal.md`
- `docs/BACKLOG.md`
- `docs/ROADMAP.md`
- `docs/ARQUITETURA.md`
- `docs/VISAO_DO_PRODUTO.md`
- `docs/evidencias/README.md`
- `docs/DECISOES.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 14:30

### 🎯 Objetivo

Limpar e reorganizar o backlog e a documentação, com B012 como foco arquitetural do projeto.

### ✅ O que mudou

- Removidos do escopo/catálogo ativo: B006–B009 (Painel / Observabilidade).
- B012 reposicionado como foco atual: “Arquitetura de perfis profissionais do portal”.
- B010 e B011 mantidos, com reavaliação explícita após validação de B012.
- Fases 008/009 marcadas como `Descontinuada`.
- README, ROADMAP, ARQUITETURA, VISÃO e documentos de homologação alinhados.

### 🧠 Decisões

- Painel operacional e observabilidade avançada saem do produto.
- B001–B005 = melhorias incrementais concluídas; etapa atual = evolução arquitetural multi-perfil.
- Nenhuma implementação de código nesta sessão.

### 📂 Arquivos impactados

- `docs/BACKLOG.md`
- `docs/ROADMAP.md`
- `docs/ARQUITETURA.md`
- `docs/VISAO_DO_PRODUTO.md`
- `docs/COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md`
- `docs/API.md`
- `docs/FLUXO_HTTP.md`
- `docs/DECISOES.md`
- `.fases/003c-perfis-profissionais-portal.md`
- `.fases/008-painel-operacional.md`
- `.fases/009-observabilidade-metricas.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 14:20

### 🎯 Objetivo

Implementar a proposta aprovada de perfis profissionais extensíveis no portal (Psicólogo/Médico), sem if/else espalhados.

### ✅ O que mudou

- Criados `PerfilProfissionalPortal`, registro e resolução por marcador HTML.
- Auth e agenda passam a usar o perfil resolvido (`consultarAgendaPsicologo` / `consultarAgendaMedico`).
- `PROFILE`/`ROLE` opcional na config; fábrica do sync repassa `perfilEsperado`.
- `perfilId` propagado em `ResultadoSincronizacaoProfissional`.
- Documentados ADR-014, Fase 003C, B012 e `.env.example`.

### 🧠 Decisões

- Strategy + registro (ADR-014); resolução híbrida HTML + PROFILE opcional.
- Fase 003C / B012; status `Implementada` até evidência sanitizada de Médico.
- Parser/Sheets inalterados na estrutura.

### 📂 Arquivos impactados

- `src/client/perfil-profissional-portal.ts`
- `src/client/ecnh-auth-protocol.ts`
- `src/client/ecnh-agenda-protocol.ts`
- `src/client/ecnh-client.ts`
- `src/config/sync-professionals.ts`
- `src/config/login-credentials.ts`
- `src/services/agenda-sync-service.ts`
- `src/composition/agenda-sync-runtime.ts`
- `.fases/003c-perfis-profissionais-portal.md`
- `docs/DECISOES.md`, `docs/BACKLOG.md`, `docs/ROADMAP.md`, `docs/API.md`
- `CHANGELOG.md`, `.env.example`

---

## 📅 19/07/2026 • 13:26

### 🎯 Objetivo

Retestar login/sync do Italo após encerramento manual de sessão e formalizar as limitações conhecidas do portal (B010/B011) sem implementar automação.

### ✅ O que mudou

- Reteste só `ECNH_USER_16` (Italo): login `erro_desconhecido`; agenda não encontrada; 0 pacientes sincronizados.
- Backlog alinhado ao texto homologado: `B010` (sessão já autenticada) e `B011` (seleção de Perfil/Visão), prioridade Alta.
- Limitações registradas em `COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md`, `ARQUITETURA.md`, `API.md`, `FLUXO_HTTP.md` e `README.md`.

### 🧠 Decisões

- **Decisão:** nenhuma automação de B010/B011 nesta tarefa.
- **Evidência confirmada:** mesmo após encerramento manual da sessão anterior, o login HTTP do Italo não apresentou os sinais autenticados confirmados.

### 📂 Arquivos impactados

- `docs/BACKLOG.md`
- `docs/COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md`
- `docs/ARQUITETURA.md`
- `docs/API.md`
- `docs/FLUXO_HTTP.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 13:24

### 🎯 Objetivo

Validar novamente o login do Italo após encerramento manual de sessão e documentar dois comportamentos do portal observados na homologação (sem implementar automação).

### ✅ O que mudou

- Reteste de sincronização apenas para `ECNH_USER_16` (Italo): login `erro_desconhecido`; agenda não obtida; nenhum paciente gravado.
- Documentados: (1) popup de sessão já existente; (2) tela "Escolha de Perfil e/ou Visão" (ex.: Caio → CIR-SAO PAULO → ENVIAR).
- Backlog: `B010` (sessão existente) e `B011` (escolha de unidade), ambos ⏳ Pendente.
- Referências em `API.md`, `FLUXO_HTTP.md` e `README.md`.

### 🧠 Decisões

- **Decisão:** não automatizar B010/B011 nesta sessão; apenas registrar evidência de homologação e itens de backlog.
- **Evidência confirmada:** após encerramento manual da sessão antiga, o login HTTP do Italo ainda não apresentou os sinais autenticados confirmados (`erro_desconhecido`).

### 📂 Arquivos impactados

- `docs/COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md`
- `docs/BACKLOG.md`
- `docs/API.md`
- `docs/FLUXO_HTTP.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 13:12

### 🎯 Objetivo

Tornar a descoberta de `ECNH_USER_*` totalmente dinâmica e reorganizar `.env` / `.env.example` (habilitados primeiro).

### ✅ O que mudou

- Removido o teto fixo `MAX_USER_INDEX = 50`; índices passam a ser descobertos pelas chaves do ambiente (`listarIndicesUsuariosEnv`).
- `.env` e `.env.example` reorganizados: `ENABLED=true` agrupados no início; depois `ENABLED=false`; sem seção de “adicionais”.
- Teste cobrindo índices altos (ex.: 99 e 120).

### 🧠 Decisões

- **Decisão:** descoberta por regex nas chaves `ECNH_USER_<n>_…`, sem limite numérico — novos profissionais homologados só exigem entradas no `.env`.
- **Evidência confirmada:** `npm run sync:agenda` listou `ECNH_USER_16` (Italo) e `ECNH_USER_17` (Caio); login de ambos retornou `erro_desconhecido` (portal manteve formulário de login), então não houve gravação na planilha nesta execução.

### 📂 Arquivos impactados

- `src/config/ecnh-user-env.ts`
- `src/config/sync-professionals.ts`
- `src/config/login-credentials.ts`
- `src/config/sync-professionals.test.ts`
- `.env` (local)
- `.env.example`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 13:01

### 🎯 Objetivo

Incluir os profissionais homologados Italo e Caio no conjunto habilitado de sincronização.

### ✅ O que mudou

- `.env`: `ECNH_USER_16` (Italo) e `ECNH_USER_17` (Caio) com `ENABLED=true`.
- `.env.example`: entradas de exemplo para Italo e Caio habilitados (sem credenciais).
- Nenhuma alteração de código, regra de negócio, BACKLOG ou ROADMAP.

### 🧠 Decisões

- **Decisão:** apenas configuração operacional; índices locais 16/17 preservados no `.env`.

### 📂 Arquivos impactados

- `.env` (local; não versionar credenciais)
- `.env.example`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 12:49

### 🎯 Objetivo

Implementar B005: cadastro de pacientes ativos na aba Agenda, substituindo o cadastro permanente da B004.

### ✅ O que mudou

- Coluna `Data` renomeada para `Data de Agendamento`.
- Persistência mantém apenas agendamentos ≥ hoje (`America/Sao_Paulo`); remove automaticamente datas passadas.
- CPF continua chave única enquanto o paciente está ativo; reinclusão após remoção gera nova Data de inclusão.
- Documentação atualizada (BACKLOG, README, visão, domínio, arquitetura) sem textos de cadastro permanente.
- Domínio (`Agenda`, `Paciente`, `AgendaRepository`) inalterado.
- B005 marcada como ✅ Concluído; B004 documentada como supersedida neste aspecto.

### 🧠 Decisões

- **Decisão:** B005 substitui oficialmente a decisão de cadastro permanente da B004.
- **Decisão:** comparação de datas por calendário real, nunca textual.

### 📂 Arquivos impactados

- `src/utils/agenda-date.ts`
- `src/utils/agenda-date.test.ts`
- `src/repositories/agenda-sheet-headers.ts`
- `src/repositories/agenda-sheet-mapper.ts`
- `src/repositories/agenda-sheet-mapper.test.ts`
- `src/repositories/google-sheets-agenda-repository.ts`
- `src/repositories/google-sheets-agenda-repository.test.ts`
- `src/scripts/validate-sheets.ts`
- `docs/BACKLOG.md`
- `docs/VISAO_DO_PRODUTO.md`
- `docs/MODELO_DOMINIO.md`
- `docs/ARQUITETURA.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 12:39

### 🎯 Objetivo

Implementar B004: cadastro acumulado de pacientes na aba Agenda, com CPF como chave única.

### ✅ O que mudou

- Coluna operacional renomeada de "Última sincronização" para "Data de inclusão" (primeira aparição).
- `GoogleSheetsAgendaRepository` deixa de substituir por data/profissional; passa a inserir apenas CPFs novos.
- CPF existente: linha e Data de inclusão preservadas; sem duplicata.
- `normalizeCpfKey` para índice por dígitos; leitura compatível com cabeçalho legado.
- Domínio (`Agenda`, `Paciente`, `AgendaRepository`) inalterado.
- B004 marcado como ✅ Concluído; itens estratégicos do painel renumerados (B005–B008).

### 🧠 Decisões

- **Decisão:** chave exclusiva = CPF normalizado (11 dígitos); nome não participa da deduplicação.
- **Decisão:** agenda vazia não remove pacientes já cadastrados.

### 📂 Arquivos impactados

- `src/utils/cpf.ts`
- `src/utils/cpf.test.ts`
- `src/utils/sync-timestamp.ts`
- `src/repositories/agenda-sheet-headers.ts`
- `src/repositories/agenda-sheet-mapper.ts`
- `src/repositories/agenda-sheet-mapper.test.ts`
- `src/repositories/google-sheets-agenda-repository.ts`
- `src/repositories/google-sheets-agenda-repository.test.ts`
- `src/scripts/validate-sheets.ts`
- `docs/MODELO_DOMINIO.md`
- `docs/BACKLOG.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 12:25

### 🎯 Objetivo

Implementar B003: coluna operacional "Última sincronização" na aba Agenda.

### ✅ O que mudou

- Utilitário `formatSyncTimestamp` (`America/Sao_Paulo`, `DD/MM/YYYY HH:mm`).
- Cabeçalho canônico da aba Agenda com coluna final "Última sincronização".
- `AgendaSheetMapper` e `GoogleSheetsAgendaRepository` gravam o mesmo timestamp em todas as linhas de uma persistência.
- Timestamp não entra no domínio Agenda/Paciente; linhas preservadas mantêm o valor anterior.
- Compatibilidade de leitura com cabeçalho legado (sem a nova coluna).
- B003 marcado como ✅ Concluído.

### 🧠 Decisões

- **Decisão:** timestamp gerado uma vez por `salvarAgenda` e reutilizado nas linhas novas daquela escrita.
- **Decisão:** coluna apenas na persistência Sheets; contratos públicos de domínio inalterados.

### 📂 Arquivos impactados

- `src/utils/sync-timestamp.ts`
- `src/utils/sync-timestamp.test.ts`
- `src/repositories/agenda-sheet-headers.ts`
- `src/repositories/agenda-sheet-mapper.ts`
- `src/repositories/agenda-sheet-mapper.test.ts`
- `src/repositories/google-sheets-agenda-repository.ts`
- `src/repositories/google-sheets-agenda-repository.test.ts`
- `docs/BACKLOG.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 12:20

### 🎯 Objetivo

Corrigir erros de diagnóstico na pasta `src/utils` (testes fora do projeto TypeScript) e formatação.

### ✅ O que mudou

- Testes passam a integrar o `tsconfig.json` (typecheck/IDE); build usa `tsconfig.build.json` sem emitir `*.test.ts`.
- `agenda-parser.test.ts` deixa de usar `import.meta` (incompatível com o módulo CJS do projeto).
- Prettier em `phone.test.ts`; detecção de dígito repetido em `phone.ts` sem backreference.

### 🧠 Decisões

- **Decisão:** typecheck inclui testes; emit de produção continua sem testes.

### 📂 Arquivos impactados

- `tsconfig.json`
- `tsconfig.build.json`
- `package.json`
- `src/parsers/agenda-parser.test.ts`
- `src/utils/phone.ts`
- `src/utils/phone.test.ts`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 11:59

### 🎯 Objetivo

Implementar B002: normalizar telefones antes da persistência no Google Sheets.

### ✅ O que mudou

- Criada função pura `normalizePhone` em `src/utils/phone.ts` (lixo, DDD 11, hífens, espaços, listas com `/`).
- `AgendaSheetMapper` aplica a normalização apenas na coluna Telefone ao gerar linhas.
- Testes unitários da utilidade e cobertura no mapper.
- B002 marcado como ✅ Concluído no BACKLOG.
- Domínio (`Paciente.telefone`), parser e contratos públicos inalterados.

### 🧠 Decisões

- **Decisão:** normalização só na preparação para persistência (mapper), no mesmo padrão de B001.

### 📂 Arquivos impactados

- `src/utils/phone.ts`
- `src/utils/phone.test.ts`
- `src/repositories/agenda-sheet-mapper.ts`
- `src/repositories/agenda-sheet-mapper.test.ts`
- `docs/BACKLOG.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 11:42

### 🎯 Objetivo

Implementar B001: normalizar e-mails (trim + lowercase) antes da persistência no Google Sheets.

### ✅ O que mudou

- Criada função pura `normalizeEmail` em `src/utils/email.ts`.
- `AgendaSheetMapper` aplica a normalização apenas na coluna E-mail ao gerar linhas.
- Testes unitários para a utilidade e cobertura no mapper.
- B001 marcado como ✅ Concluído no BACKLOG.
- Parser, sincronização e demais campos inalterados.

### 🧠 Decisões

- **Decisão:** normalização só na preparação para persistência (mapper); domínio/parser preservam o valor bruto do portal.

### 📂 Arquivos impactados

- `src/utils/email.ts`
- `src/utils/email.test.ts`
- `src/repositories/agenda-sheet-mapper.ts`
- `src/repositories/agenda-sheet-mapper.test.ts`
- `docs/BACKLOG.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 11:39

### 🎯 Objetivo

Eliminar duplicidade entre ROADMAP e BACKLOG: ROADMAP apenas MVP; BACKLOG único para evoluções futuras.

### ✅ O que mudou

- Removida do ROADMAP a seção **Backlog Estratégico** e qualquer listagem das Fases 008/009.
- Após a Fase 007, ROADMAP aponta apenas para `docs/BACKLOG.md`.
- BACKLOG passa a ser o único documento de melhorias futuras (incrementais ou estratégicas); incluído B007 (observabilidade).
- README e visão do produto alinhados; fases 000–007 inalteradas.
- Nenhuma implementação, arquitetura ou ADR foi alterada.

### 🧠 Decisões

- **Decisão:** ROADMAP = histórico do MVP (000–007); BACKLOG = única fonte de evoluções pós-MVP.

### 📂 Arquivos impactados

- `docs/ROADMAP.md`
- `docs/BACKLOG.md`
- `README.md`
- `docs/VISAO_DO_PRODUTO.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 11:36

### 🎯 Objetivo

Reorganizar `docs/BACKLOG.md` como documento oficial das melhorias incrementais (IDs B00x, status e prioridade).

### ✅ O que mudou

- BACKLOG: tabela oficial com B001–B006; convenções de status (Pendente / Em andamento / Concluído / Estacionado) e prioridade (Alta / Média / Baixa).
- Diferença ROADMAP × BACKLOG documentada no início do arquivo.
- Fases 008/009 permanecem estratégicas no ROADMAP; backlog cobre apenas incrementos.
- Nenhuma implementação, arquitetura ou ADR foi alterada.

### 🧠 Decisões

- **Decisão:** IDs sequenciais `B00n` para melhorias incrementais; B004–B006 estacionados como recortes Nice to Have da visão do Painel Operacional.

### 📂 Arquivos impactados

- `docs/BACKLOG.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 11:34

### 🎯 Objetivo

Reorganizar `docs/ROADMAP.md` com seção visual **Backlog Estratégico (Nice to Have)** para as Fases 008 e 009, sem alterar implementação.

### ✅ O que mudou

- ROADMAP: MVP (000–007) explícito como concluído na Fase 007; seção separada **Backlog Estratégico** só com 008/009 (opcionais, estacionadas).
- Referência a `BACKLOG.md` para melhorias incrementais pós-MVP.
- README alinhado à nova organização do roadmap.
- Nenhuma implementação, arquitetura, ADR, teste ou evidência foi alterada.

### 🧠 Decisões

- **Decisão:** Fases 008/009 ficam no ROADMAP como Backlog Estratégico; features incrementais continuam em `docs/BACKLOG.md`.

### 📂 Arquivos impactados

- `docs/ROADMAP.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 19/07/2026 • 11:28

### 🎯 Objetivo

Reorganizar a documentação para a etapa pós-MVP: Backlog oficial de melhorias futuras, sem fases obrigatórias após a 007.

### ✅ O que mudou

- Criado `docs/BACKLOG.md` como catálogo oficial de melhorias futuras (Nice to Have).
- Fases 008 e 009 e features candidatas (FEATURE-001, FEATURE-002) registradas apenas no backlog.
- `docs/ROADMAP.md` deixa explícito que Fases 000–007 = MVP concluído; 008/009 fora do MVP.
- `docs/VISAO_DO_PRODUTO.md` e `README.md` atualizados para a evolução pós-MVP.
- Nenhuma implementação, arquitetura, teste, ADR ou evidência foi alterada.

### 🧠 Decisões

- **Decisão:** após a Fase 007, o desenvolvimento é guiado por `docs/BACKLOG.md`, não por fases obrigatórias do produto.
- **Decisão:** Fases 008 e 009 permanecem Nice to Have no backlog, sem detalhamento de implementação nesta sessão.

### 📂 Arquivos impactados

- `docs/BACKLOG.md` (novo)
- `docs/ROADMAP.md`
- `docs/VISAO_DO_PRODUTO.md`
- `README.md`
- `CHANGELOG.md`

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
