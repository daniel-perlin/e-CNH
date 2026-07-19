# Checkpoint da evidência de autenticação

## Objetivo

Consolidar a evidência histórica atribuída a uma autenticação real do `ECNHClient` e verificar se ela sustenta o status `Validada` da Fase 003A.

Nenhum código ou protocolo foi alterado neste checkpoint.

## Eventos que não devem ser confundidos

Existem dois eventos diferentes:

1. uma execução instrumentada de `ECNHClient.login()` retornou `status=sucesso`, mas não salvou a resposta;
2. uma execução anterior e direta de `AuthTransport` salvou HTML autenticado, mas não usou o fluxo atual nem passou por `ECNHClient.login()`.

As evidências de um evento não podem ser atribuídas ao outro.

## 1. Execução classificada como bem-sucedida

A classificação ocorreu na primeira execução instrumentada da auditoria HTTP/TLS, registrada na sessão de 18/07/2026 às 20:08.

O script temporário:

- importou `ECNHClient`;
- criou um cliente novo com a configuração autorizada;
- instrumentou eventos de `ClientRequest` e `TLSSocket`;
- chamou `await client.login(cpf, password)`;
- imprimiu `resultado: "sucesso"`;
- registrou HTTP 200 nas três etapas.

A execução não foi `npm run test:login`; foi um script temporário executado com `npx tsx -`.

## 2. Critério usado

O critério do código era:

```text
CookieJar contém JSESSIONID
E
HTML final contém "Imprimir Agenda Diária do Psicólogo"
```

Somente quando ambos são verdadeiros, `ECNHAuthenticationProtocol.login()` retorna `status=sucesso`.

O script imprimiu apenas o resultado final. Ele não imprimiu separadamente os dois booleanos.

## 3. Log preservado

**Não existe log durável dessa execução no repositório.**

O logger foi substituído por uma implementação vazia durante a instrumentação. O resultado apareceu somente na saída temporária da ferramenta. Essa saída não foi salva como arquivo de evidência do projeto.

## 4. HTML preservado

**Não existe HTML preservado da execução instrumentada do `ECNHClient`.**

O script coletou tamanho e eventos de transporte, mas não salvou `response.data`.

## 5. SHA-256

**Não existe SHA-256 da resposta da execução instrumentada do `ECNHClient`.**

O hash `89ad2194171b2c7622f697b98590c0c7eb40675439adef682cc227aec0e072f2` pertence à resposta final do Chrome preservada no HAR, não à execução do cliente.

## 6. Arquivo salvo

**Não existe arquivo salvo da execução instrumentada do `ECNHClient`.**

Existe `/tmp/ecnh-login-before.html`, produzido em uma execução anterior de `AuthTransport`. Esse arquivo:

- possui HTML autenticado;
- contém o formulário protegido `DivisaoEquitativaForm`;
- não contém `LoginActionForm`;
- contém o marcador esperado;
- representa um POST direto com payload anterior;
- não executou GET → `iniciarLoginAgenda` → `autenticar`;
- não chamou `ECNHClient.login()`;
- não verificou `JSESSIONID` como critério conjunto.

O arquivo temporário possui 72.200 bytes em UTF-8 e SHA-256 `9242be8d62e1ec37065a1043a3afece8e817b91c3ee8e77097e1a69bca47718d`. Ao reconstruir os bytes Latin-1 da resposta, possui 72.162 bytes e SHA-256 `301a489dc8edb551063b19899d57121350195495d1ef201ad184ee5c04dff805`.

Esse artefato comprova que o portal retornou uma página autenticada a um diagnóstico HTTP anterior. Não comprova a execução posterior do `ECNHClient`.

## 7. Marcador autenticado

Na execução instrumentada do `ECNHClient`, a presença do marcador é inferida pelo retorno `status=sucesso`, pois o código exige esse texto.

Não existe resposta salva que permita verificar o marcador independentemente.

No arquivo temporário do diagnóstico anterior, o marcador está comprovadamente presente. Trata-se de outra execução e de outro contrato de request.

## 8. Estado autenticado do `ECNHClient`

O `ECNHClient` entrou em estado autenticado **internamente** nessa execução:

1. o protocolo retornou `status=sucesso`;
2. `ECNHClient.login()` chamou `SessionManager.markAuthenticated()`;
3. o resultado final incluiu uma sessão autenticada em memória.

Esse estado foi derivado dos dois sinais implementados. Não houve navegação protegida posterior que comprovasse a validade da sessão no servidor.

Portanto:

- estado interno do cliente: confirmado pela saída `sucesso` e pelo caminho determinístico do código;
- autenticação externa verificável: inferida pelos sinais, sem artefato próprio preservado;
- navegação autenticada posterior: não executada.

## Reprodutibilidade

Após a execução isolada:

- três execuções instrumentadas não repetiram o sucesso;
- a bateria posterior de vinte execuções com conexão persistente produziu zero sucessos;
- todas as vinte terminaram sem `ECONNRESET`;
- uma execução adicional retornou HTTP 200 nas três etapas, `JSESSIONID` presente e marcador ausente.

A classificação `sucesso` não foi reproduzida.

## Conclusão técnica

Há evidência de que o código retornou `sucesso` uma vez e marcou a sessão interna. Contudo, não há log durável, HTML, hash ou arquivo dessa execução que permita comprovação independente. O HTML autenticado preservado pertence a outro diagnóstico e não valida a implementação atual.

Pela convenção do projeto, `Validada` exige critérios executados com evidências registradas. A implementação atual não atende esse requisito de forma reproduzível e auditável.

**Reclassificação histórica:** a Fase 003A retornou de `Validada` para `Implementada` por falta de evidência durável naquele momento.

**Atualização em 19/07/2026:** a validação reproduzível posterior aprovou cinco autenticações distintas com hashes e sinais estruturais; a fase está novamente `Validada`. Consulte [VALIDACAO_REPRODUZIVEL_003A.md](VALIDACAO_REPRODUZIVEL_003A.md).
