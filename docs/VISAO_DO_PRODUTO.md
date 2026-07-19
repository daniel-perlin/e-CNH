# Visão do produto

Este documento descreve o **e-CNH** do ponto de vista funcional: problema, usuários, fluxo operacional, escopo e evolução. Para detalhes técnicos de integração, consulte [ARQUITETURA.md](ARQUITETURA.md), [API.md](API.md) e [ROADMAP.md](ROADMAP.md).

## Objetivo do projeto

Automatizar a consolidação das **agendas futuras** de profissionais credenciados no portal **e-CNH SP** em uma **planilha Google Sheets**, mantendo a aba `Agenda` atualizada sem consulta manual repetida ao portal.

O sistema substitui o trabalho operacional de abrir o portal, autenticar-se, navegar até a agenda e copiar ou conferir dados manualmente.

## Problema que resolve

Hoje, obter a visão consolidada das agendas exige que alguém:

1. acesse o portal e-CNH para cada profissional ou período relevante;
2. navegue por páginas HTML até encontrar a agenda desejada;
3. extraia ou confira pacientes, horários e datas;
4. atualize uma planilha ou outro registro central manualmente.

Esse fluxo é **lento**, **suscetível a erro humano** e tende a gerar **dados desatualizados** quando o volume de profissionais ou a frequência de consulta aumenta.

O e-CNH centraliza essa rotina em um processo automatizado, previsível e auditável.

## Usuários do sistema

| Usuário                              | Papel                                                     | Relação com o produto                                                                              |
| ------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Operador administrativo**          | Responsável pela planilha e pela rotina de acompanhamento | Consome a aba `Agenda` atualizada; não precisa acessar o portal para cada consulta                 |
| **Responsável técnico / mantenedor** | Configura credenciais, planilha e execução                | Instala, configura variáveis de ambiente, acompanha logs e valida sincronizações                   |
| **Profissional credenciado**         | Médico ou psicólogo com acesso individual ao portal       | Fonte dos dados; fornece credenciais autorizadas para a integração                                 |
| **Agente de IA ou desenvolvedor**    | Evolui o sistema por fases                                | Usa documentação funcional e técnica para implementar incrementos sem perder o contexto do produto |

O produto **não** é uma interface web para usuários finais. É um **sincronizador backend** que alimenta a planilha.

## Fluxo operacional completo

Fluxo-alvo quando todas as fases previstas estiverem concluídas:

```text
1. Disparo da sincronização (manual ou agendada)
        ↓
2. Autenticação no portal e-CNH (por profissional configurado)
        ↓
3. Navegação autenticada até a agenda
        ↓
4. Consulta das datas futuras disponíveis
        ↓
5. Download do HTML de cada agenda relevante
        ↓
6. Interpretação do HTML em registros estruturados
        ↓
7. Atualização da aba Agenda na planilha Google Sheets
        ↓
8. Registro do resultado da execução (sucesso, falhas parciais, erros)
```

### Estado atual do fluxo

| Etapa                                    | Situação                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Autenticação HTTP e sessão               | **Concluída** (Fase 003A — Autenticação HTTP), incluindo logout HTTP                               |
| Navegação autenticada e download de HTML | **Concluída** (Fase 003B — Navegação autenticada); HTML bruto de resultado obtido                  |
| Extração de dados da agenda              | **Concluída** (Fase 004 — Extração de dados da agenda)                                              |
| Integração Google Sheets                 | **Concluída** (Fase 005 — Integração Google Sheets)                                                 |
| Orquestração multi-profissionais         | **Concluída** (Fase 006 — Orquestração multi-profissionais)                                         |
| Agendamento automático (cron)            | **Pendente** (Fase 007 — Agendamento automático)                                                   |

## MVP

### MVP incremental já entregue (Fase 003A — Autenticação HTTP)

Autenticação HTTP real no portal, com:

- envio do login confirmado por evidências do DevTools;
- preservação de sessão via cookies;
- verificação de sucesso por sinais observados (`JSESSIONID` + marcador HTML);
- teste manual (`npm run test:login`) e exemplo de uso.

Este MVP **não consulta agenda** nem altera planilha. Valida apenas que o sistema consegue autenticar-se de forma confiável.

### MVP do produto (primeira entrega de valor)

A **primeira versão útil para o operador administrativo** ocorrerá quando o sistema conseguir, ao menos para um profissional configurado:

1. autenticar-se no portal;
2. obter HTML de agendas futuras;
3. extrair pacientes e horários;
4. escrever ou atualizar a aba `Agenda` na planilha;
5. executar o fluxo de forma repetível (manual ou agendada).

Esse MVP corresponde, no roadmap técnico, à conclusão das **Fases 003B a 005** para um profissional, seguida da **Fase 006** (orquestração multi-profissionais) e, por fim, da **Fase 007** (agendamento automático).

## Arquitetura funcional (alto nível)

Visão orientada a **capacidades**, não a bibliotecas ou pastas de código:

```text
┌─────────────────────────────────────────────────────────────┐
│     Agendamento automático — Fase 007 (job/cron)            │
│         Dispara sincronização e controla sobreposição       │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│   Orquestração multi-profissionais — Fase 006 (serviços)    │
│    Coordena profissionais, consultas, parsing e escrita     │
└─────┬───────────────────┬───────────────────────┬───────────┘
      │                   │                       │
      ▼                   ▼                       ▼
┌─────────────┐   ┌───────────────┐   ┌─────────────────────┐
│ Portal e-CNH│   │ Interpretação │   │ Planilha Google     │
│ (acesso e   │   │ de HTML em    │   │ Sheets (aba Agenda) │
│  sessão)    │   │ registros     │   │                     │
└─────────────┘   └───────────────┘   └─────────────────────┘
```

**Princípios funcionais:**

- Uma única fronteira acessa o portal e-CNH; demais partes recebem HTML ou dados já obtidos.
- Dados sensíveis (CPF, senha, cookies, dados de pacientes) não são expostos em logs ou documentação.
- Cada incremento entrega uma capacidade isolada antes de compor o fluxo completo.

Para o desenho técnico das camadas, consulte [ARQUITETURA.md](ARQUITETURA.md).

## Evoluções pós-MVP (Nice to Have)

> **Limite do MVP:** o MVP do projeto termina na Fase 007. As Fases 008 e 009 **não** fazem parte do MVP, **não** são pré-requisitos para o sistema funcional e permanecem **estacionadas (`Backlog` / parked)** até a conclusão da Fase 007 e nova priorização.

| Fase | Nome | Status | Visão |
| ---- | ---- | ------ | ----- |
| 008 | Painel Operacional | `Backlog` | Abas `Controle` e `Execuções` na planilha; metadados de sync; Apps Script opcional para “Sincronizar Agora”. Detalhes: [.fases/008-painel-operacional.md](../.fases/008-painel-operacional.md) |
| 009 | Observabilidade e Métricas | `Backlog` | Métricas, estatísticas, indicadores, dashboards/tendências e alertas — sem PII. Detalhes: [.fases/009-observabilidade-metricas.md](../.fases/009-observabilidade-metricas.md) |

Enquanto estiverem em `Backlog`, essas fases **não** alteram arquitetura, domínio, APIs ou ADRs.

## Backlog de funcionalidades futuras

Itens alinhados ao [ROADMAP.md](ROADMAP.md), em ordem sugerida. As Fases 003B a 006 já estão `Concluída` e saíram deste backlog de entrega imediata.

> O MVP cobre até a Fase 007. Itens 008 e 009 são Nice to Have (ver seção [Evoluções pós-MVP](#evoluções-pós-mvp-nice-to-have)).

| Prioridade | Fase | Funcionalidade                   | Descrição                                                                         |
| ---------- | ---- | -------------------------------- | --------------------------------------------------------------------------------- |
| 1          | 007  | Agendamento automático (cron)    | Rodar sincronização automaticamente com proteção contra sobreposição              |
| —          | 008  | Painel operacional (Nice to Have) | Abas Controle/Execuções e metadados de sync; Apps Script opcional — **Backlog / parked** |
| —          | 009  | Observabilidade e métricas (Nice to Have) | Métricas, dashboards, alertas — **Backlog / parked** |
| —          | —    | Classificação de falhas de login | Distinguir senha inválida, usuário bloqueado e erro de sistema com evidência      |
| —          | —    | Retentativas e resiliência       | Tratar indisponibilidade, timeout e sessão expirada de forma controlada           |

Itens **não priorizados** neste backlog permanecem como hipótese até haver necessidade operacional comprovada. As Fases 008 e 009 estão explicitamente **estacionadas** e fora do MVP.

## Escopo do projeto

O e-CNH **está dentro do escopo** quando a atividade:

- sincroniza **agendas futuras** do portal e-CNH SP para Google Sheets;
- usa **HTTP direto** e parsing de HTML SSR como estratégia principal;
- respeita credenciais autorizadas e política de privacidade dos dados pessoais;
- evolui por **fases pequenas**, cada uma documentada e testável;
- mantém a planilha como **destino operacional** da equipe administrativa.

## Itens explicitamente fora do escopo

Os itens abaixo **não fazem parte** deste produto, salvo decisão explícita futura registrada em `docs/DECISOES.md`:

| Fora do escopo                                                | Motivo                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Interface web ou aplicativo mobile para usuários finais       | O produto é um sincronizador backend, não um front-end                   |
| Substituição ou espelhamento completo do portal e-CNH         | Apenas extração de agendas para planilha                                 |
| Automação por navegador (Playwright) em produção              | Estratégia principal é HTTP direto; browser fica restrito a investigação |
| Agendas passadas ou histórico completo                        | Foco em **agendas futuras**                                              |
| Outros estados ou portais CNH fora do e-CNH SP observado      | Escopo limitado ao portal documentado                                    |
| CRM, prontuário eletrônico ou sistemas clínicos               | Destino é Google Sheets, não outro sistema de saúde                      |
| Notificações a pacientes (SMS, e-mail, WhatsApp)              | Fora da cadeia de valor da consolidação de agenda                        |
| Edição ou cancelamento de agendamentos no portal              | Somente leitura e sincronização                                          |
| Armazenamento persistente de senhas ou cookies no repositório | Proibido por segurança e governança do projeto                           |
| Inferência de endpoints, campos ou contratos sem evidência    | Engenharia reversa autorizada precede implementação                      |

---

**Leitura complementar técnica:** [ARQUITETURA.md](ARQUITETURA.md) · [MODELO_DOMINIO.md](MODELO_DOMINIO.md) · [API.md](API.md) · [ROADMAP.md](ROADMAP.md) · [DECISOES.md](DECISOES.md)
