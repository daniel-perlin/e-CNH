# Fixtures HTML do portal (Sprint 1.0 / S1-03)

HTML **sintético e sanitizado** para testes unitários das funções puras de autenticação/perfil/unidade.

Não contém CPF, senha, cookies, tokens nem dados pessoais reais.

## Arquivos

| Fixture | Uso |
| ------- | --- |
| `login-form.html` | Tela de login (`LoginActionForm`), sem marcador autenticado |
| `pos-autenticar-open-dialog-new-session.html` | Pós-`autenticar` com `openDialogNewSession` (ramo B010) |
| `pos-autenticar-open-dialog-choice.html` | Pós-`autenticar` com `openDialogChoice` (ramo B011) |
| `open-choice-unidades.html` | Tela `openChoice` com `select#idUnidTransito` |
| `autenticado-psicologo.html` | Área autenticada — marcador Psicólogo + `DivisaoEquitativaForm` |
| `autenticado-medico.html` | Área autenticada — marcador Médico + `DivisaoEquitativaForm` |

Agenda autenticada com tabela de resultado: reutilize `fixtures/agenda/` (já coberta pelo parser).

## Escopo

- Funções puras: `sessao-existente-portal`, `escolha-unidade-portal`, `perfil-profissional-portal`.
- Protocolo B010/B011: `ecnh-auth-protocol.test.ts` com `AuthTransport` fake.
- D3 (fixtures de protocolo amplas): sprint futura.
