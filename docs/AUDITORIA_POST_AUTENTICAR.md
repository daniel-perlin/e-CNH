# Auditoria do POST `method=autenticar`

## Objetivo

Comparar rigorosamente o POST final enviado pelo `ECNHClient` com a etapa `method=autenticar` do fluxo completo confirmado no HAR.

**Status da Fase 003A:** `Implementada`

## Evidência superveniente sobre `iniciarLoginAgenda`

O arquivo `/GFR/js/app/sgu/login.js` contém:

```javascript
function loginAgenda() {
  myForm.method.value = 'iniciarLoginAgenda';
  myForm.submit();
}
```

A busca global encontrou apenas a definição da função e a atribuição do valor. Essa evidência de código, isoladamente, não comprovava execução.

**Evidência posterior decisiva:** o HAR completo registra `POST /gefor/SGU/login.do` com `method=iniciarLoginAgenda` como etapa 2, entre `GET method=iniciarLogin` e `POST method=autenticar`. A execução no Network prevalece sobre a ausência de chamador identificado no arquivo. Consulte [EVIDENCIA_HAR_AUTENTICACAO.md](EVIDENCIA_HAR_AUTENTICACAO.md).

## 1. Payload enviado pelo cliente

O cliente usa `URLSearchParams` e envia, nesta ordem:

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

CPF e senha são codificados conforme `application/x-www-form-urlencoded`. O cliente valida apenas que não estejam vazios; não normaliza nem altera os valores recebidos.

O HTML completo do formulário "Acesso à Agenda Diária do Perito" contém, nesta ordem:

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

O formulário declara `method="post"`, `action="/gefor/SGU/login.do"` e não declara `enctype`. O submit HTML usa, portanto, o tipo padrão `application/x-www-form-urlencoded`.

**Comparação confirmada após o ajuste de 18/07/2026:** método, caminho, Content-Type, nomes, valores estáticos e ordem dos doze campos coincidem com o HTML fornecido. Nesse HTML há apenas um campo `codigo`.

### Validação real após o ajuste

`npm run test:login` recebeu HTTP 200 e `JSESSIONID`, mas retornou `erro_desconhecido`.

A comparação estrutural em ISO-8859-1 registrou:

- antes do ajuste: página autenticada, sem `LoginActionForm` e com o marcador "Imprimir Agenda Diária do Psicólogo";
- depois do ajuste: página inicial de login, com `LoginActionForm`, título "eCNHsp - DETRAN - São Paulo" e texto "Digite seu CPF para acessar sua conta:";
- o HTML mudou de 72.162 para 28.696 caracteres;
- o marcador autenticado ficou ausente após o ajuste.

As duas requisições foram sequenciais contra estado externo real. A evidência confirma respostas diferentes, mas não isola o payload como única variável do ambiente.

## 2. Headers enviados

O transporte configura explicitamente:

```text
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7
Accept-Language: en-US,en;q=0.9
Content-Type: application/x-www-form-urlencoded
Origin: <origem de ECNH_BASE_URL> nos POSTs; ausente no GET
Referer: específico de cada etapa
Upgrade-Insecure-Requests: 1
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36
```

Motivação de cada header:

- `Accept`: reproduzir uma navegação de documento HTML, em vez do padrão de API do Axios;
- `Accept-Language`: reproduzir o valor confirmado no HAR;
- `Origin`: identificar a origem HTTP do portal, derivada da URL base;
- `Referer`: reproduzir a página anterior registrada em cada etapa;
- `Upgrade-Insecure-Requests`: reproduzir a preferência enviada pelo Chrome em navegações;
- `User-Agent`: substituir `axios/<versão>` pelo identificador reduzido do Chrome 150 em macOS.

Axios continua gerando automaticamente `Content-Length`, `Accept-Encoding`, `Host` e `Connection`. Nenhum header `Sec-CH-UA` ou `Sec-Fetch-*` foi adicionado, pois não fazia parte do escopo.

### Resultado do experimento de Browser Fingerprint

Os headers efetivos foram inspecionados em `response.config.headers` e coincidiram com os valores acima.

Comparação da resposta antes e depois do ajuste:

```text
HTTP: 200 → 200
Tamanho: 28.696 bytes → 28.696 bytes
SHA-256: 6baae6f28e5e48bda015544c007143bd96cfaf666866977b017be8ff5228be63 → mesmo valor
LoginActionForm: presente → presente
Marcador autenticado: ausente → ausente
```

`npm run test:login` continuou retornando `erro_desconhecido`, apesar de `JSESSIONID` estar presente. Portanto, o conjunto de headers testado não alterou a resposta.

**Comparação confirmada pelo HAR:** `Accept`, `Accept-Language`, `Origin`, `Referer`, `Upgrade-Insecure-Requests` e `User-Agent` foram preservados e alinhados no cliente.

## 3. Cookies preservados

Cada instância de `ECNHClient` cria um `SessionManager`, que cria um CookieJar vazio.

No fluxo completo de um cliente novo:

- não existe cookie antes do GET inicial;
- cookies recebidos por `Set-Cookie` são armazenados automaticamente;
- os dois POSTs reutilizam os cookies recebidos nas etapas anteriores;
- a execução real confirmou o recebimento de `JSESSIONID` e cookies de infraestrutura no GET;
- o protocolo consulta a presença de `JSESSIONID` antes de retornar o resultado.

Se o login não for confirmado, `ECNHClient.login()` chama `SessionManager.clear()` e remove todos os cookies. Se houver sucesso, a sessão e o CookieJar permanecem na instância. `logout()` também remove todos os cookies localmente.

**Limite do HAR:** cookies e `Set-Cookie` não foram preservados na captura. Não é possível comparar nomes ou rotação, mas o requisito de manter o mesmo CookieJar permanece atendido.

## 4. Uso do CookieJar

`HttpCookieAgent` e `HttpsCookieAgent` associam o mesmo CookieJar à instância Axios durante toda a vida do `ECNHClient`.

O comportamento confirmado é:

1. cookies compatíveis com URL, domínio e Path são enviados automaticamente;
2. respostas `Set-Cookie` atualizam o jar;
3. requests posteriores na mesma instância reutilizam os cookies;
4. `hasCookie()` consulta o jar usando a URL base;
5. falha de login ou logout limpa o jar.

A preservação do CookieJar foi comprovada e não explica isoladamente a falha. A presença de `JSESSIONID`, porém, comprova somente sessão HTTP, não autenticação.

## 5. Tratamento de redirects

O transporte configura:

```text
maxRedirects: 5
validateStatus: () => true
```

Consequências:

- Axios segue redirects automaticamente até o limite;
- o código recebe e registra apenas a resposta final;
- respostas HTTP finais de erro não geram exceção apenas pelo status;
- falha de transporte ou excesso de redirects gera erro;
- a execução real do POST terminou em HTTP 200 sem redirect.

**Comparação pendente:** o status e a eventual cadeia de redirects do POST bem-sucedido do navegador não foram registrados.

## 6. Interpretação do charset

O protocolo solicita `response.data` como `string`. Axios usa UTF-8 como codificação textual padrão e não converte automaticamente o corpo conforme `charset=ISO-8859-1`.

Na execução real:

- o servidor declarou `text/html;charset=ISO-8859-1`;
- a leitura UTF-8 corrompeu caracteres acentuados;
- a decodificação ISO-8859-1 produziu corretamente o título "eCNHsp - DETRAN - São Paulo";
- o marcador contém caracteres acentuados em "Diária" e "Psicólogo".

**Divergência confirmada:** o navegador interpreta ISO-8859-1, enquanto o cliente atualmente verifica o marcador sobre uma string UTF-8. Isso pode produzir falso negativo na detecção de sucesso.

**Limite da evidência:** a resposta testada continuava sendo estruturalmente o formulário de login mesmo após decodificação correta. Charset não explica sozinho por que o servidor devolveu essa página.

## 7. Auditoria do JavaScript do portal

### Caminho do botão "Acessar"

O HTML completo confirma o elemento:

```html
<a href="#" onclick="login();" class="login">&nbsp;Acessar</a>
```

Portanto, "Acessar" é um link `<a>`, não um `<button>` ou `<input>`. Seu evento direto é `onclick`.

O evento confirmado é `onclick`, que chama `login()`, definido em `/GFR/js/app/sgu/login.js`, linhas 37–43. A função:

1. obtém `document.forms[0]`;
2. chama `validateForm()`;
3. chama `top.showWait(true)`;
4. executa `myForm.submit()`.

O mesmo HTML define:

```text
validateForm()
  → validateLoginActionForm(document.forms['LoginActionForm'])
  → fieldsValidate(document.forms['LoginActionForm'])
```

O operador `&&` faz `fieldsValidate()` ser chamado somente se `validateLoginActionForm()` retornar valor verdadeiro. Na mesma resposta:

- `validateLoginActionForm()` retorna `true` sem modificar o formulário;
- `fieldsValidate()`, em `login.js`, linhas 65–67, retorna `true` sem modificar o formulário.

O formulário também declara `onsubmit="return validateForm();"`. Porém, `login()` chama `validateForm()` explicitamente e depois usa `myForm.submit()`. Não há no código uma chamada ao handler `onsubmit`; a validação observada na cadeia do clique é a chamada explícita feita por `login()`.

No código disponível desse caminho, `login()` e as duas validações não:

- alteram campos;
- normalizam CPF;
- transformam senha;
- preenchem hidden fields;
- adicionam inputs;
- alteram `action`;
- alteram o método HTTP;
- alteram `enctype`;
- criam headers.

`top.showWait(true)` é executado antes do submit, mas sua implementação não foi localizada nos arquivos de login analisados. Assim, o código disponível comprova que `login()` e as validações não alteram o formulário, mas não permite afirmar quais efeitos internos `top.showWait()` possui.

### Diferença ao pressionar ENTER

`login.js`, linhas 10–13, instala `onEnter` em `document.onkeydown`.

Em `onEnter()`, linhas 72–89:

1. o código identifica a tecla 13;
2. lê `isCyberarkValue`;
3. se o valor for `"false"`, chama `submitAutenticar()`;
4. caso contrário, chama `submitVerificarCyberark()`.

`submitAutenticar()`, linhas 537–554:

1. obtém `LoginActionForm`, `cpf` e `senha`;
2. exige CPF e senha preenchidos;
3. aplica `encodeURIComponent()` à senha usada na URL;
4. substitui `form.action` por `/SGU/login.do?method=autenticar&codigo=<cpf>&senha=<senha codificada>`;
5. chama `top.showWait(true)`;
6. executa `form.submit()`.

`submitVerificarCyberark()`, linhas 522–535:

1. obtém `LoginActionForm` e `cpf`;
2. exige CPF preenchido;
3. substitui `form.action` por `/SGU/login.do?method=verificarUsuarioCyberark&codigo=<cpf>`;
4. executa `form.submit()`.

Portanto, clique e ENTER não executam o mesmo código:

- o clique chama `login()` e não altera `action` no código disponível;
- o HTML fornecido não contém um elemento com `id="isCyberarkValue"`;
- ao pressionar ENTER nesse DOM estático, `onEnter()` tenta acessar `.value` sobre o resultado nulo de `document.getElementById('isCyberarkValue')` e não alcança as funções de submit;
- o HTML também declara os campos somente como `name="codigo"` e `name="senha"`, sem os IDs `cpf` e `senha` esperados por `submitAutenticar()`;
- `submitAutenticar()` e `submitVerificarCyberark()` alterariam `action` somente se fossem alcançadas com os elementos esperados;
- nenhuma dessas funções atribui valor ao hidden `method`.

Não foi encontrada no HTML inline uma criação dinâmica desses IDs. Como o conteúdo de todos os scripts globais externos não faz parte desta evidência, não é possível afirmar que o DOM nunca seja modificado por outro arquivo.

### CPF

`login()` não normaliza CPF. O HTML completo, porém, confirma que o campo `codigo` possui:

```html
onfocus="removeCaracs(this,'cpf')" onblur="formatCamp(this,'cpf')"
```

Em `/GFR/js/commons/validate.js`:

- `removeCaracs()`, linhas 136–140, chama `unformatField()` e reescreve `campo.value`;
- `unformatField()`, linhas 107–133, usa `justNumbersStr()` para CPF;
- `formatCamp()`, linhas 28–47, pode reformatar o valor;
- `getFmtValue()`, linhas 198–216, aplica a máscara `999.999.999-99`.

Assim, existe transformação do CPF no ciclo de foco do campo, embora ela não seja executada por `login()`. Sem um registro dos eventos ocorridos imediatamente antes do clique, o código isolado não determina se o valor efetivamente submetido estava formatado ou somente numérico.

`submitAutenticar()`, usado pelo fluxo de Enter quando `isCyberark === "false"`, também usa `cpfInput.value` diretamente na URL, sem remover pontos ou hífens.

`apiValidator.js` também aceita CPF formatado ou não, mas os handlers efetivamente declarados pelo HTML pertencem a `/GFR/js/commons/validate.js`.

### Senha

No caminho de `login()`, a senha não recebe `trim`, hash, criptografia ou codificação explícita. A serialização normal do formulário é responsabilidade do navegador.

`submitAutenticar()` usa `encodeURIComponent(senhaInput.value)` somente ao colocar a senha na query string de um fluxo alternativo acionado por Enter. Isso é codificação de URL, não transformação criptográfica.

### Hidden fields e campos adicionais

`login()` não preenche hidden fields e não adiciona campos ao formulário.

Outros fluxos existentes no mesmo arquivo alteram campos já presentes:

- `loginAgenda()` define o hidden `method` como `iniciarLoginAgenda`;
- `verificarUsuarioCyberark()` define `method=verificarUsuarioCyberark`;
- `verificarCredenciadoCyberark()` e `forceLogout()` definem `method=autenticar`;
- `forceLogout()` também preenche `codigo`, `senha`, `autenticadoCyberark` e `forceLogout`.

Nenhuma dessas mutações é chamada por `login()` no código analisado.

### Outras submissões

Além de `login()`, foram encontradas chamadas a `submit()` em:

- `finalizarLogin()`;
- `showFormularioRecadastro()`;
- `loginAgenda()`;
- `openDialogNewSessionWithCyberark()`;
- `forceLogout()`;
- `verificarCredenciadoCyberark()`;
- `verificarUsuarioCyberark()`;
- `autenticar()`;
- `processarRetornoCyberarkGovBR()`;
- `processarValidacaoToken()`;
- `submitVerificarCyberark()`;
- `submitAutenticar()`;
- `submitAutenticarCyberark()`;
- `submitAutenticarCyberarkGovBR()`.

Essas funções representam fluxos alternativos. Não há chamada entre `login()` e elas na implementação analisada.

### `action`, método e `enctype`

`login()` não altera nenhum desses atributos.

Outras funções alteram `myForm.action` para fluxos de finalização, recadastro, CyberArk, token, nova sessão ou autenticação via query string. As atribuições `myForm.method.value = ...` modificam o input hidden chamado `method`, não o método HTTP do formulário.

Nenhuma atribuição a `form.method` ou `form.enctype` foi encontrada.

### Headers

Nenhum JavaScript do caminho `login()` escreve `Origin`, `Referer` ou qualquer header customizado. Um submit HTML nativo não permite configurar esses headers; eles são gerados pelo navegador.

Há usos de `XMLHttpRequest`, `$.ajax()` e `fetch()` em `login.js`, mas pertencem a consulta de IP, callbacks de biometria e verificação de extensão CyberArk. Eles não participam do submit normal de `method=autenticar`.

### Arquivos analisados

**Participação direta confirmada:**

- `/GFR/js/app/sgu/login.js`: contém `login()` e os fluxos alternativos de autenticação.

**Dependências declaradas por `login.js`:**

- `/GFR/js/comum.js`: utilitários genéricos; nenhuma mutação do submit de login foi encontrada;
- `/GFR/js/api/apiValidator.js`: valida CPF/CNPJ; não altera o formulário no caminho `login()`.

**Dependências de suporte observadas:**

- `/GFR/js/api/apiString.js`: fornece operações de String usadas pela validação;
- `/GFR/js/commons/validate.js`: fornece `removeCaracs()` e `formatCamp()`, chamados diretamente pelos eventos `onfocus` e `onblur` do campo CPF;
- script inline da página: fornece `validateForm()`, chamada por `login()`;
- implementação de `top.showWait()`: apenas interface de espera; sua origem não foi necessária para construir o POST.

## 8. Pontos ainda não comparáveis com o navegador

Faltam evidências do POST manual bem-sucedido para comparar:

- existência e conteúdo do header `Cookie`;
- nomes e atributos dos cookies antes e depois do POST;
- rotação de `JSESSIONID`;
- payload efetivamente preservado no Network, para confirmar a serialização observada no HTML;
- `Origin`;
- `Referer`;
- `Accept`;
- `Accept-Language`;
- `User-Agent`;
- headers `Sec-Fetch-*`;
- status e redirects;
- charset e título da resposta autenticada.

Esses itens são lacunas de comparação, não causas confirmadas.

## Conclusão

O cliente reproduz exatamente o núcleo documentado do POST:

- método;
- caminho;
- Content-Type;
- os doze campos do formulário HTML, seus valores estáticos e sua ordem.

O código do portal confirma que `login()` não transforma os valores nem o formulário antes do submit. Isso elimina normalização de CPF, transformação de senha e preenchimento dinâmico de hidden fields como divergências do caminho do botão "Acessar".

O HAR permite afirmar que sequência, payloads, ordem, duplicidades, headers principais, status e ausência de redirects estão alinhados. Cookies não foram preservados na captura e não podem ser comparados.

As primeiras execuções após o ajuste retornaram à tela de login ou encontraram `ECONNRESET`. Uma execução instrumentada posterior retornou `status=sucesso`, mas não preservou a resposta e não foi reproduzida. O POST está implementado conforme as evidências de protocolo; a validação da autenticação permanece pendente.
