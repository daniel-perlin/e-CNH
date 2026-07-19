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
