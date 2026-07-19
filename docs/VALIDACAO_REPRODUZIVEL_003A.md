# Validação reproduzível da Fase 003A

## Objetivo

Produzir evidência sanitizada, durável e repetível da autenticação HTTP executada pelo `ECNHClient`.

## Critério

A validação exige cinco tentativas consecutivas aprovadas.

Cada tentativa deve comprovar:

- exatamente três requests na sequência implementada;
- HTTP 200 nas três respostas;
- resultado final `status=sucesso`;
- `JSESSIONID` presente no CookieJar;
- marcador "Imprimir Agenda Diária do Psicólogo" presente;
- formulário protegido `DivisaoEquitativaForm` presente;
- formulário `LoginActionForm` ausente;
- hash SHA-256 e tamanho da resposta final registrados.

Qualquer tentativa reprovada invalida a série.

## Evidência preservada

O validador deve salvar somente:

- data e duração;
- versão do Node.js;
- método, caminho, status e duração de cada request;
- tamanho e SHA-256 de cada corpo;
- presença dos marcadores estruturais;
- presença nominal de `JSESSIONID`, sem valor;
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

O comando usa cinco tentativas por padrão. A quantidade pode ser alterada somente para diagnóstico com `LOGIN_VALIDATION_ATTEMPTS`.

## Resultado esperado

- exit code `0`: todas as tentativas atenderam ao critério;
- exit code `1`: pelo menos uma tentativa falhou;
- arquivo JSON sanitizado em `docs/evidencias/`.

O status da fase somente pode avançar para `Validada` após uma série aprovada e documentação conjunta no roadmap, documento da fase e changelog.
