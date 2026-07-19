# Evidência HAR da autenticação HTTP

## Objetivo

Registrar, sem credenciais, cookies ou dados pessoais, o fluxo de autenticação capturado no HAR `www.e-cnhsp.sp.gov.br.har` em 18/07/2026.

Esta captura passa a ser a fonte de verdade do protocolo da Fase 003A.

## Sequência confirmada

| Etapa | Requisição                                        | Status | Tamanho declarado no HAR | Corpo capturado | SHA-256 do corpo capturado                                         |
| ----- | ------------------------------------------------- | ------ | ------------------------ | --------------- | ------------------------------------------------------------------ |
| 1     | `GET /gefor/SGU/login.do?method=iniciarLogin`     | 200    | 29.448 bytes             | 29.537 bytes    | `588e3aa02de61259fb0b2165f53fc29f469b2b0b93bc9b1418a05ec0b8158241` |
| 2     | `POST /gefor/SGU/login.do` — `iniciarLoginAgenda` | 200    | 15.941 bytes             | 15.969 bytes    | `a207d131906313567ba982b5bff10c19a2a16c2174ffe7ff2335f05d6cfa50a2` |
| 3     | `POST /gefor/SGU/login.do` — `autenticar`         | 200    | 72.162 bytes             | 72.200 bytes    | `89ad2194171b2c7622f697b98590c0c7eb40675439adef682cc227aec0e072f2` |

Os hashes foram calculados sobre o texto das respostas preservado no HAR, codificado em UTF-8 para o cálculo. O campo `content.size` do HAR foi mantido separadamente do tamanho do texto capturado.

As três respostas declararam `text/html;charset=ISO-8859-1` e `Content-Encoding: gzip`.

## Redirects e cookies

**Evidências confirmadas:**

- não há resposta 302, 303, 307 ou 308 em nenhuma das 195 entradas;
- as três requisições terminam diretamente em HTTP 200;
- o HAR não preservou header `Cookie`, `Set-Cookie`, `request.cookies` ou `response.cookies` nessas etapas.

O código deve manter o mesmo CookieJar durante toda a sequência, mas a captura não comprova criação ou rotação de cookie entre as três requisições.

## Etapa 1 — início do login

### Request

```text
GET /gefor/SGU/login.do?method=iniciarLogin
Referer: <origem do portal>/
```

O Chrome não enviou `Origin` nessa navegação GET.

### Hidden fields da resposta

```text
method=autenticar
isCyberark=
codigo=
senha=
autenticadoCyberark=false
cpfStorage=
novaSenha=
novaSenha1=
alteraSenha=false
idGrupoUsuario=-1
idCFC=
idUnidTransito=-1
msgPublicacao=
forceLogout=false
```

O formulário também possui um campo visível `codigo`, produzindo duas ocorrências desse nome na submissão seguinte.

## Etapa 2 — início do login da agenda

### Request

O corpo URL-encoded segue esta ordem:

```text
method=iniciarLoginAgenda
isCyberark=
codigo=
senha=
autenticadoCyberark=false
cpfStorage=
novaSenha=
novaSenha1=
alteraSenha=false
idGrupoUsuario=-1
idCFC=
idUnidTransito=-1
msgPublicacao=
forceLogout=false
codigo=
```

O segundo `codigo` corresponde ao campo visível vazio. O `Referer` observado aponta para `/gefor/SGU/login.do?method=iniciarLogin`.

### Hidden fields da resposta

```text
method=autenticar
novaSenha=
novaSenha1=
alteraSenha=false
idGrupoUsuario=-1
idCFC=
idUnidTransito=-1
msgPublicacao=
consultaAgenda=true
autenticadoCyberark=false
```

## Reutilização da etapa 2 na etapa 3

Os dez hidden fields retornados na etapa 2 aparecem no request da etapa 3, na mesma ordem e com os mesmos valores.

**Evidência confirmada:** não existe token, identificador de sessão ou outro valor dinâmico nesses hidden fields. Todos os valores são constantes e já estão documentados.

**Decisão:** reproduzir os valores confirmados diretamente no protocolo. Não adicionar parsing de HTML, pois a captura não demonstra necessidade de extrair valor dinâmico.

## Etapa 3 — autenticação

O corpo URL-encoded segue esta ordem:

```text
method=autenticar
novaSenha=
novaSenha1=
alteraSenha=false
idGrupoUsuario=-1
idCFC=
idUnidTransito=-1
msgPublicacao=
consultaAgenda=true
autenticadoCyberark=false
codigo=<cpf>
senha=<senha>
```

O `Referer` observado aponta para `/gefor/SGU/login.do`.

A resposta contém o formulário `DivisaoEquitativaForm`, o hidden `method=consultarAgendaPsicologo` e o marcador "Imprimir Agenda Diária do Psicólogo". O identificador de usuário presente no HTML não foi registrado.

## Requests auxiliares entre as etapas

O HAR registra `GET /GFR/release.json` entre as etapas 1 e 2 e novamente entre as etapas 2 e 3. Essas chamadas são iniciadas pelo rodapé para comparar versões estáticas.

Não há evidência de cookies, redirects ou valores reutilizados dessas respostas no protocolo de autenticação. Elas não integram a sequência de três requests de login.

## Headers confirmados

O Chrome enviou:

- `Accept` de navegação HTML;
- `Accept-Language: en-US,en;q=0.9`;
- `Upgrade-Insecure-Requests: 1`;
- `User-Agent` reduzido do Chrome 150 em macOS;
- `Origin` apenas nos dois POSTs;
- `Referer` específico de cada etapa.

Os valores exatos estão descritos sem registrar credenciais ou estado de sessão.
