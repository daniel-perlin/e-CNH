# Fase 003C — Arquitetura de perfis profissionais do portal

**Status:** `Concluída`

## Objetivo

Desacoplar o fluxo hardcoded de Psicólogo do `ECNHClient`, permitindo autenticação e consulta de agenda para **múltiplos perfis do portal** (Psicólogo, Médico e **perfis futuros**), sem `if/else` espalhados e sem subclasses do cliente.

Backlog: **B012** (`✅ Concluído`).

## Escopo

- Strategy `PerfilProfissionalPortal` + registro;
- detecção do perfil pelo marcador HTML pós-login;
- `ECNH_USER_<n>_PROFILE` (ou `ROLE`) opcional como override/validação;
- `method` de consulta de agenda derivado do perfil;
- `perfilId` no resultado tipado de sincronização (sem PII);
- testes unitários e documentação.

## Fora de escopo

- B010 (sessão já autenticada);
- B011 (escolha de Perfil/Visão / unidade);
- alterações no parser ou Sheets sem evidência de divergência de tabela;
- novos canais de disparo.

## Arquitetura

```text
ECNH_USER (credenciais + PROFILE opcional)
        │
        ▼
ECNHClient
    ├── AuthenticationProtocol → resolve perfil no HTML
    ├── AgendaProtocol → method do perfil resolvido
    └── PerfilProfissionalPortal (registro)
            │
            ▼
AgendaSyncService (porta inalterada; perfilId no resultado)
```

## Decisões aprovadas

| Tema | Decisão |
| ---- | ------- |
| Padrão | Strategy + registro (sem subclasses de client) |
| Resolução | Híbrida: detectar no HTML; PROFILE/ROLE opcional |
| Slot | Fase 003C (correção pós-MVP da fronteira `client`) |
| Evidência Médico | Validada com profissional real (Italo / `ECNH_USER_16`) |
| Sync | Propagar `perfilId` em `ResultadoSincronizacaoProfissional` |

## Evidências

### Validação com profissional Médico em 19/07/2026

**Evidências confirmadas:**

- login de `ECNH_USER_16` (Italo) retornou `status=sucesso`;
- marcador HTML: `Imprimir Agenda Diária do Médico`;
- `PerfilProfissionalPortal` resolvido: `medico`;
- consulta usou `POST method=consultarAgendaMedico`;
- página de resultado autenticada (`Resultado`, `DivisaoEquitativaForm`, sem `LoginActionForm`);
- sincronização completa do mesmo profissional concluída com sucesso (confirmada pelo operador).

Consolidação sanitizada: [docs/evidencias/003c-consolidacao-perfil-medico-2026-07-19.json](../docs/evidencias/003c-consolidacao-perfil-medico-2026-07-19.json).

## Critérios de sucesso

- [x] Login aceita marcador de Psicólogo ou Médico.
- [x] Consulta de agenda usa `consultarAgendaPsicologo` ou `consultarAgendaMedico` conforme o perfil.
- [x] Sem PROFILE, Psicólogo permanece compatível com o MVP.
- [x] PROFILE divergente do HTML falha de forma tipada/mensurada.
- [x] `AgendaSyncService` expõe `perfilId` sem PII.
- [x] Validação real com profissional Médico e evidência sanitizada.

## Progresso

| Passo | Estado |
| ----- | ------ |
| 0 — Documentação | Feito |
| 1 — Contratos/registro | Feito |
| 2 — Auth multi-marcador | Feito |
| 3 — Agenda por perfil | Feito |
| 4 — Config PROFILE | Feito |
| 5 — Scripts validate | Feito |
| 6 — Docs + validação | Feito |

## Pendências

- Nenhuma pendência bloqueante no escopo da Fase 003C / B012.
- B010 e B011 permanecem no backlog para reavaliação (comportamentos distintos de unidade/sessão).

## Resultado da fase

Arquitetura de perfis profissionais do portal entregue, validada com Médico real (Italo) — login, identificação de perfil, consulta de agenda e sincronização completa — e documentada. A Fase 003C e o item B012 estão `Concluída` / `✅ Concluído`.
