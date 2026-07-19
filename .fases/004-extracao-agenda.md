# Fase 004 — Extração de dados da agenda

**Status:** `Concluída`

## Objetivo

Transformar o HTML bruto da agenda (obtido pelo `ECNHClient` na Fase 003B) em modelos de domínio tipados, por meio de um parser Cheerio isolado da camada HTTP.

## Escopo

- estudar a estrutura do HTML de resultado da consulta;
- descobrir o domínio (atributos de negócio versus detalhes de apresentação);
- criar modelos TypeScript alinhados à evidência;
- implementar parser com seletores robustos (ids, names, atributos semânticos);
- testes unitários com fixtures sanitizadas;
- scripts de validação com evidências reais sanitizadas;
- documentação somente após evidências.

## Fora de escopo

- Google Sheets;
- sincronização;
- múltiplos profissionais;
- agendamento/cron;
- regras de negócio futuras;
- qualquer chamada HTTP nova;
- reabertura de login, logout ou navegação (salvo bug bloqueante).

## Sequência de trabalho

1. Descoberta do HTML  
2. Descoberta do domínio  
3. Modelagem TypeScript  
4. Parser  
5. Testes unitários  
6. Validação com evidência real  
7. Documentação e conclusão  

## Princípios de seleção no HTML

Priorizar, nesta ordem:

- ids;
- names;
- atributos semânticos;
- estrutura funcional (ex.: `legend` + tabela associada).

Evitar, salvo ausência de alternativa confirmada:

- posição de colunas (`nth-child`);
- ordem visual da página;
- classes CSS sem significado funcional.

## Descobertas

### HTML de resultado

**Evidência confirmada** (`004-descoberta-html-2026-07-19T11-35-11-209Z.json`):

| Elemento | Observação |
| -------- | ---------- |
| Tabela de agenda | `table#agenda` (id estável) |
| Fieldset | legend `Resultado` (sem id/name) |
| Form | `DivisaoEquitativaForm`, hidden `method=agendaMedico` |
| Cabeçalhos (`th`) | Hora, CPF, Nome, Telefone, E-mail, Tipo de Processo, Categoria, Status do Exame Médico, Status do Exame Psicológico |
| Classes da tabela | `table`, `table-striped`, `table-bordered`, `table-responsive` — apresentação |
| Class dos `th` | `list_titulo` — apresentação |
| Atributo das `td` | `style` — apresentação |
| Outras tabelas | layout e `table#tableBotoes` — fora do domínio |

Consultas em 3 datas distintas retornaram 8, 7 e 6 linhas de dados, todas com 9 células por linha.

### Domínio versus apresentação

**Evidência confirmada** (`004-descoberta-dominio-2026-07-19.json`):

- **Domínio:** as nove colunas da `table#agenda` mapeiam para `Paciente` + `ItemAgenda`.
- **Apresentação:** classes Bootstrap, `list_titulo`, `style`, tabelas de layout e botões.
- **Contexto:** `dataConsulta` não permanece no HTML pós-consulta de forma confiável; o chamador informa ao parser.

### Seletores adotados

1. Primário: `table#agenda`
2. Fallback: fieldset com legend `Resultado` + tabela cujos `th` incluem Hora, CPF e Nome
3. Colunas: ligação pelo texto do `th`, nunca por índice fixo

## Evidências

- Descoberta HTML: `docs/evidencias/004-descoberta-html-2026-07-19T11-35-11-209Z.json`
- Descoberta domínio: `docs/evidencias/004-descoberta-dominio-2026-07-19.json`
- Validação parser: `docs/evidencias/004-validacao-parser-2026-07-19T11-37-57-950Z.json`

### Validação em 19/07/2026

**Evidências confirmadas:**

- `npm run test:agenda-parser` — 6 testes unitários aprovados;
- `npm run validate:agenda-parser` — 8 itens extraídos do HTML real, com presença dos campos de domínio e sem PII na evidência;
- `typecheck` e `lint` passaram.

**Resultado:** a Fase 004 avança para `Validada` e, com a documentação atualizada, para `Concluída`.

## Critérios de sucesso

- [x] Estrutura do HTML de resultado inventariada com evidência sanitizada.
- [x] Domínio confirmado: atributos de negócio separados de detalhes de UI.
- [x] Modelos TypeScript criados sem inventar campos.
- [x] Parser Cheerio isolado do `ECNHClient`, com seletores robustos.
- [x] Testes unitários aprovados com fixtures sanitizadas.
- [x] Validação reproduzível com evidência sanitizada aprovada.
- [x] Documentação obrigatória atualizada e fase `Concluída`.

## Dificuldades e limitações

- Após o POST de consulta, `select[name=data]` / `#agendamentos` e `dataReferencia` não preservam o valor consultado; a data entra via contexto do parser.
- Heurística de “forma” de telefone pode classificar alguns valores como `cpf-shaped` na descoberta; isso não altera o domínio (continua sendo a coluna Telefone).

## Pendências

- Nenhuma pendência bloqueante no escopo da Fase 004.

## Próximos passos

Iniciar a Fase 005 — Integração Google Sheets, consumindo os modelos tipados sem reabrir o parser HTTP.

## Resultado da fase

HTML bruto da agenda foi estudado, o domínio foi separado da apresentação, modelos e parser Cheerio foram implementados com seletores robustos, testados com fixtures e validados contra o portal com evidência sanitizada. A Fase 004 está `Concluída`.
