# Limitações conhecidas do portal (homologação)

Documento de **limitações conhecidas** observadas na homologação pós-MVP.

Itens de evolução: [BACKLOG.md](BACKLOG.md) — `B010` pendente; **B011** e **B012** `✅ Concluídos`.

## Caso 1 — Sessão já autenticada

**Classificação:** evidência confirmada (observação manual no portal).

Durante o login, alguns profissionais podem possuir uma sessão já aberta. O portal exibe um **popup** pedindo o encerramento da sessão anterior antes de a autenticação continuar (`openDialogNewSession` / `forceLogout`).

**Estado atual:** o sistema **não trata** esse popup automaticamente.

**Mitigação operacional:** encerrar a sessão anterior no portal antes de nova tentativa de sync.

**Backlog:** [B010](BACKLOG.md) — Tratar sessão já autenticada no portal.

## Caso 2 — Escolha de Perfil / Visão

**Classificação:** evidência confirmada; **automação entregue (B011 / Fase 003D)**.

Profissionais com múltiplas unidades recebem `openDialogChoice` → tela **"Escolha de Perfil e/ou Visão"**.

**Estado atual:** tratado genericamente via `ECNH_USER_<n>_UNIDADE` / `UNID_TRANSITO` (segundo `POST method=autenticar` com `idUnidTransito`). Validado com profissional multi-unidade real.

**Backlog:** [B011](BACKLOG.md) — `✅ Concluído`. Conceito distinto do `PerfilProfissionalPortal` (B012).

## Escopo

B010 permanece fora de automação até priorização explícita via backlog.
