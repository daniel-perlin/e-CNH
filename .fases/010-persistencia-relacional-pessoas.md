# Fase 010 — Persistência relacional paralela (pessoas)

## Objetivo

Introduzir a camada genérica de persistência da aplicação (`src/db/`) e o primeiro repositório (`PessoaRepository`), gravando pessoas em banco **em paralelo** ao Google Sheets, sem alterar o comportamento operacional da planilha nem falhar o sync se o banco estiver indisponível.

## Escopo

- Camada `db/` reutilizável (SQLite local / PostgreSQL no Railway).
- Tabela `pessoas` com upsert por CPF; sem DELETE.
- Hook best-effort no `AgendaSyncService` após `AgendaRepository.salvarAgenda`.
- Documentação ADR-022 + env + deploy.

## Fora de escopo

- Histórico de agendamentos.
- Substituir Sheets como interface da Pri.
- Inativar pessoas (`ativo` existe, sync não altera após insert).
- Playwright.

## Decisões

Ver ADR-022 em `docs/DECISOES.md`.

## Evidências

- Testes unitários: upsert SQLite; Sheets ok com `PessoaRepository` lançando erro.
- Typecheck do projeto.

## Pendências

- Provisionar PostgreSQL no Railway e definir `DATABASE_URL` para histórico persistente entre execuções do Cron.
- Validação E2E em produção com Postgres (quando o addon estiver ligado).

## Próximos passos

- `ProfissionalRepository` / `AgendamentoRepository` / `SyncRunRepository` sobre a mesma camada `db/`.
- Tornar Sheets projeção opcional no longo prazo (fora desta fase).

## Resultado da fase

**Implementada** — código e testes locais; validação Railway com Postgres pendente.
