# Arquivo — autenticação HTTP (Fase 003A)

Documentação **histórica** produzida durante a engenharia reversa e a investigação forense da autenticação no portal e-CNH.

## O que este archive é

Registro das hipóteses, auditorias e divergências que levaram ao protocolo de login consolidado. Útil para entender *como* a autenticação foi descoberta e depurada.

## O que este archive não é

Não é a documentação principal do projeto. Não descreve necessariamente o estado operacional atual (ex.: B011 / escolha de unidade, B012 / perfis).

Para o estado atual, use:

- [docs/API.md](../../API.md) — contrato do protocolo
- [docs/FLUXO_HTTP.md](../../FLUXO_HTTP.md) — fluxo HTTP
- [docs/EVIDENCIA_HAR_AUTENTICACAO.md](../../EVIDENCIA_HAR_AUTENTICACAO.md) — contrato HAR (documentação viva)
- [docs/VALIDACAO_REPRODUZIVEL_003A.md](../../VALIDACAO_REPRODUZIVEL_003A.md) — validação reproduzível
- [docs/ARQUITETURA.md](../../ARQUITETURA.md) — arquitetura vigente

## Documentos neste archive

| Documento | Papel histórico |
|-----------|-----------------|
| [DIAGNOSTICO_AUTENTICACAO_HTTP.md](DIAGNOSTICO_AUTENTICACAO_HTTP.md) | Hipóteses e plano de validação da 003A |
| [MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md](MATRIZ_DIVERGENCIAS_AUTENTICACAO_HTTP.md) | Comparação navegador × `ECNHClient` |
| [AUDITORIA_POST_AUTENTICAR.md](AUDITORIA_POST_AUTENTICAR.md) | Auditoria do POST `method=autenticar` |
| [AUDITORIA_HTTP_TLS_AUTENTICACAO.md](AUDITORIA_HTTP_TLS_AUTENTICACAO.md) | HTTP/2 × HTTP/1.1, TLS e reset |
| [ROBUSTEZ_AUTENTICACAO_HTTP.md](ROBUSTEZ_AUTENTICACAO_HTTP.md) | Keep-alive, agentes, CookieJar |
| [CHECKPOINT_EVIDENCIA_AUTENTICACAO.md](CHECKPOINT_EVIDENCIA_AUTENTICACAO.md) | Sucesso reportado × artefatos preservados |

Movidos de `docs/` na Sprint 1.0 (S1-01) em 19/07/2026.
