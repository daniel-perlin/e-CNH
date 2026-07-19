# Backlog

Documento **único** responsável pelas evoluções do e-CNH após o MVP.

## ROADMAP × BACKLOG

| Documento | Papel |
| --------- | ----- |
| [ROADMAP.md](ROADMAP.md) | Histórico da **construção do MVP** (Fases 000–007) e da evolução arquitetural 003C / B012. |
| **BACKLOG.md** (este arquivo) | Catálogo ativo de evoluções pós-MVP. |

## Contexto pós-MVP

- O **MVP foi concluído na Fase 007**. O sistema já está operacional.
- As melhorias **B001–B005** foram **incrementais** sobre o produto já entregue (normalização, cadastro ativo, etc.).
- A evolução arquitetural **B012** (múltiplos perfis profissionais do portal) está **✅ Concluída**, com validação real de profissional Médico.
- Próximas prioridades do catálogo: **B010** e **B011** (reavaliar à luz da B012 concluída).

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
| B010 | ⏳ Pendente | Alta | Tratar sessão já autenticada no portal | Popup de sessão já aberta bloqueia o login automático. Reavaliar após B012 (já concluída). |
| B011 | ⏳ Pendente | Alta | Automatizar seleção de Perfil / Visão | Tela "Escolha de Perfil e/ou Visão" pós-login (unidade). Reavaliar após B012 (já concluída). |
| B012 | ✅ Concluído | Alta | Arquitetura de perfis profissionais do portal | Strategy extensível para múltiplos perfis (Psicólogo, Médico e futuros); validada com Médico real. |

Itens **B006–B009** (Painel Operacional / Observabilidade) foram **removidos do escopo do produto** e não fazem mais parte deste catálogo.

## Detalhamento — B012

### B012 — Arquitetura de perfis profissionais do portal

| Campo | Valor |
| ----- | ----- |
| Status | ✅ Concluído |
| Prioridade | 🔴 Alta |
| Natureza | Evolução arquitetural (não apenas correção pontual) |
| Documento | [.fases/003c-perfis-profissionais-portal.md](../.fases/003c-perfis-profissionais-portal.md) |
| ADR | ADR-014 |
| Evidência | [docs/evidencias/003c-consolidacao-perfil-medico-2026-07-19.json](evidencias/003c-consolidacao-perfil-medico-2026-07-19.json) |

**Contexto:** o MVP autenticava e consultava agenda apenas no fluxo do Psicólogo. Profissionais com outros perfis do portal (ex.: Médico) falhavam o critério de login.

**Objetivo alcançado:** fronteira `client` extensível a **múltiplos perfis profissionais do portal**, de modo que novos perfis possam ser adicionados com mínimo impacto em parser, repositório, serviços e jobs.

**Validação (19/07/2026):** profissional Médico real (Italo / `ECNH_USER_16`) — login OK, perfil `medico`, consulta `consultarAgendaMedico`, sincronização completa OK.

## Detalhamento — B010 e B011

Contexto operacional: [COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md](COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md).

> **B012 está concluída.** Reavaliar se B010 e B011 ainda são necessários como itens distintos, ou se parte da necessidade foi absorvida pela arquitetura de perfis. Ainda não está decidido automatizá-los.

### B010 — Tratar sessão já autenticada no portal

| Campo | Valor |
| ----- | ----- |
| Status | ⏳ Pendente |
| Prioridade | 🔴 Alta |

**Descrição:** durante o login, alguns profissionais podem possuir uma sessão já aberta no portal. Nessa situação é exibido um popup solicitando o encerramento da sessão anterior antes da autenticação continuar.

**Objetivo futuro (sujeito a reavaliação):**

- detectar o popup;
- confirmar o encerramento da sessão anterior;
- continuar automaticamente o fluxo de login.

**Nota:** na validação de 19/07/2026 o sync do Italo concluiu com sucesso (sessão disponível); o popup continua sendo um risco operacional quando houver sessão prévia aberta.

### B011 — Automatizar seleção de Perfil / Visão

| Campo | Valor |
| ----- | ----- |
| Status | ⏳ Pendente |
| Prioridade | 🔴 Alta |

**Descrição:** alguns profissionais possuem acesso a múltiplas unidades. Após o login o portal apresenta a tela "Escolha de Perfil e/ou Visão". Para o profissional Caio deve ser selecionada automaticamente a unidade **CIR-SAO PAULO** e depois clicar em **ENVIAR**. Hoje esse fluxo não é automatizado.

**Objetivo futuro (sujeito a reavaliação):**

- detectar a tela de seleção;
- escolher automaticamente a unidade correta;
- prosseguir para a Agenda.

**Impacto atual:** pode impedir a sincronização automática de profissionais com múltiplas unidades (ex.: Caio).

> Nota: "Perfil / Visão" neste item refere-se à **escolha de unidade/visão no portal**, não ao `PerfilProfissionalPortal` (Psicólogo/Médico) da B012. São conceitos distintos.
