# Investigação — aba Agenda vazia após mudanças de persistência

**Data:** 2026-07-24  
**Modo:** investigação apenas (sem correção)  
**HEAD / origin/main:** `fb5d59d` — `feat(agenda): preservar apenas agendamentos futuros`  
**Camada db/pessoas:** alterações **locais não commitadas** (não estão em `origin/main`)

---

## Atualização 24/07/2026 • 17:40 — correção via policy

Após evidência de produto (`VISAO_DO_PRODUTO.md` = hoje ou futuras) e mecanismo confirmado em `fb5d59d`, a regra foi movida para `AgendaOperacionalPolicy` (ADR-023) com contrato **hoje ou futuro**. Utilitário `isDataAgendamentoAtiva` removido.

| Candidato | Impacta Sheets? | Evidência |
| --- | --- | --- |
| Persistência pessoas (ADR-022, working tree) | **Não** grava/limpa Sheets | `google-sheets-*` **fora** do diff local |
| Regra “só futuro” (`fb5d59d`) | **Sim** | `agenda-date.ts` + filtro em `salvarAgenda` |

---

## 1. O que mudou?

### A) Já em produção (`origin/main` = `fb5d59d`)

Arquivos que **afetam** a gravação Sheets:

- `src/utils/agenda-date.ts` — critério ativo
- `src/repositories/google-sheets-agenda-repository.ts` — comentário + uso do critério
- testes/docs relacionados

Diff essencial:

```diff
- return compararDatasCalendario(agendada, hoje) >= 0;
+ return compararDatasCalendario(agendada, hoje) > 0;
```

### B) Working tree local (persistência — **não** em `origin/main`)

Arquivos que tocam o **caminho de sync** (mas **não** a regra Sheets):

| Arquivo | Impacto Sheets |
| --- | --- |
| `src/composition/agenda-sync-runtime.ts` | Instancia `AgendaRepository` igual; adiciona `PessoaRepository` |
| `src/services/agenda-sync-service.ts` | Continua chamando `salvarAgenda`; depois best-effort pessoas |
| `src/scripts/sync-agenda.ts` / `job-agenda.ts` | `await` no runtime + `close()` do DB |
| `src/db/**`, `pessoa-*`, `database-config*` | Só banco |

**Não alterados** neste working tree (diff vazio vs HEAD):

- `src/repositories/google-sheets-agenda-repository.ts`
- `src/client/google-sheets-client.ts`
- `src/utils/agenda-date.ts`
- mapper / headers Sheets

---

## 2. Fluxo de execução

### Antes de `fb5d59d` (Sheets)

```text
Portal → parse → Agenda
  → salvarAgenda
       → mantém linhas com data >= hoje
       → insere do portal se dataConsulta >= hoje e CPF novo
       → updateValues + clearValues (cauda)
```

### Depois de `fb5d59d` (o que Railway roda hoje)

```text
Portal → parse → Agenda
  → salvarAgenda
       → mantém só data > hoje
       → insere do portal só se dataConsulta > hoje
       → se só havia “hoje”, linhasAtivas=[] e novasLinhas=[]
       → grava [cabeçalho] e limpa cauda → aba sem pacientes
```

### Com persistência local (aditivo, se rodado)

```text
Portal → parse → Agenda
  → salvarAgenda (Sheets)     ← mesma lógica de fb5d59d
  → persistirPessoasBestEffort (banco)  ← try/catch; não chama Sheets
```

---

## 3. O que deixou de acontecer?

Não há evidência de que `salvarAgenda` tenha deixado de ser chamado pela camada db.

O que **deixou de acontecer** na regra de negócio Sheets (desde `fb5d59d`):

1. Linhas com **AGENDAMENTO DO DETRAN = hoje** deixam de entrar em `ativos` (`salvarAgenda` ~L182).
2. Itens do portal com **`dataConsulta` = hoje** não entram no bloco de `novasLinhas` (`~L248`: `if (isDataAgendamentoAtiva(dataConsulta))`).
3. Resultado: `valoresFinais = [cabecalho]` → planilha operacional vazia de pacientes.

Descartado pela inspeção do código de persistência:

- Feature flag desabilitando Sheets — **não existe**
- `AgendaRepository` deixando de ser instanciado — ainda criado em `criarAgendaSyncRuntime`
- try/catch do banco engolindo falha do Sheets — o catch é **só** em `persistirPessoasBestEffort`, **depois** de `salvarAgenda`
- Banco chamando `clearValues` — **não**

---

## 4. Google Sheets

| Pergunta | Resposta |
| --- | --- |
| `AgendaRepository` ainda é chamado? | Sim — `agenda-sync-service.ts` ~L495 |
| `GoogleSheetsAgendaRepository` executa? | Sim — wiring inalterado quanto a Sheets |
| `salvarAgenda` recebe itens? | Sim, quando o parse traz itens; **inserção** depende de data > hoje |
| `updateValues` | Sim, com `[cabeçalho, ...ativos, ...novos]` (pode ser só cabeçalho) |
| `clearValues` indevido? | Só cauda se encolheu; efeito colateral esperado ao remover todas as linhas de dados |

---

## 5. Banco — interferência?

**Acoplamento que altera Sheets:** nenhum.

Único ponto de contato: `AgendaSyncService` chama banco **após** (ou no catch após tentativa de) `salvarAgenda`. O método `persistirPessoasBestEffort` não referencia `GoogleSheetsClient` / `updateValues` / `clearValues`.

Falha ao abrir DB → `NoOpPessoaRepository`; Sheets segue.

---

## 6. Causa raiz (única)

**Alteração:** commit `fb5d59d`  
**Arquivo:** `src/utils/agenda-date.ts`  
**Função:** `isDataAgendamentoAtiva`  
**Linha:** retorno `compararDatasCalendario(agendada, hoje) > 0` (antes `>= 0`)  
**Consumidor que esvazia a aba:** `GoogleSheetsAgendaRepository.salvarAgenda`  
**Motivo técnico:** na sync do dia corrente, agendamentos de “hoje” são classificados como inativos, removidos na reescrita e não reinseridos a partir do portal → aba fica só com cabeçalho.

A implementação da persistência relacional **não** é a causa dessa regressão visual; ela ainda **nem está** em `origin/main`.

---

## Próximo passo (quando autorizar correção)

Decisão de produto, não de bug da camada db:

- voltar a `>= 0` (hoje permanece), **ou**
- manter `> 0` e aceitar Agenda só com dias futuros (aba pode ficar vazia em dias sem agenda futura).

Não misturar essa correção com a camada `PessoaRepository`.
