# Fase 003E — Sessão já autenticada (`forceLogout`)

**Status:** `Concluída`

## Objetivo

Adicionar suporte **genérico** ao comportamento do portal de **sessão já aberta** após `POST method=autenticar` (`openDialogNewSession` / `forceLogout`), permitindo que qualquer profissional nessa condição complete o login HTTP e alcance B011/B012.

Backlog: **B010** (`✅ Concluído`).

## Escopo

- detecção de `openDialogNewSession`;
- `POST method=autenticar` com `forceLogout=true` no mesmo CookieJar;
- continuidade para B011 (se `openDialogChoice`) e/ou B012;
- testes unitários, evidências e documentação.

## Fora de escopo

- alteração de B011/B012/`PerfilProfissionalPortal`;
- CyberArk (`openDialogNewSessionWithCyberark`);
- Playwright;
- regras por profissional nomeado;
- `GET method=openDialogNewSession` (UI GreyBox).

## Evidências

### Descoberta / contrato (19/07/2026)

- [docs/evidencias/003e-contrato-congelado-force-logout-2026-07-19.json](../docs/evidencias/003e-contrato-congelado-force-logout-2026-07-19.json)
- [docs/evidencias/003e-relatorio-investigacao-force-logout.md](../docs/evidencias/003e-relatorio-investigacao-force-logout.md)

### Validação real (19/07/2026)

**Evidência confirmada** (`ECNH_USER_3` como veículo; comportamento genérico):

- login HTTP com ramo B010 → perfil `psicologo`;
- logout HTTP ok;
- typecheck + suite de testes (113) ok.

Artefato: [docs/evidencias/003e-consolidacao-force-logout-2026-07-19.json](../docs/evidencias/003e-consolidacao-force-logout-2026-07-19.json).

## Critérios de sucesso

- [x] Contrato HTTP congelado com evidência sanitizada.
- [x] Ramo genérico no protocolo de autenticação.
- [x] Profissional sem diálogo continua no caminho atual.
- [x] Profissional com diálogo completa login + B012 (e B011 se aplicável — coberto por teste unitário).
- [x] Validação real com evidência sanitizada.
- [x] Documentação e CHANGELOG de conclusão.

## Progresso

| Passo | Estado |
| ----- | ------ |
| 0 — Investigação e contrato HTTP | Feito |
| 1 — ADR + desenho no protocolo | Feito |
| 2 — Implementação HTTP | Feito |
| 3 — Testes | Feito |
| 4 — Validação real | Feito |
| 5 — Fechamento documental | Feito |

## Pendências

- Variante CyberArk não exercitada (fora de escopo).
- Texto do botão GreyBox não necessário ao contrato HTTP.

## Resultado da fase

Suporte genérico a sessão já aberta entregue, validado com profissional real e documentado. Fase 003E e B010 `Concluída` / `✅ Concluído`.
