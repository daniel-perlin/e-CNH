# Deploy no Railway — sincronização diária (Cron efêmero)

Guia operacional para colocar o e-CNH em produção no Railway **sem alterar** a lógica de sincronização.
Checklist acionável: [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md) · Decisão: ADR-020 em [DECISOES.md](DECISOES.md).

---

## 1. Arquitetura (Opção A)

```text
Railway Cron (UTC)  →  sobe o serviço
                    →  node dist/index.js  (= npm start)
                    →  [padrão] scripts/sync-agenda.js
                    →  AgendaSyncJob + FileSyncLock
                    →  process.exit(0|1)  →  processo encerra
```

### Modo diagnóstico de conectividade (permanente)

Para isolar rede Railway ↔ portal (Imperva) **sem** trocar o Start Command:

1. Defina `RUN_CONNECTIVITY_PROBE=true` nas Variables.
2. Redeploy / Run uma vez (`node dist/index.js` inalterado).
3. Leia nos logs `ecnh.connectivity.probe.success` ou `…failed`.
4. Remova a variável (ou `=false`) e redeploy para voltar ao sync.

| `RUN_CONNECTIVITY_PROBE` | Comportamento de `node dist/index.js` |
| --- | --- |
| ausente / `false` / `0` | AgendaSync (padrão, produção) |
| `true` / `1` / `yes` / `on` | Só GET `iniciarLogin` via `AuthTransport`; encerra |

CLI equivalente (local ou prod build): `npm run test:ecnh-connectivity` / `test:ecnh-connectivity:prod`.

| Alternativa | Quando usar |
| --- | --- |
| **A — Cron efêmero** (produção) | Uma vez por dia às 16:00 BRT; sobe, sincroniza, desliga |
| **B — `npm run job:agenda`** | Daemon local 24/7 com `node-cron` (ADR-013); **não** use como Start no Railway Cron |

O horário **não** vem de `AGENDA_SYNC_CRON` no serviço de produção: vem do **Cron Schedule** do Railway.

---

## 2. O que o repositório já traz

| Artefato | Função |
| --- | --- |
| `railway.toml` | `buildCommand=npm run build`, `startCommand=node dist/index.js`, `restartPolicyType=NEVER` |
| `package.json` → `start` | `node dist/index.js` → delega a `sync-agenda` (one-shot, sem `tsx`) |
| `dist/scripts/sync-agenda.js` | Fluxo E2E; também executável direto |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service Account só por variável (sem arquivo em `secrets/`) |
| `process.exit` em `sync-agenda` | Garante encerramento mesmo com HTTP keep-alive |

**Não é necessário no Cron Railway:** `node-cron`, volume persistente, pasta `secrets/`, path `GOOGLE_SHEETS_CREDENTIALS_PATH`.

O lock escreve em `.data/agenda-sync.lock` (criado automaticamente no FS efêmero). Com um único Cron por vez, isso é suficiente — sem volume.

---

## 3. Pré-requisitos

1. Conta Railway + repositório GitHub deste projeto.
2. JSON da Google Service Account (conteúdo completo).
3. Planilha compartilhada com o e-mail da SA (**Editor**).
4. Variáveis dos profissionais habilitados (mesmo conteúdo do `.env` local).
5. Node **≥ 20** (`engines` no `package.json`).

---

## 4. Passo a passo no painel Railway

### 4.1 Criar o serviço

1. New Project → Deploy from GitHub → selecione este repo.
2. Confirme branch (ex.: `main`).
3. Aguarde o primeiro build ou dispare Deploy.

### 4.2 Build e Start

Valores já definidos em `railway.toml` (confira em Settings se o painel sobrescreveu):

| Setting | Valor |
| --- | --- |
| Builder | Nixpacks |
| Build Command | `npm run build` |
| Start Command | `node dist/index.js` (ou `npm start`) |
| Restart Policy | **NEVER** |

> Se o processo **não** encerrar, o próximo Cron é **ignorado** pela plataforma.

### 4.3 Cron Schedule

1. Settings → Cron Schedule (ou equivalente “Cron Job”).
2. Expressão: **`0 19 * * *`**
3. Railway avalia em **UTC**.
4. `16:00` em `America/Sao_Paulo` (UTC−3; Brasil sem DST desde 2019) = **19:00 UTC** = `0 19 * * *`.

### 4.4 Variáveis (Variables)

Cole **todas** as obrigatórias (seção 5). Use “Secret” para senhas e para `GOOGLE_SERVICE_ACCOUNT_JSON`.

**Como colar o JSON da SA**

1. Abra o arquivo local da Service Account (nunca commitar).
2. Copie o JSON **inteiro** (uma linha ou multilinha, conforme o painel aceitar).
3. Crie a variável `GOOGLE_SERVICE_ACCOUNT_JSON` com esse valor.
4. Não configure `GOOGLE_SHEETS_CREDENTIALS_PATH` neste serviço.

---

## 5. Variáveis de ambiente

### Obrigatórias

| Variável | Descrição |
| --- | --- |
| `ECNH_BASE_URL` | Base URL do portal e-CNH |
| `ECNH_USER_<n>_ENABLED=true` | Profissional habilitado |
| `ECNH_USER_<n>_NAME` | Nome completo (config) |
| `ECNH_USER_<n>_CPF` | CPF |
| `ECNH_USER_<n>_PASSWORD` | Senha |
| `ECNH_USER_<n>_CLINIC` | Clínica → coluna UNIDADE |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | ID da planilha |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON completo da Service Account |

Repita o bloco `ECNH_USER_<n>_…` para cada índice habilitado (1, 2, 3…).

### Recomendadas / opcionais

| Variável | Notas |
| --- | --- |
| `NODE_ENV` | `production` |
| `GOOGLE_SHEETS_SHEET_NAME` | Default `Agenda` |
| `ECNH_USER_<n>_PROFILE` | `psicologo` \| `medico` |
| `ECNH_USER_<n>_UNIDADE` / `UNID_TRANSITO` | Multi-unidade (B011) |
| `LOG_LEVEL` | O script de sync usa logger em nível warn |
| `AGENDA_SYNC_LOCK_PATH` | Default `.data/agenda-sync.lock` (auto-criado) |
| `RUN_CONNECTIVITY_PROBE` | `true` só para diagnóstico de rede (não deixe ligado em produção diária) |

### Proibido / desnecessário neste serviço

| Variável / comando | Motivo |
| --- | --- |
| `AGENDA_SYNC_CRON` | Horário = Cron do Railway |
| `npm run job:agenda` como Start | Daemon 24/7 (Opção B), não Cron efêmero |
| `GOOGLE_SHEETS_CREDENTIALS_PATH` | Preferir JSON inline |
| Catálogo `secrets/credenciais-candidatas.json` | Só refresh/audit local |
| `RUN_CONNECTIVITY_PROBE=true` em regime diário | Só diagnóstico pontual; depois remova |

---

## 6. Expressões cron

| Objetivo | Onde | Expressão |
| --- | --- | --- |
| Todos os dias **16:00 BRT** | Railway Cron Schedule | `0 19 * * *` (UTC) |
| Equivalente no daemon local | `AGENDA_SYNC_CRON` + `AGENDA_SYNC_TZ` | `0 16 * * *` + `America/Sao_Paulo` |

---

## 7. Scripts

| Script | Ambiente | Uso |
| --- | --- | --- |
| `npm run build` | CI / Railway / local | Compila `src/` → `dist/` |
| `npm start` / `node dist/index.js` | **Railway** | Sync one-shot e `process.exit` |
| `npm run sync:agenda:prod` | local/CI | Mesmo entrypoint que `start` |
| `node dist/scripts/sync-agenda.js` | equivalente | Mesmo fluxo (sem passar por `index.js`) |
| `npm run sync:agenda` | local | Via `tsx` + `.env` |
| `npm run job:agenda` | local | Daemon; **não** usar no Cron Railway |

### Validação local do binário de produção (sem deploy)

```bash
npm run build
# Simula ausência de .env (só variáveis do ambiente):
DOTENV_CONFIG_PATH=/tmp/ecnh-empty.env \
  env -i PATH="$PATH" HOME="$HOME" \
  DOTENV_CONFIG_PATH=/tmp/ecnh-empty.env \
  NODE_ENV=production \
  npm start
```

Esperado: falha rápida por variável ausente e **exit code 1** (processo não fica pendurado).

Com variáveis reais (local), `npm start` executa o mesmo fluxo do Railway.

---

## 8. Validação pós-deploy

Siga [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md). Em resumo:

1. Build verde nos logs Railway.
2. **Run manual** uma vez → resumo no log → processo encerra → planilha atualiza.
3. Aguardar (ou adiantar) o Cron `0 19 * * *` → mesma verificação.
4. Confirmar ausência de CPF/senha nos logs.

---

## 9. Riscos conhecidos

| Risco | Mitigação |
| --- | --- |
| Cron UTC lido como BRT | Usar `0 19 * * *` para 16:00 BRT |
| Processo que não encerra | `process.exit` no `sync-agenda`; Restart `NEVER` |
| `erro-infraestrutura` Sheets sob carga | Observado localmente; próxima janela / retry operacional |
| Lock em FS efêmero | Um Cron por vez; arquivo auto-criado; stale configurado |
| Secrets no git | Só Variables do Railway |
| Conta portal bloqueada | Operacional (fora do código) |

---

## 10. Próximos passos

1. Marcar o [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md) item a item.
2. Criar o serviço, colar Variables, configurar Cron.
3. Run manual → primeiro Cron.
4. (Opcional) alerta em `exitCode !== 0`.
