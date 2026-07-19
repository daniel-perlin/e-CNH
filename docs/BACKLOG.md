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
| B002 | ⏳ Pendente | Média | Normalizar telefones | Adicionar DDD 11 quando o telefone vier sem DDD. |
| B003 | ⏳ Pendente | Alta | Coluna "Última sincronização" | Adicionar na aba `Agenda` o timestamp da última atualização de cada linha. |
| B004 | ❄️ Estacionado | Baixa | Aba "Controle" | Criar aba `Controle` na planilha Google Sheets (Painel Operacional). |
| B005 | ❄️ Estacionado | Baixa | Aba "Execuções" | Criar aba `Execuções` com histórico das sincronizações. |
| B006 | ❄️ Estacionado | Baixa | Botão "Sincronizar Agora" | Botão via Apps Script para disparo manual (Nice to Have). |
| B007 | ❄️ Estacionado | Baixa | Observabilidade e métricas | Métricas operacionais, dashboards/tendências e alertas sem PII (Nice to Have). |
