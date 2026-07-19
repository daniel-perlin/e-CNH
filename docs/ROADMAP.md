# Roadmap

Cada fase deve resolver um único problema e não antecipar funcionalidades posteriores. A sequência abaixo reflete a separação arquitetural do sistema: portal → extração → destino → orquestração → agendamento.

| Fase                                        | Status         | Entrega                                                                                                     |
| ------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| Fase 000 — Foundation                       | `Concluída`    | Estrutura, configuração, convenções e documentação.                                                         |
| Fase 001 — Engenharia reversa               | `Concluída`    | Evidências do DevTools e mapa do protocolo.                                                                 |
| Fase 002 — Consolidação arquitetural        | `Concluída`    | Documentação, decisões e arquitetura HTTP baseadas em evidências reais.                                     |
| Fase 003A — Autenticação HTTP               | `Concluída`    | Autenticação HTTP, sessão, CookieJar, verificação, logout HTTP e testes; sem agenda.    |
| Fase 003B — Navegação autenticada           | `Concluída`    | Página de agenda, endpoints, parâmetros e HTML bruto; sem extração estruturada.                             |
| Fase 004 — Extração de dados da agenda      | `Planejada`    | Parser HTML, modelos tipados e testes unitários; sem integração com planilha.                               |
| Fase 005 — Integração Google Sheets         | `Planejada`    | Leitura/escrita e contrato da aba `Agenda`.                                                                 |
| Fase 006 — Orquestração multi-profissionais | `Planejada`    | Caso de uso que coordena múltiplos profissionais e o fluxo completo de sincronização; execução sob demanda. |
| Fase 007 — Agendamento automático (cron)    | `Planejada`    | Job agendado e proteção contra sobreposição de execuções.                                                   |

> **Situação da Fase 003B:** `Concluída` em 19/07/2026. Consulta `POST method=consultarAgendaPsicologo` reproduzida no `ECNHClient` com HTML de resultado e evidências sanitizadas. Próxima fase: 004 — Extração de dados da agenda.

## Convenção de status

Cada fase da 003A à 007 possui exatamente um estado e progride sem saltos:

`Planejada` → `Implementada` → `Validada` → `Concluída`

- **Planejada:** objetivo, escopo e critérios documentados; implementação ainda não finalizada.
- **Implementada:** escopo desenvolvido; validação da fase ainda pendente.
- **Validada:** critérios executados no ambiente adequado, com evidências registradas.
- **Concluída:** fase validada, sem pendências bloqueantes no escopo e com documentação obrigatória atualizada.

Um status só pode mudar quando a evidência correspondente estiver registrada no documento da fase e no diário do projeto.

## Alinhamento arquitetural

| Fase | Camada principal     | Fronteira de responsabilidade                    |
| ---- | -------------------- | ------------------------------------------------ |
| 003A | `client`             | Autenticação e sessão HTTP                       |
| 003B | `client`             | Navegação autenticada e obtenção de HTML         |
| 004  | `parsers` / `models` | HTML → objetos de domínio tipados                |
| 005  | `repositories`       | Objetos de domínio → Google Sheets               |
| 006  | `services`           | Caso de uso de sincronização multi-profissionais |
| 007  | `jobs`               | Disparo automático e controle de concorrência    |

## Critério de avanço

Antes de iniciar a próxima fase, a fase atual deve estar `Concluída`, com fatos observados, decisões relevantes e validações proporcionais ao risco registrados.
