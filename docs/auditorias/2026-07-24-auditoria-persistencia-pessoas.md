# Auditoria — camada de persistência de pessoas

**Data:** 2026-07-24  
**Escopo:** validação da implementação existente (sem novas funcionalidades)  
**Fonte:** código + arquivo SQLite real

Canvas: `auditoria-persistencia-pessoas.canvas.tsx`

---

## 1. Localização do banco

| Item | Valor (evidência) |
| --- | --- |
| Caminho absoluto | `/Users/danielperlin/Github/e-CNH/.data/ecnh.sqlite` |
| Relativo padrão | `.data/ecnh.sqlite` (`src/config/database-config.ts`) |
| Override | `DATABASE_SQLITE_PATH` |
| Tamanho observado | 122 880 bytes (24/07/2026 17:40) |

**Como / quando é criado**

1. `criarAgendaSyncRuntime` → `openAppDatabase` (`src/db/client.ts`)
2. `fs.mkdirSync` no diretório do path
3. `new Database(sqlitePath)` (better-sqlite3) — cria o arquivo se não existir
4. `ensurePessoasSchemaSqlite` — `CREATE TABLE IF NOT EXISTS pessoas` + índice único

**Se ainda não existir:** o sync cria pasta, arquivo e tabela automaticamente (desde que a persistência esteja habilitada e não haja falha de abertura → senão cai em `NoOpPessoaRepository`).

**Produção Railway:** sem `DATABASE_URL`, o padrão seria SQLite no FS efêmero (não acumula entre Crons). Recomendado: Postgres.

---

## 2. Estrutura (schema atual)

### Tabelas

| Nome | Papel |
| --- | --- |
| `pessoas` | Domínio — histórico de pessoas |
| `sqlite_sequence` | Interna do SQLite (AUTOINCREMENT) |

### Colunas de `pessoas`

| Coluna | Tipo | Restrição |
| --- | --- | --- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `cpf` | TEXT | NOT NULL UNIQUE |
| `nome` | TEXT | nullable |
| `email` | TEXT | nullable |
| `telefone` | TEXT | nullable |
| `origem` | TEXT | NOT NULL DEFAULT `'Projeto e-CNH'` |
| `ativo` | INTEGER | NOT NULL DEFAULT 1 |
| `primeira_sincronizacao` | TEXT | NOT NULL (ISO UTC) |
| `ultima_sincronizacao` | TEXT | NOT NULL (ISO UTC) |
| `created_at` | TEXT | NOT NULL |
| `updated_at` | TEXT | NOT NULL |

### Índices / chaves

- UNIQUE implícito em `cpf` + índice `pessoas_cpf_uidx` ON `pessoas(cpf)`
- PK em `id`
- **Relacionamentos / FKs:** nenhum

DDL: `src/db/ensure-schema.ts`

---

## 3. Pessoas (estado atual do arquivo)

| Métrica | Valor |
| --- | ---: |
| Registros | **409** |
| CPFs únicos | **409** |
| Com e-mail | **409** |
| Com telefone | **409** |

### 10 exemplos (mascarados)

| Nome | CPF | E-mail | Telefone | Origem |
| --- | --- | --- | --- | --- |
| REMERSON MOREIRA DA SILVA | ***6848 | re***@gmail.com | ******5458 | Projeto e-CNH |
| DAYANE RIBEIRO SOUZA | ***0813 | da***@live.com | ******0209 | Projeto e-CNH |
| HELLEN DE JESUS DO NASCIMENTO | ***4854 | HE***@GMAIL.COM | ******6384 | Projeto e-CNH |
| WALLACE CAETANO DE LIMA | ***7880 | wc***@gmail.com | ******4394 | Projeto e-CNH |
| ELIAS GUILHERME DOS SANTOS | ***6145 | NA***@GMAIL.COM | ******8238 | Projeto e-CNH |
| DENISE MENDES DE LIMA | ***6840 | DE***@GMAIL.COM | ******9911 | Projeto e-CNH |
| ANA GRAZIELA MOREIRA MEDINA | ***3860 | WW***@GMAIL.COM | ******8956 | Projeto e-CNH |
| SAMUEL VITOR SALVADOR BATISTA | ***6886 | SA***@GMAIL.COM | ******2036 | Projeto e-CNH |
| LUCAS DE PROENCA PRETO | ***8870 | lp***@hotmail.com | ******0277 | Projeto e-CNH |
| BRAYAN JORGE CLAURE JOVE | ***5800 | br***@gmail.com | ******0665 | Projeto e-CNH |

Todos os 10 com `ativo=1` e `primeira_sincronizacao` ≈ `ultima_sincronizacao` (primeira carga na sync de 24/07 ~20:39 UTC).

---

## 4. UPSERT (`DrizzlePessoaRepository`)

**Identidade:** CPF normalizado (`normalizeCpfKey` — 11 dígitos). CPF inválido → ignorado (não grava).

| Situação | Ação |
| --- | --- |
| CPF não existe | **INSERT** (origem, ativo=true, timestamps iguais) |
| CPF existe | **UPDATE** |

**Atualizados no UPDATE:** `nome`, `email`, `telefone` (só se vierem preenchidos; senão preserva o atual); sempre `ultima_sincronizacao`, `updated_at`.

**Nunca alterados no UPDATE do sync:** `id`, `cpf`, `origem`, `ativo`, `primeira_sincronizacao`, `created_at`.

**Duas syncs seguidas:** 1ª → muitos INSERTs; 2ª → sobretudo UPDATEs (atualiza `ultima_sincronizacao`); contagem de linhas não cai; novos CPFs do portal entram como INSERT.

---

## 5. Persistência / DELETE

- **Nenhum** `DELETE` / `DROP` / `TRUNCATE` de `pessoas` no código de produção.
- Banco **cresce** com novos CPFs; existentes só são atualizados.
- Soft-flag `ativo` existe mas o sync **não** inativa ninguém hoje.
- Remoção só ocorreria se alguém apagasse o arquivo `.data/ecnh.sqlite` manualmente ou perdesse o volume/FS efêmero.

---

## 6. Integração com a sincronização

```text
Portal → parse → Agenda (domínio)
  → AgendaRepository.salvarAgenda (Google Sheets)
  → persistirPessoasBestEffort → PessoaRepository.upsertMuitos (banco)
```

- Ordem: Sheets primeiro; banco depois (`agenda-sync-service.ts`).
- Erro no banco: log `pessoas.upsert.failed`; **não** altera resultado do Sheets.
- Destinos independentes — sem acoplamento de falha.

---

## 7. Git

| Item | Status |
| --- | --- |
| `.gitignore` | `.data/` (linha 21) |
| `git check-ignore .data/ecnh.sqlite` | ignorado via `.data/` |
| Risco de commit acidental | Baixo, se `.gitignore` for respeitado |
| Pasta `.data` | Protegida (lock + sqlite) |

---

## 8. Backup (recomendação — sem implementar)

**Local (simples e gratuito):**

1. Cron diário: `cp .data/ecnh.sqlite backups/ecnh-$(date +%Y%m%d).sqlite`
2. Manter N dias (ex.: 30) e apagar o resto
3. Opcional: `rsync`/`scp` para outro disco ou máquina da rede

**Railway:** preferir **PostgreSQL** do plugin (persistência real + snapshot do provedor). SQLite no Cron sem volume **não** serve como histórico.

---

## 9. Próximos passos (roadmap técnico, sem implementar)

1. **Postgres no Railway** (`DATABASE_URL`) — histórico entre Crons  
2. **Backup automatizado** do store  
3. **`AgendamentoRepository`** — histórico de exames (próxima entidade)  
4. **`SyncRunRepository`** — auditoria de cada execução  
5. **`ProfissionalRepository`** — sair do `.env` puro  
6. Só depois: Sheets como projeção opcional sobre o banco  

---

## Veredito

**Sim — pronta para uso contínuo local** e para começar a base histórica (já há 409 pessoas).

**Caveat de produção:** no Railway Cron, só considere “pronta de verdade” com **PostgreSQL**. SQLite no filesystem efêmero **não** acumula entre dias.
