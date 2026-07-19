# Fase 007 — Agendamento automático (cron)

**Status:** `Concluída`

## Objetivo

Executar automaticamente o `AgendaSyncService` em horários configuráveis, com proteção contra execuções concorrentes/sobrepostas, reutilizando integralmente a orquestração da Fase 006 e mantendo o disparo manual `npm run sync:agenda`.

## Escopo

- daemon Node com scheduler interno (`node-cron`);
- abstração `SyncLock` com implementação inicial em arquivo (`FileSyncLock`);
- lock global compartilhado entre ticks do cron e `sync:agenda`;
- `AgendaSyncJob`: agendamento/lock + chamada a `sincronizarProfissionais` (sem lógica de sync);
- `AgendaSyncScheduler`: registra expressão cron e dispara o job;
- wiring compartilhado (`criarAgendaSyncRuntime`) para script manual e daemon;
- config de fronteira: `AGENDA_SYNC_CRON` (obrigatória; padrão recomendado `0 17 * * *`), `AGENDA_SYNC_TZ`, `AGENDA_SYNC_LOCK_PATH`;
- script `npm run job:agenda`;
- testes unitários de lock/job sem rede;
- documentação e evidências sanitizadas.

## Fora de escopo

- alterações na lógica interna de `AgendaSyncService`, `ECNHClient`, parser ou `AgendaRepository`;
- painel operacional / abas Controle e Execuções (Fase 008);
- observabilidade avançada, métricas e alertas (Fase 009);
- filas distribuídas (Bull/Redis), cluster multi-host sem FS compartilhado;
- API HTTP ou novos canais de disparo além do daemon e do script manual.

## Arquitetura entregue

```text
npm run job:agenda          npm run sync:agenda
        │                            │
        ▼                            │
AgendaSyncScheduler                  │
        │ tick                       │
        ▼                            ▼
            AgendaSyncJob
                │
                ├── SyncLock (FileSyncLock)
                │
                └── criarAgendaSyncRuntime → AgendaSyncService
                                              └── (Fase 006 intacta)
```

Comandos oficiais: `npm run job:agenda` (daemon) e `npm run sync:agenda` (manual).

## Evidências

- Validação local lock/job/scheduler: `docs/evidencias/007-validacao-agendamento-2026-07-19T14-14-42-781Z.json`
- Validação consolidada: `docs/evidencias/007-validacao-agendamento-2026-07-19T14-16-00-000Z.json`
- Testes unitários: 43 aprovados (`npm test`)
- Comandos: `npm run validate:agenda-job`, `npm run sync:agenda`, `npm run job:agenda`

### Validação em 19/07/2026

**Evidências confirmadas:**

- `FileSyncLock` retorna `null` quando ocupado; segundo job recebe `ignorado_por_lock`;
- `AgendaSyncScheduler` dispara tick com expressão configurável;
- daemon inicia/para com `AGENDA_SYNC_CRON` (eventos estruturados sem PII);
- `npm run sync:agenda` continua funcional via `AgendaSyncJob` + lock (6/7 profissionais ok; falha parcial tipada em `ECNH_USER_4`).

**Resultado:** a Fase 007 avança para `Validada` e, com a documentação atualizada, para `Concluída`.

## Critérios de aceite

- [x] Documento da fase e ROADMAP/CHANGELOG alinhados.
- [x] Daemon (`job:agenda`) dispara sync em horários configuráveis via env.
- [x] `AgendaSyncService` reutilizado sem mover lógica de sincronização para o job.
- [x] `SyncLock` abstrai o mecanismo; implementação inicial em arquivo.
- [x] Lock global impede sobreposição entre ticks e entre cron e `sync:agenda`.
- [x] Lock ocupado → pular + log, sem fila.
- [x] `npm run sync:agenda` permanece disponível e usa o mesmo caminho de orquestração + lock.
- [x] Wiring compartilhado; sem duplicação material entre script manual e daemon.
- [x] Testes unitários de lock/job sem rede; sem PII em logs/evidências.
- [x] Nenhuma entrega das Fases 008/009.
- [x] Client, parser e `AgendaRepository` de agenda não alterados.

## Decisões desta fase

| Tema | Decisão | Classificação |
| ---- | ------- | ------------- |
| Processo | Daemon Node + scheduler interno | Aprovado / ADR-013 |
| Lock | Global (cron + manual) atrás de `SyncLock` | Aprovado / ADR-013 |
| Implementação do lock | Arquivo via `proper-lockfile` | Evidência confirmada |
| Cron | `node-cron`; `AGENDA_SYNC_CRON` obrigatória; padrão recomendado `0 17 * * *` (diário às 17:00, `America/Sao_Paulo`) | Evidência confirmada |
| Fuso | `AGENDA_SYNC_TZ` default `America/Sao_Paulo` | Evidência confirmada |
| Lock path | `AGENDA_SYNC_LOCK_PATH` default `.data/agenda-sync.lock` | Evidência confirmada |
| Lock ocupado | Pular + warn (sem fila) | Evidência confirmada |
| Wiring | `src/composition/agenda-sync-runtime.ts` | Evidência confirmada |

## Progresso

| Passo | Estado | Notas |
| ----- | ------ | ----- |
| 0 — Documentação | Feito | |
| 1 — Contratos | Feito | |
| 2 — `FileSyncLock` | Feito | |
| 3 — `AgendaSyncJob` | Feito | |
| 4 — Composition + `sync:agenda` | Feito | |
| 5 — Scheduler + `job:agenda` | Feito | |
| 6 — Validação | Feito | Evidência sanitizada + docs |

## Pendências

- Nenhuma pendência bloqueante no escopo da Fase 007.
- Limitação conhecida: lock de arquivo assume um host / volume compartilhado.
- Fases 008 e 009 permanecem em `Backlog`.

## Próximos passos

MVP do produto concluído na Fase 007. Priorizar Fases 008/009 somente com decisão explícita.

## Resultado da fase

Agendamento automático entregue e validado: daemon com cron configurável, lock global, job fino sobre `AgendaSyncService`, e `sync:agenda` preservado. A Fase 007 está `Concluída`.
