# Validação reproduzível da Fase 003A

## Objetivo

Produzir evidência sanitizada, durável e repetível da autenticação HTTP executada pelo `ECNHClient`.

## Critério

A validação exige cinco tentativas aprovadas com evidência durável.

Cada tentativa deve comprovar:

- exatamente três requests na sequência implementada;
- HTTP 200 nas três respostas;
- resultado final `status=sucesso`;
- `JSESSIONID` presente no CookieJar;
- marcador "Imprimir Agenda Diária do Psicólogo" presente;
- formulário protegido `DivisaoEquitativaForm` presente;
- formulário `LoginActionForm` ausente;
- hash SHA-256 e tamanho da resposta final registrados.

### Credenciais distintas

**Evidência confirmada:** o portal tende a rejeitar re-login imediato da mesma conta, devolvendo novamente o formulário de login. Por isso, a série oficial usa usuários habilitados distintos (`ECNH_USER_<n>_`), um por tentativa.

## Evidência preservada

O validador salva somente:

- data e duração;
- versão do Node.js;
- método, caminho, status e duração de cada request;
- tamanho e SHA-256 de cada corpo;
- presença dos marcadores estruturais;
- presença nominal de `JSESSIONID`, sem valor;
- fonte da credencial (`ECNH_USER_<n>`), sem CPF nem senha;
- resultado tipado do cliente;
- resumo da série.

Não salvar:

- CPF;
- senha;
- valores de cookies;
- HTML;
- headers sensíveis;
- dados pessoais encontrados na resposta.

## Comando

```bash
npm run validate:login
```

Variáveis opcionais:

- `LOGIN_VALIDATION_ATTEMPTS` — padrão `5`;
- `LOGIN_VALIDATION_DELAY_MS` — intervalo entre tentativas, padrão `5000`;
- `ECNH_LOGIN_USER_INDEX` — força um único usuário; a série oficial prefere o pool de habilitados.

## Formato do CPF

O cliente formata o CPF como `DDD.DDD.DDD-DD` antes do POST `autenticar`, conforme o HAR do login bem-sucedido no Chrome.

## Resultado oficial desta validação

Em 19/07/2026 foram aprovadas cinco autenticações distintas do `ECNHClient`, com evidências sanitizadas em:

- `docs/evidencias/003a-validacao-login-2026-07-19T10-24-57-211Z.json`
- `docs/evidencias/003a-validacao-login-2026-07-19T10-25-07-904Z.json`
- `docs/evidencias/003a-validacao-login-2026-07-19T10-25-30-003Z.json`
- `docs/evidencias/003a-validacao-login-2026-07-19T10-29-58-734Z.json`
- `docs/evidencias/003a-validacao-login-2026-07-19T10-30-14-623Z.json`

A consolidação está em `docs/evidencias/003a-consolidacao-validacao-2026-07-19.json`.

Com essa evidência, a Fase 003A avançou para `Validada`. Em seguida, o logout HTTP (`GET method=finalizarLogin`) foi confirmado e implementado; a fase está `Concluída`.
