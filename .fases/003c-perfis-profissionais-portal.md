# Fase 003C — Arquitetura de perfis profissionais do portal

**Status:** `Implementada`

## Objetivo

Desacoplar o fluxo hardcoded de Psicólogo do `ECNHClient`, permitindo autenticação e consulta de agenda para **múltiplos perfis do portal** (Psicólogo, Médico e **perfis futuros**), sem `if/else` espalhados e sem subclasses do cliente.

Backlog: **B012** (foco atual do projeto).

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
| Evidência Médico | Marcadores/methods da homologação; evidência sanitizada durável ainda a consolidar |
| Sync | Propagar `perfilId` em `ResultadoSincronizacaoProfissional` |

## Critérios de sucesso

- [x] Login aceita marcador de Psicólogo ou Médico.
- [x] Consulta de agenda usa `consultarAgendaPsicologo` ou `consultarAgendaMedico` conforme o perfil.
- [x] Sem PROFILE, Psicólogo permanece compatível com o MVP.
- [x] PROFILE divergente do HTML falha de forma tipada/mensurada.
- [x] `AgendaSyncService` expõe `perfilId` sem PII.
- [ ] Validação real com ao menos um Médico e um Psicólogo e evidência sanitizada.

## Progresso

| Passo | Estado |
| ----- | ------ |
| 0 — Documentação | Feito |
| 1 — Contratos/registro | Feito |
| 2 — Auth multi-marcador | Feito |
| 3 — Agenda por perfil | Feito |
| 4 — Config PROFILE | Feito |
| 5 — Scripts validate | Feito |
| 6 — Docs + validação | Parcial (falta evidência real Médico) |

## Pendências

- Consolidar evidência sanitizada de login/consulta Médico no portal real.
- Confirmar se a tabela `#agenda` do Médico é idêntica à do Psicólogo (hipótese atual: sim).

## Resultado da fase

Implementação concluída no código; status permanece `Implementada` até validação real com evidência sanitizada de perfil Médico.
