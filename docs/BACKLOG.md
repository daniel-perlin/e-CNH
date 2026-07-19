# Backlog

Documento **único** responsável pelas evoluções do e-CNH após o MVP.

## ROADMAP × BACKLOG

| Documento | Papel |
| --------- | ----- |
| [ROADMAP.md](ROADMAP.md) | Histórico da **construção do MVP** (Fases 000–007) e evoluções arquiteturais pós-MVP (003C / B012, 003D / B011). |
| **BACKLOG.md** (este arquivo) | Catálogo ativo de evoluções pós-MVP. |

## Contexto pós-MVP

- O **MVP foi concluído na Fase 007**. O sistema já está operacional.
- **B012** (perfis profissionais) e **B011** (escolha de unidade/visão) estão **✅ Concluídos**.
- Próxima prioridade do catálogo: **B010** (sessão já autenticada), se priorizado.

## Convenções

### Status

| Status | Significado |
| ------ | ----------- |
| ⏳ Pendente | Ainda não iniciado |
| 🚧 Em andamento | Em implementação ou validação |
| ✅ Concluído | Entregue e documentado |

### Prioridade

`Alta` · `Média` · `Baixa`

### Identificadores

Melhorias usam IDs sequenciais: `B001`, `B002`, `B003`, …

## Catálogo

| ID | Status | Prioridade | Título | Descrição |
| -- | ------ | ---------- | ------ | --------- |
| B001 | ✅ Concluído | Média | Normalizar e-mails | Converter e-mails para lowercase (com trim) antes da persistência na planilha. |
| B002 | ✅ Concluído | Média | Normalizar telefones | Remover lixo/hífens, DDD 11 em celular de 9 dígitos e normalizar listas com `/` antes da persistência. |
| B003 | ✅ Concluído | Alta | Coluna de inclusão na Agenda | Timestamp operacional por linha (hoje: "Data de inclusão"). |
| B004 | ✅ Concluído | Alta | Evitar pacientes duplicados por CPF | Introduziu CPF como chave única. **Supersedida pela B005** quanto ao caráter permanente do cadastro. |
| B005 | ✅ Concluído | Alta | Cadastro de pacientes ativos | Aba Agenda mantém só agendamentos de hoje/futuro; remove passados; CPF único enquanto ativo; reinclusão gera nova Data de inclusão. |
| B010 | ⏳ Pendente | Alta | Tratar sessão já autenticada no portal | Popup de sessão já aberta (`openDialogNewSession` / `forceLogout`). Escopo distinto de B011. |
| B011 | ✅ Concluído | Alta | Escolha genérica de Perfil / Visão (unidade) | `openDialogChoice` / `openChoice` / segundo `autenticar`; config `UNIDADE`/`UNID_TRANSITO`; validado com multi-unidade real. |
| B012 | ✅ Concluído | Alta | Arquitetura de perfis profissionais do portal | Strategy extensível para múltiplos perfis (Psicólogo, Médico e futuros); validada com Médico real. |

Itens **B006–B009** (Painel Operacional / Observabilidade) foram **removidos do escopo do produto** e não fazem mais parte deste catálogo.

## Detalhamento — B011

### B011 — Escolha genérica de Perfil / Visão (unidade)

| Campo | Valor |
| ----- | ----- |
| Status | ✅ Concluído |
| Prioridade | 🔴 Alta |
| Documento | [.fases/003d-escolha-unidade-visao.md](../.fases/003d-escolha-unidade-visao.md) |
| ADR | ADR-015 |
| Evidência | [docs/evidencias/003d-consolidacao-escolha-unidade-2026-07-19.json](evidencias/003d-consolidacao-escolha-unidade-2026-07-19.json) |

**Objetivo alcançado:** infraestrutura genérica para qualquer profissional multi-unidade via config `UNIDADE` / `UNID_TRANSITO`.

**Validação (19/07/2026):** multi-unidade real — `openDialogChoice` → `openChoice` → `CIR-SAO PAULO` (`18`) → B012 `medico` → agenda/parser → sync Sheets OK.

> Nota: “Perfil / Visão” aqui é **unidade/visão do portal**, não o `PerfilProfissionalPortal` da B012.

## Detalhamento — B012

### B012 — Arquitetura de perfis profissionais do portal

| Campo | Valor |
| ----- | ----- |
| Status | ✅ Concluído |
| Documento | [.fases/003c-perfis-profissionais-portal.md](../.fases/003c-perfis-profissionais-portal.md) |
| ADR | ADR-014 |
| Evidência | [docs/evidencias/003c-consolidacao-perfil-medico-2026-07-19.json](evidencias/003c-consolidacao-perfil-medico-2026-07-19.json) |

## Detalhamento — B010

Contexto: [COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md](COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md).

### B010 — Tratar sessão já autenticada no portal

| Campo | Valor |
| ----- | ----- |
| Status | ⏳ Pendente |
| Prioridade | 🔴 Alta |

**Descrição:** popup pedindo encerrar sessão anterior (`openDialogNewSession` / `forceLogout`). Escopo **distinto** de B011.
