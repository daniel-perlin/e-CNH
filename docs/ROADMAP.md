# Roadmap

Cada fase do MVP resolveu um único problema sem antecipar funcionalidades posteriores. A sequência abaixo reflete a separação arquitetural do sistema: portal → extração → destino → orquestração → agendamento.

## MVP do projeto (Fases 000–007)

As Fases **000 a 007** constituem o **MVP do projeto**.

**Status do MVP:** concluído.

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

> **Situação da Fase 007:** oficialmente `Concluída` em 19/07/2026. Daemon (`job:agenda`), `SyncLock` global e `AgendaSyncJob` validados com evidência sanitizada. O MVP do produto termina nesta fase.

## Fora do MVP (melhorias futuras)

As Fases **008** e **009** **não fazem parte do MVP**. São melhorias futuras (**Nice to Have**): não são pré-requisitos para o sistema operacional e não há fases obrigatórias após a 007.

| Item | Status | Notas |
| ---- | ------ | ----- |
| Fase 008 — Painel Operacional | Nice to Have | Registrada no backlog; visão em [.fases/008-painel-operacional.md](../.fases/008-painel-operacional.md) |
| Fase 009 — Observabilidade e Métricas | Nice to Have | Registrada no backlog; visão em [.fases/009-observabilidade-metricas.md](../.fases/009-observabilidade-metricas.md) |

O catálogo oficial de evoluções pós-MVP — incluindo essas fases e features candidatas — está em **[BACKLOG.md](BACKLOG.md)**.

## Convenção de status (MVP)

Cada fase da 003A à 007 possui exatamente um estado e progride sem saltos:

`Planejada` → `Implementada` → `Validada` → `Concluída`

- **Planejada:** objetivo, escopo e critérios documentados; implementação ainda não finalizada.
- **Implementada:** escopo desenvolvido; validação da fase ainda pendente.
- **Validada:** critérios executados no ambiente adequado, com evidências registradas.
- **Concluída:** fase validada, sem pendências bloqueantes no escopo e com documentação obrigatória atualizada.

Com o MVP concluído, novas funcionalidades **não** seguem mais essa progressão obrigatória de fases. Evoluções futuras são priorizadas e acompanhadas em [BACKLOG.md](BACKLOG.md).

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

## Critério de avanço

As Fases 000–007 do MVP estão `Concluída`. Não há próxima fase obrigatória do produto.

Melhorias futuras (incluindo 008 e 009) só entram em implementação quando forem priorizadas explicitamente no [BACKLOG.md](BACKLOG.md), com documentação e escopo definidos naquele momento.
