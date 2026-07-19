# Fase 008 — Painel Operacional (Nice to Have)

**Status:** `Backlog`

> **Nice to Have / parked.** Esta fase **não faz parte do MVP**. Permanece estacionada até a conclusão das Fases 006 e 007 e até nova priorização explícita. Nenhuma implementação, desenho técnico em `ARQUITETURA.md` / ADRs ou alteração de domínio deve ocorrer enquanto o status for `Backlog`.

## Objetivo

Tornar a planilha Google Sheets um painel operacional leve para a equipe administrativa: visualizar o estado da última sincronização e o histórico de execuções, eventualmente com um gatilho remoto “Sincronizar Agora”.

## Escopo previsto

- aba `Controle` com metadados da última execução (status, duração, quantidade de profissionais, quantidade de registros, erros resumidos sem PII);
- aba `Execuções` com histórico append-only de sincronizações;
- persistência desses metadados a partir do resultado tipado da orquestração (sem reimplementar login/parser/agenda);
- possível ponte futura com Google Apps Script (menu/botão) chamando um endpoint autenticado que dispare a mesma orquestração do MVP;
- documentação de contratos de abas e critérios de privacidade (sem CPF, senha, cookies ou dados de pacientes nos metadados).

## Fora de escopo

- qualquer trabalho enquanto o MVP (Fases 006 e 007) não estiver concluído e a fase não for priorizada;
- reimplementar sincronização, cron ou lógica de portal dentro do Apps Script;
- alterar `ECNHClient`, parser, `AgendaRepository` de agenda ou o layout da aba `Agenda` como requisito desta fase;
- interface web/mobile dedicada, CRM ou notificações a pacientes;
- observabilidade avançada, dashboards externos ou alertas (Fase 009);
- inventar APIs ou contratos sem evidência e decisão registrada.

## Critérios de aceitação preliminares

- [ ] Documento da fase promovido de `Backlog` para a progressão oficial somente após priorização explícita.
- [ ] Abas `Controle` e `Execuções` definidas e escritas sem PII nas evidências/logs.
- [ ] Registro de execução consumindo o resultado da orquestração existente, sem duplicar o fluxo de sync.
- [ ] Se houver “Sincronizar Agora”, o disparo reutiliza a orquestração do MVP e respeita proteção contra sobreposição (Fase 007).
- [ ] Nenhuma dependência circular: painel observa/dispara; não contém regras de domínio do portal.

## Relação com o MVP

| Fase | Papel |
| ---- | ----- |
| 006–007 | MVP funcional (sync sob demanda + cron) |
| 008 | Melhoria Nice to Have — painel na planilha |
| 009 | Melhoria Nice to Have — métricas/observabilidade |

## Resultado da fase

Pendente. Apenas visão e critérios preliminares documentados; implementação **não** iniciada.
