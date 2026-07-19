# Roadmap

Cada fase deve resolver um único problema e não antecipar funcionalidades posteriores. A sequência abaixo reflete a separação arquitetural do sistema: portal → extração → destino → orquestração → agendamento.

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
| Fase 008 — Painel Operacional (Nice to Have)| `Backlog`      | Abas Controle/Execuções e metadados de sync; Apps Script opcional — **parked** (pós-MVP).                   |
| Fase 009 — Observabilidade e Métricas (Nice to Have) | `Backlog` | Métricas, dashboards e alertas — **parked** (pós-MVP).                                                      |

> **Limite do MVP:** o MVP do projeto termina na Fase 007. As Fases 008 e 009 representam melhorias futuras (Nice to Have), não são pré-requisitos para que o sistema esteja funcional e permanecem em backlog até nova priorização.

> **Situação da Fase 006:** oficialmente `Concluída` em 19/07/2026. Orquestração multi-profissional validada via `npm run sync:agenda` (6/7 profissionais ok; falha parcial tipada) com evidência sanitizada.

> **Situação da Fase 007:** oficialmente `Concluída` em 19/07/2026. Daemon (`job:agenda`), `SyncLock` global e `AgendaSyncJob` validados com evidência sanitizada. O MVP do produto termina nesta fase. Fases 008 e 009 permanecem em `Backlog`.

## Convenção de status

Cada fase da 003A à 007 possui exatamente um estado e progride sem saltos:

`Planejada` → `Implementada` → `Validada` → `Concluída`

- **Planejada:** objetivo, escopo e critérios documentados; implementação ainda não finalizada.
- **Implementada:** escopo desenvolvido; validação da fase ainda pendente.
- **Validada:** critérios executados no ambiente adequado, com evidências registradas.
- **Concluída:** fase validada, sem pendências bloqueantes no escopo e com documentação obrigatória atualizada.

As Fases 008 e 009 usam o estado `Backlog` (estacionadas / parked): visão documentada, sem implementação e fora da progressão do MVP até nova priorização.

Um status só pode mudar quando a evidência correspondente estiver registrada no documento da fase e no diário do projeto.

## Alinhamento arquitetural

| Fase | Camada principal     | Fronteira de responsabilidade                    |
| ---- | -------------------- | ------------------------------------------------ |
| 003A | `client`             | Autenticação e sessão HTTP                       |
| 003B | `client`             | Navegação autenticada e obtenção de HTML         |
| 004  | `parsers` / `models` | HTML → objetos de domínio tipados                |
| 005  | `repositories`       | Objetos de domínio → Google Sheets               |
| 006  | `services`           | `AgendaSyncService`: orquestração multi-profissionais |
| 007  | `jobs`               | Disparo automático e controle de concorrência    |

## Critério de avanço

Antes de iniciar a próxima fase do MVP (até a 007), a fase atual deve estar `Concluída`, com fatos observados, decisões relevantes e validações proporcionais ao risco registrados. As Fases 008 e 009 não entram nessa sequência até serem priorizadas.

## Backlog pós-MVP (Nice to Have) — estacionado

As fases abaixo **não fazem parte do MVP**, **não estão em implementação** e permanecem **parked** até nova priorização explícita.

### Fase 008 — Painel Operacional (Nice to Have)

**Status:** `Backlog` · Documento: [.fases/008-painel-operacional.md](../.fases/008-painel-operacional.md)

Escopo conceitual (somente visão futura; nada a implementar agora):

- aba `Controle` na planilha Google Sheets;
- aba `Execuções` com histórico de sincronizações;
- registro de metadados das execuções (status, duração, quantidade de profissionais, quantidade de registros, erros resumidos sem PII);
- possível integração futura com Google Apps Script para um botão “Sincronizar Agora”;
- não antecipa cron, orquestração ou mudanças nas Fases 006/007.

### Fase 009 — Observabilidade e Métricas (Nice to Have)

**Status:** `Backlog` · Documento: [.fases/009-observabilidade-metricas.md](../.fases/009-observabilidade-metricas.md)

Escopo conceitual (somente visão futura; nada a implementar agora):

- métricas operacionais;
- estatísticas de sincronizações;
- indicadores de desempenho;
- dashboards e tendências;
- alertas e monitoramento;
- não é pré-requisito para o sistema funcional após a Fase 007.
