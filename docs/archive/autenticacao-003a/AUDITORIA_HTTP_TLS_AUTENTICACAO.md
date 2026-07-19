# Auditoria HTTP/TLS da autenticação

## Objetivo

Comparar a camada de transporte usada pelo Axios com o HAR do Chrome e localizar tecnicamente o `ECONNRESET` observado no POST `method=autenticar`.

Nenhum código de produção, arquitetura ou cliente HTTP foi alterado. A coleta usou instrumentação temporária e sanitizada dos eventos de `ClientRequest` e `TLSSocket`.

## Ambiente auditado

- Node.js `v26.5.0`;
- OpenSSL `3.6.3`;
- macOS `arm64`;
- Axios `1.18.1`;
- `axios-cookiejar-support` `7.0.0`;
- `http-cookie-agent` `8.0.0`;
- `follow-redirects` `1.16.0`;
- `tough-cookie` `6.0.2`.

## Comparação do transporte

### Chrome registrado no HAR

**Evidências confirmadas:**

- as três etapas usam HTTP/2;
- request e response registram `http/2.0`;
- as três entradas possuem o mesmo identificador de conexão, `443`;
- DNS, conexão TCP e negociação TLS aparecem como `-1` nas três entradas;
- esses campos demonstram que as etapas reutilizaram uma conexão já estabelecida;
- o HAR não registra redirects.

### Axios em Node.js

**Evidências confirmadas em nove requests instrumentados:**

- requests e responses usam HTTP/1.1;
- ALPN não negociou `h2`;
- `reusedSocket` permaneceu `false` em todos os requests;
- cada request recebeu um socket novo com `connecting=true`;
- o agente efetivo é `CookieAgent`;
- `keepAlive` está desabilitado nesse agente;
- `axios-cookiejar-support` cria um novo `HttpsCookieAgent` em cada request;
- cada etapa concluiu uma nova negociação TLS;
- `TLSSocket.isSessionReused()` retornou `false`;
- o TLS negociado foi `TLSv1.3`;
- a cifra foi `TLS_AES_128_GCM_SHA256`;
- o certificado foi autorizado;
- o SNI foi `www.e-cnhsp.sp.gov.br`;
- não existem opções explícitas de `minVersion`, `maxVersion`, `secureProtocol` ou `rejectUnauthorized` no agente.

O runtime possui defaults `TLSv1.2` a `TLSv1.3`. O agente global do Node usa keep-alive, mas ele não é o agente efetivo dos requests com CookieJar.

## Comparação dos requests

### Elementos equivalentes

- métodos, caminhos e ordem das três etapas;
- `Accept`;
- `Accept-Language`;
- `Content-Type`;
- `Origin`;
- `Referer`;
- `Upgrade-Insecure-Requests`;
- `User-Agent`;
- payload da etapa 2 com 215 bytes;
- nomes, ordem e duplicidade dos campos URL-encoded.

### Divergências confirmadas

1. **Versão HTTP**
   - Chrome: HTTP/2.
   - Axios: HTTP/1.1.

2. **Conexão**
   - Chrome: conexão HTTP/2 reutilizada.
   - Axios: um novo socket TLS por request, sem keep-alive.

3. **Headers exclusivos do HAR**
   - pseudo-headers HTTP/2;
   - `Cache-Control: no-cache`;
   - `Pragma: no-cache`;
   - `Priority`;
   - `Sec-CH-UA`, `Sec-CH-UA-Mobile` e `Sec-CH-UA-Platform`;
   - `Sec-Fetch-Dest`, `Sec-Fetch-Mode`, `Sec-Fetch-Site` e `Sec-Fetch-User`.

4. **Accept-Encoding**
   - Chrome: `gzip, deflate, br, zstd`;
   - Axios: `gzip, compress, deflate, br`.

5. **Headers gerenciados pelo protocolo**
   - Chrome usa pseudo-header `:authority`;
   - Node envia `Host` e, no wire observado durante a falha, `Connection: close`.

6. **Cookies**
   - o HAR fornecido não preservou cookies;
   - o Axios enviou `JSESSIONID`, `visid_incap_3189407` e `incap_ses_1694_3189407` nas etapas 2 e 3;
   - somente os nomes foram registrados.

7. **Tamanho do corpo final**
   - HAR: 203 bytes;
   - Axios: 200 bytes;
   - nomes e ordem dos campos coincidem;
   - a diferença está na serialização dos valores de credencial, que não foram registrados.

## Reprodução do `ECONNRESET`

Foram realizadas três execuções consecutivas com clientes novos:

- tentativa 1: as três respostas foram HTTP 200;
- tentativa 2: etapas 1 e 2 retornaram HTTP 200; etapa 3 terminou em `ECONNRESET`;
- tentativa 3: as três respostas foram HTTP 200.

Uma execução instrumentada anterior, sem alteração de código, retornou `status=sucesso`. A resposta não foi preservada e o resultado não foi reproduzido; por isso, o checkpoint posterior não o aceita como validação independente.

## Sequência de eventos na falha

No POST `method=autenticar` que falhou:

1. um socket novo foi criado;
2. `secureConnect` confirmou TLS 1.3;
3. o request emitiu `finish`;
4. `headerSent` era `true`;
5. `writableFinished` era `true`;
6. o corpo possuía 200 bytes;
7. o socket registrava 1.063 bytes escritos no momento de `finish`;
8. nenhum evento `response` ocorreu;
9. nenhum header ou primeiro chunk de resposta chegou ao parser HTTP;
10. `TLSSocket.socketOnEnd` produziu `ECONNRESET`.

O evento `finish` comprova que Node entregou headers e corpo integralmente à camada de transporte local. Sem captura de pacotes, não é possível comprovar que o peer recebeu ou processou todo o corpo.

## Erro completo

### Axios

```text
name: Error
message: socket hang up
code: ECONNRESET
syscall: ausente
errno: ausente

Error: socket hang up
    at AxiosError.from (.../node_modules/axios/dist/node/axios.cjs:1355:24)
    at RedirectableRequest.handleRequestError (.../node_modules/axios/dist/node/axios.cjs:4082:25)
    at RedirectableRequest.emit (node:events:521:24)
    at eventHandlers.<computed> (.../node_modules/follow-redirects/index.js:56:24)
    at ClientRequest.emit (node:events:509:20)
    at req.emit (.../node_modules/http-cookie-agent/dist/http/create_cookie_agent.js:86:16)
    at emitErrorEvent (node:_http_client:112:11)
    at TLSSocket.socketOnEnd (node:_http_client:771:5)
    at TLSSocket.emit (node:events:521:24)
    at Axios.request (.../node_modules/axios/dist/node/axios.cjs:5517:41)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async AuthTransport.request (.../src/client/auth-transport.ts:46:24)
    at async ECNHAuthenticationProtocol.login (.../src/client/ecnh-auth-protocol.ts:61:24)
    at async ECNHClient.login (.../src/client/ecnh-client.ts:35:20)
```

### `error.cause`

```text
name: Error
message: socket hang up
code: ECONNRESET
syscall: ausente
errno: ausente
cause: ausente

Error: socket hang up
    at TLSSocket.socketOnEnd (node:_http_client:771:25)
    at TLSSocket.emit (node:events:521:24)
    at endReadableNT (node:internal/streams/readable:1753:12)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
```

## Diagnóstico técnico

### Conclusões comprovadas

- não houve falha de DNS, conexão TCP inicial, certificado ou handshake TLS;
- o reset ocorreu depois de `secureConnect` e depois de o request terminar localmente;
- o reset ocorreu antes de qualquer resposta HTTP ser entregue ao Axios;
- o Axios recria conexão e sessão TLS a cada etapa;
- o Chrome reutiliza uma única conexão HTTP/2;
- o mesmo código produziu um `status=sucesso` não preservado, HTTP 200 sem marcador e `ECONNRESET` em execuções próximas;
- o encerramento prematuro veio do peer remoto ou de um intermediário entre o cliente e a aplicação.

### Limites da conclusão

- `ECONNRESET` e `TLSSocket.socketOnEnd` não identificam qual hop encerrou a conexão;
- sem captura de pacotes, não é possível distinguir com rigor um TCP RST de um encerramento incompatível com uma resposta HTTP completa;
- não é possível atribuir o fechamento ao portal, CDN, WAF, balanceador ou backend;
- não está comprovado que HTTP/1.1, ausência de keep-alive ou fingerprint TLS sejam a causa;
- não está comprovado que o servidor tenha processado o POST antes de fechar a conexão.

### Síntese

A causa local imediata é o término do socket TLS pelo lado remoto antes do recebimento de headers HTTP, após o envio local completo do POST. A divergência estrutural mais relevante é que o Chrome usa HTTP/2 sobre conexão reutilizada, enquanto o Axios usa HTTP/1.1 sobre uma nova conexão TLS em cada etapa. A intermitência impede afirmar causalidade entre essa divergência e o reset.

A investigação subsequente de keep-alive, agentes, timeout, retry, concorrência e ciclo do CookieJar está em [ROBUSTEZ_AUTENTICACAO_HTTP.md](ROBUSTEZ_AUTENTICACAO_HTTP.md).

## Experimento posterior com conexão persistente

O transporte passou a reutilizar um único `HttpCookieAgent` e um único `HttpsCookieAgent`, com `keepAlive=true` e `maxSockets=1`.

Uma captura confirmou o mesmo socket nas três etapas e `reusedSocket=true` nos dois POSTs. Em vinte execuções consecutivas, não ocorreu `ECONNRESET`, mas nenhuma autenticação foi confirmada. Portanto, a conexão persistente estabilizou o transporte na amostra, sem estabilizar o resultado funcional.
