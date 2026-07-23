# Evidências sanitizadas

Este diretório recebe artefatos gerados por validações controladas.

Os arquivos podem conter somente metadados técnicos, hashes e sinais booleanos. É proibido registrar HTML, credenciais, valores de cookies, tokens ou dados pessoais.

## Validação oficial da Fase 003A

- Critério e comando de login: [VALIDACAO_REPRODUZIVEL_003A.md](../VALIDACAO_REPRODUZIVEL_003A.md)
- Consolidação de login: `003a-consolidacao-validacao-2026-07-19.json`
- Consolidação de logout: `003a-consolidacao-logout-2026-07-19.json`
- Descoberta de logout: `003a-descoberta-logout-*.json`
- Tentativas individuais de login: `003a-validacao-login-*.json`

## Validação oficial da Fase 003B

- Documento da fase: [003b-navegacao-autenticada.md](../../.fases/003b-navegacao-autenticada.md)
- Descoberta: `003b-descoberta-navegacao-*.json`
- Validação: `003b-validacao-navegacao-*.json`

## Validação oficial da Fase 004

- Documento da fase: [004-extracao-agenda.md](../../.fases/004-extracao-agenda.md)
- Descoberta HTML: `004-descoberta-html-*.json`
- Descoberta domínio: `004-descoberta-dominio-*.json`
- Validação do parser: `004-validacao-parser-*.json`

## Validação oficial da Fase 005

- Documento da fase: [005-integracao-google-sheets.md](../../.fases/005-integracao-google-sheets.md)
- Descoberta API (estática): `005-descoberta-api-sheets-2026-07-19.json`
- Descoberta de conexão: `005-descoberta-conexao-sheets-*.json`
- Validação de persistência: `005-validacao-sheets-*.json`

## Validação oficial da Fase 006

- Documento da fase: [006-orquestracao-sincronizacao.md](../../.fases/006-orquestracao-sincronizacao.md)
- Validação da sincronização: `006-validacao-sincronizacao-*.json`
- Comando: `npm run sync:agenda`

## Validação oficial da Fase 007

- Documento da fase: [007-agendamento-automatico.md](../../.fases/007-agendamento-automatico.md)
- Validação local (lock/job/scheduler): `007-validacao-agendamento-2026-07-19T14-14-42-781Z.json`
- Validação consolidada: `007-validacao-agendamento-2026-07-19T14-16-00-000Z.json`
- Comandos: `npm run validate:agenda-job`, `npm run job:agenda`, `npm run sync:agenda`

## Validação E2E pós-MVP — credenciais + sync (2026-07-23)

- Relatório: [008-validacao-e2e-credenciais-sync-2026-07-23.md](008-validacao-e2e-credenciais-sync-2026-07-23.md)
- Comandos: `npm run audit:credenciais`, `npm run sync:agenda`
- Resultado: 16/16 sync OK; Alessandra excluída (bloqueio portal)

## Validação oficial da Fase 003C / B012

- Documento da fase: [003c-perfis-profissionais-portal.md](../../.fases/003c-perfis-profissionais-portal.md)
- Consolidação Médico (Italo / `ECNH_USER_16`): `003c-consolidacao-perfil-medico-2026-07-19.json`
- Escopo validado: login, resolução de perfil `medico`, consulta `consultarAgendaMedico`, sincronização completa

## Descoberta da Fase 003D / B011

- Documento da fase: [003d-escolha-unidade-visao.md](../../.fases/003d-escolha-unidade-visao.md)
- Descoberta do ENVIAR / segundo `autenticar`: `003d-descoberta-enviar-escolha-unidade-2026-07-19.json`
- Consolidação multi-unidade (`ECNH_USER_17`): `003d-consolidacao-escolha-unidade-2026-07-19.json`
- JS do portal: `/GFR/js/app/sgu/choice.js` (`enviar()` → form pai → `login()`)
