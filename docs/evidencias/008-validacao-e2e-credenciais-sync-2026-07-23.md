# Validação E2E — credenciais e sincronização de agenda

**Classificação:** evidência confirmada (portal real + Google Sheets real)  
**Data da execução:** 2026-07-23 (BRT)  
**Comandos:** `npm run audit:credenciais`, `npm run sync:agenda`  
**Disciplina:** sem CPF, senha, cookies, HTML bruto ou dados de pacientes neste documento.

Artefatos relacionados:

- Auditoria de credenciais: `npm run audit:credenciais` (catálogo local gitignored)
- Sincronização: `npm run sync:agenda`
- Diário: [CHANGELOG.md](../../CHANGELOG.md) — sessão 23/07/2026 • 18:30

---

## Objetivo

Registrar oficialmente que, após a auditoria inteligente de credenciais:

1. o login HTTP dos profissionais configurados foi validado contra o portal e-CNH SP;
2. a sincronização ponta a ponta (login → perfil/unidade → agenda → parser → regras → Google Sheets) foi executada com sucesso para todos os profissionais habilitados na rodada E2E;
3. o projeto está aprovado para uso em produção local e preparado para deploy (ex.: Railway), com a ressalva explícita de uma conta bloqueada no portal.

---

## Ambiente

| Campo | Valor |
| --- | --- |
| Data | 2026-07-23 (BRT) |
| Branch | `main` |
| Commit HEAD no momento do registro | `19b085c` (working tree com alterações locais de docs/credenciais ainda não commitadas) |
| Portal | e-CNH SP (HTTP real via `ECNH_BASE_URL`) |
| Destino | Google Sheets — aba `Agenda` (Service Account) |
| Profissionais na auditoria (catálogo) | 17 |
| Profissionais na sincronização E2E | 16 (`ENABLED=true`) |
| Excluída do sync E2E | Alessandra (`ECNH_USER_9`, `ENABLED=false` — bloqueio no portal) |

---

## Resultado da auditoria

Comando: `npm run audit:credenciais`  
Escopo: catálogo de candidatas × todos os `ECNH_USER_*` (incluindo desabilitados).

| Métrica | Valor |
| --- | ---: |
| Processados | 17 |
| Autenticaram | 16 |
| Atualizados no `.env` nesta rodada | 0 (correções prévias de aspas/senha vazia já aplicadas) |
| Continuam inválidos | 1 |
| Portal indisponível / timeout | 0 |

| Nome (operacional) | Status auditoria | Observação |
| --- | --- | --- |
| 16 profissionais restantes do catálogo | Autenticado | Login HTTP OK |
| Alessandra Petraglia de Freitas | Inválido | Portal rejeita; candidata idêntica à credencial atual — possível bloqueio/reativação |

Correções de configuração aplicadas **antes** desta E2E (não são bug de regra de negócio):

- senha com `#` sem aspas (dotenv) — corrigida com aspas;
- `PASSWORD` vazia — preenchida a partir do catálogo local (gitignored).

---

## Resultado da sincronização E2E

Comando: `npm run sync:agenda`  
**Sucesso geral:** sim  
**Falhas de fluxo:** 0  

Legenda das colunas: Login / Agenda (consulta+HTML) / Parser / Sheets = etapas do pipeline.  
`Itens` = pacientes extraídos do HTML (todas as datas).  
`Gravadas` / `Removidas` = totais agregados reportados pela persistência na rodada.

| Profissional | Login | Agenda | Parser | Google Sheets | Itens | Gravadas | Removidas |
| --- | :---: | :---: | :---: | :---: | ---: | ---: | ---: |
| Gabriela Moura Gomes dos Santos | ✅ | ✅ | ✅ | ✅ | 19 | 1 | 0 |
| Isis Isadora Moraes Soares | ✅ | ✅ | ✅ | ✅ | 16 | 1 | 0 |
| Cristina Marina de Sousa | ✅ | ✅ | ✅ | ✅ | 18 | 1 | 0 |
| Aline | ✅ | ✅ | ✅ | ✅ | 20 | 9 | 0 |
| Fabiana | ✅ | ✅ | ✅ | ✅ | 19 | 1 | 0 |
| Gladson | ✅ | ✅ | ✅ | ✅ | 17 | 0 | 0 |
| Gabrielle | ✅ | ✅ | ✅ | ✅ | 24 | 0 | 0 |
| Valeria Souza da Silva | ✅ | ✅ | ✅ | ✅ | 21 | 10 | 0 |
| Carlos Roberto de Melo | ✅ | ✅ | ✅ | ✅ | 30 | 16 | 0 |
| Marina Paulino Gracia | ✅ | ✅ | ✅ | ✅ | 37 | 17 | 0 |
| Bruno Eduardo dos Santos | ✅ | ✅ | ✅ | ✅ | 52 | 29 | 0 |
| Rodrigo Mitchell Pereira da Silva | ✅ | ✅ | ✅ | ✅ | 38 | 16 | 0 |
| Maria Rozana | ✅ | ✅ | ✅ | ✅ | 20 | 9 | 0 |
| Priscila | ✅ | ✅ | ✅ | ✅ | 19 | 7 | 0 |
| Italo | ✅ | ✅ | ✅ | ✅ | 72 | 1 | 0 |
| Caio | ✅ | ✅ | ✅ | ✅ | 51 | 1 | 0 |

### Resumo E2E

| Métrica | Valor |
| --- | ---: |
| Profissionais processados | 16 |
| Login OK | 16 |
| Agenda consultada (datas `ok`) | 16 |
| Parser OK | 16 |
| Google Sheets OK | 16 |
| Agenda sem itens (`itens=0`) | 0 |
| Falhas de sync | 0 |

---

## Observações

1. **Alessandra** permanece bloqueada/rejeitada pelo portal; credencial candidata idêntica à atual. Não participa do sync E2E (`ENABLED=false`). Tratamento: operacional no portal (reativação), não correção de código.
2. **`ECONNRESET` no logout:** observado pontualmente em `GET method=finalizarLogin`. Logout é best-effort; a sessão local foi descartada. **Não** impactou o sucesso da sincronização.
3. **`gravadas=0` (Gladson, Gabrielle):** não é erro. Login, HTML, parser e persistência retornaram sucesso; nenhum paciente **novo** foi inserido (deduplicação por CPF / pacientes já ativos / datas sem inclusão nova). Distinto de “agenda vazia”.
4. Nenhum CPF, senha, cookie ou HTML foi arquivado neste documento.

---

## Conclusão

Declara-se, com base nesta execução controlada:

| Declaração | Status |
| --- | :---: |
| Módulo de credenciais validado (auditoria + login real) | ✅ |
| Sincronização E2E validada (16/16 habilitados) | ✅ |
| Google Sheets (aba `Agenda`) validado na rodada | ✅ |
| Projeto aprovado para **produção local** | ✅ |
| Pronto para **deploy Railway** (com secrets/env no destino) | ✅ |

**Ressalva:** a conta Alessandra exige ação no portal antes de reentrada no pool de sync.

---

## Classificação da evidência

| Item | Tipo |
| --- | --- |
| Contagens e status de login/sync acima | **Evidência confirmada** |
| Motivo exato do bloqueio de Alessandra no portal | **Pendência de validação** junto ao portal (reativação) |
| Causa raiz do `ECONNRESET` no logout | **Hipótese** de instabilidade transitória de rede/portal |
