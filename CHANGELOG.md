# Diário de evolução do projeto

> ### 📌 Estado atual
>
> **Fase atual:** Fase 003A — Autenticação HTTP (`Implementada`)  
> **Próxima fase:** Fase 003B — Navegação autenticada (`Planejada`)  
> **Última atualização:** 2026-07-18 20:40 BRT  
> **Última sessão executada:** 18/07/2026 • 20:40 — Checkpoint da evidência de autenticação

Este arquivo registra, em ordem cronológica inversa, cada sessão concluída no projeto. O histórico nunca deve ser apagado ou sobrescrito.

> **Recomendação de nomenclatura:** `DIARIO_DE_BORDO.md` representa melhor a função atual do arquivo. O nome `CHANGELOG.md` deve ser mantido por enquanto para preservar referências existentes; uma eventual renomeação deve ocorrer em tarefa própria, com atualização coordenada de toda a documentação.

---

## 📅 18/07/2026 • 20:40

### 🎯 Objetivo

Verificar se a execução histórica classificada como sucesso possui evidência durável e reproduzível suficiente para sustentar o status `Validada`.

### ✅ O que mudou

- Localizada a execução temporária de `ECNHClient.login()` que imprimiu `status=sucesso`.
- Confirmado que o critério do código exigia conjuntamente `JSESSIONID` e o marcador autenticado.
- Verificada a ausência de log durável, HTML, hash e arquivo dessa execução.
- Separado o resultado do cliente de um HTML autenticado anterior salvo por diagnóstico direto de `AuthTransport`.
- Verificado que o cliente marcou uma sessão interna, mas não executou navegação protegida posterior.
- Consolidado o checkpoint em documento próprio.
- Nenhum código ou protocolo foi alterado.

### 🧠 Decisões

- **Evidência confirmada:** o `ECNHClient` retornou `sucesso` uma vez e marcou estado interno autenticado.
- **Limite:** a resposta dessa execução não foi preservada e o marcador somente pode ser inferido pelo caminho do código.
- **Evidência confirmada:** `/tmp/ecnh-login-before.html` contém marcador e formulário protegido, mas pertence a um POST direto antigo e não ao `ECNHClient`.
- **Evidência confirmada:** o resultado `sucesso` não foi reproduzido em três tentativas instrumentadas nem na bateria de vinte.
- A evidência não atende ao requisito auditável de `Validada`.
- A Fase 003A retorna para `Implementada`.

### 📂 Arquivos impactados

- `docs/CHECKPOINT_EVIDENCIA_AUTENTICACAO.md`
- `docs/AUDITORIA_HTTP_TLS_AUTENTICACAO.md`
- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/ROBUSTEZ_AUTENTICACAO_HTTP.md`
- `docs/API.md`
- `docs/FLUXO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/ROADMAP.md`
- `docs/VISAO_DO_PRODUTO.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 20:28

### 🎯 Objetivo

Implementar exclusivamente agentes persistentes com keep-alive e medir vinte execuções consecutivas do login.

### ✅ O que mudou

- Criados um `HttpCookieAgent` e um `HttpsCookieAgent` por `AuthTransport`.
- Configurados `keepAlive=true` e `maxSockets=1`.
- Reutilizados os mesmos agentes, CookieJar e socket nas três etapas.
- Substituído o wrapper que recriava agentes pelo uso direto de `http-cookie-agent`.
- Preservados protocolo, payload, headers e sequência GET → POST → POST.
- Executados `typecheck`, `lint`, `build` e vinte `npm run test:login` consecutivos.
- Confirmados `reusedSocket=true` e o mesmo identificador de socket nos dois POSTs.

### 🧠 Decisões

- **Antes:** 1 sucesso em 6 registros disponíveis, taxa de 16,67%, com 3 `ECONNRESET`.
- **Depois:** 0 sucessos em 20, taxa de 0%, com 0 `ECONNRESET`.
- **Tempos depois:** média de 582 ms, mínimo de 469 ms e máximo de 793 ms.
- **Evidência confirmada:** a conexão persistente eliminou o reset na bateria.
- **Evidência confirmada:** a conexão persistente não estabilizou a autenticação.
- Nenhum retry, workaround ou alteração adicional foi implementado.
- A Fase 003A permanece `Validada`, não `Concluída`.

### 📂 Arquivos impactados

- `src/client/auth-transport.ts`
- `package.json`
- `package-lock.json`
- `docs/ROBUSTEZ_AUTENTICACAO_HTTP.md`
- `docs/AUDITORIA_HTTP_TLS_AUTENTICACAO.md`
- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/API.md`
- `docs/ARQUITETURA.md`
- `docs/DECISOES.md`
- `docs/ROADMAP.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 20:18

### 🎯 Objetivo

Investigar exclusivamente a intermitência entre autenticação bem-sucedida e `ECONNRESET`, sem reabrir a engenharia reversa nem alterar o protocolo.

### ✅ O que mudou

- Auditado o ciclo de Axios, CookieJar, agentes HTTP/HTTPS, sockets, timeout e execução sequencial.
- Inspecionados `axios-cookiejar-support`, `http-cookie-agent`, Axios e `follow-redirects`.
- Comparadas execuções bem-sucedidas e resetadas até o primeiro ponto de divergência.
- Classificadas hipóteses confirmadas, eliminadas e ainda não comprovadas.
- Criado um plano mínimo para isolar keep-alive e reutilização de conexão antes de considerar retry.
- Nenhum código de produção foi alterado.

### 🧠 Decisões

- **Evidência confirmada:** a instância Axios e o CookieJar são reutilizados nas três etapas.
- **Evidência confirmada:** o wrapper cria novos `HttpCookieAgent` e `HttpsCookieAgent` em cada request, com `keepAlive=false`.
- **Evidência confirmada:** não existe retry automático, timeout envolvido, concorrência entre etapas ou descarte prematuro do CookieJar.
- **Evidência confirmada:** sucesso e reset são equivalentes até `request.finish`; a divergência surge antes dos headers de resposta.
- **Hipótese mais provável:** a abertura de três conexões TLS independentes reduz afinidade no caminho remoto e expõe comportamento intermitente de borda ou backend.
- **Plano mínimo:** preservar um único par de agentes com keep-alive e medir essa variável isoladamente; não repetir isoladamente o POST final.
- A Fase 003A permanece `Validada`.

### 📂 Arquivos impactados

- `docs/ROBUSTEZ_AUTENTICACAO_HTTP.md`
- `docs/AUDITORIA_HTTP_TLS_AUTENTICACAO.md`
- `docs/ROADMAP.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 20:08

### 🎯 Objetivo

Auditar exclusivamente a camada HTTP/TLS do fluxo autenticador, comparando Axios e HAR e localizando o `ECONNRESET` sem alterar código de produção.

### ✅ O que mudou

- Instrumentados temporariamente e de forma sanitizada os eventos de `ClientRequest` e `TLSSocket`.
- Comparados versão HTTP, headers, payloads, agentes, keep-alive, reutilização de socket, ALPN, TLS e ponto da falha.
- Registrados `error.code`, `error.cause`, `syscall`, `errno` e stacks completos sem dados sensíveis.
- Reproduzido o `ECONNRESET` no POST `method=autenticar`.
- Confirmada autenticação real em uma execução instrumentada sem alteração do código.
- Criada a auditoria técnica completa e atualizada a documentação da fase.

### 🧠 Decisões

- **Evidência confirmada:** o Chrome usa HTTP/2 e reutiliza uma conexão; o Axios usa HTTP/1.1 e abre um socket TLS novo por etapa.
- **Evidência confirmada:** o agente efetivo é `CookieAgent`, com keep-alive desabilitado e sem reutilização de sessão TLS.
- **Evidência confirmada:** o reset ocorreu depois de `secureConnect` e `request.finish`, mas antes de qualquer header de resposta.
- **Evidência confirmada:** o erro Axios e sua causa possuem `code=ECONNRESET`; `syscall` e `errno` estão ausentes.
- **Limite:** não é possível identificar por essa evidência se portal, CDN, WAF, balanceador ou backend encerrou a conexão.
- **Limite:** a divergência HTTP/2 versus HTTP/1.1 não pode ser classificada como causa porque o mesmo cliente também obteve sucesso.
- A Fase 003A avança para `Validada`; a intermitência impede `Concluída`.

### 📂 Arquivos impactados

- `docs/AUDITORIA_HTTP_TLS_AUTENTICACAO.md`
- `docs/API.md`
- `docs/FLUXO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/ROADMAP.md`
- `docs/VISAO_DO_PRODUTO.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 20:00

### 🎯 Objetivo

Implementar a sequência completa de autenticação observada no HAR, preservando o mesmo CookieJar e sem alterar a arquitetura.

### ✅ O que mudou

- Auditado o HAR de forma sanitizada, sem registrar CPF, senha, cookies ou identificadores pessoais.
- Confirmada a sequência `GET iniciarLogin` → `POST iniciarLoginAgenda` → `POST autenticar`.
- Registrados status, tamanhos, hashes SHA-256 e hidden fields das três respostas.
- Confirmado que os dez hidden fields da etapa 2 reaparecem na etapa 3 com valores estáticos e sem token dinâmico.
- Implementados os três requests, os payloads na ordem observada, a duplicidade de `codigo` na etapa 2, os headers por etapa e a decodificação ISO-8859-1.
- Mantidos o mesmo `AuthTransport`, CookieJar, arquitetura e critérios de sucesso.
- Restringido o log de erro HTTP a nome, código e mensagem para impedir serialização de credenciais e cookies pelo Axios.
- Executados `typecheck`, `lint`, `build` e duas tentativas de `npm run test:login`.

### 🧠 Decisões

- **Evidência confirmada:** as três respostas do HAR foram HTTP 200 e não houve redirects.
- **Evidência confirmada:** nenhum valor dinâmico da etapa 2 exige parser HTML; os dez hidden fields são constantes.
- **Evidência confirmada:** o HAR não preservou cookies, portanto nomes e rotação não podem ser comparados.
- **Validação real:** a primeira tentativa encontrou `ECONNRESET` na etapa 2; a segunda alcançou HTTP 200 nas etapas 1 e 2 e encontrou `ECONNRESET` na etapa 3.
- A autenticação não recebeu resposta final conclusiva e a Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `src/client/ecnh-auth-protocol.ts`
- `src/client/auth-transport.ts`
- `docs/EVIDENCIA_HAR_AUTENTICACAO.md`
- `docs/API.md`
- `docs/FLUXO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/ROADMAP.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 19:26

### 🎯 Objetivo

Auditar exclusivamente requisições, redirects, submissões e mudanças de estado anteriores ao POST `method=autenticar`.

### ✅ O que mudou

- Analisados o HTML de login, `login.js` e os scripts globais carregados pela página.
- Separadas diferenças comprovadas de efeitos sem evidência sobre a sessão.
- Documentados a chamada a `/GFR/release.json` e o cookie visual `style1`.
- Confirmada a ausência de `meta refresh`, iframe com `src`, submit automático e redirect automático no código auditado.

### 🧠 Decisões

- **Diferença comprovada:** o Chrome recebe o documento HTML antes do clique; o cliente inicia diretamente pelo POST.
- **Diferença comprovada:** a página chama `fetch('/GFR/release.json')`; o cliente não.
- **Diferença comprovada:** `styleswitcher.js` mantém o cookie visual `style1`; o cliente não.
- Não há evidência de que essas diferenças criem estado de autenticação, alterem `JSESSIONID` ou sejam obrigatórias.
- A primeira URL, redirects e cookies de servidor anteriores ao POST continuam sem captura Network.
- Nenhuma alteração de código foi realizada e a Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `docs/FLUXO_HTTP.md`
- `.fases/003-login-http.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 19:13

### 🎯 Objetivo

Determinar o estado do cliente e as evidências disponíveis sobre o navegador antes do POST `method=autenticar`.

### ✅ O que mudou

- Auditado o encadeamento entre `ECNHClient`, protocolo, transporte, sessão e CookieJar.
- Confirmado que o cliente não executa GET antes do POST.
- Confirmado que a primeira requisição é `POST /gefor/SGU/login.do`.
- Registrada a ausência de captura da navegação inicial do Chrome.
- Atualizados fluxo HTTP, diagnóstico e documento da fase.

### 🧠 Decisões

- **Evidência confirmada:** cada cliente novo começa com CookieJar vazio e não recebe cookies antes do POST.
- **Evidência confirmada:** `JSESSIONID` é recebido somente na resposta do POST direto.
- **Pendência de validação:** primeira URL, GETs, redirects e cookies anteriores do Chrome não foram preservados.
- Um GET genérico já testado não reproduziu login; nenhuma navegação inicial será implementada sem captura real.
- Para avançar, é necessário registrar o fluxo manual desde uma sessão limpa, validar a autenticação e concluir documentalmente a Fase 003A.

### 📂 Arquivos impactados

- `docs/FLUXO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `.fases/003-login-http.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 19:04

### 🎯 Objetivo

Testar se os principais headers de navegação do Chrome alteram o tratamento do POST de autenticação.

### ✅ O que mudou

- Configurados `Accept`, `Accept-Language`, `Origin`, `Referer`, `Upgrade-Insecure-Requests` e `User-Agent` no `AuthTransport`.
- Preservados payload, arquitetura, CookieJar, redirects, fluxo e critério de sucesso.
- Confirmados os headers efetivamente enviados pelo Axios.
- Executados `typecheck`, `lint`, `build` e `npm run test:login`.
- Comparadas byte a byte as respostas anterior e posterior ao ajuste.

### 🧠 Decisões

- **Evidência confirmada:** os seis headers estavam presentes no request real.
- **Evidência confirmada:** a resposta permaneceu com 28.696 bytes e SHA-256 `6baae6f28e5e48bda015544c007143bd96cfaf666866977b017be8ff5228be63`.
- **Evidência confirmada:** `LoginActionForm` permaneceu presente e o marcador autenticado permaneceu ausente.
- O perfil principal testado não altera a resposta e não explica isoladamente a falha de autenticação.
- Os valores exatos do Chrome usado em um login manual bem-sucedido continuam pendentes de captura.
- A Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `src/client/auth-transport.ts`
- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `docs/API.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 18:54

### 🎯 Objetivo

Reproduzir fielmente no cliente os campos, valores estáticos e ordem do formulário HTML de autenticação.

### ✅ O que mudou

- Reordenado o payload conforme o formulário "Acesso à Agenda Diária do Perito".
- Incluídos `novaSenha`, `novaSenha1` e `msgPublicacao` com string vazia.
- Alterado `idCFC` de `-1` para string vazia.
- Preservados arquitetura, fluxo, CookieJar, redirects e critério de sucesso.
- Executados `typecheck`, `lint`, `build` e `npm run test:login`.
- Comparadas estruturalmente as respostas anterior e posterior ao ajuste.

### 🧠 Decisões

- **Evidência confirmada:** antes do ajuste, uma execução diagnóstica retornou o marcador autenticado e não continha `LoginActionForm`.
- **Evidência confirmada:** após o ajuste, o portal retornou HTTP 200 e `JSESSIONID`, mas a página continha `LoginActionForm` e não continha o marcador autenticado.
- **Evidência confirmada:** o HTML mudou de 72.162 para 28.696 caracteres.
- **Limite da evidência:** as requisições foram sequenciais contra estado externo; a diferença não pode ser atribuída exclusivamente ao payload.
- A Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `src/client/ecnh-auth-protocol.ts`
- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `docs/API.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 18:49

### 🎯 Objetivo

Incorporar o HTML completo do formulário "Acesso à Agenda Diária do Perito" à reconstrução do fluxo de autenticação.

### ✅ O que mudou

- Confirmado que "Acessar" é um link `<a>` com `onclick="login();"`.
- Confirmados o formulário, seu `action`, método, handler `onsubmit` e hidden `method=autenticar`.
- Documentados os handlers `onfocus` e `onblur` que removem e reaplicam a máscara do CPF.
- Confirmado que o DOM fornecido não possui os IDs exigidos por `onEnter()` e suas funções alternativas.
- Identificadas diferenças objetivas entre os controles do formulário e o payload do cliente.
- Atualizados auditoria, diagnóstico e matriz de divergências.

### 🧠 Decisões

- A ausência de transformação dentro de `login()` não significa ausência de transformação no ciclo completo do campo CPF.
- O HTML confirma `novaSenha`, `novaSenha1` e `msgPublicacao` vazios, ausentes no cliente.
- O formulário contém `idCFC` vazio, enquanto o cliente envia `idCFC=-1`.
- A representação efetivamente submetida do CPF ainda depende da sequência de eventos e deve ser preservada no Network.
- No DOM estático fornecido, o ENTER interrompe antes de qualquer submit porque `isCyberarkValue` não existe.
- Nenhum código foi alterado e a Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 18:43

### 🎯 Objetivo

Reconstruir, apenas com evidências de código, as cadeias executadas pelo clique em "Acessar" e pela tecla ENTER.

### ✅ O que mudou

- Documentada a sequência `onclick` → `login()` → validações → espera → `form.submit()`.
- Confirmado que o caminho do clique não altera o formulário no código disponível.
- Documentado separadamente o caminho de ENTER por `onEnter()`.
- Corrigidas a matriz de divergências e o diagnóstico para eliminar a hipótese de transformação por `login()`.

### 🧠 Decisões

- **Evidência confirmada:** clique e ENTER executam funções diferentes.
- **Evidência confirmada:** `submitAutenticar()` e `submitVerificarCyberark()`, usados pelo ENTER conforme `isCyberark`, alteram `form.action`.
- **Evidência confirmada:** `login()` não altera `action`, hidden `method`, CPF, senha ou outros campos.
- **Limite da evidência:** a tag HTML completa do elemento "Acessar" e o script inline exatamente da resposta intermediária não foram preservados.
- Nenhum código foi alterado e a Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 18:36

### 🎯 Objetivo

Determinar, exclusivamente pelo JavaScript do portal, como o navegador prepara o submit de `method=autenticar`.

### ✅ O que mudou

- Auditado `/GFR/js/app/sgu/login.js` e suas dependências declaradas e de validação.
- Confirmado que `login()` apenas valida, exibe a espera e chama o submit nativo.
- Catalogadas as submissões e mutações pertencentes a fluxos alternativos.
- Atualizada a auditoria técnica com as evidências coletadas.

### 🧠 Decisões

- **Evidência confirmada:** `login()` não altera CPF, senha, hidden fields, `action`, método HTTP ou `enctype`.
- **Evidência confirmada:** o fluxo normal não adiciona campos nem escreve `Origin`, `Referer` ou headers customizados.
- **Evidência confirmada:** `submitAutenticar()`, acionado pelo caminho alternativo de Enter, apenas aplica `encodeURIComponent` à senha usada na query string e não normaliza o CPF.
- As mutações de formulário encontradas em CyberArk, nova sessão, force logout e agenda não são chamadas por `login()`.
- Nenhum código foi alterado e a Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 18:23

### 🎯 Objetivo

Abandonar, por falta de evidência, a participação de `iniciarLoginAgenda` e auditar rigorosamente o POST `method=autenticar` produzido pelo cliente.

### ✅ O que mudou

- Criado `docs/AUDITORIA_POST_AUTENTICAR.md`.
- Documentados payload, ordem dos campos, headers efetivos, cookies, CookieJar, redirects e charset do cliente.
- Executada captura local com dados fictícios para observar o request produzido por Axios 1.18.1, sem acessar credenciais reais.
- Atualizados diagnóstico, matriz, API, README e documento da fase para remover `iniciarLoginAgenda` do fluxo considerado.
- Mantido o foco no POST comprovado pelo navegador.

### 🧠 Decisões

- Uma função sem chamador identificado não constitui evidência de execução.
- O cliente coincide com método, caminho, Content-Type e os nove campos documentados do navegador.
- A equivalência integral ainda não pode ser afirmada porque cookies enviados, headers e eventuais campos adicionais do POST bem-sucedido não foram preservados.
- O charset ISO-8859-1 é a única divergência concreta já demonstrada no processamento da resposta; ele não explica sozinho o retorno estrutural ao formulário.
- Nenhum código foi alterado e a Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `docs/AUDITORIA_POST_AUTENTICAR.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/API.md`
- `.fases/003-login-http.md`
- `README.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 18:10

### 🎯 Objetivo

Avaliar se `/GFR/js/app/sgu/login.js` concentra a lógica que transforma o formulário intermediário no POST `method=autenticar`.

### ✅ O que mudou

- Analisada a nova evidência de que o formulário já contém `method=autenticar`.
- Reavaliada a necessidade de hidden fields e tokens dinâmicos na resposta intermediária.
- Priorizada a coleta de `login.js` para identificar a transformação executada por `onclick="login()"`.
- Nenhum código ou documento técnico foi modificado.

### 🧠 Decisões

- `login.js` provavelmente concentra a orquestração client-side da submissão final, mas não toda a lógica do protocolo, que também depende do estado mantido pelo servidor.
- A hipótese de que o HTML precisa fornecer dinamicamente o valor de `method` foi eliminada.
- A ausência de tokens aparentes reduz, mas não elimina, a hipótese de dados dinâmicos criados pelo script.
- A coleta de `login.js` passa a ter prioridade sobre uma análise adicional do corpo HTML já conhecido; cookies, redirects e o request efetivamente enviado continuam sendo evidências indispensáveis.
- A Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `CHANGELOG.md`

---

## 📅 18/07/2026 • 18:06

### 🎯 Objetivo

Determinar se a resposta do POST `method=iniciarLoginAgenda` precisa ser conhecida antes de reproduzir o fluxo confirmado do navegador.

### ✅ O que mudou

- Analisada a suficiência da sequência GET `verificarUsuarioCyberark` → POST `iniciarLoginAgenda` → POST `autenticar`.
- Identificadas as informações intermediárias que ainda podem alterar a construção do segundo POST.
- Nenhum código ou documento técnico foi modificado.

### 🧠 Decisões

- A resposta do primeiro POST é indispensável para concluir a descoberta do protocolo.
- Isso não implica que o código de produção necessariamente precisará interpretar seu HTML.
- O parsing só será necessário se a resposta fornecer hidden fields ou tokens usados pelo POST `autenticar`.
- Se a resposta apenas atualizar cookies, redirects ou estado de servidor, a sequência com o mesmo CookieJar poderá ser suficiente.
- A Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `CHANGELOG.md`

---

## 📅 18/07/2026 • 17:50

### 🎯 Objetivo

Criar uma comparação detalhada entre o fluxo HTTP do navegador e o `ECNHClient`, classificando cada diferença conforme a evidência disponível.

### ✅ O que mudou

- Criado `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`.
- Comparados sequência, GETs, POSTs, cookies, CookieJar, payload, campos ocultos, headers, redirects, charset, HTML e marcador autenticado.
- Cada item foi classificado como `Confirmada`, `Hipótese` ou `Eliminada`.
- As divergências foram ordenadas por probabilidade de impedir o login.
- A matriz foi referenciada pelo diagnóstico, fluxo HTTP, README e documento da fase.

### 🧠 Decisões

- A diferença a investigar primeiro é a existência e a função dos dois requests `login.do` do navegador.
- Preservação do CookieJar, método, caminho, Content-Type e payload principal conhecido foram eliminados como causas isoladas.
- GET genérico no próprio `login.do` também foi eliminado como correção suficiente.
- Charset ISO-8859-1 permanece uma divergência confirmada paralela: pode impedir a detecção de sucesso, mas não explica o retorno ao formulário.
- Nenhuma correção foi implementada e a Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `docs/MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md`
- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `docs/FLUXO_HTTP.md`
- `README.md`
- `.fases/003-login-http.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 17:46

### 🎯 Objetivo

Comparar o protocolo implementado com as evidências do login manual e ordenar as causas prováveis da divergência, sem implementar correções.

### ✅ O que mudou

- Criado `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`.
- Documentadas hipóteses sobre os dois requests `login.do`, sessão inicial, cookies, campos ocultos, headers, redirects, credenciais e charset.
- Separadas evidências confirmadas, evidências contrárias e pendências de coleta para cada hipótese.
- Definido um plano de captura DevTools e comparação request a request.
- Adicionadas referências ao diagnóstico no README, no mapa de API, no roadmap e no documento da fase.

### 🧠 Decisões

- A principal hipótese é que o navegador executa um protocolo de duas etapas que foi consolidado incorretamente como um único POST.
- Um GET genérico no próprio `login.do` e campos ocultos estáticos não resolveram a autenticação, portanto não devem ser implementados como correção.
- A codificação ISO-8859-1 é um risco confirmado para o detector do marcador, mas não explica o retorno estrutural do formulário de login.
- Nenhuma alteração de código será feita antes de preservar separadamente os dois requests do navegador em uma captura sanitizada.
- A Fase 003A permanece `Implementada`.

### 📂 Arquivos impactados

- `docs/DIAGNOSTICO_AUTENTICACAO_HTTP.md`
- `docs/API.md`
- `.fases/003-login-http.md`
- `README.md`
- `docs/ROADMAP.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 17:38

### 🎯 Objetivo

Validar a implementação da Fase 003A contra o portal real do e-CNH, sem iniciar navegação autenticada ou funcionalidades de fases posteriores.

### ✅ O que mudou

- Executado `npm run test:login` com configuração local autorizada.
- Confirmados carregamento das variáveis, envio do POST URL-encoded, resposta HTTP 200 e preservação de `JSESSIONID` no CookieJar.
- Confirmado que o HTML retornou o formulário de login, com título "eCNHsp - DETRAN - São Paulo", sem o marcador "Imprimir Agenda Diária do Psicólogo".
- Registradas as evidências e pendências da validação na documentação técnica e no documento da fase.
- Mantido o status da Fase 003A como `Implementada`.

### 🧠 Decisões

- `JSESSIONID` isoladamente comprova sessão HTTP, não autenticação.
- O login continua exigindo conjuntamente `JSESSIONID` e o marcador HTML confirmado.
- Nenhum código foi alterado porque a resposta não fornece evidência suficiente para distinguir credenciais rejeitadas, campo ausente, cabeçalho obrigatório ou estado prévio do portal.
- A próxima ação segura é comparar o cliente com uma captura DevTools sanitizada de login manual bem-sucedido.
- A Fase 003B não deve começar enquanto a 003A não estiver `Concluída`.

### 📂 Arquivos impactados

- `.fases/003-login-http.md`
- `README.md`
- `docs/API.md`
- `docs/FLUXO_HTTP.md`
- `docs/ROADMAP.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 17:23

### 🎯 Objetivo

Criar uma convenção permanente e inequívoca para representar o estado de cada fase do projeto.

### ✅ O que mudou

- Definidos os estados únicos `Planejada`, `Implementada`, `Validada` e `Concluída`.
- Formalizada a progressão obrigatória entre os estados.
- Adicionado o status de cada fase ao roadmap.
- Documentada a convenção para contribuidores, desenvolvedores e agentes de IA.
- A Fase 003A foi registrada como `Implementada`; as Fases 003B a 007 permanecem `Planejada`.

### 🧠 Decisões

- `docs/ROADMAP.md` é a fonte de verdade dos estados.
- Nenhuma fase pode pular estados ou mudar de status sem evidência registrada.
- `Validada` exige execução dos critérios no ambiente adequado.
- `Concluída` exige validação, ausência de pendências bloqueantes no escopo e atualização documental.
- A Fase 003A não avançou para `Validada`, pois a autenticação no portal real ainda não foi confirmada.

### 📂 Arquivos impactados

- `AGENTS.md`
- `README.md`
- `docs/ROADMAP.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 17:05

### 🎯 Objetivo

Transformar visualmente o `CHANGELOG.md` em um diário contínuo, com leitura rápida do estado do projeto e sessões padronizadas.

### ✅ O que mudou

- Removida a seção `[Unreleased]`.
- Criado um dashboard com fase atual, próxima fase, última atualização e última sessão executada.
- Adotado o título de sessão `## 📅 DD/MM/YYYY • HH:mm`.
- Definida a estrutura interna de objetivo, mudanças, decisões e arquivos impactados.
- Atualizada a regra permanente em `AGENTS.md`.

### 🧠 Decisões

- As sessões são exibidas em ordem cronológica inversa.
- Registros anteriores sem data comprovada permanecem em uma área de histórico legado.
- Recomenda-se futuramente o nome `DIARIO_DE_BORDO.md`, mas o arquivo não foi renomeado nesta tarefa.

### 📂 Arquivos impactados

- `AGENTS.md`
- `CHANGELOG.md`

---

## 📅 18/07/2026 • 17:01

### 🎯 Objetivo

Transformar o `CHANGELOG.md` em um diário permanente da evolução do projeto.

### ✅ O que mudou

- Foram estabelecidos os campos `Última atualização` e `Fase atual`.
- Foi criada inicialmente a área `[Unreleased]` com sessões datadas.
- A atualização obrigatória do diário ao concluir qualquer tarefa foi formalizada em `AGENTS.md`.

### 🧠 Decisões

- Cada conclusão deve acrescentar uma sessão com data e hora em BRT.
- Sessões e histórico anteriores nunca podem ser sobrescritos ou apagados.
- O uso de `[Unreleased]` foi posteriormente substituído pelo formato direto de sessões registrado em 18/07/2026 às 17:05.

### 📂 Arquivos impactados

- `AGENTS.md`
- `CHANGELOG.md`

---

## 🗂️ Histórico anterior ao diário

Os registros abaixo foram preservados sem datas ou horários porque essas informações não foram documentadas no momento das alterações.

### Refinamento documental — Roadmap

- **Objetivo:** padronizar a nomenclatura das fases futuras e alinhar o roadmap à separação arquitetural do sistema.
- **Principais alterações:** fases 003A–007 renomeadas e reordenadas (006 — Orquestração multi-profissionais; 007 — Agendamento automático); tabela de alinhamento arquitetural adicionada em `docs/ROADMAP.md`; referências atualizadas em README, visão do produto e documentação técnica.
- **Decisões:** observabilidade deixa de ser fase numerada — logs estruturados permanecem padrão transversal desde a Fase 000; cron passa a ser responsabilidade exclusiva da Fase 007.
- **Arquivos impactados:** `docs/ROADMAP.md`, `README.md`, `docs/VISAO_DO_PRODUTO.md`, `docs/ARQUITETURA.md`, `docs/API.md`, `.fases/003-login-http.md`, `CHANGELOG.md`.

### Refinamento documental — Visão do produto

- **Objetivo:** separar a documentação funcional da documentação técnica, facilitando onboarding de desenvolvedores e agentes de IA.
- **Principais alterações:** criado `docs/VISAO_DO_PRODUTO.md` com objetivo, usuários, fluxo operacional, MVP, arquitetura funcional, backlog, escopo e itens fora do escopo; README atualizado com seção de leitura recomendada.
- **Decisões:** visão funcional permanece em documento próprio; detalhes de integração HTTP, domínio e ADRs continuam nos documentos técnicos existentes.
- **Arquivos impactados:** `docs/VISAO_DO_PRODUTO.md`, `README.md`, `CHANGELOG.md`.

### Fase 003A — Autenticação HTTP

- **Objetivo:** entregar o MVP de autenticação HTTP, sessão e teste automatizado sem navegar na agenda.
- **Principais alterações:** `ECNHClient` envia o POST de login confirmado; Axios usa `tough-cookie` e `axios-cookiejar-support`; criado exemplo mínimo em `examples/login.ts`.
- **Decisões:** sucesso exige `JSESSIONID` e marcador HTML confirmados; estados sem sinal comprovado não usam heurísticas; logout descarta somente a sessão local enquanto seu endpoint é desconhecido.
- **Arquivos impactados:** `package.json`, `package-lock.json`, `.env.example`, `src/client/`, `src/types/auth.ts`, `src/scripts/test-login.ts`, `examples/login.ts`, `README.md`, `docs/API.md`, `docs/ARQUITETURA.md`, `docs/MODELO_DOMINIO.md`, `.fases/003-login-http.md`.

### Fase 002.3 — Modelagem do domínio

- **Objetivo:** documentar os contratos conceituais compartilhados entre cliente, parser, serviços e Google Sheets.
- **Principais alterações:** modelos de Profissional, Paciente, Agenda, ResultadoLogin e ResultadoConsultaAgenda; diretrizes de privacidade e limites de evidência.
- **Decisões:** resultados lógicos não são associados a HTTP/HTML até confirmação; senhas são efêmeras e dados pessoais não são expostos.
- **Arquivos impactados:** `docs/MODELO_DOMINIO.md`, `docs/ARQUITETURA.md`, `CHANGELOG.md`, `.fases/002.3-modelagem-dominio.md`.

### Fase 002.2 — Refinamento da arquitetura para autenticação

- **Objetivo:** dividir a implementação de autenticação em etapas pequenas e independentes.
- **Principais alterações:** Fase 003 separada em 003A (autenticação HTTP e sessão) e 003B (navegação autenticada); `ECNHClient` documentado como fronteira única do portal.
- **Decisões:** resultado de login será explicitamente modelado; parser, serviços e Sheets não fazem HTTP direto ao e-CNH.
- **Arquivos impactados:** `CHANGELOG.md`, `docs/ROADMAP.md`, `docs/ARQUITETURA.md`, `docs/DECISOES.md`, `.fases/003-login-http.md`, `.fases/002.2-refinamento-autenticacao.md`.

### Fase 002.1 — Consolidar regras permanentes

- **Objetivo:** tornar `AGENTS.md` a fonte permanente de instruções do repositório.
- **Principais alterações:** regras de idioma, ciclo de fases, atualização documental obrigatória, padrão de evidências, CHANGELOG e ordem de trabalho.
- **Decisões:** documentação e arquitetura antecedem implementação; cada fase concluída possui registro próprio.
- **Arquivos impactados:** `AGENTS.md`, `CHANGELOG.md`, `.fases/`.

### Fase 002 — Consolidação arquitetural

- **Objetivo:** consolidar documentação e arquitetura com evidências do DevTools.
- **Principais alterações:** registro de `POST /gefor/SGU/login.do`, formulário URL-encoded, `JSESSIONID`, HTML SSR e fluxo HTTP.
- **Decisões:** ADR-002 estabelece HTTP direto como estratégia principal; Playwright fica para investigação e depuração.
- **Arquivos impactados:** `README.md`, `docs/API.md`, `docs/ARQUITETURA.md`, `docs/DECISOES.md`, `docs/FLUXO_HTTP.md`, `docs/ROADMAP.md`.

### Fase 001 — Engenharia reversa

- **Objetivo:** preparar o mapa de investigação do portal e-CNH sem implementar integração.
- **Principais alterações:** documentação de autenticação, sessão, navegação, riscos e checklist de captura autorizada.
- **Decisões:** fatos e hipóteses devem ser separados; nenhum contrato externo é inferido sem evidência.
- **Arquivos impactados:** `docs/API.md`, `docs/ARQUITETURA.md`, `docs/DECISOES.md`, `.fases/001-engenharia-reversa.md`.

### Fase 000 — Foundation

- **Objetivo:** criar estrutura, convenções e documentação base do projeto.
- **Principais alterações:** configuração TypeScript, organização de pastas, scripts de qualidade e documentação inicial.
- **Decisões:** TypeScript estrito e arquitetura por responsabilidades técnicas.
- **Arquivos impactados:** `package.json`, `tsconfig.json`, `.env.example`, `README.md`, `docs/`.
