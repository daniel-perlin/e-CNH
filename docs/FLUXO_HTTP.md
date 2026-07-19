# Fluxo HTTP do portal e-CNH

## Fatos observados no Chrome DevTools

```text
Cliente HTTP
  │
  │ GET /gefor/SGU/login.do?method=iniciarLogin
  ▼
HTML inicial
  │
  │ POST /gefor/SGU/login.do
  │ method=iniciarLoginAgenda
  ▼
HTML do formulário de credenciais
  │
  │ POST /gefor/SGU/login.do
  │ method=autenticar
  ▼
Portal e-CNH
  │ HTML completo SSR
  ▼
CookieJar preservado
  │
  ▼
HTML "Imprimir Agenda Diária do Psicólogo"
```

O portal não retornou JSON no fluxo observado e nenhuma API REST foi identificada. O HTML devolvido pelo servidor é o artefato de navegação e será a fonte para parsers em fase posterior.

## Estado da sessão antes do POST

### Sequência confirmada no HAR

**Evidências confirmadas:**

1. `GET /gefor/SGU/login.do?method=iniciarLogin`;
2. `POST /gefor/SGU/login.do` com `method=iniciarLoginAgenda`;
3. `POST /gefor/SGU/login.do` com `method=autenticar`.

As três respostas terminaram em HTTP 200, sem redirects. O HAR não preservou cookies de request ou response nessas etapas.

### Estado entre as etapas

O mesmo `AuthTransport` e o mesmo CookieJar são usados na sequência completa.

A resposta da etapa 2 contém os dez hidden fields enviados na etapa 3. Todos possuem valores constantes; nenhum token dinâmico foi observado. Por isso, o protocolo reproduz os valores confirmados sem adicionar parser HTML.

### Requisições e mudanças de estado observáveis no código da página

**Requests auxiliares confirmados:**

- o HTML chama `fetch('/GFR/release.json', { cache: 'no-cache' })` entre as etapas 1 e 2;
- a chamada se repete entre as etapas 2 e 3;
- não há evidência de estado reutilizado dessas respostas na autenticação.

**Efeitos não comprovados:**

- não há resposta Network preservada de `/GFR/release.json`, portanto não é possível afirmar se ela cria ou altera cookies;
- não há evidência de que `style1` seja enviado no POST, afete `JSESSIONID` ou participe da autenticação;
- os dois iframes declarados no HTML não possuem `src`, portanto o HTML não comprova requisição automática por eles;
- não existe `meta refresh` no HTML fornecido;
- `global.js`, `login.js` e os scripts globais auditados não executam submit ou navegação automática durante a carga da página;
- as funções com `fetch`, AJAX, redirect e submit nesses arquivos dependem de chamadas explícitas que não aparecem na cadeia do botão "Acessar".

### Comparação

O cliente agora reproduz as três requisições de login na ordem do HAR. A evidência completa, incluindo payloads, respostas e hashes, está em [EVIDENCIA_HAR_AUTENTICACAO.md](EVIDENCIA_HAR_AUTENTICACAO.md).

## Parâmetros observados no login

| Parâmetro             | Valor observado | Obrigatoriedade         |
| --------------------- | --------------- | ----------------------- |
| `method`              | `autenticar`    | Pendente de confirmação |
| `novaSenha`           | vazio           | Pendente de confirmação |
| `novaSenha1`          | vazio           | Pendente de confirmação |
| `alteraSenha`         | `false`         | Pendente de confirmação |
| `idGrupoUsuario`      | `-1`            | Pendente de confirmação |
| `idCFC`               | vazio           | Pendente de confirmação |
| `idUnidTransito`      | `-1`            | Pendente de confirmação |
| `msgPublicacao`       | vazio           | Pendente de confirmação |
| `consultaAgenda`      | `true`          | Pendente de confirmação |
| `autenticadoCyberark` | `false`         | Pendente de confirmação |
| `codigo`              | CPF             | Pendente de confirmação |
| `senha`               | Senha           | Pendente de confirmação |

O cliente reproduz esses doze controles e sua ordem. Valores de CPF, senha e cookies não devem ser versionados.

## Validação do cliente HTTP em ambiente real

Em 18/07/2026, o fluxo completo confirmado no HAR foi executado com configuração local autorizada.

**Evidências confirmadas:**

```text
GET /gefor/SGU/login.do?method=iniciarLogin
  ↓
HTTP 200
  ↓
POST /gefor/SGU/login.do • method=iniciarLoginAgenda
  ↓
HTTP 200
  ↓
POST /gefor/SGU/login.do • method=autenticar
  ↓
ECONNRESET
```

Uma execução instrumentada posterior recebeu HTTP 200 nas três etapas e retornou `status=sucesso`, mas não preservou a resposta. O resultado não foi reproduzido e não sustenta validação independente.

**Pendência:** esclarecer ou estabilizar o encerramento intermitente do socket antes de concluir a fase. Consulte a [auditoria HTTP/TLS](AUDITORIA_HTTP_TLS_AUTENTICACAO.md).

As diferenças conhecidas e pendentes estão organizadas na [matriz de divergências da autenticação HTTP](MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md).

## Descobertas pendentes

- resposta real conclusiva da terceira etapa no cliente;
- endpoints e parâmetros de consulta de agenda;
- pesquisa e troca de Data de Agendamento;
- obtenção de todas as datas disponíveis;
- requisições que retornam a agenda;
- tabelas HTML que contêm os pacientes;
- logout e ciclo completo de expiração de sessão.
