# Fase 003A — Autenticação HTTP

**Status:** `Concluída`

## Objetivo

Implementar autenticação HTTP real no `ECNHClient`, preservando sessão e encerrando-a no portal quando o endpoint de logout for conhecido.

## Escopo

- login HTTP;
- criação e manutenção de sessão;
- gerenciamento do CookieJar;
- verificação de autenticação;
- descarte de sessão via logout HTTP confirmado;
- teste automatizado e exemplo de uso.

Não consultar agenda, não navegar em páginas de agenda, não fazer parsing e não integrar Google Sheets.

## Descobertas

- O HAR confirmou o fluxo `GET iniciarLogin` → `POST iniciarLoginAgenda` → `POST autenticar`.
- O menu dinâmico confirma o logout: `GET method=finalizarLogin`.
- `tough-cookie` com agentes HTTP permite preservar cookies automaticamente no Axios.

## Evidências

- `JSESSIONID` é o cookie de sessão confirmado.
- O HTML autenticado contém "Imprimir Agenda Diária do Psicólogo".
- O MVP exige ambos os sinais para retornar `sucesso`.

### Validação no portal real em 18/07/2026

**Evidências confirmadas:**

- `.env` carregou `ECNH_BASE_URL`, `ECNH_CPF` e `ECNH_PASSWORD`; os valores foram verificados apenas quanto à presença e ao formato, sem exposição.
- `npm run test:login` enviou `POST /gefor/SGU/login.do` com `Content-Type: application/x-www-form-urlencoded`.
- O portal respondeu `HTTP 200`, sem redirecionamento, e informou `text/html;charset=ISO-8859-1`.
- O CookieJar recebeu e preservou `JSESSIONID`.
- O título decodificado da resposta foi "eCNHsp - DETRAN - São Paulo".
- O HTML retornou novamente o formulário de login com ação `/gefor/SGU/login.do`.
- O marcador "Imprimir Agenda Diária do Psicólogo" não estava presente no HTML bruto nem no texto normalizado.
- O resultado final do cliente foi `erro_desconhecido`, conforme o contrato atual para ausência dos dois sinais de sucesso.

**Resultado:** a comunicação HTTP e a manutenção da sessão foram comprovadas, mas a autenticação não foi confirmada. A fase permanece `Implementada`, não `Validada`.

### Ajuste fiel ao formulário e nova validação em 18/07/2026

**Ajustes implementados:**

- payload reordenado conforme o HTML fornecido;
- inclusão de `novaSenha`, `novaSenha1` e `msgPublicacao` vazios;
- alteração de `idCFC` de `-1` para string vazia;
- preservação de endpoint, método, Content-Type, CookieJar, redirects, sessão e critério de sucesso.

**Evidências confirmadas:**

- `typecheck`, `lint` e `build` foram concluídos sem erros;
- imediatamente antes do ajuste, uma execução diagnóstica com o payload anterior retornou página autenticada, sem `LoginActionForm` e com o marcador esperado;
- após o ajuste, `npm run test:login` recebeu HTTP 200 e preservou `JSESSIONID`, mas retornou `erro_desconhecido`;
- a resposta posterior ao ajuste continha `LoginActionForm`, não continha o marcador autenticado e apresentou o texto "Digite seu CPF para acessar sua conta:";
- o HTML mudou de 72.162 para 28.696 caracteres.

**Limite da evidência:** as requisições foram executadas sequencialmente contra o ambiente real. A mudança de resposta está confirmada, mas não é possível atribuí-la exclusivamente ao payload sem controlar o estado externo.

**Resultado:** a implementação agora reproduz os controles do HTML fornecido, porém a autenticação final não foi confirmada. A fase permanece `Implementada`.

### Experimento de Browser Fingerprint em 18/07/2026

**Headers adicionados ao `AuthTransport`:**

- `Accept` de navegação HTML;
- `Accept-Language` com prioridade para português brasileiro;
- `Origin` derivado da URL base;
- `Referer` da página de login;
- `Upgrade-Insecure-Requests: 1`;
- `User-Agent` reduzido do Chrome 150 em macOS.

**Evidências confirmadas:**

- os seis headers estavam presentes no request efetivo;
- payload, CookieJar, redirects, fluxo e critério de sucesso não foram alterados;
- `typecheck`, `lint` e `build` foram concluídos sem erros;
- `npm run test:login` recebeu HTTP 200 e `JSESSIONID`, mas retornou `erro_desconhecido`;
- antes e depois dos headers, a resposta possuía 28.696 bytes, o mesmo SHA-256, `LoginActionForm` presente e marcador autenticado ausente.

**Resultado:** o perfil principal de Chrome testado não alterou a resposta do portal e não confirmou autenticação. A fase permanece `Implementada`.

### Auditoria do estado pré-POST em 18/07/2026

**Evidências confirmadas:**

- o cliente não realiza GET antes da autenticação;
- a primeira requisição é `POST /gefor/SGU/login.do`;
- cada `ECNHClient` novo começa com CookieJar vazio;
- nenhum cookie é recebido do portal antes do POST;
- `JSESSIONID` surge somente na resposta do POST direto;
- o HTML do navegador foi preservado, mas a navegação que o produziu não foi registrada integralmente.
- o HTML chama `fetch('/GFR/release.json')`, sem evidência de efeito sobre a sessão;
- `styleswitcher.js` mantém o cookie visual `style1`, sem evidência de participação na autenticação;
- não há `meta refresh`, iframe com `src`, submit automático ou redirect automático comprovado no código de carga da página.

**Conclusão:** não é possível confirmar se o Chrome executa uma sequência prévia diferente ou recebe cookies antes do POST. A próxima evidência necessária é uma captura Network/HAR desde uma sessão limpa até o login manual bem-sucedido. Nenhum GET deve ser implementado antes dessa captura.

### Implementação do fluxo confirmado pelo HAR em 18/07/2026

**Evidências confirmadas:**

- o HAR contém exatamente três requests `login.do`, na ordem GET → POST → POST;
- as três respostas do Chrome foram HTTP 200 e não houve redirects;
- status, tamanhos, hashes SHA-256 e hidden fields estão registrados em [EVIDENCIA_HAR_AUTENTICACAO.md](../docs/EVIDENCIA_HAR_AUTENTICACAO.md);
- os dez hidden fields da resposta da etapa 2 são reutilizados na etapa 3;
- todos possuem valores estáticos; nenhum token dinâmico exige parsing;
- o cliente reproduz campos, duplicidade de `codigo`, ordem, headers por etapa e codificação ISO-8859-1;
- o mesmo CookieJar é preservado durante as três requisições.

**Validação real:**

- `typecheck`, `lint` e `build` foram concluídos sem erros antes da validação;
- a primeira execução recebeu HTTP 200 no GET e encontrou `ECONNRESET` no POST da etapa 2;
- a segunda execução recebeu HTTP 200 nas etapas 1 e 2 e encontrou `ECONNRESET` na etapa 3;
- nenhuma resposta final conclusiva foi obtida;
- o log de erro do transporte foi restringido a nome, código e mensagem para impedir exposição de request, credenciais e cookies.

**Resultado:** o fluxo estrutural está implementado conforme o HAR, mas a autenticação real ainda não foi validada devido ao encerramento da conexão. A fase permanece `Implementada`.

### Auditoria HTTP/TLS em 18/07/2026

**Evidências confirmadas:**

- o Chrome usa HTTP/2 e reutiliza a mesma conexão nas três etapas;
- o Axios usa HTTP/1.1, `CookieAgent` sem keep-alive e um novo socket TLS por etapa;
- o reset reproduzido ocorreu após TLS 1.3 e após `request.finish`;
- headers e corpo foram concluídos localmente, mas nenhum header de resposta chegou ao Axios;
- `error.code` e `error.cause.code` foram `ECONNRESET`;
- `syscall` e `errno` estavam ausentes;
- três execuções consecutivas produziram HTTP 200, `ECONNRESET` e HTTP 200 na etapa final;
- uma execução instrumentada separada retornou resultado `sucesso`, sem preservar a resposta.

**Diagnóstico:** o peer remoto ou um intermediário encerrou o socket TLS antes de entregar uma resposta HTTP completa. A conexão nova por etapa é uma divergência comprovada em relação ao Chrome, mas não existe evidência suficiente para classificá-la como causa.

A auditoria completa está em [AUDITORIA_HTTP_TLS_AUTENTICACAO.md](../docs/archive/autenticacao-003a/AUDITORIA_HTTP_TLS_AUTENTICACAO.md).

**Resultado registrado à época:** uma saída `status=sucesso` levou a fase a `Validada`. O checkpoint posterior demonstrou que essa execução não possui resposta preservada e reclassificou a fase.

### Análise de robustez em 18/07/2026

**Evidências confirmadas:**

- a instância Axios e o CookieJar são reutilizados durante as três etapas;
- `axios-cookiejar-support` cria novos agentes HTTP e HTTPS em cada request;
- o `CookieAgent` efetivo usa `keepAlive=false`;
- nenhum socket ou sessão TLS é reutilizado;
- não existe retry automático;
- o timeout de 30 segundos não participa do reset;
- as três etapas usam `await` e não apresentam concorrência;
- cookies são persistidos sincronamente antes da etapa seguinte;
- o CookieJar só é limpo depois que o protocolo retorna falha;
- sucesso e reset são equivalentes até `request.finish`;
- a divergência surge apenas quando a resposta HTTP deveria começar.

**Hipótese mais provável:** as três conexões TLS independentes reduzem a afinidade no caminho remoto e expõem comportamento intermitente em componente de borda ou backend. A hipótese é sustentada pela divergência de conexão, mas não está comprovada como causa.

**Plano mínimo:** preservar um único par de `HttpCookieAgent` e `HttpsCookieAgent` com keep-alive durante a transação e medir o resultado antes de considerar retry. O protocolo de autenticação não deve ser alterado.

A análise completa está em [ROBUSTEZ_AUTENTICACAO_HTTP.md](../docs/archive/autenticacao-003a/ROBUSTEZ_AUTENTICACAO_HTTP.md).

### Reutilização de agentes e bateria de validação em 18/07/2026

**Implementação:**

- um `HttpCookieAgent` e um `HttpsCookieAgent` são criados por `AuthTransport`;
- ambos usam o mesmo CookieJar;
- `keepAlive=true`;
- `maxSockets=1`;
- os agentes são reutilizados nas três etapas;
- protocolo, payload, headers e sequência permaneceram inalterados;
- nenhum retry ou workaround foi adicionado.

**Evidências confirmadas:**

- a etapa 1 abriu o socket 1;
- as etapas 2 e 3 reutilizaram o socket 1 com `reusedSocket=true`;
- `typecheck`, `lint` e `build` passaram;
- vinte execuções consecutivas produziram zero `ECONNRESET`;
- nenhuma das vinte execuções confirmou autenticação;
- tempo médio de 582 ms, mínimo de 469 ms e máximo de 793 ms.

**Comparação:**

- antes: 1 `status=sucesso` sem resposta preservada em 6 registros, taxa reportada de 16,67%, com 3 `ECONNRESET`;
- depois: 0 sucessos em 20, taxa de 0%, sem `ECONNRESET`.

**Resultado:** a reutilização da conexão eliminou o reset na amostra, mas não estabilizou a autenticação. A hipótese foi confirmada somente para o transporte.

### Checkpoint da evidência de sucesso em 18/07/2026

**Evidências confirmadas:**

- uma execução temporária de `ECNHClient.login()` imprimiu `status=sucesso`;
- o código somente produz esse resultado quando encontra `JSESSIONID` e o marcador autenticado;
- nessa execução, o cliente marcou uma sessão interna;
- o logger estava desabilitado;
- a resposta HTML não foi salva;
- não existe hash ou arquivo dessa resposta;
- não houve navegação protegida posterior;
- o resultado não foi reproduzido em três execuções instrumentadas nem na bateria de vinte.

Existe um HTML autenticado em `/tmp/ecnh-login-before.html`, mas ele pertence a um diagnóstico anterior de `AuthTransport`, com POST direto e payload antigo. Esse artefato não comprova a execução posterior do `ECNHClient`.

**Resultado:** o sucesso interno foi observado, mas não possui evidência durável e independente da resposta externa. Conforme a convenção do projeto, a Fase 003A retorna para `Implementada`.

O checkpoint completo está em [CHECKPOINT_EVIDENCIA_AUTENTICACAO.md](../docs/archive/autenticacao-003a/CHECKPOINT_EVIDENCIA_AUTENTICACAO.md).

### Validação reproduzível em 19/07/2026

**Evidências confirmadas:**

- `npm run validate:login` preserva metadados sanitizados, hashes e sinais estruturais;
- o CPF é enviado como `DDD.DDD.DDD-DD`, conforme o HAR;
- cinco autenticações distintas do `ECNHClient` foram aprovadas com `JSESSIONID`, marcador autenticado, `DivisaoEquitativaForm` e ausência de `LoginActionForm`;
- hashes finais e fontes `ECNH_USER_2`, `ECNH_USER_3`, `ECNH_USER_5`, `ECNH_USER_6` e `ECNH_USER_7` estão em `docs/evidencias/003a-consolidacao-validacao-2026-07-19.json`;
- o portal rejeita re-login imediato da mesma conta; a série oficial usa credenciais distintas.

**Resultado:** a Fase 003A avança para `Validada`.

### Descoberta e implementação do logout HTTP em 19/07/2026

**Evidências confirmadas:**

- a página autenticada referencia `/gefor/global/menu_items.jsp`;
- o menu declara `{name:"Sair", url:".../login.do?method=finalizarLogin..."}`;
- `GET /gefor/SGU/login.do?method=finalizarLogin` retornou HTTP 200, `LoginActionForm` presente e marcador autenticado ausente;
- re-login imediato da mesma conta após o logout retornou `sucesso`;
- consolidação em `docs/evidencias/003a-consolidacao-logout-2026-07-19.json`.

**Implementação:** `ECNHClient.logout()` envia o GET confirmado e limpa a sessão local em seguida.

**Resultado:** a Fase 003A avança para `Concluída`.

## Pendências

- observar respostas de senha inválida, usuário bloqueado e erro do sistema (fora do bloqueio para conclusão desta fase).

## Critérios de sucesso

- [x] Autenticação HTTP usa apenas endpoint, método e parâmetros observados.
- [x] CookieJar é preservado entre requisições pelo Axios.
- [x] Sucesso depende dos sinais de cookie e HTML confirmados.
- [x] `npm run test:login` informa início, transporte, sessão, resultado e falhas.
- [x] Executar o teste com ambiente e credenciais autorizadas.
- [x] Confirmar autenticação real com evidência sanitizada, hash e sinais estruturais preservados.
- [x] Executar logout HTTP após descobrir seu endpoint.

## Dificuldades e limitações

O portal tende a rejeitar re-login imediato da mesma conta sem logout HTTP. Após `method=finalizarLogin`, o re-login imediato foi observado com sucesso. Senha inválida, usuário bloqueado e erro do sistema continuam sem sinais HTTP/HTML confirmados. O CookieJar pode ainda conter `JSESSIONID` após o logout remoto; por isso a limpeza local permanece obrigatória.

## Próximos passos

Iniciar a Fase 003B — Navegação autenticada. Não antecipar parsing de agenda nem Sheets.

## Resultado da fase

MVP de login HTTP, transporte Axios com agentes persistentes, CookieJar, tipagem de resultado, logs estruturados, teste, validação reproduzível e logout HTTP (`method=finalizarLogin`) foram implementados e comprovados. A Fase 003A está `Concluída`.
