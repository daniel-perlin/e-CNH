# Limitações conhecidas do portal (homologação)

Documento de **limitações conhecidas** observadas na homologação pós-MVP.

Itens de evolução: [BACKLOG.md](BACKLOG.md) — **B010**, **B011** e **B012** `✅ Concluídos`.

## Caso 1 — Sessão já autenticada

**Classificação:** evidência confirmada; **automação entregue (B010 / Fase 003E)**.

Durante o login, alguns profissionais podem possuir uma sessão já aberta. O portal responde ao `POST method=autenticar` (`forceLogout=false`) com HTML ainda de login e chamada JavaScript `openDialogNewSession`.

**Estado atual:** tratado genericamente no `ECNHAuthenticationProtocol`: detectar `openDialogNewSession` → `POST autenticar` com `forceLogout=true` no mesmo CookieJar → continuar B011/B012. Validado com profissional real.

**Backlog:** [B010](BACKLOG.md) — `✅ Concluído`. Artefato: [evidencias/003e-consolidacao-force-logout-2026-07-19.json](evidencias/003e-consolidacao-force-logout-2026-07-19.json).

## Caso 2 — Escolha de Perfil / Visão

**Classificação:** evidência confirmada; **automação entregue (B011 / Fase 003D)**.

Profissionais com múltiplas unidades recebem `openDialogChoice` → tela **"Escolha de Perfil e/ou Visão"**.

**Estado atual:** tratado genericamente via `ECNH_USER_<n>_UNIDADE` / `UNID_TRANSITO` (segundo `POST method=autenticar` com `idUnidTransito`). Validado com profissional multi-unidade real.

**Backlog:** [B011](BACKLOG.md) — `✅ Concluído`. Conceito distinto do `PerfilProfissionalPortal` (B012).

## Escopo

B010, B011 e B012 estão automatizados no login HTTP. Este documento permanece como registro histórico dos comportamentos do portal.
