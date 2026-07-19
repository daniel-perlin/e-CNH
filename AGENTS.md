# Constituição do projeto e-CNH

Este documento é obrigatório para qualquer pessoa ou agente que altere este repositório. Em caso de conflito entre conveniência de implementação e estas regras, preserve estas regras e registre a decisão necessária.

## Idioma

- Todo conteúdo produzido no projeto deve estar em português brasileiro: documentação, comentários, README, mensagens de log, CHANGELOG e arquivos em `.fases/`.
- São exceções nomes de bibliotecas, classes, APIs externas e termos técnicos consolidados, como Axios, CookieJar e TypeScript.
- Não misture idiomas em uma mesma explicação quando houver equivalente claro em português.

## Organização das fases

- Cada fase concluída deve possuir um documento próprio em `.fases/`, nomeado com número e propósito, por exemplo: `000-foundation.md`, `001-engenharia-reversa.md`, `002-consolidacao-arquitetura.md` e `003-login-http.md`.
- O documento de uma fase deve registrar, no mínimo: objetivo, escopo, decisões tomadas, evidências coletadas, pendências, próximos passos e resultado da fase.
- Implemente somente o escopo da fase solicitada. Não antecipe funcionalidades de fases futuras.
- Antes de criar abstrações, confirme uma necessidade atual ou um ponto de extensão concreto.

## Status das fases

- Cada fase da 003A à 007 deve possuir exatamente um destes estados: `Planejada`, `Implementada`, `Validada` ou `Concluída`.
- A progressão obrigatória é `Planejada` → `Implementada` → `Validada` → `Concluída`; não pule estados.
- `Planejada`: objetivo, escopo e critérios estão documentados, mas a implementação não foi finalizada.
- `Implementada`: o escopo foi desenvolvido, porém a validação exigida pela fase ainda está pendente.
- `Validada`: os critérios da fase foram executados com evidências registradas no ambiente adequado.
- `Concluída`: a fase foi validada, não possui pendências bloqueantes dentro do escopo e toda a documentação obrigatória foi atualizada.
- `docs/ROADMAP.md` é a fonte de verdade do status de todas as fases.
- Altere um status somente com evidência registrada; atualize conjuntamente `docs/ROADMAP.md`, o documento da fase e `CHANGELOG.md`.

## Atualização obrigatória ao concluir uma fase

Atualize obrigatoriamente:

- `CHANGELOG.md`;
- a documentação impactada;
- `README.md`, quando a mudança afetar a visão de projeto, uso ou arquitetura;
- `docs/DECISOES.md`, quando houver decisão arquitetural;
- `docs/ROADMAP.md`, quando a sequência ou escopo das fases mudar;
- o documento correspondente em `.fases/`.

## CHANGELOG

- Toda conclusão de tarefa deve atualizar `CHANGELOG.md`, mesmo quando não encerrar uma fase.
- Trate o arquivo como diário contínuo de evolução, não como changelog tradicional de releases.
- Mantenha no topo os campos `Fase atual`, `Próxima fase`, `Última atualização` e `Última sessão executada`.
- Registre `Última atualização` no formato `YYYY-MM-DD HH:mm BRT`.
- Atualize `Fase atual` quando houver avanço ou mudança no roadmap.
- Atualize `Próxima fase` quando a sequência do roadmap mudar ou a fase atual for concluída.
- Crie cada sessão diretamente no corpo do diário, em ordem cronológica inversa, com o título `## 📅 DD/MM/YYYY • HH:mm`.
- Organize cada sessão nas subseções `🎯 Objetivo`, `✅ O que mudou`, `🧠 Decisões` e `📂 Arquivos impactados`.
- Nunca sobrescreva sessões anteriores, apague histórico ou consolide retroativamente entradas distintas.
- Não use a seção `[Unreleased]`.
- Registre a conclusão de cada fase em uma sessão própria e mantenha o documento correspondente em `.fases/`.

## Evidências e decisões

- Nunca registre hipótese como fato.
- Identifique explicitamente cada informação como **evidência confirmada**, **hipótese** ou **pendência de validação**.
- Registre decisões arquiteturais relevantes em `docs/DECISOES.md`, incluindo contexto, decisão e consequência.
- Não invente endpoints, payloads, cookies, campos, seletores ou contratos externos.

## Ordem de trabalho

Evite implementar código antes de a arquitetura estar documentada. Priorize, nesta ordem:

1. documentação;
2. arquitetura;
3. implementação;
4. testes;
5. otimizações.

## Arquitetura

- Mantenha responsabilidade única, baixo acoplamento e alta coesão.
- Evite duplicação e favoreça composição sobre herança.
- Separe domínio de infraestrutura: serviços não devem depender diretamente de Axios, Google APIs, HTML ou cron.
- `client/` acessa HTTP e SDKs; `parsers/` transforma documentos externos; `repositories/` abstrai fontes e destinos; `services/` contém casos de uso; `jobs/` apenas orquestra execução.
- Mantenha separados acesso HTTP, parsing de HTML, integrações externas, regras de negócio, modelos e configuração.
- Não crie dependências circulares.

## Código e segurança

- Priorize simplicidade, tipagem forte, documentação, testes e facilidade de manutenção.
- Escreva funções pequenas, tipadas e legíveis, com nomes autoexplicativos; não use `any`.
- Prefira clareza à complexidade. Evite comentários que apenas repetem o código; documente contratos públicos e decisões não óbvias.
- Valide dados nas fronteiras: ambiente, HTTP, HTML e planilhas.
- Não inclua credenciais, dados pessoais, cookies, sessões ou tokens em código, logs, testes, fixtures, documentação ou commits.
- Use logs estruturados e tratamento consistente de erros, preservando contexto e causa sem expor segredos.

## Qualidade

- Projete código testável com dependências injetáveis e efeitos externos isolados.
- Documente APIs públicas e execute typecheck, lint e build quando aplicável.
- Não introduza quick fixes: corrija a causa ou registre a limitação para decisão posterior.
