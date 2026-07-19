# Fase 005 — Integração Google Sheets

**Status:** `Concluída`

## Objetivo

Persistir os modelos de domínio da agenda (`Agenda` / `ItemAgenda` / `Paciente`) em uma planilha Google Sheets, por meio de uma camada de repositório desacoplada, substituível e sem regras de negócio.

## Escopo

- estudar a API Google Sheets (`googleapis` Sheets v4) já dependente do projeto;
- definir autenticação por Service Account e configuração de ambiente;
- definir layout da aba `Agenda` (cabeçalhos, coluna `Profissional`, atualização);
- criar `AgendaRepository` (interface), `AgendaSheetMapper` (puro) e `GoogleSheetsAgendaRepository`;
- implementar escrita e substituição idempotente por `dataConsulta` + `profissional`;
- testes unitários do mapper/repositório e scripts de descoberta/validação;
- documentação após evidências da validação real.

## Fora de escopo

- múltiplos profissionais (orquestração);
- agendamento automático (cron);
- sincronização periódica;
- regras de negócio, filtros ou validações operacionais;
- alterações no `ECNHClient` ou no parser da agenda.

## Arquitetura

```text
AgendaRepository (interface)
        ↓
GoogleSheetsAgendaRepository
        ↓
AgendaSheetMapper (puro) + GoogleSheetsClient (SDK)
        ↓
Google Sheets API
```

Princípios confirmados:

- o domínio não conhece `googleapis` nem ranges A1;
- o mapper só converte domínio ↔ linhas;
- o repositório apenas persiste e recupera;
- a Fase 006 poderá trocar a implementação sem alterar parser/cliente HTTP.

## Layout da aba `Agenda`

| Coluna | Origem |
| ------ | ------ |
| Profissional | Contexto de persistência |
| Data | `Agenda.dataConsulta` |
| Hora | `ItemAgenda.horario` |
| CPF | `Paciente.cpf` |
| Nome | `Paciente.nome` |
| Telefone | `Paciente.telefone` |
| E-mail | `Paciente.email` |
| Tipo de Processo | `ItemAgenda.tipoProcesso` |
| Categoria | `ItemAgenda.categoria` |
| Status do Exame Médico | `ItemAgenda.statusExameMedico` |
| Status do Exame Psicológico | `ItemAgenda.statusExamePsicologico` |

**Estratégia de atualização:** substituir todas as linhas com a mesma `Data` e o mesmo `Profissional`, depois regravar os itens. Agenda vazia remove as linhas daquele par.

## Autenticação e configuração

| Variável | Função |
| -------- | ------ |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | ID da planilha |
| `GOOGLE_SHEETS_SHEET_NAME` | Nome da aba (padrão `Agenda`) |
| `GOOGLE_SHEETS_CREDENTIALS_PATH` ou `GOOGLE_APPLICATION_CREDENTIALS` | Caminho do JSON da Service Account |

A planilha deve ser compartilhada com o e-mail da Service Account (Editor).

## Implementação

| Módulo | Papel |
| ------ | ----- |
| `src/repositories/agenda-repository.ts` | Interface e resultados tipados |
| `src/repositories/agenda-sheet-mapper.ts` | Conversão pura domínio ↔ linhas |
| `src/repositories/google-sheets-agenda-repository.ts` | Persistência / recuperação |
| `src/client/google-sheets-client.ts` | Encapsula `googleapis` Sheets v4 |
| `src/config/google-sheets-config.ts` | Fronteira de ambiente |

Comandos:

```bash
npm run test:sheets
npm run discover:sheets
npm run validate:sheets
```

## Evidências

- Descoberta estática da API: `docs/evidencias/005-descoberta-api-sheets-2026-07-19.json`
- Descoberta de conexão: `docs/evidencias/005-descoberta-conexao-sheets-2026-07-19T13-23-22-770Z.json`
- Validação de persistência: `docs/evidencias/005-validacao-sheets-2026-07-19T13-23-24-530Z.json`

### Validação em 19/07/2026

**Evidências confirmadas:**

- `npm run test:sheets` — 9 testes unitários aprovados (mapper + repositório in-memory);
- `npm run discover:sheets` — Service Account autenticou; planilha encontrada; aba `Agenda` presente (`hasAgendaSheet=true`);
- `npm run validate:sheets` — escrita de 2 linhas sintéticas, leitura de volta e limpeza aprovadas; evidência sem PII.

**Resultado:** a Fase 005 avança para `Validada` e, com a documentação atualizada, para `Concluída`.

## Critérios de sucesso

- [x] Layout e autenticação documentados com evidência.
- [x] Interface `AgendaRepository` e implementação Sheets criadas.
- [x] `AgendaSheetMapper` puro, testado sem rede.
- [x] Escrita/substituição idempotente validada (in-memory e API real).
- [x] Evidência sanitizada de validação real aprovada.
- [x] Documentação obrigatória atualizada e fase `Concluída`.

## Dificuldades e limitações

- Antes do compartilhamento da planilha com a Service Account, a API retornou `The caller does not have permission`; corrigido apenas na configuração Google (Editor), sem mudança de código.

## Pendências

- Nenhuma pendência bloqueante no escopo da Fase 005.

## Próximos passos

Iniciar a Fase 006 — Orquestração multi-profissionais, consumindo `AgendaRepository` sem acoplar ao Sheets.

## Resultado da fase

Persistência da agenda em Google Sheets foi implementada com interface substituível, mapper puro e Service Account; validada contra planilha real com evidências sanitizadas. A Fase 005 está `Concluída`.
