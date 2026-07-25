# Backlog

Documento **único** responsável pelas evoluções do e-CNH após o MVP.

## ROADMAP × BACKLOG

| Documento | Papel |
| --------- | ----- |
| [ROADMAP.md](ROADMAP.md) | Histórico da **construção do MVP** (Fases 000–007) e evoluções arquiteturais pós-MVP (003C / B012, 003D / B011, 003E / B010). |
| **BACKLOG.md** (este arquivo) | Catálogo ativo de evoluções pós-MVP. |

## Contexto pós-MVP

- O **MVP foi concluído na Fase 007**. O sistema já está operacional.
- **B012**, **B011**, **B010** e **B013** estão **✅ Concluídos**.
- Item pendente de baixa prioridade: **B014** (separar projeção operacional de metadados técnicos de sync).
- Demais prioridades futuras: D3 fixtures amplas (se priorizado).

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
| B005 | ✅ Concluído | Alta | Cadastro de pacientes ativos | Aba Agenda mantém agendamentos **hoje ou futuros** (`AgendaOperacionalPolicy`); remove passados; CPF único enquanto ativo; reinclusão gera nova Data de inclusão. |
| B010 | ✅ Concluído | Alta | Tratar sessão já autenticada no portal | `openDialogNewSession` → `POST autenticar` com `forceLogout=true`; validado com profissional real. Escopo distinto de B011. |
| B011 | ✅ Concluído | Alta | Escolha genérica de Perfil / Visão (unidade) | `openDialogChoice` / `openChoice` / segundo `autenticar`; config `UNIDADE`/`UNID_TRANSITO`; validado com multi-unidade real. |
| B012 | ✅ Concluído | Alta | Arquitetura de perfis profissionais do portal | Strategy extensível para múltiplos perfis (Psicólogo, Médico e futuros); validada com Médico real. |
| B013 | ✅ Concluído | Alta | Coluna Unidade na Agenda | Nome operacional por profissional (`CLINIC` → resolver centralizado → coluna Unidade). |
| B014 | ⏳ Pendente | Baixa | Separar projeção operacional de metadados técnicos | Evoluir além da coluna técnica de CPF da v1.0 (aba técnica, store auxiliar ou equivalente). |
| B015 | 🔧 Implementada | Alta | Persistência relacional de pessoas (paralela) | Camada `db/` + `PessoaRepository`; Sheets intacto; best-effort; ADR-022 / Fase 010. Validação Postgres Railway pendente. |

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
| Status | ✅ Concluído |
| Prioridade | 🔴 Alta |
| Fase | 003E (`Concluída`) |
| Módulo | `src/client/sessao-existente-portal.ts` + ramo em `ECNHAuthenticationProtocol` |

**Descrição:** popup pedindo encerrar sessão anterior (`openDialogNewSession` / `forceLogout`). Escopo **distinto** de B011.

**Contrato / validação (19/07/2026):** após detectar `openDialogNewSession`, reenviar `POST method=autenticar` com `forceLogout=true` no mesmo CookieJar (sem GreyBox); em seguida B011/B012. Artefatos: [evidencias/003e-contrato-congelado-force-logout-2026-07-19.json](evidencias/003e-contrato-congelado-force-logout-2026-07-19.json), [evidencias/003e-consolidacao-force-logout-2026-07-19.json](evidencias/003e-consolidacao-force-logout-2026-07-19.json), [.fases/003e-sessao-existente-force-logout.md](../.fases/003e-sessao-existente-force-logout.md).

## Detalhamento — B013

### B013 — Coluna Unidade na Agenda

| Campo | Valor |
| ----- | ----- |
| Status | ✅ Concluído |
| Prioridade | 🔴 Alta |
| Resolver | `src/utils/unidade-operacional.ts` (`resolveNomeUnidadeOperacional`) |

**Objetivo:** cada paciente sincronizado exibe a unidade operacional do profissional (`CLINIC` no `.env`), não um dado da agenda HTML.

**Mapeamento inicial:**

| CLINIC (.env) | Unidade (planilha) |
| ------------- | ------------------ |
| Talento Limão/Zona Norte | LIMÃO |
| Capão Redondo/Zona Sul | CAPÃO REDONDO |
| Clínica Carrão/Zona Leste | VILA CARRÃO |

Novas unidades: adicionar apenas no registro centralizado do resolver.

## Detalhamento — B014

### B014 — Separar projeção operacional de metadados técnicos de sincronização

| Campo | Valor |
| ----- | ----- |
| Status | ⏳ Pendente |
| Prioridade | 🟢 Baixa |

**Contexto (v1.0+):** o contrato visual da aba `Agenda` tem 10 colunas operacionais (`CABECALHOS_ABA_AGENDA`), sem CPF. O CPF permanece a chave de negócio (B004/B005). Para preservar a deduplicação entre sincronizações, a implementação atual mantém o CPF em **coluna técnica adjacente**, fora do cabeçalho oficial. Essa coluna técnica é decisão de implementação da **v1.0**, não um objetivo arquitetural permanente (ver ADR-018 / ADR-024).

**Objetivo futuro:** separar claramente:

- **projeção operacional** — planilha usada pela clínica (colunas oficiais de `CABECALHOS_ABA_AGENDA`);
- **metadados técnicos de sincronização** — identidade/deduplicação e demais dados que o sync precisa e a clínica não deve ver no layout operacional.

**Alternativas a avaliar (não decidir agora):**

- aba técnica separada na mesma planilha;
- armazenamento auxiliar fora da aba `Agenda`;
- outra estratégia que elimine a coluna técnica “invisível” na aba operacional.

**Fora de escopo imediato:** alterar comportamento, remover a coluna técnica da v1.0 ou escolher a solução final nesta tarefa.
