# Auditoria de persistência — e-CNH

**Data:** 2026-07-24  
**Escopo:** camada de persistência (SQLite solicitado) e fluxo Portal → store → Google Sheets  
**Método:** análise apenas do código e documentação existentes — sem implementação  
**Status das afirmações:** evidência confirmada, salvo onde marcado como gap / visão futura

---

## Achado central

**Não existe camada SQLite neste repositório.**

- Sem dependência `better-sqlite3`, Drizzle, Knex, Prisma ou similar em `package.json`
- Sem arquivos `.db` / `.sqlite` / migrations / `CREATE TABLE` no projeto
- A única menção a SQLite é **planejamento futuro** na ADR-012 (`docs/DECISOES.md`): preparação para substituir o destino (Postgres, SQLite, etc.)

**Store persistente atual:** Google Sheets (aba `Agenda`).

**Fluxo real:** Portal e-CNH (HTTP/Axios) → parse HTML → Google Sheets.

O fluxo **Portal → Playwright → SQLite → Sheets** **não está implementado**. Playwright também está ausente de `package.json` e de `src/`.

---

## 1. Estrutura atual do banco

### SQLite

| Item | Status |
| --- | --- |
| Tabelas | Nenhuma |
| Colunas | N/A |
| Relacionamentos / FKs | N/A |
| Índices / chaves SQL | N/A |

### “Schema” operacional real = layout Sheets

Fonte: `src/repositories/agenda-sheet-headers.ts` (`CABECALHOS_ABA_AGENDA`)

| Índice | Coluna | Papel |
| --- | --- | --- |
| 0 | UNIDADE | Operacional |
| 1 | AGENDAMENTO DO DETRAN | Data do exame |
| 2 | HORÁRIO | Horário |
| 3 | PACIENTE | Nome |
| 4 | TELEFONE | Contato |
| 5 | EMAIL | Contato |
| 6 | PROFISSIONAL | Texto formatado |
| 7 | DATA DE INCLUSÃO | Timestamp da 1ª inclusão enquanto ativo |
| 8 | *(técnica CPF)* | Deduplicação; fora do contrato visual |

Unicidade de negócio: CPF normalizado em memória durante `salvarAgenda` (`src/utils/cpf.ts` + `src/repositories/google-sheets-agenda-repository.ts`), não constraint SQL.

---

## 2. Persistência dos dados

Não há DELETE / TRUNCATE / DROP / VACUUM SQL.

Ciclo de vida em `GoogleSheetsAgendaRepository.salvarAgenda` (`src/repositories/google-sheets-agenda-repository.ts`):

1. Lê a matriz inteira da aba.
2. Classifica linhas com `isDataAgendamentoAtiva` (`src/utils/agenda-date.ts`): permanece só data **estritamente posterior a hoje** (`America/Sao_Paulo`).
3. Insere itens do portal cujo CPF ainda não está entre os ativos.
4. Regrava via `reescreverAba`: `updateValues` + `clearValues` apenas da cauda se a aba encolheu (ADR-021).
5. Noop: se não há linhas novas nem remoções e o cabeçalho já é canônico, **não escreve**.

| Operação | Existe? | Como |
| --- | --- | --- |
| DELETE SQL | Não | — |
| TRUNCATE / DROP | Não | — |
| Recriação de tabela | Não | — |
| Remoção de linhas | Sim | Descarte de não-futuros antes da regravação |
| Limpeza de cauda | Sim | `clearValues` se encolheu |
| Permanecem para sempre? | Não | Hoje e passado saem a cada sync |

---

## 3. Pessoas que fazem exames (candidatos)

Modelo: `Paciente` em `src/models/agenda.ts`.

| Pergunta | Resposta (evidência) |
| --- | --- |
| É gravada no banco? | Não há banco. Grava como **linha** na planilha. |
| Em qual tabela? | Nenhuma. |
| CPF é único? | Sim, **enquanto ativo** (`normalizeCpfKey` + set `cpfsAtivos`). |
| Se aparecer de novo? | Se CPF já ativo → **não duplica e não atualiza** (`continue`). |
| Se sumir do portal? | Linha **permanece** até a data deixar de ser futura. |
| Em seis meses ainda existirá? | Só se ainda tiver data futura e sobreviver a cada sync. Caso contrário, **não**. |

Documentação alinhada: `docs/MODELO_DOMINIO.md` (B004/B005).

CPF visual omitido na projeção; valor técnico na coluna adjacente (`projetarLinhaComCpfTecnico` / `hidratarCpfTecnico`).

---

## 4. Agendamentos

| Aspecto | Evidência |
| --- | --- |
| Formato | Uma linha = paciente ativo + data DETRAN + horário + profissional + unidade |
| Histórico de agendas passadas | **Não** — removidas na sync |
| Histórico de alterações | **Não** — só `DATA DE INCLUSÃO` da inclusão atual |
| Se muda a data | Linha antiga some se deixar de ser futura; CPF já ativo **não** é atualizado |
| Se some do portal | Pode permanecer até a data expirar o critério “futuro” |
| Perdemos histórico? | **Sim**, de forma deliberada no produto atual |

Campos de domínio (`categoria`, status de exames, etc.) existem em `ItemAgenda`, mas **não** entram no layout oficial atual da planilha.

`docs/VISAO_DO_PRODUTO.md` declara agendas passadas / histórico completo **fora de escopo**.

---

## 5. Profissionais de saúde

| Aspecto | Evidência |
| --- | --- |
| Tabela específica? | **Não** |
| Onde ficam? | Variáveis `ECNH_USER_<n>_*` (`src/config/sync-professionals.ts`) |
| Na planilha | Texto em `PROFISSIONAL` + `UNIDADE` (derivada de `CLINIC`) |
| Relacionamento profissional ↔ candidato | Implícito na linha (texto), **sem FK** |
| Credenciais | Efêmeras no sync; refresh opcional no `.env`, não em DB |
| Adequação | OK para sync operacional; **inadequado** para SaaS com entidades estáveis |

---

## 6. Sincronização (fluxo real)

```text
Entrypoint (sync-agenda / index / job-agenda)
  → FileSyncLock (.data/agenda-sync.lock)
  → AgendaSyncService.sincronizarProfissionais
       → por profissional:
            ECNHClient.login (HTTP Axios + CookieJar)
            → resolver perfil
            → listarDatasAgendamento
            → por data: obter HTML → parseAgendaHtml → salvarAgenda (Sheets)
            → logout (finally)
  → unlock → resumo / exit code
```

| Etapa pedida | Realidade no código |
| --- | --- |
| Portal e-CNH | Sim — `src/client/ecnh-client.ts` |
| Playwright | **Não** — HTTP direto |
| SQLite | **Não** |
| Google Sheets | Sim — destino final e store |

**Wiring:** `src/composition/agenda-sync-runtime.ts`  
**Orquestração:** `src/services/agenda-sync-service.ts`  
**Persistência:** `src/repositories/google-sheets-agenda-repository.ts`  
**Parser:** `src/parsers/agenda-parser.ts`

Nota: o JSDoc de `AgendaRepository.salvarAgenda` ainda fala em “substituir linhas da mesma data+profissional” (ADR-012 antiga); a implementação atual é o cadastro B004/B005 por CPF ativo.

---

## 7. Fonte de verdade

| Papel | Quem |
| --- | --- |
| Autoridade dos agendamentos no portal | Portal e-CNH (leitura HTTP) |
| Único store persistente de pacientes | Google Sheets (aba `Agenda`) |
| SQLite como fonte de verdade | **Não** — componente inexistente |
| Sheets como só relatório | **Não** — é store + UI operacional |

A porta `AgendaRepository` (`src/repositories/agenda-repository.ts` + ADR-012) foi desenhada para permitir trocar o destino (Postgres/SQLite), mas a implementação concreta é só Sheets.

---

## 8. Visão de longo prazo × suporte atual

Visão desejada (pelo solicitante): profissionais, pessoas, agendamentos, histórico de sync, histórico de alterações, histórico completo de candidatos, Sheets só relatório.

| Capacidade | Suporte atual | Gap |
| --- | --- | --- |
| Profissionais de saúde | Só `.env` + coluna texto | Crítico |
| Pessoas (candidatos) | Linha ativa sem entidade | Crítico |
| Agendamentos | Snapshot de futuros | Crítico |
| Histórico de sincronizações | Logs estruturados | Importante |
| Histórico de alterações | Só `DATA DE INCLUSÃO` | Crítico |
| Histórico completo de candidatos | Purge B005 | Crítico |
| Sheets só relatório | Sheets = destino final | Crítico |

**Reaproveitável:** modelos de domínio, client HTTP, parser, porta `AgendaRepository`, jobs/lock — como núcleo de sync, não como modelo de dados SaaS.

---

## 9. Melhorias priorizadas

### Críticas

- Introduzir store relacional (SQLite local → Postgres em produção) como **fonte de verdade**
- Entidades: profissional, pessoa, agendamento
- Parar de apagar histórico na sync
- Sheets como projeção operacional (visão), não store canônico

**Benefício:** histórico multi-anos, base para SaaS, auditoria e relatórios fiáveis.

### Importantes

- Tabela de runs de sincronização
- Auditoria de mudanças (before/after)
- Upsert real de pessoa (atualizar contato/nome quando já existe)
- Relacionamento explícito profissional ↔ agendamento

**Benefício:** rastreabilidade operacional e correção de dados sem reinventar a planilha.

### Recomendadas

- Migrations versionadas
- Testes de contrato do repository
- Alinhar JSDoc de `AgendaRepository` ao B005
- ADR + fase no roadmap para a nova fonte de verdade

**Benefício:** evolução controlada sem regressão silenciosa.

### Opcionais

- Multi-tenant SaaS
- API de leitura
- Painel
- Exportações além de Sheets

**Benefício:** produto além do sync diário.

---

## 10. Veredito (sem implementação)

A estrutura atual é uma **boa base de sincronizador operacional** (HTTP + domínio tipado + porta de repositório), mas **não** é uma boa base de **dados históricos / SaaS**.

**Recomendação:** mudança arquitetural de persistência **antes** de novas funcionalidades que dependam de histórico — banco como fonte de verdade, Sheets só visão.

Próximo passo natural (quando autorizado): ADR + schema + fase no roadmap — sem código até pedido explícito.

---

## Arquivos consultados

### Persistência / Sheets

- `src/repositories/agenda-repository.ts`
- `src/repositories/google-sheets-agenda-repository.ts`
- `src/repositories/agenda-sheet-mapper.ts`
- `src/repositories/agenda-sheet-headers.ts`
- `src/client/google-sheets-client.ts`
- `src/config/google-sheets-config.ts`

### Sync / jobs / config

- `src/services/agenda-sync-service.ts`
- `src/composition/agenda-sync-runtime.ts`
- `src/jobs/agenda-sync-job.ts`
- `src/jobs/file-sync-lock.ts`
- `src/scripts/sync-agenda.ts`
- `src/scripts/job-agenda.ts`
- `src/index.ts`
- `src/config/sync-professionals.ts`

### Domínio / portal / utils

- `src/models/agenda.ts`
- `src/client/ecnh-client.ts`
- `src/parsers/agenda-parser.ts`
- `src/utils/agenda-date.ts`
- `src/utils/cpf.ts`
- `package.json`

### Documentação

- `docs/DECISOES.md` (ADR-012, ADR-021)
- `docs/MODELO_DOMINIO.md`
- `docs/VISAO_DO_PRODUTO.md`
- `docs/ARQUITETURA.md`
- `docs/BACKLOG.md`

---

*Documento gerado a partir da auditoria de 24/07/2026. Versão visual equivalente: canvas `auditoria-persistencia-sqlite.canvas.tsx`.*
