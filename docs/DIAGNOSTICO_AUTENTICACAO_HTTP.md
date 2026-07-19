# Diagnóstico da autenticação HTTP

## Objetivo

Explicar a evolução do `ECNHClient` até reproduzir o fluxo completo confirmado pelo HAR de login bem-sucedido.

**Status da Fase 003A:** `Implementada`

Consulte também a [matriz de divergências](MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md), que compara cada etapa do navegador e do `ECNHClient` e classifica diferenças como confirmadas, hipóteses ou eliminadas.

## Comparação disponível

### Protocolo implementado

**Evidências confirmadas no código e na execução real:**

- o CookieJar começa vazio;
- é executado `GET /gefor/SGU/login.do?method=iniciarLogin`;
- em seguida é enviado o POST `method=iniciarLoginAgenda`;
- por último é enviado o POST `method=autenticar`;
- os dois POSTs usam `application/x-www-form-urlencoded`;
- os corpos reproduzem campos, duplicidades, valores estáticos e ordem do HAR;
- além de `Content-Type`, o transporte configura `Accept`, `Accept-Language`, `Origin`, `Referer`, `Upgrade-Insecure-Requests` e `User-Agent`;
- o mesmo CookieJar é preservado nas três etapas;
- Axios segue até cinco redirecionamentos;
- sucesso exige simultaneamente `JSESSIONID` e o marcador "Imprimir Agenda Diária do Psicólogo".

### Protocolo do navegador documentado

**Evidências confirmadas:**

- o HAR contém exatamente três requests `login.do`, na ordem GET → POST → POST;
- os dois formulários eram URL-encoded;
- não houve redirects;
- os corpos e os HTMLs das três etapas foram preservados;
- o HAR não preservou cookies de request ou response;
- o fluxo manual bem-sucedido chegou ao HTML "Imprimir Agenda Diária do Psicólogo".

O contrato completo está em [EVIDENCIA_HAR_AUTENTICACAO.md](EVIDENCIA_HAR_AUTENTICACAO.md).

## Hipóteses ordenadas por probabilidade

### 1. `iniciarLoginAgenda` faz parte do fluxo atual

**Classificação:** confirmada pelo HAR.

**Evidências:**

- a etapa 2 é `POST /gefor/SGU/login.do`;
- o primeiro campo do corpo é `method=iniciarLoginAgenda`;
- a resposta HTTP 200 contém o formulário usado na etapa 3.

A ausência de chamador identificado em `login.js` não prevalece sobre a execução registrada no Network.

### 2. Falta a sequência criada antes do POST final

**Classificação:** divergência confirmada e corrigida no código.

**Evidências confirmadas:**

- o navegador executa `GET method=iniciarLogin` antes dos POSTs;
- o navegador executa `POST method=iniciarLoginAgenda` antes de `autenticar`;
- o cliente anterior iniciava diretamente em `autenticar`;
- o cliente agora reproduz as três etapas com o mesmo CookieJar.

**Limite da evidência:**

- o HAR não preservou cookies;
- a validação real do cliente encontrou `ECONNRESET` antes de obter a terceira resposta.

### 3. O payload implementado difere do HAR

**Classificação:** eliminada no código após a captura do HAR.

**Evidências confirmadas:**

- a etapa 2 reproduz os quinze controles, incluindo as duas ocorrências de `codigo`;
- a etapa 3 reproduz os doze controles;
- nomes, valores estáticos e ordem coincidem com o HAR;
- os dez hidden fields da resposta 2 são reutilizados na etapa 3;
- nenhum hidden dinâmico foi observado.

**Resultado da validação real:**

- a etapa 2 enviada pelo cliente possui os mesmos 215 bytes registrados no HAR;
- a validação alcançou HTTP 200 nas duas primeiras etapas;
- a conexão foi encerrada na etapa 3 antes de uma resposta conclusiva.

### 4. O portal valida `Origin`, `Referer` ou contexto de navegação

**Classificação:** valores confirmados no HAR e alinhados no cliente.

**Evidências confirmadas:**

- o GET não envia `Origin` e usa a raiz do portal como `Referer`;
- o POST da etapa 2 usa a URL do GET como `Referer`;
- o POST da etapa 3 usa `/gefor/SGU/login.do` como `Referer`;
- os dois POSTs enviam a origem do portal.

### 5. A conta ou credencial recebeu um resultado não classificado

**Probabilidade:** média-baixa.

**Hipótese:** o portal rejeitou a tentativa por senha, bloqueio, perfil ou condição operacional sem expor uma mensagem no HTML processado.

**Evidências que suportam:**

- o retorno ao formulário é compatível com falha de autenticação;
- os sinais de senha inválida, bloqueio e erro do sistema nunca foram capturados;
- não há evidência registrada de login manual bem-sucedido com a mesma configuração no mesmo momento da tentativa HTTP.

**Evidências necessárias:**

- confirmar login manual autorizado com a mesma conta no momento da captura;
- capturar respostas sanitizadas de sucesso e falha;
- identificar mensagens em scripts, frames ou requests auxiliares.

### 6. Headers de representação ou identificação alteram o tratamento

**Classificação:** perfil principal testado sem alteração de resposta.

**Evidências confirmadas:**

- `Accept` passou do padrão de API do Axios para o valor de navegação HTML do Chrome;
- `Accept-Language` foi alinhado a `en-US,en;q=0.9`;
- `User-Agent` passou a identificar Chrome 150 em macOS;
- `Upgrade-Insecure-Requests: 1` foi incluído;
- o request efetivo continha todos os valores configurados;
- o HAR confirmou os valores do Chrome 150 em cada etapa.

**Conclusão:** os principais headers estão alinhados à captura.

**Limite:** `Sec-CH-UA` e `Sec-Fetch-*` permanecem fora do conjunto solicitado e não foram adicionados.

### 7. A função `login()` transforma o POST antes da submissão

**Classificação:** eliminada no caminho disparado pelo clique em "Acessar".

**Evidências confirmadas:**

- o elemento é `<a href="#" onclick="login();" class="login">`;
- o formulário declara `method="post"`, `action="/gefor/SGU/login.do"` e `onsubmit="return validateForm();"`;
- o hidden `method` já possui `value="autenticar"`;
- `/GFR/js/app/sgu/login.js`, linhas 37–43, mostra que `login()` apenas obtém o formulário, chama `validateForm()`, exibe a espera e executa `form.submit()`;
- `fieldsValidate()`, linhas 65–67, apenas retorna `true`;
- o `validateLoginActionForm()` definido no mesmo HTML também retorna `true`;
- nenhuma dessas funções altera CPF, senha, hidden fields, `action`, método HTTP ou `enctype`.

**Transformação fora de `login()`:**

- o campo `codigo` chama `removeCaracs(this,'cpf')` em `onfocus`;
- o mesmo campo chama `formatCamp(this,'cpf')` em `onblur`;
- `/GFR/js/commons/validate.js` confirma que essas funções reescrevem o valor sem máscara e com máscara, respectivamente;
- sem o registro da sequência de eventos anterior ao clique, não é possível determinar somente pelo código qual representação foi serializada.

**Divergências de payload confirmadas pelo HTML:**

- o formulário inclui `novaSenha`, `novaSenha1` e `msgPublicacao`;
- `idCFC` está vazio;
- a ordem dos controles está documentada.

Essas divergências foram corrigidas no cliente em 18/07/2026.

**Limite remanescente:** a implementação de `top.showWait()` não foi localizada nos arquivos de login analisados.

**Fluxo distinto confirmado:** pressionar ENTER executa `onEnter()`, mas o HTML fornecido não contém `id="isCyberarkValue"`, `id="cpf"` nem `id="senha"`. No DOM estático documentado, a leitura de `isCyberarkValue.value` interrompe a execução antes de qualquer submit. As funções `submitAutenticar()` e `submitVerificarCyberark()` alterariam `form.action` somente se fossem alcançadas em um DOM que contivesse os elementos esperados. Nenhuma criação inline desses IDs foi encontrada.

## Risco secundário confirmado: codificação do HTML

O portal respondeu `text/html;charset=ISO-8859-1`. Axios entregou a resposta textual como UTF-8, produzindo caracteres inválidos no título, enquanto a decodificação ISO-8859-1 resultou em "eCNHsp - DETRAN - São Paulo".

Isso não explica o retorno do formulário de login, confirmado também pela estrutura HTML. Porém, pode causar falso negativo no marcador autenticado, pois "Diária" e "Psicólogo" contêm caracteres acentuados. O tratamento de charset deve ser validado quando uma resposta autenticada for obtida.

## Evidências ainda necessárias

Coletar um HAR sanitizado de login manual bem-sucedido contendo:

1. página de entrada e toda a sequência até a página autenticada;
2. o POST `method=autenticar` preservado integralmente;
3. método, URL, status, initiator e redirects;
4. nomes e atributos dos cookies antes e depois do POST;
5. nomes, ordem, duplicidade e valores não sensíveis dos campos;
6. `Origin`, `Referer`, `Accept`, `Accept-Language`, `User-Agent` e `Content-Type`;
7. charset, título e marcador de cada resposta;
8. confirmação de que a mesma conta concluiu o login manualmente.

Nunca registrar valores de CPF, senha, cookies, tokens ou dados pessoais.

## Plano recomendado

1. Abrir uma sessão limpa do navegador, habilitar Preserve log e desabilitar cache.
2. Executar um login manual autorizado e confirmar visualmente a página final.
3. Exportar HAR sanitizado e o POST `method=autenticar` como cURL, removendo segredos.
4. Comparar payload, headers e cookies com a [auditoria do cliente](AUDITORIA_POST_AUTENTICAR.md).
5. Identificar o primeiro ponto em que browser e cliente divergem.
6. Definir a menor correção sustentada por evidência, incluindo charset se necessário.
7. Executar novamente `npm run test:login`.
8. Promover a fase para `Validada` somente quando `JSESSIONID` e o marcador autenticado forem confirmados; promover para `Concluída` após resolver pendências bloqueantes e atualizar toda a documentação.
