# Roadmap

Documento histórico da **construção do MVP** (Fases 000–007). Cada fase resolveu um único problema sem antecipar funcionalidades posteriores. A sequência reflete a separação arquitetural: portal → extração → destino → orquestração → agendamento.

## MVP do projeto (Fases 000–007)

As Fases **000 a 007** constituem o **MVP do projeto**.

**Status do MVP:** concluído na **Fase 007**.

| Fase                                        | Status         | Entrega                                                                                                     |
| ------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| Fase 000 — Foundation                       | `Concluída`    | Estrutura, configuração, convenções e documentação.                                                         |
| Fase 001 — Engenharia reversa               | `Concluída`    | Evidências do DevTools e mapa do protocolo.                                                                 |
| Fase 002 — Consolidação arquitetural        | `Concluída`    | Documentação, decisões e arquitetura HTTP baseadas em evidências reais.                                     |
| Fase 003A — Autenticação HTTP               | `Concluída`    | Autenticação HTTP, sessão, CookieJar, verificação, logout HTTP e testes; sem agenda.    |
| Fase 003B — Navegação autenticada           | `Concluída`    | Página de agenda, endpoints, parâmetros e HTML bruto; sem extração estruturada.                             |
| Fase 004 — Extração de dados da agenda      | `Concluída`     | Parser HTML, modelos tipados e testes unitários; sem integração com planilha.                               |
| Fase 005 — Integração Google Sheets         | `Concluída`    | Persistência via `AgendaRepository` / Google Sheets; validação real (Service Account, aba `Agenda`, substituição idempotente) concluída. |
| Fase 006 — Orquestração multi-profissionais | `Concluída`    | `AgendaSyncService` + `sync:agenda`; multi-profissional sob demanda validado com evidência sanitizada.       |
| Fase 007 — Agendamento automático (cron)    | `Concluída`    | Daemon + `SyncLock` + `AgendaSyncJob` sobre `AgendaSyncService`; validado com evidência sanitizada. |

> **Situação da Fase 006:** oficialmente `Concluída` em 19/07/2026. Orquestração multi-profissional validada via `npm run sync:agenda` (6/7 profissionais ok; falha parcial tipada) com evidência sanitizada.

> **Situação da Fase 007:** oficialmente `Concluída` em 19/07/2026. Daemon (`job:agenda`), `SyncLock` global e `AgendaSyncJob` validados com evidência sanitizada.

O MVP do projeto foi concluído na Fase 007. As melhorias incrementais B001–B005 foram registradas e concluídas no [BACKLOG](BACKLOG.md).

### Evolução arquitetural pós-MVP

| Item | Status | Entrega |
| ---- | ------ | ------- |
| Fase 003C / **B012** — Arquitetura de perfis profissionais do portal | `Concluída` | Strategy extensível (`PerfilProfissionalPortal`); validada com Médico real (Italo): login, perfil, consulta e sync completo |

O objetivo desta evolução **não** é apenas “suportar Médico além de Psicólogo”, e sim permitir **novos perfis do portal** com mínimo impacto nas camadas superiores.

B010 e B011 permanecem no backlog para **reavaliação** (comportamentos de sessão/unidade distintos do perfil profissional).

Detalhes: [.fases/003c-perfis-profissionais-portal.md](../.fases/003c-perfis-profissionais-portal.md) · [BACKLOG.md](BACKLOG.md) · evidência [003c-consolidacao-perfil-medico-2026-07-19.json](evidencias/003c-consolidacao-perfil-medico-2026-07-19.json).

## Convenção de status (MVP)

Cada fase da 003A à 007 possui exatamente um estado e progride sem saltos:

`Planejada` → `Implementada` → `Validada` → `Concluída`

- **Planejada:** objetivo, escopo e critérios documentados; implementação ainda não finalizada.
- **Implementada:** escopo desenvolvido; validação da fase ainda pendente.
- **Validada:** critérios executados no ambiente adequado, com evidências registradas.
- **Concluída:** fase validada, sem pendências bloqueantes no escopo e com documentação obrigatória atualizada.

Um status de fase do MVP só muda quando a evidência correspondente estiver registrada no documento da fase e no diário do projeto.

## Alinhamento arquitetural (MVP)

| Fase | Camada principal     | Fronteira de responsabilidade                    |
| ---- | -------------------- | ------------------------------------------------ |
| 003A | `client`             | Autenticação e sessão HTTP                       |
| 003B | `client`             | Navegação autenticada e obtenção de HTML         |
| 004  | `parsers` / `models` | HTML → objetos de domínio tipados                |
| 005  | `repositories`       | Objetos de domínio → Google Sheets               |
| 006  | `services`           | `AgendaSyncService`: orquestração multi-profissionais |
| 007  | `jobs`               | Disparo automático e controle de concorrência    |
