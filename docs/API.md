# Integração e-CNH: mapa de protocolo

## Status da evidência

As informações identificadas como **fato observado** foram vistas diretamente no Chrome DevTools durante a engenharia reversa. Itens identificados como **pendente de confirmação** não devem ser usados para criar contratos ou código de produção.

## Regras para a descoberta autorizada

- Use somente uma conta autorizada e o ambiente oficial indicado pelo responsável do projeto.
- Preserve uma cópia local do HAR sanitizado: remova valores de `Cookie`, `Set-Cookie`, `Authorization`, CPF, senha, paciente e qualquer identificador pessoal.
- Documente método, caminho, nomes de parâmetros, códigos de resposta, redirecionamentos e atributos de cookie; nunca valores sensíveis.

## Autenticação

### Fatos observados

```text
GET  /gefor/SGU/login.do?method=iniciarLogin
POST /gefor/SGU/login.do • method=iniciarLoginAgenda
POST /gefor/SGU/login.do • method=autenticar
  -> três respostas HTTP 200 sem redirects
  -> HTML "Imprimir Agenda Diária do Psicólogo" na resposta final
```

| Elemento                 | Fato observado                                                                                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Método e caminho         | sequência GET → POST → POST em `/gefor/SGU/login.do`                                                                                                                                                                             |
| Corpo                    | `application/x-www-form-urlencoded`                                                                                                                                                                                              |
| Parâmetros observados    | `method=autenticar`, `novaSenha=`, `novaSenha1=`, `alteraSenha=false`, `idGrupoUsuario=-1`, `idCFC=`, `idUnidTransito=-1`, `msgPublicacao=`, `consultaAgenda=true`, `autenticadoCyberark=false`, `codigo=<cpf>`, `senha=<senha>` |
| Resposta                 | HTML completo, não JSON                                                                                                                                                                                                          |
| Estilo de integração     | SSR e navegação por formulários HTML tradicionais                                                                                                                                                                                |
| Página após autenticação | contém "Imprimir Agenda Diária do Psicólogo"                                                                                                                                                                                     |

O cliente reproduz as três etapas, os corpos URL-encoded e a ordem observada. Consulte a [evidência HAR](EVIDENCIA_HAR_AUTENTICACAO.md).

### Headers de navegação configurados

O `AuthTransport` reproduz os seguintes headers principais de um Chrome em navegação HTML:

- `Accept`: formatos aceitos por uma navegação de documento;
- `Accept-Language: en-US,en;q=0.9`, conforme o HAR;
- `Origin`: derivado de `ECNH_BASE_URL`;
- `Referer`: valor específico de cada uma das três etapas;
- `Upgrade-Insecure-Requests: 1`;
- `User-Agent`: identificador reduzido do Chrome 150 em macOS.

O HAR confirmou os valores do Chrome. `Origin` está ausente no GET e presente nos dois POSTs.

### Pendências para a Fase 003A — Autenticação HTTP

| Item                                                     | Estado                             |
| -------------------------------------------------------- | ---------------------------------- |
| URL base oficial, página de entrada e redirecionamentos  | Confirmados no HAR                 |
| Todos os campos do formulário e valores ocultos          | Confirmados no HAR e implementados |
| Token CSRF ou hidden dinâmico entre as etapas            | Não observado no HAR               |
| Critério verificável de sucesso além do título observado | Pendente de confirmação            |
| Respostas para credenciais inválidas e sessão expirada   | Pendente de confirmação            |
| Endpoint, método e efeito do logout                      | Pendente de confirmação            |

## Sessão e cookies

**Fato observado:** o portal usa sessão baseada em cookies e foi observado o cookie `JSESSIONID`. Todo fluxo de navegação futuro deverá preservar o mesmo CookieJar entre requisições relacionadas.

Ainda devem ser confirmados domínio, `Path`, `Secure`, `HttpOnly`, `SameSite`, expiração, rotação e o comportamento de sessão expirada. Não inferir esses atributos a partir do nome do cookie.

## Endpoints identificados

| Operação                  | Método     | Caminho                                   | Parâmetros obrigatórios                      | Resposta          | Estado         |
| ------------------------- | ---------- | ----------------------------------------- | -------------------------------------------- | ----------------- | -------------- |
| Início do login           | `GET`      | `/gefor/SGU/login.do?method=iniciarLogin` | `method=iniciarLogin`                        | HTML completo SSR | Fato observado |
| Início do login da agenda | `POST`     | `/gefor/SGU/login.do`                     | `method=iniciarLoginAgenda` e formulário     | HTML completo SSR | Fato observado |
| Autenticação              | `POST`     | `/gefor/SGU/login.do`                     | `method=autenticar`, CPF, senha e formulário | HTML completo SSR | Fato observado |
| Página protegida inicial  | A observar | A observar                                | A observar                                   | A observar        | Pendente       |
| Descoberta de datas       | A observar | A observar                                | A observar                                   | A observar        | Pendente       |
| Consulta de agenda        | A observar | A observar                                | A observar                                   | A observar        | Pendente       |
| Logout                    | A observar | A observar                                | A observar                                   | A observar        | Pendente       |

## Navegação e HTML

**Fato observado:** depois da autenticação bem-sucedida, o próprio HTML retornado contém a página "Imprimir Agenda Diária do Psicólogo". Isso sustenta que a navegação ocorre por formulários HTML tradicionais; nenhuma API REST foi observada.

As próximas fases devem descobrir quais endpoints consultam a agenda, parâmetros de pesquisa, como trocar a Data de Agendamento, como obter datas disponíveis, quais requisições realmente retornam agenda e quais tabelas HTML contêm pacientes.

## Pontos de falha a tratar

- credenciais inválidas, bloqueio temporário ou desafio adicional de autenticação;
- campos ocultos/CSRF ausentes, expirados ou alterados;
- sessão expirada, cookie rotacionado ou resposta de login disfarçada como `200 OK`;
- redirecionamentos inesperados e mudança de domínio;
- limites de taxa, timeout e indisponibilidade do portal;
- alteração de HTML, texto, IDs ou estrutura de tabelas;
- conteúdo pessoal em logs, erros, HARs ou fixtures.

## Implementação da Fase 003A

O `ECNHClient` implementa a sequência GET → POST → POST confirmada no HAR. Os dois POSTs usam `Content-Type` URL-encoded. `tough-cookie`, `HttpCookieAgent` e `HttpsCookieAgent` preservam o mesmo CookieJar e os mesmos agentes entre as três requisições.

O login só é classificado como sucesso quando os dois sinais confirmados estão presentes: cookie `JSESSIONID` e o marcador HTML "Imprimir Agenda Diária do Psicólogo". Ausência desses sinais é retornada como `erro desconhecido`; senha inválida e usuário bloqueado continuam sem mapeamento porque seus sinais HTTP/HTML não foram confirmados.

O endpoint de logout permanece pendente. Atualmente, `logout()` descarta a sessão local sem enviar requisição HTTP ao portal.

## Validação real da Fase 003A em 18/07/2026

**Evidências confirmadas:**

- as variáveis obrigatórias do `.env` foram carregadas;
- o cliente executou o GET inicial e o POST `iniciarLoginAgenda` na ordem confirmada;
- a primeira tentativa encontrou `ECONNRESET` na etapa 2;
- a segunda tentativa recebeu HTTP 200 nas etapas 1 e 2, mas encontrou `ECONNRESET` na etapa 3;
- o log de erro foi restringido a nome, código e mensagem para impedir exposição de request, credenciais e cookies.
- uma execução instrumentada posterior retornou `status=sucesso`, sem preservar a resposta;
- três novas execuções alternaram entre HTTP 200 e `ECONNRESET` na etapa final.

O fluxo implementado coincide com o HAR. Uma execução retornou `status=sucesso`, mas não preservou a resposta e não foi reproduzida. A Fase 003A está `Implementada`.

**Pendência:** esclarecer ou estabilizar o encerramento intermitente da conexão antes de concluir a fase.

As lacunas restantes estão no [diagnóstico da autenticação](DIAGNOSTICO_AUTENTICACAO_HTTP.md). A comparação exata do request produzido pelo cliente está na [auditoria do POST `method=autenticar`](AUDITORIA_POST_AUTENTICAR.md).
