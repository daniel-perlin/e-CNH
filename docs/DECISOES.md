# Decisões arquiteturais

## ADR-001 — TypeScript estrito e Node.js 20+

- **Status:** aceito
- **Decisão:** usar TypeScript com `strict: true` e Node.js 20 ou superior.
- **Consequência:** contratos de integração são verificados mais cedo e contribuições devem manter tipos completos.

## ADR-002 — Integração HTTP ao invés de automação por navegador

- **Status:** aceito
- **Contexto:** o DevTools confirmou um `POST` de formulário, resposta HTML SSR e sessão baseada em cookie; nenhuma API REST foi observada.
- **Decisão:** a integração principal usará Axios, tough-cookie e http-cookie-agent para manter sessão e agentes HTTP persistentes. Cheerio será usado futuramente para interpretar HTML.
- **Motivos:** menor consumo de memória, maior velocidade, menos dependência da interface gráfica, execução simples em cron, maior facilidade para testes automatizados, arquitetura mais limpa e menos pontos de falha.
- **Consequência:** Playwright não participa do caminho produtivo normal. Continua disponível para engenharia reversa, depuração e investigação de casos que comprovadamente dependam de JavaScript de navegador.
- **Evolução em 18/07/2026:** `axios-cookiejar-support` foi substituído pelo uso direto de `HttpCookieAgent` e `HttpsCookieAgent` para permitir reutilização explícita dos agentes com keep-alive, sem alterar o protocolo.

## ADR-003 — Arquitetura por responsabilidades técnicas

- **Status:** aceito
- **Decisão:** separar clients, parsers, repositories, services e jobs.
- **Consequência:** mudanças em portal, HTML, Sheets ou cron permanecem localizadas.

## ADR-004 — Logs estruturados e validação de fronteiras

- **Status:** aceito
- **Decisão:** usar Pino para logs estruturados e Zod para validar configurações e dados de fronteira quando forem introduzidos.
- **Consequência:** CPF, senha, cookies, tokens e dados de pacientes são proibidos em logs e documentação.

## ADR-005 — Evidência antes de implementação

- **Status:** aceito
- **Decisão:** somente dados confirmados no DevTools são documentados como fatos. Campos, cookies e endpoints restantes continuam pendentes.
- **Consequência:** a Fase 003A — Autenticação HTTP implementará apenas o protocolo confirmado, sem payloads ou contratos fictícios.

## ADR-006 — ECNHClient como fronteira única do portal

- **Status:** aceito
- **Contexto:** autenticação, cookies e navegação autenticada compartilham a mesma sessão e o mesmo transporte HTTP.
- **Decisão:** centralizar em `ECNHClient` autenticação, manutenção da sessão, transporte HTTP e navegação autenticada. Serviços, parser e integração com Google Sheets não fazem chamadas HTTP diretas ao portal; consomem contratos e HTML fornecidos pelo fluxo do cliente.
- **Consequência:** cookies, endpoints e detalhes de Axios permanecem encapsulados. As Fases 003A e 003B podem evoluir independentemente, sem duplicar gerenciamento de sessão.

## ADR-007 — Resultado de login explicitamente modelado

- **Status:** aceito
- **Contexto:** falhas de autenticação possuem causas operacionais distintas e não devem ser confundidas com indisponibilidade do sistema.
- **Decisão:** a futura autenticação representará explicitamente, no mínimo, sucesso, senha inválida, usuário bloqueado, erro do sistema e erro desconhecido.
- **Consequência:** não há mapeamento de resposta implementado até que o DevTools confirme os sinais HTTP/HTML correspondentes. A modelagem evita contratos implícitos e simplifica tratamento de erros e testes futuros.
