# Fase 003D — Escolha de Perfil e/ou Visão (unidade)

**Status:** `Concluída`

## Objetivo

Adicionar suporte **genérico** ao comportamento do portal **"Escolha de Perfil e/ou Visão"** após o `POST method=autenticar`, permitindo que qualquer profissional com múltiplas unidades complete o login HTTP e alcance a área autenticada onde o B012 resolve o perfil e a agenda.

Backlog: **B011** (`✅ Concluído`).

## Escopo

- detecção de `openDialogChoice`;
- `GET method=openChoice`;
- resolução da unidade via config (`UNIDADE` / `UNID_TRANSITO`);
- segundo `POST method=autenticar` com `idUnidTransito`;
- continuidade do critério B012;
- testes unitários, evidências e documentação.

## Fora de escopo

- B010; CyberArk; hardcode de profissional/`idUnidTransito`; alterações em `PerfilProfissionalPortal`.

## Evidências

### Validação real (19/07/2026)

**Evidências confirmadas** (profissional multi-unidade / `ECNH_USER_17`):

- `openDialogChoice` detectado após o primeiro `autenticar`;
- `GET method=openChoice` executado;
- unidade `CIR-SAO PAULO` → value `18` (via `UNIDADE`);
- segundo `POST method=autenticar` com `idUnidTransito=18`;
- B012: perfil `medico`, `consultarAgendaMedico`;
- parser: 49 itens em 4 datas;
- sync Sheets: sucesso; 25 linhas gravadas em datas futuras (B005).

Artefato: [docs/evidencias/003d-consolidacao-escolha-unidade-2026-07-19.json](../docs/evidencias/003d-consolidacao-escolha-unidade-2026-07-19.json).

Descoberta do contrato: [docs/evidencias/003d-descoberta-enviar-escolha-unidade-2026-07-19.json](../docs/evidencias/003d-descoberta-enviar-escolha-unidade-2026-07-19.json).

## Critérios de sucesso

- [x] Profissional sem diálogo continua no caminho B012.
- [x] Profissional com diálogo e config válida completa login + B012.
- [x] Validação real com evidência sanitizada.
- [x] Sync completo do caso de validação.

## Progresso

| Passo | Estado |
| ----- | ------ |
| 0 — Documentação | Feito |
| 1 — Descoberta do POST ENVIAR | Feito |
| 2 — Contratos e parse | Feito |
| 3 — Protocolo HTTP da escolha | Feito |
| 4 — Configuração | Feito |
| 5 — Validação real | Feito |
| 6 — Fechamento documental | Feito |

## Pendências

- Nenhuma pendência bloqueante no escopo da Fase 003D / B011.
- B010 permanece no backlog (sessão já autenticada).

## Resultado da fase

Suporte genérico à escolha de unidade/visão entregue, validado com profissional multi-unidade real (login, unidade, B012, agenda, sync) e documentado. Fase 003D e B011 `Concluída` / `✅ Concluído`.
