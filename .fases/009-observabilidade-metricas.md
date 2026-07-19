# Fase 009 — Observabilidade e Métricas (Nice to Have)

**Status:** `Backlog`

> **Nice to Have / parked.** Esta fase **não faz parte do MVP**. Permanece estacionada até a conclusão das Fases 006 e 007 e até nova priorização explícita. Nenhuma implementação, desenho técnico em `ARQUITETURA.md` / ADRs ou alteração de domínio deve ocorrer enquanto o status for `Backlog`.

## Objetivo

Oferecer visibilidade operacional contínua sobre as sincronizações: métricas, tendências, indicadores de desempenho e, quando fizer sentido, alertas — sem alterar o fluxo núcleo de autenticação, extração e persistência da agenda.

## Escopo previsto

- métricas operacionais das execuções de sincronização (sucesso/falha, duração, volumes);
- estatísticas agregadas ao longo do tempo;
- indicadores de desempenho relevantes à operação administrativa;
- dashboards e tendências (ferramenta a definir na priorização);
- alertas e monitoramento proporcionais ao risco operacional;
- uso exclusivo de dados já tipados/sanitizados (sem PII em métricas, logs ou painéis).

## Fora de escopo

- qualquer trabalho enquanto o MVP (Fases 006 e 007) não estiver concluído e a fase não for priorizada;
- substituir o painel operacional da planilha (Fase 008) ou antecipá-lo como dependência obrigatória sem decisão;
- reescrever orquestração, cron, client HTTP ou parser para “caber” em uma stack de métricas;
- coleta de dados pessoais de pacientes ou credenciais para fins de telemetria;
- APM/comercial obrigatório sem necessidade operacional comprovada;
- inventar contratos externos sem evidência e decisão registrada.

## Critérios de aceitação preliminares

- [ ] Documento da fase promovido de `Backlog` para a progressão oficial somente após priorização explícita.
- [ ] Conjunto mínimo de métricas definido sem PII e alinhado aos resultados tipados da sincronização.
- [ ] Fonte de verdade das métricas documentada (ex.: histórico de execuções, logs estruturados sanitizados).
- [ ] Dashboards/alertas, se existirem, não acoplam domínio do portal às ferramentas de observação.
- [ ] Evidência de que o MVP permanece funcional sem esta fase.

## Relação com o MVP

| Fase | Papel |
| ---- | ----- |
| 006–007 | MVP funcional (sync sob demanda + cron) |
| 008 | Melhoria Nice to Have — painel na planilha |
| 009 | Melhoria Nice to Have — métricas/observabilidade |

## Resultado da fase

Pendente. Apenas visão e critérios preliminares documentados; implementação **não** iniciada.
