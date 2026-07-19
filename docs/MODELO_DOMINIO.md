# Modelo de domínio

## Propósito

Este documento define os contratos conceituais compartilhados entre `ECNHClient`, parser HTML, serviços e integração com Google Sheets. Ele não é uma implementação TypeScript nem descreve um contrato HTTP; modelos concretos só serão criados nas fases que precisarem deles.

## Princípios de dados

- CPF, senha, telefone e e-mail são dados sensíveis e não podem ser registrados em logs, fixtures, mensagens de erro ou documentação com valores reais.
- A senha do profissional existe somente como dado de entrada para autenticação; não deve ser persistida no domínio nem propagada para parser, serviços ou Sheets.
- Campos podem ser ausentes, incompletos ou indisponíveis no portal. A obrigatoriedade definitiva será definida por evidência e pela fase que implementar cada integração.

## Profissional

Representa um médico ou psicólogo credenciado que possui acesso individual ao portal.

| Atributo conceitual | Descrição                                     | Tratamento                                        |
| ------------------- | --------------------------------------------- | ------------------------------------------------- |
| nome                | Nome de identificação do profissional.        | Dado pessoal; não registrar desnecessariamente.   |
| cpf                 | Identificador usado na autenticação.          | Sensível; nunca exibir em logs.                   |
| senha               | Segredo usado no login.                       | Entrada efêmera; nunca persistir ou retornar.     |
| clínica             | Clínica ou unidade associada ao profissional. | A confirmar conforme a fonte de dados.            |
| função              | Papel profissional, como médico ou psicólogo. | A confirmar conforme a fonte de dados.            |
| status do login     | Estado lógico da autenticação mais recente.   | Derivado de `ResultadoLogin`; não contém segredo. |

## Paciente

Representa uma pessoa retornada por uma agenda do portal.

| Atributo conceitual | Descrição                                | Tratamento                             |
| ------------------- | ---------------------------------------- | -------------------------------------- |
| nome                | Nome do paciente.                        | Dado pessoal.                          |
| cpf                 | Identificador do paciente, se informado. | Dado pessoal sensível.                 |
| telefone            | Meio de contato, se informado.           | Dado pessoal sensível.                 |
| email               | Meio de contato, se informado.           | Dado pessoal sensível.                 |
| horário             | Horário associado ao atendimento.        | Formato e fuso pendentes de evidência. |

O parser só deverá preencher dados efetivamente presentes no HTML confirmado. Ausência de paciente em uma agenda não deve ser confundida com falha de consulta.

## Agenda

Representa uma agenda consultada para um profissional e período específicos.

| Atributo conceitual | Descrição                                              |
| ------------------- | ------------------------------------------------------ |
| data da consulta    | Data à qual a agenda se refere.                        |
| data do agendamento | Data em que o registro foi agendado, quando fornecida. |
| profissional        | Referência ao profissional proprietário da agenda.     |
| lista de pacientes  | Coleção de pacientes retornados para a agenda.         |

Os formatos de data, o relacionamento exato entre datas e a estrutura HTML que os fornece permanecem pendentes de descoberta na Fase 003B.

## ResultadoLogin

Representa o retorno lógico de uma tentativa de autenticação. É independente de HTTP, HTML, texto de tela e cookie até que existam evidências para mapeá-los.

| Estado            | Significado conceitual                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| sucesso           | A autenticação foi confirmada e a sessão está disponível.              |
| senha inválida    | As credenciais foram rejeitadas por senha inválida.                    |
| usuário bloqueado | O acesso do profissional está bloqueado.                               |
| erro do sistema   | A tentativa falhou por condição conhecida do portal ou infraestrutura. |
| erro desconhecido | A tentativa não pôde ser classificada com segurança.                   |

**Evidência confirmada:** sucesso é validado pela presença conjunta de `JSESSIONID` e do marcador HTML pós-login documentado em `API.md`.

**Pendência de validação:** os sinais HTTP/HTML de senha inválida e usuário bloqueado ainda não foram observados e não devem ser presumidos. Na ausência dos sinais confirmados de sucesso, o MVP retorna `erro desconhecido`.

## ResultadoConsultaAgenda

Representa o retorno lógico de uma consulta ao portal, a ser usado somente após a Fase 003B.

| Elemento conceitual | Descrição                                                                      |
| ------------------- | ------------------------------------------------------------------------------ |
| sucesso             | Indica se a consulta foi concluída de acordo com evidência futura.             |
| HTML retornado      | Conteúdo HTML bruto recebido do portal para processamento posterior.           |
| agendas encontradas | Agendas identificadas conceitualmente; sua extração pertence à fase de parser. |
| mensagens de erro   | Mensagens classificadas sem expor dados sensíveis.                             |

**Pendência de validação:** endpoints, parâmetros, critérios de sucesso e estrutura das agendas ainda não foram confirmados.

## Relação entre as camadas

```text
ECNHClient -> ResultadoLogin / ResultadoConsultaAgenda
                         │
                         ▼
                  AgendaParser -> Agenda -> Paciente
                         │
                         ▼
                  Serviços -> Google Sheets
```

`ECNHClient` entrega resultados de transporte e autenticação; o parser transforma HTML em modelos de domínio; serviços orquestram o fluxo; a integração com Google Sheets usa os modelos sem acessar o portal diretamente.
