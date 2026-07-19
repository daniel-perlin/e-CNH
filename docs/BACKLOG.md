# Backlog

Documento **único** responsável pelas evoluções do e-CNH após o MVP.

## ROADMAP × BACKLOG

| Documento | Papel |
| --------- | ----- |
| [ROADMAP.md](ROADMAP.md) | Histórico da **construção do MVP** (Fases 000–007) e da evolução arquitetural em curso (003C / B012). |
| **BACKLOG.md** (este arquivo) | Catálogo ativo de evoluções pós-MVP. |

## Contexto pós-MVP

- O **MVP foi concluído na Fase 007**. O sistema já está operacional.
- As melhorias **B001–B005** foram **incrementais** sobre o produto já entregue (normalização, cadastro ativo, etc.).
- O projeto entra agora em uma **nova etapa de evolução arquitetural**: a fronteira do portal passa a admitir **múltiplos perfis profissionais** (Psicólogo, Médico e perfis futuros), com mínimo impacto nas demais camadas.
- O foco atual do projeto é **B012** (Arquitetura de perfis profissionais do portal).

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

## Foco atual

| ID | Status | Prioridade | Título |
| -- | ------ | ---------- | ------ |
| **B012** | 🚧 Em andamento | Alta | Arquitetura de perfis profissionais do portal |

Detalhamento na seção [B012](#detalhamento--b012) abaixo.

## Catálogo

| ID | Status | Prioridade | Título | Descrição |
| -- | ------ | ---------- | ------ | --------- |
| B001 | ✅ Concluído | Média | Normalizar e-mails | Converter e-mails para lowercase (com trim) antes da persistência na planilha. |
| B002 | ✅ Concluído | Média | Normalizar telefones | Remover lixo/hífens, DDD 11 em celular de 9 dígitos e normalizar listas com `/` antes da persistência. |
| B003 | ✅ Concluído | Alta | Coluna de inclusão na Agenda | Timestamp operacional por linha (hoje: "Data de inclusão"). |
| B004 | ✅ Concluído | Alta | Evitar pacientes duplicados por CPF | Introduziu CPF como chave única. **Supersedida pela B005** quanto ao caráter permanente do cadastro. |
| B005 | ✅ Concluído | Alta | Cadastro de pacientes ativos | Aba Agenda mantém só agendamentos de hoje/futuro; remove passados; CPF único enquanto ativo; reinclusão gera nova Data de inclusão. |
| B010 | ⏳ Pendente | Alta | Tratar sessão já autenticada no portal | Popup de sessão já aberta bloqueia o login automático (ex.: Italo). **Reavaliar após B012.** |
| B011 | ⏳ Pendente | Alta | Automatizar seleção de Perfil / Visão | Tela "Escolha de Perfil e/ou Visão" pós-login (ex.: Caio → CIR-SAO PAULO). **Reavaliar após B012.** |
| B012 | 🚧 Em andamento | Alta | Arquitetura de perfis profissionais do portal | Evolução arquitetural: Strategy extensível para múltiplos perfis do portal (Psicólogo, Médico e futuros). |

Itens **B006–B009** (Painel Operacional / Observabilidade) foram **removidos do escopo do produto** e não fazem mais parte deste catálogo.

## Detalhamento — B012

### B012 — Arquitetura de perfis profissionais do portal

| Campo | Valor |
| ----- | ----- |
| Status | 🚧 Em andamento (`Implementada` no código; validação real pendente) |
| Prioridade | 🔴 Alta |
| Natureza | Evolução arquitetural (não apenas correção pontual) |
| Documento | [.fases/003c-perfis-profissionais-portal.md](../.fases/003c-perfis-profissionais-portal.md) |
| ADR | ADR-014 |

**Contexto:** o MVP autenticava e consultava agenda apenas no fluxo do Psicólogo. Profissionais com outros perfis do portal (ex.: Médico) falhavam o critério de login.

**Objetivo:** tornar a fronteira `client` extensível a **múltiplos perfis profissionais do portal**, de modo que novos perfis possam ser adicionados com mínimo impacto em parser, repositório, serviços e jobs.

**Não é o objetivo** limitar a arquitetura a Médico e Psicólogo: esses são os primeiros perfis confirmados; o registro de perfis deve admitir expansão futura.

**Pendente para ✅ Concluído:** evidência sanitizada de login/consulta com perfil Médico no portal real e documentação da fase promovida a `Validada` / `Concluída`.

## Detalhamento — B010 e B011

Contexto operacional: [COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md](COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md).

> **Reavaliar após validação completa da arquitetura de perfis profissionais (B012).** A nova arquitetura poderá absorver parcial ou totalmente esta necessidade. Ainda não está decidido se B010 e B011 permanecerão necessários como itens distintos.

### B010 — Tratar sessão já autenticada no portal

| Campo | Valor |
| ----- | ----- |
| Status | ⏳ Pendente |
| Prioridade | 🔴 Alta |

**Descrição:** durante o login, alguns profissionais podem possuir uma sessão já aberta no portal. Nessa situação é exibido um popup solicitando o encerramento da sessão anterior antes da autenticação continuar. Hoje esse cenário bloqueia a sincronização automática.

**Objetivo futuro (sujeito a reavaliação pós-B012):**

- detectar o popup;
- confirmar o encerramento da sessão anterior;
- continuar automaticamente o fluxo de login.

**Impacto atual:** impede a sincronização automática do profissional Italo.

### B011 — Automatizar seleção de Perfil / Visão

| Campo | Valor |
| ----- | ----- |
| Status | ⏳ Pendente |
| Prioridade | 🔴 Alta |

**Descrição:** alguns profissionais possuem acesso a múltiplas unidades. Após o login o portal apresenta a tela "Escolha de Perfil e/ou Visão". Para o profissional Caio deve ser selecionada automaticamente a unidade **CIR-SAO PAULO** e depois clicar em **ENVIAR**. Hoje esse fluxo não é automatizado.

**Objetivo futuro (sujeito a reavaliação pós-B012):**

- detectar a tela de seleção;
- escolher automaticamente a unidade correta;
- prosseguir para a Agenda.

**Impacto atual:** impede a sincronização automática do profissional Caio.

> Nota: "Perfil / Visão" neste item refere-se à **escolha de unidade/visão no portal**, não ao `PerfilProfissionalPortal` (Psicólogo/Médico) da B012. São conceitos distintos.
