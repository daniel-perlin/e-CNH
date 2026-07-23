# Validação E2E — formatação Google Sheets

**Classificação:** evidência confirmada (portal real + Google Sheets real)  
**Data da execução:** 2026-07-23 (BRT)  
**Comando principal:** `npm run sync:agenda`  
**Disciplina:** sem CPF, senha, cookies, HTML bruto ou nomes completos de pacientes neste documento.

Artefatos relacionados:

- Sincronização: `npm run sync:agenda`
- Formatação: `formatPatientName` / `formatProfessionalDisplayName`
- Diário: [CHANGELOG.md](../../CHANGELOG.md) — sessão 23/07/2026 • 18:55

---

## Resumo executivo

A alteração de **apresentação** das colunas PACIENTE e PROFISSIONAL chegou ao Google Sheets sem mudar autenticação, parser HTML, deduplicação por CPF, regras de pacientes ativos ou o contrato da aba.

| Resultado | Valor |
| --- | --- |
| Profissionais sincronizados com sucesso | **16/16** |
| Login HTTP | **16/16** |
| Linhas ativas na aba `Agenda` ao final | **233** |
| PACIENTE no padrão (1 token, Title Case) | **233/233** |
| PROFISSIONAL no padrão (`<tipo>: NOME…`) | **233/233** |
| Dupla formatação | **0** |
| Valores legados de PROFISSIONAL remanescentes | **0** |
| Pronto para commit da formatação | **SIM** |

---

## Ambiente

| Campo | Valor |
| --- | --- |
| Data | 2026-07-23 (BRT) |
| Commit HEAD no registro | `58aab69` (working tree com a mudança de formatação ainda não commitada) |
| Portal | e-CNH SP (HTTP real) |
| Destino | Google Sheets — aba `Agenda` |
| Profissionais habilitados | 16 (`ENABLED=true`) |
| Excluída | Alessandra (`ECNH_USER_9`, `ENABLED=false`) |

---

## Método

1. Executar `npm run sync:agenda` (pipeline completo: login → perfil/unidade → agenda → parser → regras → Sheets).
2. Em falhas transitórias de infraestrutura (API Sheets / `ECONNRESET` no portal), reexecutar os profissionais afetados com pausa entre tentativas — **sem alterar regras de negócio**.
3. Auditar a aba `Agenda` por padrão estrutural (não por PII):
   - PACIENTE: exatamente um token; Title Case `pt-BR`.
   - PROFISSIONAL: `^(Psicólogo\|Médico): [A-ZÀ-Ü]+( [A-ZÀ-Ü]+)?$`; ausência de prefixo duplicado.

---

## Tabela de validações

| # | Validação | Resultado | Evidência |
| --- | :---: | --- | --- |
| 1 | Login HTTP dos 16 profissionais | ✅ | `login: sucesso` em todos |
| 2 | Consulta de agenda (HTML) | ✅ | Datas sincronizadas por profissional |
| 3 | Parser HTML | ✅ | Itens extraídos > 0 em todos |
| 4 | `perfilId` de domínio (sem heurística de nome) | ✅ | `psicologo` / `medico` no resultado do login |
| 5 | PACIENTE = primeiro nome Title Case | ✅ | 233/233 linhas |
| 6 | PROFISSIONAL = `<tipo>: PRIMEIRO [SEGUNDO]` caixa alta | ✅ | 233/233 linhas; 16 valores distintos |
| 7 | Sem dupla formatação | ✅ | 0 ocorrências |
| 8 | Deduplicação por CPF (regressão) | ✅ | Reexecução com `gravadas=0` quando já ativo |
| 9 | Pacientes ativos / limpeza de datas passadas | ✅ | Pipeline inalterado; só formatação muda |
| 10 | Scheduler / job / lock | ✅ | Não alterados nesta mudança |
| 11 | Cabeçalho oficial da aba | ✅ | 8 colunas canônicas preservadas |

---

## Exemplos reais — PROFISSIONAL (antes → depois)

Valores operacionais confirmados na planilha após a sincronização (origem: `NAME` da config + `perfilId` do login):

| Antes (nome completo na config) | Depois (coluna PROFISSIONAL) | `perfilId` |
| --- | --- | --- |
| Gabriela Moura Gomes dos Santos | `Psicólogo: GABRIELA MOURA` | `psicologo` |
| Isis Isadora Moraes Soares | `Psicólogo: ISIS ISADORA` | `psicologo` |
| Valeria Souza da Silva | `Psicólogo: VALERIA SOUZA` | `psicologo` |
| Carlos Roberto de Melo | `Médico: CARLOS ROBERTO` | `medico` |
| Marina Paulino Gracia | `Médico: MARINA PAULINO` | `medico` |
| Bruno Eduardo dos Santos | `Médico: BRUNO EDUARDO` | `medico` |
| Italo | `Médico: ITALO` | `medico` |
| Aline | `Psicólogo: ALINE` | `psicologo` |

**Nota:** com um único token no `NAME` (ex.: Italo, Aline), a regra grava só o primeiro nome — comportamento esperado, sem inventar sobrenome.

---

## Exemplos — PACIENTE (regra confirmada)

A planilha **não** guarda mais o nome completo em caixa alta. A auditoria estrutural encontrou **233/233** células PACIENTE com um único token em Title Case.

Formato esperado (exemplos ilustrativos da regra; sem arquivar PII do portal):

| Antes (domínio / HTML) | Depois (Sheets) |
| --- | --- |
| `JOSE EDSON…` | `Jose` |
| `LEANDRO…` | `Leandro` |
| `ANTÔNIO…` | `Antônio` |

Preservação de acentos: coberta por testes unitários (`formatPatientName`). Nesta rodada E2E, a amostra ativa não trouxe primeiro nome acentuado; o padrão Title Case `pt-BR` foi aplicado em 100% das linhas.

---

## Quantidades

### Sincronização sequencial consolidada (16 profissionais)

| Métrica | Valor |
| --- | ---: |
| Profissionais processados | 16 |
| Sucesso geral (após retry pontual) | sim |
| Login OK | 16 |
| Itens extraídos (soma das agendas) | 454 |
| Linhas **novas** gravadas nesta consolidação | 140 |
| Linhas ativas finais na planilha | 233 |
| Remoções reportadas na consolidação | 0 |

`gravadas=0` em profissionais já cobertos (ex.: Fabiana no retry, Maria Rozana, Priscila, Italo, Caio) = deduplicação / pacientes já ativos — **não** é falha de formatação.

### Distribuição final na coluna PROFISSIONAL

| Valor na planilha | Linhas |
| --- | ---: |
| Médico: ITALO | 45 |
| Médico: BRUNO EDUARDO | 30 |
| Médico: CAIO | 24 |
| Médico: MARINA PAULINO | 17 |
| Médico: CARLOS ROBERTO | 16 |
| Médico: RODRIGO MITCHELL | 16 |
| Psicólogo: GABRIELLE | 13 |
| Psicólogo: VALERIA SOUZA | 10 |
| Psicólogo: MARIA ROZANA | 9 |
| Psicólogo: ALINE | 9 |
| Psicólogo: CRISTINA MARINA | 8 |
| Psicólogo: FABIANA | 8 |
| Psicólogo: GLADSON | 8 |
| Psicólogo: PRISCILA | 7 |
| Psicólogo: ISIS ISADORA | 7 |
| Psicólogo: GABRIELA MOURA | 6 |
| **Total** | **233** |

---

## Observações operacionais (fora do escopo da formatação)

1. **`npm run sync:agenda` em rajada** pode retornar `erro-infraestrutura` na persistência Sheets no final da fila (quota/escrita intensiva da regravação da aba). **Não** é regressão da formatação: login/parser seguem OK; retry do profissional afeta resolve.
2. **`ECONNRESET` pontual** no portal (`obter_html`) observado em Fabiana; retry imediato com sucesso.
3. Reexecução com sucesso após falha transitória **restaura** a cobertura dos 16 profissionais e mantém o padrão de formatação.
4. Nenhuma regra de autenticação, parser, deduplicação ou scheduler foi alterada nesta etapa.

---

## Resultado final

| Critério | Status |
| --- | :---: |
| Formatação PACIENTE no Sheets | ✅ |
| Formatação PROFISSIONAL no Sheets | ✅ |
| `perfilId` como fonte do tipo | ✅ |
| Sem dupla formatação | ✅ |
| Regressão de sync / auth / parser / dedup | ✅ (sem mudança de regra) |
| Pronto para commit | **SIM** |

Declara-se aprovada a validação E2E da formatação de apresentação no Google Sheets.
