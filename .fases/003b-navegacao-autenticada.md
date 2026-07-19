# Fase 003B — Navegação autenticada

**Status:** `Concluída`

## Objetivo

Descobrir e reproduzir a navegação HTTP pós-login até obter o HTML bruto da agenda diária, de forma reproduzível, sem interpretar pacientes ou horários.

## Escopo

- inventário do HTML autenticado e do formulário de agenda;
- descoberta de endpoints, parâmetros e respostas de consulta;
- reprodução no `ECNHClient` da obtenção de HTML bruto;
- scripts de descoberta e validação com evidências sanitizadas.

Não implementar parser de agenda, modelos tipados de paciente, Google Sheets, orquestração multi-profissional nem cron.

## Descobertas

### Página pós-login

**Evidência confirmada:** o POST `method=autenticar` bem-sucedido já devolve a página "Imprimir Agenda Diária do Psicólogo" com o formulário `DivisaoEquitativaForm`.

| Elemento | Valor observado |
| -------- | --------------- |
| Form | `DivisaoEquitativaForm` |
| Método HTTP | `POST` |
| Action | `/gefor/GFR/divisao/divisaoEquitativa.do` |
| `method` (hidden) | `consultarAgendaPsicologo` |
| Campos | `idUnidadeTransitoConsulta`, `idUsuarioMedicoConsulta`, `dataReferencia`, `data` |
| Select de datas | `#agendamentos` (`name="data"`), opções `DD/MM/YYYY` |
| UI | `PESQUISAR` → `pesquisar()`; `LIMPAR` → `cancelar()` |

### Scripts do portal

**Evidência confirmada** em `/GFR/js/app/divisao/agendaPsicologo.js` e `/GFR/js/app/divisao/comum.js`:

- `pesquisar()` valida campos e faz `document.forms[0].submit()`;
- `fieldsValidate()` exige unidade, psicólogo, `dataReferencia` e `data`;
- `refreshAgendaMedica()` chama JSON `method=refreshAgendaMedicaByMedico`;
- `refreshPsicologo()` / `refreshMedicos()` chamam JSON `method=refreshMedicosByUnidadeTransito`.

### Consulta da agenda

**Evidência confirmada:**

```text
POST /gefor/GFR/divisao/divisaoEquitativa.do
Content-Type: application/x-www-form-urlencoded

method=consultarAgendaPsicologo
idUnidadeTransitoConsulta=<id>
idUsuarioMedicoConsulta=<id>
dataReferencia=<DD/MM/YYYY|DDMMYYYY>
data=<DD/MM/YYYY>
```

A resposta HTML autenticada contém:

- fieldset/legend `Resultado`;
- hidden `method=agendaMedico`;
- tabela com cabeçalhos: Hora, CPF, Nome, Telefone, E-mail, Tipo de Processo, Categoria, Status do Exame Médico, Status do Exame Psicológico.

### Refresh JSON (datas / profissionais)

**Evidência confirmada:** ambos retornam `application/json` com array de `{ value, label }`.

| method | Parâmetros principais | Uso |
| ------ | --------------------- | --- |
| `refreshMedicosByUnidadeTransito` | `idUnidadeTransitoConsulta`, opcional `idTipoProfessional=4` | popular psicólogos |
| `refreshAgendaMedicaByMedico` | `idUsuarioMedicoConsulta`, `dataReferencia` | popular `#agendamentos` |

## Evidências

- Descoberta: `docs/evidencias/003b-descoberta-navegacao-2026-07-19T11-22-02-650Z.json`
- Validação reproduzível via `ECNHClient`: `docs/evidencias/003b-validacao-navegacao-2026-07-19T11-23-40-485Z.json`

### Validação em 19/07/2026

**Evidências confirmadas:**

- `npm run validate:agenda` autenticou, listou datas do HTML pós-login, consultou a primeira data e encerrou a sessão;
- a resposta da consulta manteve o marcador autenticado, apresentou legend `Resultado`, `method=agendaMedico` e os cabeçalhos esperados;
- `typecheck` e `lint` passaram.

**Resultado:** a Fase 003B avança para `Validada`.

## Critérios de sucesso

- [x] Endpoints e parâmetros da navegação de agenda confirmados por evidência.
- [x] HTML bruto de resultado obtido com a mesma sessão autenticada (CookieJar).
- [x] Reprodução no `ECNHClient` sem parsing de pacientes.
- [x] Script de validação com evidência sanitizada aprovada.
- [x] Sem antecipação da Fase 004 (parser) ou posteriores.

## Dificuldades e limitações

- O JS do portal exige `dataReferencia`, mas o servidor também devolveu `Resultado` com o campo vazio na descoberta. A reprodução no cliente exige `dataReferencia` no formato observado (`DD/MM/YYYY` ou `DDMMYYYY`) para aderir à validação do navegador.
- Os endpoints JSON de refresh foram confirmados, porém não são necessários para a consulta quando o select `#agendamentos` já vem populado no HTML pós-login.
- O HTML de resultado contém dados pessoais; apenas metadados, hashes e sinais estruturais são preservados em `docs/evidencias/`.

## Pendências

- Expor no `ECNHClient`, se necessário em fase futura, os refreshes JSON para trocar `dataReferencia` quando o select pós-login estiver vazio.
- Parsing estruturado da tabela de resultado (Fase 004).

## Próximos passos

Iniciar a Fase 004 — Extração de dados da agenda, sem alterar o protocolo HTTP confirmado.

## Resultado da fase

Navegação autenticada até o HTML bruto da agenda foi descoberta, implementada no `ECNHClient`, validada com evidência sanitizada e documentada. A Fase 003B está `Concluída`.
