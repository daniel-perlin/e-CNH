# Fase 001 — Checklist de engenharia reversa do e-CNH

## Objetivo

Mapear de forma autorizada o protocolo do portal sem implementar login, scraping ou integrações.

## Escopo

Captura de evidências de autenticação, sessão, navegação e futuras consultas de agenda.

## Decisões tomadas

- Não tratar hipóteses como contratos.
- Sanitizar capturas e não registrar dados pessoais ou segredos.

## Evidências coletadas

As evidências confirmadas foram consolidadas posteriormente em `docs/API.md` e `docs/FLUXO_HTTP.md`.

## Pendências

Confirmar campos obrigatórios, logout, ciclo da sessão e endpoints de agenda.

## Próximos passos

Consolidar a arquitetura HTTP e então implementar a autenticação na Fase 003.

## Pré-requisitos

- [ ] Responsável forneceu URL oficial e autorização para observação.
- [ ] Conta de teste/autorizada disponível; nenhuma credencial será salva no repositório.
- [ ] Ambiente e data/hora da captura registrados.
- [ ] DevTools configurado para preservar log de rede e não gravar conteúdo sensível.

## Autenticação

- [ ] Registrar URL e método da página inicial.
- [ ] Registrar `action`, método, `enctype` e nomes dos campos do formulário.
- [ ] Identificar todos os campos ocultos e a origem de tokens anti-CSRF.
- [ ] Registrar endpoint, `Content-Type` e nomes — nunca valores — dos parâmetros enviados.
- [ ] Registrar códigos de sucesso, erro, redirecionamentos e página final.
- [ ] Observar comportamento para credenciais inválidas sem expor CPF/senha.
- [ ] Identificar endpoint e método de logout, se existente.

## Sessão e cookies

- [ ] Listar nomes de cookies, domínio, `Path`, `Secure`, `HttpOnly`, `SameSite` e expiração.
- [ ] Identificar quais cookies surgem antes e depois do login.
- [ ] Verificar rotação de sessão após autenticação.
- [ ] Verificar como o portal sinaliza sessão expirada.
- [ ] Verificar se requisições XHR exigem cabeçalhos, token CSRF ou `Referer` específico.

## Navegação e agendas

- [ ] Mapear a página pós-login e o caminho até a agenda.
- [ ] Identificar requisição de descoberta de datas futuras.
- [ ] Identificar requisição de agenda por data e seus parâmetros.
- [ ] Distinguir navegação HTML, formulário e XHR/fetch.
- [ ] Registrar paginação, filtros, fuso horário e representação de datas.
- [ ] Capturar exemplos sanitizados de agenda vazia, preenchida e erro.

## Qualidade e segurança

- [ ] Sanitizar HARs, screenshots e exemplos antes de compartilhá-los.
- [ ] Confirmar que logs não contêm dados pessoais, segredos ou cookies.
- [ ] Anotar limites de taxa, timeout, mensagens de erro e indisponibilidades.
- [ ] Atualizar `docs/API.md` com fatos confirmados e data da observação.
- [ ] Registrar decisões novas em `docs/DECISOES.md`.
- [ ] Revisar o material com o responsável antes de iniciar a implementação de login.

## Resultado da fase

Checklist de investigação criado e evidências do DevTools encaminhadas para consolidação arquitetural.
