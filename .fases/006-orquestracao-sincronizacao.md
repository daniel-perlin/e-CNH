# Fase 006 — Orquestração da sincronização (multi-profissionais)

**Status:** `Concluída`

## Objetivo

Criar a camada de aplicação (`src/services`) que orquestra o fluxo completo de sincronização da agenda, utilizando exclusivamente os componentes já existentes e validados nas fases anteriores:

1. login no portal;
2. listar datas disponíveis;
3. obter HTML da agenda;
4. executar o parser;
5. persistir via `AgendaRepository`;
6. logout;
7. retornar um resultado tipado da sincronização.

A orquestração cobre um ou mais profissionais configurados, em execução sob demanda (sem cron).

## Escopo

- `AgendaSyncService` em `src/services`;
- tipos `ResultadoSincronizacao*` e `EntradaSincronizacaoProfissional` (sem PII no resultado);
- coordenação de `ECNHClient` + `parseAgendaHtml` + `AgendaRepository` por injeção;
- resolução de profissionais habilitados via `src/config/sync-professionals.ts` (sem acoplar o serviço ao `.env`);
- loop sequencial multi-profissional com falha parcial tipada;
- testes unitários com fakes;
- script `npm run sync:agenda`;
- documentação após evidências da validação real.

## Fora de escopo

- alterações em `ECNHClient`, `parseAgendaHtml` ou `AgendaRepository`;
- cron / overlap (Fase 007);
- painel operacional / Apps Script (Fase 008);
- observabilidade avançada (Fase 009);
- API HTTP ou novos canais de disparo além do script sob demanda.

## Arquitetura entregue

```text
resolveEntradasSincronizacao (config)
        │
        ▼
AgendaSyncService
    ├── ECNHClient (fábrica: uma sessão por profissional)
    ├── parseAgendaHtml
    └── AgendaRepository
        │
        ▼
ResultadoSincronizacao (tipado, sem PII)
```

Comando oficial: `npm run sync:agenda`.

## Evidências

- Validação real: `docs/evidencias/006-validacao-sincronizacao-2026-07-19T13-53-48-274Z.json`
- Testes unitários: 32 aprovados (`npm test`)

### Validação em 19/07/2026

**Evidências confirmadas:**

- `npm test` — 32 testes aprovados (serviço, config de profissionais, resumo);
- `npm run sync:agenda` — 7 profissionais processados; 6 com login/datas/persistência/logout ok;
- falha parcial tipada em `ECNH_USER_4` (`loginStatus=erro_desconhecido`, `logoutExecutado=true`);
- evidência sanitizada sem CPF, senha, cookies ou dados de pacientes.

**Resultado:** a Fase 006 avança para `Validada` e, com a documentação atualizada, para `Concluída`.

## Critérios de aceite

- [x] Documento da fase e ROADMAP alinhados; status `Concluída`.
- [x] `AgendaSyncService` orquestra login → datas → HTML → parse → persistência → logout sem alterar client/parser/repositório.
- [x] Resultado tipado cobre sucesso, falha de login, falha de extração/persistência e logout; sem PII no resultado agregado.
- [x] Multi-profissional sequencial com falha parcial reportável.
- [x] Testes unitários do serviço/config aprovados sem rede.
- [x] Script sob demanda executável; sem cron.
- [x] Validação da fase com evidência sanitizada e documentação obrigatória atualizada.

## Decisões desta fase

| Tema | Decisão | Classificação |
| ---- | ------- | ------------- |
| Pasta | `src/services` | Alinhado a ADR-003 |
| Nome | `AgendaSyncService` | Confirmado |
| Cliente/parser/repo | Somente consumir | Confirmado |
| Multi-profissional | Sequencial com falha parcial | Evidência confirmada |
| Datas | `listarDatasAgendamento()`; `dataReferencia = data` | Evidência confirmada |
| Nome na planilha | `ECNH_USER_<n>_NAME` via config | Evidência confirmada |

## Progresso

| Passo | Estado | Notas |
| ----- | ------ | ----- |
| 0 — Documentação | Feito | |
| 1 — Contratos | Feito | |
| 2 — `sincronizarProfissional` | Feito | |
| 3 — `sincronizarProfissionais` | Feito | |
| 4 — Config profissionais | Feito | |
| 5 — Script sob demanda | Feito | `npm run sync:agenda` |
| 6 — Validação | Feito | Evidência sanitizada + docs |

## Pendências

- Nenhuma pendência bloqueante no escopo da Fase 006.
- Cron (007) e painel/métricas (008/009) permanecem fora deste escopo.

## Próximos passos

Iniciar a Fase 007 — Agendamento automático (cron), consumindo `AgendaSyncService` sem alterar a orquestração.

## Resultado da fase

Orquestração multi-profissional entregue e validada no ambiente real via `npm run sync:agenda`, com testes unitários e evidência sanitizada. A Fase 006 está `Concluída`.
