# Checklist de deploy — Railway (Cron efêmero)

Use este checklist **na ordem**. Não marque item sem evidência.
Guia detalhado: [DEPLOY_RAILWAY.md](DEPLOY_RAILWAY.md) · ADR: [DECISOES.md](DECISOES.md) (ADR-020).

> Esta etapa é só infraestrutura. Não altera regras de sincronização.

---

## Antes de criar o serviço (repo)

- [ ] `npm run build` conclui sem erro localmente
- [ ] `npm start` aponta para `node dist/index.js` (delega a `sync-agenda`; ver `package.json`)
- [ ] `railway.toml` presente com `startCommand = "node dist/index.js"` e `restartPolicyType = NEVER`
- [ ] Service Account disponível como JSON (conteúdo para `GOOGLE_SERVICE_ACCOUNT_JSON`)
- [ ] Planilha compartilhada com o e-mail da Service Account (**Editor**)
- [ ] Lista de variáveis `ECNH_USER_*` habilitados pronta (copiar do `.env` local, sem commit)
- [ ] Documentação lida: este checklist + [DEPLOY_RAILWAY.md](DEPLOY_RAILWAY.md)

---

## Criação do serviço

- [ ] Conta Railway criada
- [ ] Projeto Railway criado
- [ ] Repositório GitHub conectado ao serviço
- [ ] Branch de deploy definida (ex.: `main`)
- [ ] Build Command: `npm run build` (ou herdado do `railway.toml`)
- [ ] Start Command: `node dist/index.js` (ou `npm start`; herdado do `railway.toml`)
- [ ] Restart policy: **NEVER** (Cron não deve reiniciar em loop)

---

## Variáveis de ambiente

### Portal

- [ ] `ECNH_BASE_URL`
- [ ] `NODE_ENV=production` (recomendado)

### Google Sheets

- [ ] `GOOGLE_SHEETS_SPREADSHEET_ID`
- [ ] `GOOGLE_SERVICE_ACCOUNT_JSON` (JSON completo da SA, em Variable secreta)
- [ ] `GOOGLE_SHEETS_SHEET_NAME=Agenda` (opcional se já for o default)

### Profissionais (`ECNH_USER_<n>_…` para cada habilitado)

Para cada `n` com `ENABLED=true`:

- [ ] `ECNH_USER_<n>_ENABLED=true`
- [ ] `ECNH_USER_<n>_NAME`
- [ ] `ECNH_USER_<n>_CPF`
- [ ] `ECNH_USER_<n>_PASSWORD`
- [ ] `ECNH_USER_<n>_CLINIC`
- [ ] `ECNH_USER_<n>_PROFILE` (recomendado: `psicologo` | `medico`)
- [ ] `ECNH_USER_<n>_UNIDADE` / `UNID_TRANSITO` (só se multi-unidade / B011)

### Não configurar no serviço Cron

- [ ] Confirmado: **sem** `AGENDA_SYNC_CRON` (horário vem do Cron do Railway)
- [ ] Confirmado: **sem** path local `GOOGLE_SHEETS_CREDENTIALS_PATH` (usar JSON inline)
- [ ] Confirmado: Start **não** é `npm run job:agenda` (daemon 24/7)

---

## Cron

- [ ] Cron Schedule no painel: `0 19 * * *`
- [ ] Entendido: Railway usa **UTC**; `0 19 * * *` ≡ **16:00** `America/Sao_Paulo`
- [ ] Serviço marcado como Cron Job / schedule ativo

---

## Teste manual (antes do primeiro tick)

- [ ] Deploy do build concluído com sucesso (logs de build OK)
- [ ] Execução manual (“Run” / trigger) disparada uma vez
- [ ] Processo **encerrou** (exit 0 ou 1) — não ficou idle
- [ ] Log mostra resumo da sincronização **sem** CPF/senha
- [ ] Planilha Google atualizada (linhas/datas coerentes)
- [ ] Em caso de `exit 1`, causa identificada (credencial, portal, Sheets) e corrigida

---

## Primeiro Cron agendado

- [ ] Aguardar o horário `0 19 * * *` UTC (ou temporariamente adiantar o cron para validar)
- [ ] Execução automática apareceu nos logs do Railway
- [ ] Processo encerrou após o sync
- [ ] Planilha refletiu a rodada
- [ ] Nenhuma execução sobreposta / travada

---

## Logs e operação

- [ ] Logs acessíveis no painel Railway
- [ ] Sem vazamento de CPF, senha, cookies ou HTML nos logs
- [ ] (Opcional) alerta em falha (`exitCode !== 0`) configurado

---

## Critério de conclusão

Marque **Pronto em produção** somente se:

1. Build + Start + variáveis + Cron estiverem OK  
2. Teste manual OK  
3. Pelo menos **um** Cron agendado OK  

| Campo | Valor |
| --- | --- |
| Pronto em produção | ☐ SIM / ☐ NÃO |
| Data da validação | |
| Responsável | |
