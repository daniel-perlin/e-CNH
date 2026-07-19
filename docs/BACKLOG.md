# Backlog

Documento **único** responsável por **todas as evoluções futuras** do e-CNH — melhorias incrementais e iniciativas estratégicas (Nice to Have).

## ROADMAP × BACKLOG

| Documento | Papel |
| --------- | ----- |
| [ROADMAP.md](ROADMAP.md) | Histórico da **construção do MVP** (Fases 000–007). Não lista evoluções futuras. |
| **BACKLOG.md** (este arquivo) | **Única** fonte de melhorias futuras (incrementais ou estratégicas). |

## Contexto pós-MVP

- O **MVP foi concluído na Fase 007**. O sistema já está operacional.
- Não há fases obrigatórias após a 007.
- Visões preliminares do antigo Painel Operacional e de Observabilidade (quando existirem em `.fases/`) são apenas referência histórica; o rastreamento ativo está neste catálogo.

Itens aqui listados **não são necessários** para o funcionamento do sistema.

## Convenções

### Status

| Status | Significado |
| ------ | ----------- |
| ⏳ Pendente | Ainda não iniciado |
| 🚧 Em andamento | Em implementação ou validação |
| ✅ Concluído | Entregue e documentado |
| ❄️ Estacionado | Pausado / Nice to Have até nova priorização |

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
| B006 | ❄️ Estacionado | Baixa | Aba "Controle" | Criar aba `Controle` na planilha Google Sheets (Painel Operacional). |
| B007 | ❄️ Estacionado | Baixa | Aba "Execuções" | Criar aba `Execuções` com histórico das sincronizações. |
| B008 | ❄️ Estacionado | Baixa | Botão "Sincronizar Agora" | Botão via Apps Script para disparo manual (Nice to Have). |
| B009 | ❄️ Estacionado | Baixa | Observabilidade e métricas | Métricas operacionais, dashboards/tendências e alertas sem PII (Nice to Have). |
| B010 | ⏳ Pendente | Alta | Tratar sessão já autenticada no portal | Popup de sessão já aberta bloqueia o login automático (ex.: Italo). |
| B011 | ⏳ Pendente | Alta | Automatizar seleção de Perfil / Visão | Tela "Escolha de Perfil e/ou Visão" pós-login (ex.: Caio → CIR-SAO PAULO). |

## Detalhamento — B010 e B011

Contexto: [COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md](COMPORTAMENTOS_PORTAL_HOMOLOGACAO.md). **Não implementar agora.**

### B010 — Tratar sessão já autenticada no portal

| Campo | Valor |
| ----- | ----- |
| Status | ⏳ Pendente |
| Prioridade | 🔴 Alta |

**Descrição:** durante o login, alguns profissionais podem possuir uma sessão já aberta no portal. Nessa situação é exibido um popup solicitando o encerramento da sessão anterior antes da autenticação continuar. Hoje esse cenário bloqueia a sincronização automática.

**Objetivo futuro:**

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

**Objetivo futuro:**

- detectar a tela de seleção;
- escolher automaticamente a unidade correta;
- prosseguir para a Agenda.

**Impacto atual:** impede a sincronização automática do profissional Caio.
