# Decisões arquiteturais

## ADR-001 — TypeScript estrito e Node.js 20+

- **Status:** aceito
- **Decisão:** usar TypeScript com `strict: true` e Node.js 20 ou superior.
- **Consequência:** contratos de integração são verificados mais cedo e contribuições devem manter tipos completos.

## ADR-002 — Integração HTTP ao invés de automação por navegador

- **Status:** aceito
- **Contexto:** o DevTools confirmou um `POST` de formulário, resposta HTML SSR e sessão baseada em cookie; nenhuma API REST foi observada.
- **Decisão:** a integração principal usará Axios, tough-cookie e http-cookie-agent para manter sessão e agentes HTTP persistentes. Cheerio será usado futuramente para interpretar HTML.
- **Motivos:** menor consumo de memória, maior velocidade, menos dependência da interface gráfica, execução simples em cron, maior facilidade para testes automatizados, arquitetura mais limpa e menos pontos de falha.
- **Consequência:** Playwright não participa do caminho produtivo normal. Continua disponível para engenharia reversa, depuração e investigação de casos que comprovadamente dependam de JavaScript de navegador.
- **Evolução em 18/07/2026:** `axios-cookiejar-support` foi substituído pelo uso direto de `HttpCookieAgent` e `HttpsCookieAgent` para permitir reutilização explícita dos agentes com keep-alive, sem alterar o protocolo.

## ADR-003 — Arquitetura por responsabilidades técnicas

- **Status:** aceito
- **Decisão:** separar clients, parsers, repositories, services e jobs.
- **Consequência:** mudanças em portal, HTML, Sheets ou cron permanecem localizadas.

## ADR-004 — Logs estruturados e validação de fronteiras

- **Status:** aceito
- **Decisão:** usar Pino para logs estruturados e Zod para validar configurações e dados de fronteira quando forem introduzidos.
- **Consequência:** CPF, senha, cookies, tokens e dados de pacientes são proibidos em logs e documentação.

## ADR-005 — Evidência antes de implementação

- **Status:** aceito
- **Decisão:** somente dados confirmados no DevTools são documentados como fatos. Campos, cookies e endpoints restantes continuam pendentes.
- **Consequência:** a Fase 003A — Autenticação HTTP implementará apenas o protocolo confirmado, sem payloads ou contratos fictícios.

## ADR-006 — ECNHClient como fronteira única do portal

- **Status:** aceito
- **Contexto:** autenticação, cookies e navegação autenticada compartilham a mesma sessão e o mesmo transporte HTTP.
- **Decisão:** centralizar em `ECNHClient` autenticação, manutenção da sessão, transporte HTTP e navegação autenticada. Serviços, parser e integração com Google Sheets não fazem chamadas HTTP diretas ao portal; consomem contratos e HTML fornecidos pelo fluxo do cliente.
- **Consequência:** cookies, endpoints e detalhes de Axios permanecem encapsulados. As Fases 003A e 003B podem evoluir independentemente, sem duplicar gerenciamento de sessão.

## ADR-007 — Resultado de login explicitamente modelado

- **Status:** aceito
- **Contexto:** falhas de autenticação possuem causas operacionais distintas e não devem ser confundidas com indisponibilidade do sistema.
- **Decisão:** a futura autenticação representará explicitamente, no mínimo, sucesso, senha inválida, usuário bloqueado, erro do sistema e erro desconhecido.
- **Consequência:** não há mapeamento de resposta implementado até que o DevTools confirme os sinais HTTP/HTML correspondentes. A modelagem evita contratos implícitos e simplifica tratamento de erros e testes futuros.

## ADR-008 — Formato do CPF no POST autenticar

- **Status:** aceito
- **Contexto:** o HAR do login bem-sucedido envia `codigo` no padrão `DDD.DDD.DDD-DD`; o Chrome reformata o campo no `onblur` antes do submit.
- **Decisão:** o `ECNHClient` normaliza o CPF para `DDD.DDD.DDD-DD` na fronteira de autenticação, aceitando entrada com ou sem máscara.
- **Consequência:** o protocolo HTTP continua enviando exatamente o formato observado no navegador, sem depender do valor cru do `.env`.

## ADR-009 — Logout HTTP via method=finalizarLogin

- **Status:** aceito
- **Contexto:** o HTML autenticado não expõe o link "Sair"; o menu dinâmico em `/gefor/global/menu_items.jsp` declara `url` com `GET /gefor/SGU/login.do?method=finalizarLogin`.
- **Decisão:** `ECNHClient.logout()` envia esse GET com o CookieJar da sessão e, em seguida, sempre descarta a sessão local.
- **Consequência:** o portal recebe o encerramento observado no menu. Falha de rede no GET não impede a limpeza local. Não confundir com o campo `forceLogout` da tela de login.

## ADR-011 — Extração de agenda por `table#agenda` e cabeçalhos textuais

- **Status:** aceito
- **Contexto:** a Fase 004 confirmou que o HTML de resultado contém `table#agenda` com nove colunas nomeadas em `th`, enquanto classes Bootstrap/`list_titulo`/`style` são só apresentação. A data consultada não permanece confiável no formulário após o POST.
- **Decisão:** o parser localiza a tabela por `table#agenda` (fallback: fieldset `Resultado` + cabeçalhos), liga células pelo texto do `th` e recebe `dataConsulta` como contexto opcional do chamador. Modelos representam domínio (`Paciente`, `ItemAgenda`, `Agenda`), não o layout HTML.
- **Consequência:** `ECNHClient` continua devolvendo HTML bruto; `parseAgendaHtml` é puro e testável. A persistência Sheets (Fase 005, `Concluída`) consome os modelos sem conhecer seletores.

## ADR-012 — Persistência de agenda via AgendaRepository e Google Sheets

- **Status:** aceito
- **Contexto:** a Fase 005 precisava gravar `Agenda` tipada em planilha sem acoplar domínio ao `googleapis`, e preparar substituição futura do destino (Postgres, SQLite, etc.).
- **Decisão:** expor `AgendaRepository` como porta; implementar `GoogleSheetsAgendaRepository` com Service Account; converter domínio ↔ linhas em `AgendaSheetMapper` puro; autenticar via JSON da Service Account; layout da aba `Agenda` inclui coluna `Profissional`; substituir linhas pelo par `Data` + `Profissional` (sem append cego nem upsert).
- **Consequência:** serviços futuros dependem só da interface; testes unitários cobrem mapper e repositório sem rede; a orquestração multi-profissional (Fase 006) não exige mudança estrutural na planilha. Validação real em 19/07/2026 confirmou a decisão; a Fase 005 está `Concluída`.

## ADR-013 — Agendamento automático via daemon, SyncLock e job fino

- **Status:** aceito
- **Contexto:** a Fase 007 precisa disparar o `AgendaSyncService` em horários configuráveis sem mover a orquestração para a camada de jobs, e impedir sobreposição entre execuções manuais e automáticas.
- **Decisão:**
  - processo longo (daemon Node) com scheduler interno (`node-cron`);
  - porta `SyncLock` com implementação inicial em arquivo (`FileSyncLock` / `proper-lockfile`);
  - lock global compartilhado entre `npm run job:agenda` e `npm run sync:agenda`;
  - `AgendaSyncJob` apenas adquire lock, chama `sincronizarProfissionais` e libera; se o lock estiver ocupado, pula e registra `warn` (sem fila);
  - wiring compartilhado em `src/composition` para evitar duplicação entre pontos de entrada.
- **Consequência:** `AgendaSyncService`, client, parser e repositório permanecem sem conhecer cron ou arquivo de lock. Limitação: o lock de arquivo assume um único host ou volume compartilhado; cluster multi-host sem FS comum fica fora do MVP. Iniciativas antigas de Painel Operacional / Observabilidade (ex-Fases 008/009) foram **descontinuadas** e removidas do backlog ativo.

## ADR-014 — Perfis profissionais do portal via Strategy

- **Status:** aceito
- **Contexto:** o MVP autenticava apenas pelo marcador/método do Psicólogo; Médicos autenticados eram classificados como `erro_desconhecido`.
- **Decisão:**
  - introduzir `PerfilProfissionalPortal` (marcador + `method` de consulta) com registro extensível;
  - resolver o perfil no HTML pós-login; `ECNH_USER_<n>_PROFILE` (ou `ROLE`) opcional valida/override;
  - um único `ECNHClient` / `AgendaProtocol` parametrizado — sem subclasses nem `if/else` espalhados;
  - propagar `perfilId` em `ResultadoSincronizacaoProfissional` (sem PII).
- **Consequência:** Psicólogo permanece compatível sem config; Médico autentica e consulta com `consultarAgendaMedico`. Novos perfis exigem evidência + entrada no registro.
- **Validação (19/07/2026):** evidência confirmada com profissional Médico real (Italo / `ECNH_USER_16`) — login, resolução de perfil `medico`, consulta `consultarAgendaMedico` e sincronização completa. Artefato: `docs/evidencias/003c-consolidacao-perfil-medico-2026-07-19.json`. B012 / Fase 003C `Concluída`.
