# Robustez da autenticação HTTP

## Objetivo

Analisar exclusivamente por que execuções idênticas do protocolo já validado alternam entre autenticação bem-sucedida, resposta HTTP 200 sem marcador e `ECONNRESET`.

Payload, JavaScript, HTML, hidden fields, headers, HAR e sequência GET → POST → POST estão encerrados e não fazem parte desta investigação.

Esta análise definiu uma única hipótese para experimento: preservar agentes e conexão. A implementação e o resultado da bateria estão registrados ao final.

## Escopo auditado

- reutilização de conexão;
- keep-alive;
- timeout;
- retry;
- concorrência e race conditions;
- fechamento de sockets;
- ciclo do CookieJar;
- ciclo da instância Axios;
- agentes HTTP e HTTPS;
- comportamento do `CookieAgent`;
- comparação entre sucesso e reset.

## Linha de base anterior ao experimento

## 1. Reutilização de conexão

**Evidência confirmada:** não existe reutilização de conexão no fluxo atual.

Em nove requests instrumentados:

- `reusedSocket` foi `false`;
- cada request recebeu `connecting=true`;
- cada request executou `secureConnect`;
- `TLSSocket.isSessionReused()` foi `false`.

A mesma instância `AuthTransport` executa as três etapas, mas cada request usa socket e sessão TLS novos.

## 2. Keep-alive

**Evidência confirmada:** o agente efetivo possui `keepAlive=false`.

O `AuthTransport` não configura agentes diretamente. `axios-cookiejar-support` instala um interceptor que cria, em cada request:

```text
new HttpCookieAgent({ cookies: { jar } })
new HttpsCookieAgent({ cookies: { jar } })
```

Como o wrapper não fornece `keepAlive: true`, o `CookieAgent` efetivo não mantém o socket após a resposta. O wire observado contém `Connection: close`.

O agente global do Node.js possui keep-alive, mas não participa desses requests.

## 3. Timeout

**Evidência confirmada:** o timeout configurado é de 30 segundos.

O reset observado ocorreu em centenas de milissegundos, com:

- `code=ECONNRESET`;
- ausência de `ECONNABORTED` ou `ETIMEDOUT`;
- ausência do handler de timeout no stack;
- `secureConnect` e `request.finish` já concluídos.

**Conclusão:** timeout não explica a intermitência observada.

## 4. Retry involuntário

**Evidência confirmada:** não existe retry automático.

- o projeto não usa `axios-retry`;
- não há interceptor de response que repita requests;
- não há loop de retry no protocolo;
- `follow-redirects` trata redirects, não retries;
- o HAR e a execução real não apresentaram redirects;
- cada tentativa instrumentada produziu exatamente três requests.

`maxRedirects: 5` não repete um request que termina em `ECONNRESET`.

## 5. Race conditions

**Evidência confirmada no fluxo testado:** as etapas são estritamente sequenciais.

Cada `transport.request()` é aguardado com `await` antes de iniciar a próxima etapa. Não há promessa concorrente, callback pendente ou request em paralelo no protocolo.

O `CookieAgent` salva `Set-Cookie` de forma síncrona no evento `response`, antes de repassar esse evento ao Axios. A leitura do CookieJar para o request seguinte também é síncrona.

**Risco não relacionado às falhas observadas:** `ECNHClient.login()` não possui exclusão mútua. Duas chamadas simultâneas no mesmo cliente compartilhariam Axios e CookieJar. As reproduções auditadas foram sequenciais e usaram clientes novos, portanto esse risco não causou o reset registrado.

## 6. Fechamento prematuro de sockets

**Evidências confirmadas no request que falhou:**

- TLS 1.3 foi negociado;
- `headerSent=true`;
- `writableFinished=true`;
- `request.finish` ocorreu;
- o corpo completo foi entregue à camada local;
- nenhum evento `response` ocorreu;
- nenhum header ou chunk de resposta chegou ao Axios;
- `TLSSocket.socketOnEnd` gerou `ECONNRESET`.

Não existe chamada da aplicação a `abort()` ou `destroy()`. O timeout não expirou. `CookieAgent` somente chama `req.destroy()` quando ocorre erro ao ler ou salvar cookies; nenhum erro de CookieJar foi registrado.

**Conclusão:** não há evidência de fechamento prematuro iniciado pelo cliente. O socket terminou pelo peer remoto ou por um intermediário.

## 7. Descarte do CookieJar

**Evidência confirmada:** o CookieJar não é descartado durante o protocolo.

- um `SessionManager` e um CookieJar são criados por `ECNHClient`;
- as três etapas compartilham esse mesmo objeto;
- cookies recebidos são salvos antes do request seguinte;
- `SessionManager.clear()` só é chamado depois que o protocolo retorna falha;
- em caso de sucesso, o CookieJar é mantido;
- em caso de falha, o descarte ocorre depois do `ECONNRESET`, não antes.

**Conclusão:** o descarte do CookieJar não causa o reset.

## 8. Reuso da instância Axios

**Evidência confirmada:** a instância Axios é criada uma vez no construtor do `AuthTransport` e reutilizada nas três etapas.

Entretanto, o interceptor do `axios-cookiejar-support` substitui `httpAgent` e `httpsAgent` em cada request. Portanto:

- Axios é reutilizado;
- CookieJar é reutilizado;
- HTTP Agent não é reutilizado;
- HTTPS Agent não é reutilizado;
- socket não é reutilizado.

## 9. HTTP Agent e HTTPS Agent

As opções efetivas observadas foram:

```text
classe: CookieAgent
keepAlive: false
keepAliveMsecs: 1000
maxSockets: Infinity
maxFreeSockets: 256
maxCachedSessions: 100
scheduling: lifo
```

Não existem opções TLS explícitas de versão mínima, versão máxima, `secureProtocol` ou `rejectUnauthorized`. O runtime negociou TLS 1.3 com certificado autorizado.

## 10. Comportamento do CookieAgent

O `CookieAgent`:

1. lê o CookieJar de forma síncrona antes de gerar o header;
2. combina cookies explícitos com os cookies do jar;
3. salva `Set-Cookie` de forma síncrona quando recebe `response`;
4. destrói o request somente se o processamento local de cookies lançar erro;
5. delega a abertura da conexão ao `https.Agent`.

Não foi registrado erro de parsing ou persistência de cookie.

O comportamento relevante para robustez não está na manipulação dos cookies, mas no wrapper criar um agente novo sem keep-alive para cada request.

## 11. Sucesso versus `ECONNRESET`

Até o ponto de envio, execuções bem-sucedidas e falhas foram equivalentes:

- cliente e protocolo iguais;
- CookieJar novo por tentativa;
- três etapas sequenciais;
- agente `CookieAgent`;
- `keepAlive=false`;
- socket novo;
- `reusedSocket=false`;
- TLS 1.3;
- ALPN sem HTTP/2;
- handshake concluído;
- headers enviados;
- corpo final de 200 bytes;
- `request.finish` concluído.

A primeira diferença observável aparece após o envio:

- sucesso: o cliente recebe headers HTTP 200 e o corpo;
- falha: o socket termina sem nenhum evento `response`.

Em execuções próximas, o mesmo código produziu:

- autenticação confirmada;
- HTTP 200 sem marcador autenticado;
- `ECONNRESET`.

Essa variação após o envio, sem variação local anterior detectada, aponta para comportamento intermitente fora do processo Node.js.

## Hipótese mais provável

**Hipótese com maior sustentação:** a criação de três conexões TLS independentes e rápidas para uma única transação de login reduz a afinidade no caminho remoto e aciona comportamento intermitente em um componente de borda.

Evidências que sustentam:

- o Chrome preserva uma única conexão HTTP/2 durante o fluxo;
- o Axios abre três conexões HTTP/1.1 independentes;
- o portal entrega cookies com nomes associados à infraestrutura Imperva;
- o reset ocorre no último POST, depois do envio e antes da resposta;
- o mesmo request pode receber HTTP 200 ou ser encerrado;
- nenhum mecanismo local de timeout, retry, concorrência ou descarte de sessão explica a alternância.

**Limite:** não está comprovado que a ausência de keep-alive seja a causa. A evidência não distingue CDN, WAF, balanceador, afinidade de backend ou aplicação.

## Hipóteses secundárias

1. **Instância remota ou rota de balanceamento instável.**
   Uma conexão nova em cada etapa pode alcançar caminhos diferentes. Não há identificação de backend na evidência disponível.

2. **Política intermitente de proteção automatizada.**
   Os cookies de infraestrutura e o fechamento sem resposta são compatíveis, mas não comprovam bloqueio pelo WAF.

3. **Falha transitória do backend.**
   Continua possível, porém não há resposta HTTP, log servidor ou identificador de instância que a confirme.

## Hipóteses eliminadas para o reset observado

- timeout de 30 segundos;
- retry automático;
- redirect;
- concorrência entre as três etapas;
- descarte do CookieJar durante o fluxo;
- recriação da instância Axios;
- falha no handshake TLS;
- erro local do `CookieAgent`;
- fechamento explícito do socket pela aplicação.

## Experimento implementado

Foi alterada somente a infraestrutura do `AuthTransport`:

1. um único `HttpCookieAgent` e um único `HttpsCookieAgent` são criados por instância;
2. ambos usam o CookieJar existente;
3. `keepAlive` foi habilitado;
4. `maxSockets` foi limitado a `1`;
5. os mesmos agentes são reutilizados nas três etapas;
6. o wrapper que recriava agentes foi removido.

Essa mudança não altera payload, headers funcionais ou sequência de autenticação.

### Confirmação da conexão

Uma execução instrumentada confirmou:

- etapa 1: `reusedSocket=false`, socket 1;
- etapa 2: `reusedSocket=true`, socket 1;
- etapa 3: `reusedSocket=true`, socket 1;
- `CookieAgent` com `keepAlive=true`;
- `maxSockets=1`.

## Bateria de validação

Foram executadas vinte chamadas consecutivas de `npm run test:login`, cada uma em processo novo.

Resultados:

- total: 20;
- sucessos: 0;
- falhas: 20;
- `ECONNRESET`: 0;
- taxa de sucesso: 0%;
- tempo médio: 582 ms;
- tempo mínimo: 469 ms;
- tempo máximo: 793 ms.

Uma execução adicional confirmou HTTP 200 nas três etapas, `JSESSIONID` presente e ausência do marcador autenticado.

## Comparação antes e depois

### Antes

A linha de base disponível reúne seis execuções instrumentadas ou registradas durante a auditoria anterior:

- `status=sucesso` reportado: 1, sem resposta preservada;
- falhas: 5;
- `ECONNRESET`: 3;
- respostas sem autenticação: 2;
- taxa de sucesso reportada pelo cliente: 16,67%;
- taxa de `ECONNRESET`: 50%.

Os tempos agregados dessa linha de base não foram preservados. A amostra anterior possui seis execuções, enquanto a bateria posterior possui vinte; a comparação de taxa deve considerar essa diferença e a ausência de artefato da única classificação positiva.

### Depois

- taxa de sucesso: 0%;
- taxa de `ECONNRESET`: 0%;
- vinte falhas sem reset.

## Conclusão objetiva

O reuso dos agentes e da conexão eliminou `ECONNRESET` na bateria de vinte execuções e tornou o transporte determinístico nesse aspecto. Entretanto, não estabilizou a autenticação: a taxa de sucesso caiu de 16,67% na amostra anterior para 0% na bateria posterior.

A hipótese foi confirmada apenas para o sintoma de conexão, não para o objetivo funcional do login. Não foram adicionados retries, workarounds ou outras alterações.

## Resultado

A implementação preserva Axios, CookieJar, agentes e socket durante as três etapas. Em 19/07/2026, a validação reproduzível aprovou cinco autenticações distintas com evidência sanitizada; a Fase 003A está `Validada`. Consulte [VALIDACAO_REPRODUZIVEL_003A.md](VALIDACAO_REPRODUZIVEL_003A.md).
