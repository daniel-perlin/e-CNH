# Limitações conhecidas do portal (homologação)

Documento de **limitações conhecidas** observadas na homologação pós-MVP. Estes fluxos **existem no portal** e **ainda não são tratados automaticamente** pelo `ECNHClient` / sincronização.

Itens de evolução: [BACKLOG.md](BACKLOG.md) — `B010`, `B011` (reavaliar; **B012** já está `✅ Concluído`).

## Caso 1 — Sessão já autenticada

**Classificação:** evidência confirmada (observação manual no portal).

Durante o login, alguns profissionais podem possuir uma sessão já aberta. O portal exibe um **popup** pedindo o encerramento da sessão anterior antes de a autenticação continuar.

**Estado atual:** o sistema **não trata** esse popup. Sem encerrar a sessão manualmente, a sincronização automática fica bloqueada (ex.: profissional Italo).

**Mitigação operacional:** encerrar a sessão anterior no portal antes de nova tentativa de sync.

**Backlog:** [B010](BACKLOG.md) — Tratar sessão já autenticada no portal.  
**Reavaliação:** **B012** concluída. Reavaliar se este item permanece necessário como evolução distinta.

## Caso 2 — Escolha de Perfil / Visão

**Classificação:** evidência confirmada (observação manual no portal).

Alguns profissionais têm acesso a múltiplas unidades. Após o login, o portal apresenta a tela **"Escolha de Perfil e/ou Visão"**.

**Exemplo homologado (Caio):**

1. Selecionar a unidade **CIR-SAO PAULO**;
2. Clicar em **ENVIAR**.

**Estado atual:** esse passo **não é automatizado**. Sem a seleção, a sincronização automática do profissional Caio fica impedida.

**Backlog:** [B011](BACKLOG.md) — Automatizar seleção de Perfil / Visão (unidade no portal; conceito distinto de B012).  
**Reavaliação:** **B012** concluída. Reavaliar se este item permanece necessário como evolução distinta.

## Escopo

Não implementar automação destes fluxos até priorização explícita via backlog, salvo decisão contrária registrada.
