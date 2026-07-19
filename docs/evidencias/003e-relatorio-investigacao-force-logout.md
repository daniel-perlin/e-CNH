# Relatório técnico — B010 / Fase 003E (investigação)

**Data:** 2026-07-19  
**Escopo:** congelar o contrato HTTP de `openDialogNewSession` / `forceLogout` **sem** implementar código de produção.  
**Disciplina:** mesma do B011 (descoberta HTTP + JS do portal → contrato → ADR → implementação futura).  
**Classificação geral:** evidência confirmada (HTTP real + `login.js`), com pendências explícitas abaixo.

Artefatos:

- Descoberta sanitizada: [003e-descoberta-force-logout-2026-07-19T20-15-26-238Z.json](003e-descoberta-force-logout-2026-07-19T20-15-26-238Z.json)
- Contrato congelado: [003e-contrato-congelado-force-logout-2026-07-19.json](003e-contrato-congelado-force-logout-2026-07-19.json)
- Fase: [.fases/003e-sessao-existente-force-logout.md](../../.fases/003e-sessao-existente-force-logout.md)

---

## 1. Após o primeiro `POST method=autenticar` (`forceLogout=false`)

### Marcadores HTML (evidência confirmada)

| Sinal | Valor observado |
| ----- | --------------- |
| `openDialogNewSession(...)` no HTML | presente |
| `LoginActionForm` | presente |
| Marcador autenticado (B012) | ausente |
| `DivisaoEquitativaForm` | ausente |
| `openDialogChoice` / `openChoice` | ausente |
| Hidden `forceLogout` | presente, valor `false` |
| HTTP status | 200 |
| Header `Location` | ausente |

O HTML permanece na tela de login. A autenticação **não** falhou por senha inválida no sentido clássico: o portal sinaliza sessão prévia e pede encerramento via diálogo.

### Scripts JS relevantes

Carregados na página de login (entre outros): `/GFR/js/app/sgu/login.js`, GreyBox (`AJS.js`, `gb_scripts.js`), jQuery, bootstrap.

### Funções chamadas (evidência confirmada via HTML + `login.js`)

1. `callAppFunctions()` (inline) — quando `!temErros`.
2. `openDialogNewSession(cpf, senha, autenticadoCyberark)` — abre GreyBox com URL  
   `.../SGU/login.do?method=openDialogNewSession&cpfUsuario=...&senha=...&autenticadoCyberark=...`.

Nesta descoberta: `autenticadoCyberark='false'`. A variante `openDialogNewSessionWithCyberark` **não** foi exercitada (**pendência de validação**).

---

## 2. Clique em “Encerrar sessões anteriores” (ou equivalente)

### Caminho de browser (evidência confirmada via `login.js`)

O botão do diálogo (UI GreyBox) resulta em chamada a **`forceLogout()`**, que:

1. Obtém `LoginActionForm` no documento pai (`parent.parent`);
2. (Re)preenche `codigo`, `senha`, `autenticadoCyberark` quando o fluxo do diálogo fornece esses valores;
3. Define `method=autenticar`;
4. Define **`forceLogout=true`**;
5. Chama `top.showWait(true)` e `myForm.submit()`.

### Texto exato do botão

**Pendência de validação:** o HTML do GreyBox (`GET method=openDialogNewSession`) não foi baixado nesta etapa (evita query string com senha e não é necessário ao contrato HTTP mínimo). O rótulo operacional usado na homologação manual continua sendo “encerrar sessão anterior”; a automação deve ancorar em `forceLogout()`, não em texto de UI.

---

## 3. Requests HTTP disparados

### Sequência mínima para automação (contrato congelado)

| # | Método | URL | Papel |
| - | ------ | --- | ----- |
| 1 | GET | `/gefor/SGU/login.do?method=iniciarLogin` | Bootstrap / cookies |
| 2 | POST | `/gefor/SGU/login.do` (`method=iniciarLoginAgenda`) | Contexto agenda |
| 3 | POST | `/gefor/SGU/login.do` (`method=autenticar`, `forceLogout=false`) | Credenciais |
| 4 | POST | `/gefor/SGU/login.do` (`method=autenticar`, **`forceLogout=true`**) | Encerrar sessão anterior + autenticar |

CookieJar: o mesmo da etapa 3 (JSESSIONID presente).  
Content-Type: `application/x-www-form-urlencoded`.  
Headers: os já usados pelo cliente HTTP do projeto (User-Agent etc.); nenhum header especial além do fluxo normal de login foi necessário.

### UI-only (não obrigatório na automação)

| # | Método | URL | Papel |
| - | ------ | --- | ----- |
| 3b | GET | `...login.do?method=openDialogNewSession&cpfUsuario=...&senha=...&autenticadoCyberark=...` | Conteúdo do GreyBox |

**Evidência confirmada:** o atalho HTTP (pular 3b e ir direto ao passo 4) produziu área autenticada com marcador B012.

### Corpo do passo 4 (diferença crítica)

Igual ao autenticar inicial, **exceto** `forceLogout=true`. Campos observados:

`method`, `novaSenha`, `novaSenha1`, `alteraSenha`, `idGrupoUsuario`, `idCFC`, `idUnidTransito`, `msgPublicacao`, `consultaAgenda`, `autenticadoCyberark`, `codigo`, `senha`, `forceLogout`.

---

## 4. Após o `forceLogout` (`POST autenticar` com `forceLogout=true`)

| Pergunta | Resposta | Classificação |
| -------- | -------- | ------------- |
| Existe redirect (`Location`)? | Não | evidência confirmada |
| Existe novo POST autenticar além deste? | Não (este *é* o autenticar de forceLogout) | evidência confirmada |
| Existe GET intermediário obrigatório? | Não | evidência confirmada |
| Muda o JSESSIONID? | Sem `Set-Cookie` JSESSIONID na resposta; cookie permanece presente; valor **não** comparado | hipótese: mesma sessão |
| Existe novo token? | Nenhum campo de token novo observado; `autenticadoCyberark` permanece `false` | evidência confirmada neste caso |
| Resultado HTML | Marcador autenticado + perfil `psicologo` + `DivisaoEquitativaForm`; sem `openDialogNewSession` | evidência confirmada |

---

## 5. Sequência HTTP congelada (resumo)

```
GET  iniciarLogin
POST iniciarLoginAgenda
POST autenticar (forceLogout=false)
  └─ se openDialogNewSession → POST autenticar (forceLogout=true)  [B010]
  └─ senão → classificação B011 / B012 como hoje
```

Ordem exata e campos: ver JSON do contrato congelado.

---

## 6. Genericidade

**Evidência confirmada:** o gatilho é o marcador genérico `openDialogNewSession` após `autenticar`, não o nome do profissional, clínica ou índice `ECNH_USER_*`.

A descoberta usou `ECNH_USER_3` apenas como veículo de reprodução. A automação recomendada:

- detectar o marcador;
- reenviar o mesmo autenticar com `forceLogout=true` no mesmo CookieJar;
- seguir para B011 (se `openDialogChoice`) e/ou B012.

Não exige configuração nova por profissional. Não deve haver lógica nominativa.

**Hipótese (não bloqueante):** após forceLogout, um profissional multi-unidade ainda pode cair em B011; a ordem correta no protocolo é B010 → B011 → B012.

---

## Diagnóstico

O login do profissional que “trava” em `erro_desconhecido` / sem marcador B012, com `JSESSIONID` e HTML ainda de login, é compatível com **sessão já aberta (B010)**, não com falha de senha genérica nem com B011.

O cliente atual envia sempre `forceLogout=false` e não trata o ramo; por isso a sincronização aborta antes da agenda.

---

## Recomendação arquitetural (implementação futura — fora desta etapa)

1. Tratar o ramo **dentro** de `ECNHAuthenticationProtocol`, após o primeiro `autenticar` e **antes** de B011/B012.
2. Detecção por marcador `openDialogNewSession` (espelhar a disciplina de `openDialogChoice`).
3. Um único POST adicional: `autenticar` com `forceLogout=true` (mesmos campos/credenciais/CookieJar).
4. **Não** automatizar GreyBox/`GET openDialogNewSession` na implementação.
5. **Não** usar Playwright.
6. Zero regras por profissional; zero config obrigatória.
7. Erros tipados se, após forceLogout, o diálogo persistir ou o marcador B012/B011 não aparecer.
8. Registrar ADR próprio (proposta em `docs/DECISOES.md`) e só então alterar `src/`.

Status desta etapa de investigação: contrato congelado.  
**Atualização (19/07/2026):** implementação e validação concluídas — ver [003e-consolidacao-force-logout-2026-07-19.json](003e-consolidacao-force-logout-2026-07-19.json) e [.fases/003e-sessao-existente-force-logout.md](../../.fases/003e-sessao-existente-force-logout.md).
