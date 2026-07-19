# Fase 002 — Consolidação arquitetural

## Objetivo

Atualizar documentação, arquitetura e decisões do projeto com as evidências reais coletadas no Chrome DevTools.

## Escopo

Documentação do protocolo de login, sessão e fluxo HTTP; nenhuma implementação funcional de login, scraping, Sheets ou cron.

## Decisões tomadas

- HTTP direto é a estratégia principal da integração.
- Axios, CookieJar e HTML SSR são as fronteiras técnicas da integração futura.
- Playwright é reservado para investigação e depuração.

## Evidências coletadas

- `POST /gefor/SGU/login.do` com `application/x-www-form-urlencoded`.
- Sessão baseada em cookie; `JSESSIONID` observado.
- Resposta HTML SSR com "Imprimir Agenda Diária do Psicólogo" após autenticação.

## Pendências

Confirmar campos obrigatórios, atributos de cookies, critérios de sucesso e logout; descobrir endpoints de agenda.

## Próximos passos

Implementar autenticação HTTP real na Fase 003, sem antecipar scraping.

## Resultado da fase

Arquitetura e roadmap consolidados com fatos observados; nenhuma funcionalidade de negócio foi criada.
