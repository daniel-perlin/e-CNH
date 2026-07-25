# Modelo de domínio

## Propósito

Este documento define os contratos conceituais compartilhados entre `ECNHClient`, parser HTML, serviços e integração com Google Sheets. Modelos TypeScript concretos da agenda estão em `src/models/agenda.ts` (Fase 004).

## Princípios de dados

- CPF, senha, telefone e e-mail são dados sensíveis e não podem ser registrados em logs, fixtures de evidência, mensagens de erro ou documentação com valores reais. Fixtures de teste unitário usam valores sintéticos.
- A senha do profissional existe somente como dado de entrada para autenticação; não deve ser persistida no domínio nem propagada para parser, serviços ou Sheets.
- Campos podem ser ausentes, incompletos ou indisponíveis no portal. A obrigatoriedade definitiva será definida por evidência e pela fase que implementar cada integração.

## Profissional

Representa um médico ou psicólogo credenciado que possui acesso individual ao portal.

| Atributo conceitual | Descrição                                     | Tratamento                                        |
| ------------------- | --------------------------------------------- | ------------------------------------------------- |
| nome                | Nome de identificação do profissional.        | Dado pessoal; não registrar desnecessariamente.   |
| cpf                 | Identificador usado na autenticação.          | Sensível; nunca exibir em logs.                   |
| senha               | Segredo usado no login.                       | Entrada efêmera; nunca persistir ou retornar.     |
| clínica             | Valor de `ECNH_USER_<n>_CLINIC` no `.env`.     | Traduzido para **unidade operacional** via `resolveNomeUnidadeOperacional` (não vem do HTML da agenda). |
| unidade operacional | Nome exibido na planilha (coluna UNIDADE).    | Exemplos: `LIMÃO`, `CAPÃO REDONDO`, `VILA CARRÃO`. Distinto da unidade/visão do portal (B011). |
| função              | Papel profissional no portal (`psicologo` / `medico`). | Resolvido no HTML pós-login; opcionalmente `ECNH_USER_<n>_PROFILE`. |
| status do login     | Estado lógico da autenticação mais recente.   | Derivado de `ResultadoLogin`; não contém segredo. |

## Paciente / Pessoa

Representa a pessoa associada a uma linha da agenda (`table#agenda`).

No Google Sheets (operacional), a pessoa aparece como linha ativa (B004/B005).

No banco relacional (ADR-022), a mesma pessoa é upsertada em `pessoas` (histórico permanente, nunca apagada), com `origem = "Projeto e-CNH"`, flag `ativo` e `primeira_sincronizacao` / `ultima_sincronizacao`.

| Atributo | Coluna HTML | Tratamento |
| -------- | ----------- | ---------- |
| nome | Nome | Dado pessoal. |
| cpf | CPF | Dado pessoal sensível. |
| telefone | Telefone | Dado pessoal sensível. |
| email | E-mail | Dado pessoal sensível. |

**Evidência confirmada (Fase 004):** esses quatro campos correspondem a colunas de domínio na tabela de resultado. Ausência de valor na célula vira propriedade omitida no modelo tipado.

## ItemAgenda

Representa um atendimento/linha da agenda diária. Agrupa o paciente com metadados do processo e dos exames.

| Atributo | Coluna HTML | Tratamento |
| -------- | ----------- | ---------- |
| horario | Hora | Horário do atendimento (`HH:MM` observado). |
| paciente | — | Objeto `Paciente`. |
| tipoProcesso | Tipo de Processo | Metadado do processo DETRAN. |
| categoria | Categoria | Categoria associada ao atendimento. |
| statusExameMedico | Status do Exame Médico | Estado do exame médico. |
| statusExamePsicologico | Status do Exame Psicológico | Estado do exame psicológico. |

Classes CSS, `style` e tabelas de layout **não** fazem parte do domínio.

## Agenda

Representa a agenda diária extraída do HTML de resultado.

| Atributo | Origem | Descrição |
| -------- | ------ | --------- |
| dataConsulta | Contexto do chamador | Data `DD/MM/YYYY` da consulta. **Não** é lida da tabela: o HTML pós-POST não preserva o select de forma confiável. |
| itens | Linhas de `table#agenda` | Coleção de `ItemAgenda`. Lista vazia é agenda válida sem pacientes. |

## ResultadoLogin

Representa o retorno lógico de uma tentativa de autenticação. É independente de HTTP, HTML, texto de tela e cookie até que existam evidências para mapeá-los.

| Estado            | Significado conceitual                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| sucesso           | A autenticação foi confirmada e a sessão está disponível.              |
| senha inválida    | As credenciais foram rejeitadas por senha inválida.                    |
| usuário bloqueado | O acesso do profissional está bloqueado.                               |
| erro do sistema   | A tentativa falhou por condição conhecida do portal ou infraestrutura. |
| erro desconhecido | A tentativa não pôde ser classificada com segurança.                   |

**Evidência confirmada:** sucesso é validado pela presença conjunta de `JSESSIONID` e de um marcador HTML de perfil conhecido (Psicólogo ou Médico). O `perfilId` entra na sessão autenticada e no resultado de sincronização.

**Pendência de validação:** os sinais HTTP/HTML de senha inválida e usuário bloqueado ainda não foram observados e não devem ser presumidos. Na ausência dos sinais confirmados de sucesso, o MVP retorna `erro desconhecido`.

## ResultadoExtracaoAgenda

Representa o retorno lógico do parser HTML → domínio (Fase 004). Independente de HTTP/sessão.

| Elemento | Descrição |
| -------- | --------- |
| sucesso | Extração concluída com `table#agenda` e cabeçalhos obrigatórios. |
| agenda | `Agenda` tipada quando `sucesso` é verdadeiro. |
| motivoFalha | `html-sem-tabela-agenda`, `cabecalhos-obrigatorios-ausentes` ou `estrutura-invalida`. |

O HTML bruto permanece responsabilidade do `ECNHClient` (`ResultadoConsultaAgenda` conceitual da navegação). O parser não realiza requests.

## ResultadoPersistenciaAgenda

Representa o retorno lógico da persistência domínio → destino (Fase 005). Independente de Google Sheets.

| Elemento | Descrição |
| -------- | --------- |
| sucesso | Persistência concluída. |
| linhasGravadas | Quantidade de linhas **novas** inseridas (CPF ainda não ativo na planilha). |
| linhasRemovidas | Quantidade de linhas removidas por agendamento DETRAN **passado** (B005 / `AgendaOperacionalPolicy`). |
| motivoFalha | `contexto-incompleto`, `data-consulta-ausente`, `cabecalho-incompativel` ou `erro-infraestrutura`. |

O contexto de persistência inclui `profissional` (coluna **PROFISSIONAL**) e `unidadeOperacional` (coluna **UNIDADE**). A senha do profissional nunca entra nesta camada.

**Projeção Google Sheets (layout oficial / contrato da clínica):** a aba `Agenda` **exibe** apenas estas colunas, nesta ordem (fonte: `CABECALHOS_ABA_AGENDA`):

1. UNIDADE  
2. AGENDAMENTO DO DETRAN  
3. HORÁRIO  
4. PACIENTE  
5. TELEFONE  
6. EMAIL  
7. Tipo de Processo  
8. Categoria  
9. PROFISSIONAL  
10. DATA DE INCLUSÃO  

CPF e status de exames permanecem no **domínio** (`Paciente` / `ItemAgenda`) e na extração HTML; o CPF **não** faz parte do contrato visual. Tipo de processo e categoria já existiam no domínio/parser e passam a constar na projeção operacional.

**Regra de negócio (B004/B005):** a aba `Agenda` é um cadastro de **pacientes ativos**. Em cada sincronização, permanecem linhas cujo agendamento DETRAN é **hoje ou futuro** (calendário `America/Sao_Paulo`; datas passadas saem). A decisão vive em `AgendaOperacionalPolicy` (`src/domain/agenda-operacional-policy.ts`), não em utilitários de data. O **CPF normalizado continua sendo a chave única** do paciente enquanto ele está ativo. Se o paciente sair (data passada) e voltar depois, a reinclusão gera nova DATA DE INCLUSÃO.

**Implementação da projeção:** o mapper grava as 10 colunas de `CABECALHOS_ABA_AGENDA`. Planilhas no layout oficial anterior (`CABECALHOS_ABA_AGENDA_OFICIAL_V8`, 8 colunas) são aceitas na leitura e migradas automaticamente na primeira escrita. Para a deduplicação por CPF continuar funcionando entre sincronizações sem colocar o CPF no contrato visual, o repositório preserva o valor em coluna técnica adjacente (sem título no cabeçalho oficial) — índice resolvido conforme o layout lido (V8 → 8; canônico → 10).

**Coluna UNIDADE (B013):** cada linha recebe o nome operacional derivado do `CLINIC` do profissional sincronizado — não do HTML da agenda do paciente.

## Relação entre as camadas

```text
ECNHClient -> HTML bruto / ResultadoLogin
                         │
                         ▼
              parseAgendaHtml -> ResultadoExtracaoAgenda
                         │
                         ▼
              AgendaRepository -> destino (Google Sheets)
```

`ECNHClient` entrega transporte e HTML; o parser transforma HTML em modelos de domínio; `AgendaRepository` persiste/recupera esses modelos. A implementação `GoogleSheetsAgendaRepository` usa `AgendaSheetMapper` (puro) e não é conhecida pelo domínio.

A Fase 006 introduz `AgendaSyncService` (`src/services`) para orquestrar esse encadeamento e devolver um `ResultadoSincronizacao` tipado, sem alterar client, parser ou repositório. Detalhes em [.fases/006-orquestracao-sincronizacao.md](../.fases/006-orquestracao-sincronizacao.md).

A Fase 007 dispara essa orquestração via `AgendaSyncJob` / `AgendaSyncScheduler` com `SyncLock` global, sem alterar o serviço. Detalhes em [.fases/007-agendamento-automatico.md](../.fases/007-agendamento-automatico.md).

## ResultadoSincronizacao

Representa o retorno lógico da orquestração (Fase 006). Independente de HTTP, HTML e Sheets.

| Elemento | Descrição |
| -------- | --------- |
| sucessoGeral | Verdadeiro somente se todos os profissionais sincronizaram com sucesso. |
| profissionais | Lista de `ResultadoSincronizacaoProfissional`. |

### ResultadoSincronizacaoProfissional

| Elemento | Descrição |
| -------- | --------- |
| identificadorSeguro | Rótulo operacional (ex.: `ECNH_USER_3`), sem CPF. |
| loginStatus | Status do login tipado. |
| logoutExecutado | Indica se o logout rodou no `finally`. |
| sucesso | Sucesso do profissional (todas as datas ok). |
| datas | Lista de `ResultadoSincronizacaoData`. |

### ResultadoSincronizacaoData

| Elemento | Descrição |
| -------- | --------- |
| dataConsulta | Data `DD/MM/YYYY`. |
| sucesso | Extração e persistência ok. |
| itensExtraidos / linhasGravadas / linhasRemovidas | Contagens operacionais (sem PII). |
| motivoFalhaExtracao / motivoFalhaPersistencia | Motivos tipados reutilizados das fases 004/005. |

CPF e senha existem apenas na entrada efêmera da sincronização; nunca no resultado tipado.
