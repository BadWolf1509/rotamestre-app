# Varredura de refatorações — trilha testes e infra: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar da árvore o apoio de teste, os scripts e os `npm run` mortos (alguns escrevem num banco que é produção), transformar em guarda de CI a regra de paridade entre as duas pastas de migration, deduplicar os helpers das guardas de migration e trocar esperas reais por fake timers, sem tocar código de produção (exceto um `export`).

**Architecture:** Só testes, configuração e docs. Toda remoção vem acompanhada de uma guarda que falha se a classe voltar: `npm run` apontando para arquivo inexistente, arquivo que não é migration na pasta canônica, migration nova sem cópia em `supabase/migrations`. Os helpers das guardas vão para um módulo em `database/__tests__/_helpers/`, migrado arquivo a arquivo com a mesma contagem de testes. A Parte 2 (cadeia falsa do Supabase, item 1.13) fica separada e só roda depois que as outras trilhas forem mescladas.

**Tech Stack:** Jest 29 (`jest-expo`), `@testing-library/react-native` 13, TypeScript, GitHub Actions (YAML), knip.

**Spec:** `docs/superpowers/2026-11-03-varredura-refatoracoes.md` (branch `docs/varredura-refatoracoes-03-11`), itens 0.5, 0.6, 0.7, 0.8, 1.12, 1.14 e bug B14; na Parte 2, o item 1.13. Relatório de origem: R5 (testes, CI e banco), resumido nesse consolidado.

## Global Constraints

- TDD quando houver código: guarda nova é vista **falhando** (com o defeito plantado ou o estado atual) antes de ficar verde.
- Branch própria `refactor/varredura-testes-infra`, num worktree em `.claude/worktrees/` (skill `superpowers:using-git-worktrees`), a partir de `main` em `c64859af` ou mais nova.
- Nunca `--no-verify`.
- Nunca escrever em banco nem em rede, nunca disparar workflow (`gh workflow run` proibido). Nenhum script removido é executado para "conferir".
- Jest dentro do worktree: `npx jest <caminhos> --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`, com os **caminhos antes das opções** (depois delas viram padrão de exclusão; armadilha do `PROJECT_CONTEXT`). Saída com `Tests: 0` significa que o padrão engoliu o worktree, não que passou.
- Verificação final: suíte inteira do Jest, `npm run type-check`, `npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings=0 --ignore-pattern ".claude/**"`, `npm run scan:morto:arquivos` e `npm run scan:nao-declarado`.
- Sem push.
- Commits em PT-BR no estilo do repositório (`tipo(escopo): descrição`), terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- O pre-commit pode deixar ruído CRLF: conferir com `git diff --ignore-cr-at-eol` e descartar o que for só fim de linha.
- Parte 1 não toca `src/**` nem `app/**` fora de `__tests__`. Única exceção registrada: `export` de `DEBOUNCE_RECARGA_MS` em `src/components/gestor/mapa-rota/hooks/useMapaRotaData.ts:16` (Tarefa 7).
- Repositório público: nenhuma mensagem de commit, comentário ou doc descreve como os scripts removidos se conectavam ao banco.
- Decisões que não se reabrem: `supabase/migrations` é **subconjunto** de `database/migrations` por desenho (a guarda usa allowlist, não igualdade); knip não é step bloqueante; banco único = produção (não se copiam as 8 migrations para `supabase/`).

## Review Focus

1. **Checkout com CRLF (Windows):** comparação de conteúdo entre as pastas tem de normalizar `\r\n`; uma cópia byte-idêntica salva com CRLF não pode acusar drift. Teste: `ler normaliza CRLF` (Tarefa 4).
2. **Guarda rodada de dentro de worktree ou de outro cwd:** toda guarda nova resolve caminhos a partir de `__dirname`, nunca de `process.cwd()`. Teste: as guardas da Tarefa 3 e 6 passam rodando o Jest a partir do worktree (passo de verificação de cada uma).
3. **`npm run` com cadeia `&&` e argumentos:** a guarda de scripts tem de achar cada `node <arquivo>` de uma linha como `build:web` (cinco comandos encadeados), não só o primeiro. Teste: `acha todos os node <arquivo> de uma cadeia com &&` (Tarefa 3).
4. **Arquivo da allowlist que ganha cópia, ou migration nova só em `database/`:** a falha precisa nomear o arquivo e dizer o que fazer. Teste: casos vermelhos da Tarefa 6 com a mensagem conferida.
5. **Fake timers vazando para o teste seguinte do mesmo arquivo:** quem liga `jest.useFakeTimers()` desliga no `afterEach`. Teste: a suíte inteira de cada arquivo da Tarefa 7 passa em ordem e com `--randomize`.

## Ajustes em relação ao spec

- **0.5, qual mock prevalece:** o código já responde. O `jest.mock` de `jest.setup.js:666` é içado ao topo e roda primeiro; `setupSupabaseMocks()` (`jest.setup.js:67`) registra outro depois, e o último registro é o que vale. `app/__tests__/integration/auth/reset-password.test.tsx:63-64` acrescenta `setSession` "se faltar", o que só faz sentido porque a factory em vigor (a de `jest.mocks/supabase.js`) não o tem. A sonda continua no plano (Tarefa 1), mas a expectativa é que a cópia de `jest.setup.js:603-670` esteja morta.
- **0.5:** `__mocks__/@supabase/supabase-js.ts` está **vivo**: é mock automático de módulo de `node_modules`, carregado sem import. Não sai. `__tests__/README.md` (nov/2025) descreve Maestro e uma estrutura que não existe; sai na Tarefa 8.
- **0.6:** são **5** `npm run` órfãos, não 4 (falta `mcp:git:test`). `database/migrations/` tem **10** `.js` (9 `execute-*` + `verify-checkpoint-logic.js`), não 7. Os `.bat` da raiz (`start-android.bat`, `setup-android-env.bat`), `scripts/dev-edge.bat` e `tools/scripts/assets/update-favicons.bat` **não** escrevem no banco e podem ser usados à mão no Windows do gestor: ficam fora e viram pergunta (ver Riscos). Os `tools/scripts/setup/*.bat` saem: configuram servidores MCP de pastas que não existem. `tools/scripts/package.json` fica (o `"type": "module"` define o formato dos `.js` vizinhos); só saem dele as dependências que só os scripts apagados usavam. `database/MIGRATIONS.md:1492,1530` cita um script apagado como história: fica.
- **0.7:** o comentário de `src/components/AddressAutocomplete.tsx` sobre a ordem dos provedores é código de produção: fica para a trilha que tocar o componente. O 216 foi medido de novo agora (`Unused exports (216)`), mas as trilhas que apagam defaults e código morto mudam o número: medir na hora da Tarefa 8.
- **0.8:** corte em `20260101000000`. Antes dele, `supabase/` simplesmente não tem as migrations antigas (subconjunto). Depois dele, exatamente as 8 do spec faltam; nenhum arquivo de `supabase/` diverge de `database/` (conferido com CRLF normalizado). O `99999999999999_seed_test_data.sql` sai na Tarefa 3, antes da guarda.
- **1.12:** são 38 guardas `migration*.test.ts`, mais `sql-estrutura.test.ts` (35ª cópia de `semComentarios`). `ler` idêntico em 36; `migration42` lê sem normalizar CRLF. O extrator de rollback idêntico aparece em ~24; as 6 variantes (`sql.search(/^-- ROLLBACK:/m)` sem tirar o prefixo, `normaliza(...)`) ficam locais. As asserções de "documentada em MIGRATIONS.md" diferem por migration: não se abstraem, só o caminho do doc.
- **1.14:** o projeto usa Jest **29**, não 30. Em `useMapaRotaData.realtime.test.ts` são **4** esperas (`:161`, `:214`, `:339`, `:364`), não 3. Os `setTimeout(…, 100)` de `useMainCardData.test.ts:254,272` e `ChangeDriverModal.test.tsx:554` **não** são contra debounce (esperam "nada aconteceu"): saem do item.
- **`workflows-seguranca`:** a correção do B14 não muda nada que a guarda lê hoje; ela ganha uma asserção (Tarefa 2) e precisa continuar verde.

## Alternativas comparadas

| Ponto                      | Escolhida                                                                 | Descartada e por quê                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Mock do Supabase duplicado | Ficar com `jest.mocks/supabase.js` (é o que vale hoje)                    | Ficar com a cópia de `jest.setup.js`: mudaria o mock em vigor (ganha `setSession`) para toda a suíte                                      |
| B14                        | Tirar `jest-results.json` do artefato                                     | Gerar com `--json --outputFile`: cria um relatório que ninguém lê; o `junit.xml` já vai dentro de `coverage/`                             |
| Scripts órfãos             | Apagar (o git guarda; mesma decisão da varredura de 25/10)                | Mover para `database/legado/`: continuam executáveis contra produção e visíveis ao `migration-drift-auditor`                              |
| Paridade                   | Allowlist das 8 que só encolhe, a partir de um corte                      | Exigir igualdade: desfaz o subconjunto por desenho. Manter só as 32 asserções por arquivo: migration sem guarda própria escapa, como as 8 |
| Helpers das guardas        | Módulo `_helpers/migration.ts`, migrado por arquivo                       | `describe.each` único: reescreve ~7.000 linhas com decisões datadas e arrisca afrouxar guarda                                             |
| Debounce                   | Fake timers + a constante importada, com asserção antes e depois do prazo | Espera real derivada da constante (`DEBOUNCE + 100`): continua em tempo real e frágil sob carga                                           |

---

## Parte 1

### Tarefa 1: Mock do Supabase em uma fonte só e apoio de teste sem importador (0.5)

**Files:**

- Modify: `jest.setup.js:603-670` (remover `createMockQueryBuilder`, `mockSupabaseClient` e o `jest.mock('@/lib/supabase', …)`)
- Delete: `jest.mocks/factories.ts`, `__mocks__/test-data.ts`
- Modify: `docs/TESTING.md:99` (linha `test-data.ts` da árvore) e o texto "Supabase Mock" de `:332` (passa a dizer `jest.mocks/supabase.js`)

**Interfaces:**

- Produces: `jest.mocks/supabase.js` (`setupSupabaseMocks`) passa a ser a única definição do mock global de `@/lib/supabase`.

- [ ] **Step 1: Medir a linha de base da suíte**

Run: `npx jest --listTests --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers | wc -l` e a suíte inteira com as mesmas opções.
Expected: anotar `N` arquivos e `Tests: X passed`; tudo verde.

- [ ] **Step 2: Sonda (não commitar) — a cópia do `jest.setup.js` nunca é chamada**

Trocar temporariamente a factory de `jest.setup.js:666` por `() => { throw new Error('SONDA_SETUP') }`.
Run: `npx jest src/hooks/main-card-data app/__tests__/integration/auth/reset-password.test.tsx --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: PASS (a factory nunca roda).

- [ ] **Step 3: Contrassonda (não commitar) — a sonda enxerga**

Desfazer o Step 2 e pôr o mesmo `throw` (`'SONDA_MOCKS'`) na factory de `jest.mocks/supabase.js:64`.
Run: o mesmo comando.
Expected: FAIL com `SONDA_MOCKS`. Desfazer com `git checkout -- jest.setup.js jest.mocks/supabase.js`. Se o Step 2 tiver falhado ou este passado, parar: a premissa está errada e o item volta ao spec.

- [ ] **Step 4: Remover a cópia morta e os arquivos sem importador**

Apagar `jest.setup.js:603-670` (deixar uma linha de comentário: "Mock de `@/lib/supabase`: `jest.mocks/supabase.js`, chamado acima"), apagar `jest.mocks/factories.ts` e `__mocks__/test-data.ts`, ajustar `docs/TESTING.md`. Antes de apagar, `git grep -n -E "factories|test-data"` não pode achar import.

- [ ] **Step 5: Suíte inteira**

Run: suíte inteira (comando do Step 1).
Expected: os mesmos `N` arquivos e `X` testes do Step 1, todos verdes.

- [ ] **Step 6: Commit**

```bash
git add jest.setup.js jest.mocks/factories.ts __mocks__/test-data.ts docs/TESTING.md
git commit -m "test(setup): mock do Supabase numa fonte só; apaga apoio de teste sem importador"
```

### Tarefa 2: Artefato do CI sem arquivo que nada gera (B14)

**Files:**

- Modify: `.github/workflows/test.yml:117-121` (tirar a linha `jest-results.json`; `path:` fica só `coverage`)
- Test: `scripts/lib/__tests__/workflows-seguranca.test.ts` (no `describe('test.yml: artefatos de falha só com captura de tela')`)

- [ ] **Step 1: Escrever o teste que falha**

```ts
it('o artefato test-results não lista jest-results.json sem comando que o gere', () => {
  const lista = /^\s+jest-results\.json\s*$/m.test(executado);
  const gera = /--outputFile[= ]jest-results\.json/.test(executado);
  expect(lista && !gera).toBe(false);
});
```

- [ ] **Step 2: Ver falhar**

Run: `npx jest scripts/lib/__tests__/workflows-seguranca.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL só no teste novo (`expected false, received true`).

- [ ] **Step 3: Tirar `jest-results.json` do `path:` do upload `test-results`**

- [ ] **Step 4: Ver passar**

Run: o mesmo comando.
Expected: PASS em todos os testes do arquivo (inclusive o de SHA de 40 hex e o de `test-results` inteiro).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/test.yml scripts/lib/__tests__/workflows-seguranca.test.ts
git commit -m "fix(ci): artefato test-results sem o jest-results.json que nada gerava"
```

### Tarefa 3: Scripts e `npm run` órfãos, com guardas da classe (0.6)

**Files:**

- Create: `scripts/lib/__tests__/npm-scripts-apontam-para-arquivo.test.ts`
- Create: `database/__tests__/pastas-de-migration.test.ts` (primeiro `describe`; a Tarefa 6 acrescenta o segundo)
- Modify: `package.json:50-54` (remover `mcp:git`, `mcp:git:test`, `mcp:db`, `migration:run`, `migration:verify`)
- Modify: `knip.jsonc:59` (remover a entrada `"start"` de `ignoreBinaries` e seu comentário)
- Modify: `database/__tests__/sql-estrutura.test.ts:89` (o filtro do `99999999999999` perde o motivo)
- Modify: `.claude/agents/migration-drift-auditor.md:61-62` (sem os auxiliares em maiúsculas nem o seed na pasta)
- Modify: `tools/scripts/package.json` (remover `pg`, `@supabase/supabase-js`, `dotenv` se o `git grep` do Step 5 não achar outro usuário; manter `"type": "module"` e `sharp`)
- Delete: `tools/scripts/db/` (5 arquivos), `tools/scripts/migration/` (2), `tools/scripts/setup/` (2), `tools/prepare-google-play.js`; `database/apply-migration-direct.js`, `database/run-migration-007.js`, `database/add-incidentes-table.sql`, `database/check_triggers.sql`, `database/schema.sql`; em `database/migrations/`: os 10 `.js`, `CONSOLIDATED_v1.4.0_route_expiration.sql`, `IDENTIFY_DUPLICATE_FUNCTIONS.sql`, `REMOVE_DUPLICATE_FUNCTIONS.sql`, `VERIFY_FUNCTIONS_SEARCH_PATH.sql`, `99999999999999_seed_test_data.sql`

**Interfaces:**

- Produces: `database/__tests__/pastas-de-migration.test.ts` com `const NOME_DE_MIGRATION = /^\d{3,14}_[a-z0-9_]+\.sql$/` exportável para a Tarefa 6 (constante local do arquivo; a Tarefa 6 escreve no mesmo arquivo).

- [ ] **Step 1: Escrever as duas guardas**

`npm-scripts-apontam-para-arquivo.test.ts` lê `package.json` a partir de `__dirname`, quebra cada script em `&&`, `||` e `;`, e para cada `node <caminho>` exige `existsSync(join(RAIZ, caminho))`. Testes:

- `acha todos os node <arquivo> de uma cadeia com &&`: em `build:web` acha os 4 arquivos de `tools/scripts/`.
- `todo node <arquivo> de um npm run existe`: `expect(faltando).toEqual([])`, onde `faltando` lista `"<script>: <caminho>"`.

`pastas-de-migration.test.ts`, `describe('database/migrations só guarda migration')`:

- `todo arquivo tem nome de migration`: `readdirSync` da pasta filtrado pelos que **não** casam `NOME_DE_MIGRATION`, `toEqual([])`.
- `não guarda seed de dados de teste`: nenhum nome começa com `99999999999999`.

- [ ] **Step 2: Ver falhar**

Run: `npx jest scripts/lib/__tests__/npm-scripts-apontam-para-arquivo.test.ts database/__tests__/pastas-de-migration.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL listando `mcp:git`, `mcp:git:test`, `mcp:db`; e os 14 arquivos e o seed da pasta canônica. O teste da cadeia `&&` passa.

- [ ] **Step 3: Conferir cada arquivo antes de apagar**

Run: para cada nome da lista de Files, `git grep -n -F "<nome>" -- . ':!package-lock.json'`.
Expected: só autorreferência, `package.json:50-54`, `knip.jsonc:59`, `sql-estrutura.test.ts:89`, `migration-drift-auditor.md`, `MIGRATIONS.md:1492,1530` (história) e planos antigos em `docs/superpowers/`. Qualquer outro chamador: o arquivo fica e vai para o relatório.

- [ ] **Step 4: Apagar os arquivos, as 5 entradas do `package.json`, o `start` do `knip.jsonc`, o filtro de `sql-estrutura.test.ts:89` e ajustar `migration-drift-auditor.md:61-62`**

- [ ] **Step 5: Dependências do `tools/scripts/package.json`**

Run: `git grep -n -E "from 'pg'|require\('pg'\)|supabase-js|dotenv" -- tools scripts database`
Expected: nada. Então remover essas 3 dependências (manter `sharp` e `"type"`).

- [ ] **Step 6: Ver passar**

Run: o comando do Step 2, depois `npx jest scripts database --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`, `npm run scan:nao-declarado` e `npm run scan:morto:arquivos`.
Expected: PASS; `scripts-sem-service-role` segue verde (varre 66 arquivos, piso 20); os dois `scan` sem achado novo (o `start` não é mais binário usado).

- [ ] **Step 7: Commit**

```bash
git add -A package.json knip.jsonc tools database scripts/lib/__tests__/npm-scripts-apontam-para-arquivo.test.ts .claude/agents/migration-drift-auditor.md
git commit -m "chore(scripts): apaga scripts e npm run órfãos que escreviam no banco; guardas da classe"
```

### Tarefa 4: Módulo de helpers das guardas de migration (1.12, parte A)

**Files:**

- Create: `database/__tests__/_helpers/migration.ts`
- Test: `database/__tests__/migration-helpers.test.ts`

**Interfaces:**

- Produces (todas exportadas de `database/__tests__/_helpers/migration.ts`):
  - `RAIZ: string`, `PASTA_DB: string`, `PASTA_SUPA: string`, `PASTA_SONDAS: string`, `CAMINHO_DOC: string` (`database/MIGRATIONS.md`)
  - `ler(caminho: string): string` — `''` se não existe; `\r\n` vira `\n`
  - `semComentarios(sql: string): string` — por linha, `l.replace(/--.*$/, '')` (a regra atual, sem tratar `/* */`)
  - `rollbackDe(sql: string): string` — do primeiro `-- ROLLBACK:` ao fim, cada linha sem `/^-- ?/`; `''` sem o marcador
  - `interface Migration { arquivo: string; caminhoDb: string; caminhoSupa: string; sql: string; executavel: string; rollback: string }`
  - `carregarMigration(arquivo: string): Migration`
  - `lerSonda(arquivo: string): string`
  - `itExisteNasDuasPastas(m: Migration): void` — registra `it('existe nas duas pastas, com conteúdo idêntico')` com as 3 asserções de hoje (`existsSync(caminhoDb)`, `existsSync(caminhoSupa)`, `ler(caminhoSupa) === sql`)

- [ ] **Step 1: Escrever o teste dos helpers**

Em `migration-helpers.test.ts`, com textos em memória e um arquivo temporário em `os.tmpdir()`:

- `ler normaliza CRLF`: arquivo com `'a\r\nb'` → `'a\nb'`.
- `ler de arquivo ausente devolve vazio`.
- `semComentarios corta do -- ao fim da linha`: `"SELECT 1; -- x\nSELECT 2;"` → `"SELECT 1; \nSELECT 2;"`.
- `rollbackDe tira o prefixo`: `"BEGIN;\n-- ROLLBACK:\n-- DROP x;"` → `"ROLLBACK:\nDROP x;"`; sem marcador → `''`.
- `carregarMigration de uma migration real`: `carregarMigration('20261026125000_rota_encerrada_nao_volta.sql').sql` contém `rota_encerrada_nao_volta` e `executavel` não contém `--`.

- [ ] **Step 2: Ver falhar**

Run: `npx jest database/__tests__/migration-helpers.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL com `Cannot find module './_helpers/migration'`.

- [ ] **Step 3: Implementar `database/__tests__/_helpers/migration.ts`** (o nome não casa `testMatch`, então não vira suíte)

- [ ] **Step 4: Ver passar**

Run: o mesmo comando e `npx jest --listTests database --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers | grep -c _helpers`.
Expected: PASS; `0` (o helper não é listado como suíte).

- [ ] **Step 5: Commit**

```bash
git add database/__tests__/_helpers/migration.ts database/__tests__/migration-helpers.test.ts
git commit -m "test(migrations): helpers comuns das guardas de migration"
```

### Tarefa 5: Guardas de migration passam a importar os helpers (1.12, parte B)

**Files:**

- Modify: `database/__tests__/migration38…80-*.test.ts` (38 arquivos) e `database/__tests__/sql-estrutura.test.ts` (só `semComentarios`)
- Modify: `.claude/skills/new-migration/SKILL.md` (uma linha no checklist: a guarda estática nova importa de `database/__tests__/_helpers/migration.ts`)

**Interfaces:**

- Consumes: tudo o que a Tarefa 4 exporta, com os mesmos nomes.

- [ ] **Step 1: Linha de base**

Run: `npx jest database --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers 2>&1 | grep -E "^Tests:|^Test Suites:"`
Expected: anotar as duas contagens.

- [ ] **Step 2: Migrar 38–55 sem mudar asserção**

Em cada arquivo: trocar as definições locais de `raiz`, caminhos, `ler`, `semComentarios`, `executavel`, `rollback` e o `it('existe nas duas pastas…')` pelo import (`carregarMigration`, `itExisteNasDuasPastas`, `lerSonda`, `CAMINHO_DOC`). Extratores específicos (`corpoFuncao`, `normaliza`, rollback por `search`) ficam locais, recebendo `m.sql`/`m.executavel`. Arquivo sem um dos itens (ex.: `migration56`, sem `ler`/`semComentarios`) só importa o que usa.

- [ ] **Step 3: Conferir a contagem**

Run: o comando do Step 1.
Expected: as mesmas contagens, tudo verde.

- [ ] **Step 4: Commit**

```bash
git add database/__tests__
git commit -m "test(migrations): guardas 38 a 55 usam os helpers comuns"
```

- [ ] **Step 5: Repetir Steps 2–4 para 56–69 e depois para 70–80 + `sql-estrutura.test.ts` + a linha do `SKILL.md`**, um commit por lote (`… guardas 56 a 69 …`, `… guardas 70 a 80 e sql-estrutura …`).

- [ ] **Step 6: Nenhuma cópia sobrou**

Run: `git grep -n -E "const ler = |const semComentarios = " -- database/__tests__`
Expected: só `_helpers/migration.ts`. Qualquer outro resultado tem um comentário de uma linha dizendo por que ficou local.

- [ ] **Step 7: Prova de que as guardas ainda mordem**

Sem commitar: apagar `SET search_path = ''` de `database/migrations/20261026125000_rota_encerrada_nao_volta.sql`.
Run: `npx jest database/__tests__/migration75-rota-encerrada-nao-volta.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL em "existe nas duas pastas" e em "INVOKER, search_path vazio". Desfazer com `git checkout -- database/migrations`.

### Tarefa 6: Guarda de paridade entre as duas pastas de migration (0.8)

**Files:**

- Modify: `database/__tests__/pastas-de-migration.test.ts` (segundo `describe`)
- Modify: `database/MIGRATIONS.md:16-17` (item 3 do processo: "cobrado por `database/__tests__/pastas-de-migration.test.ts`") e `CLAUDE.md` (linha `supabase/migrations/` do Layout: a paridade tem guarda)

**Interfaces:**

- Consumes: `ler`, `PASTA_DB`, `PASTA_SUPA` (Tarefa 4); `NOME_DE_MIGRATION` (Tarefa 3, mesmo arquivo).

- [ ] **Step 1: Escrever a guarda**

`describe('supabase/migrations é subconjunto fiel de database/migrations')`, com:

```ts
const CORTE = '20260101000000';
// Aplicadas antes de a regra ser cobrada (MCP/Dashboard) e registradas como
// aplicadas no MIGRATIONS.md. A lista só encolhe: não acrescente nome aqui.
const SO_EM_DATABASE = [
  '20260208000000_fix_rls_multi_unidade.sql',
  '20260713190000_fix_inserir_parada_chegada_conflict.sql',
  '20260827190000_expiracao_rota_fuso_e_guarda_horario.sql',
  '20260831230000_expirar_rotas_em_andamento.sql',
  '20260831234500_lembrete_rota_em_andamento.sql',
  '20260906120000_rls_endurecimento_papel_e_view_admin.sql',
  '20260908000000_realtime_motorista_locations.sql',
  '20261004120000_dedup_logs_por_parada.sql',
];
```

Testes:

- `todo arquivo de supabase/migrations existe em database/migrations com o mesmo conteúdo` (inclui os de 8 dígitos, como `20251220_enable_realtime.sql`): lista de divergentes/ausentes `toEqual([])`.
- `migration a partir do corte tem cópia em supabase/migrations`: arquivos `^\d{14}_` de `database/` com prefixo `>= CORTE`, fora da allowlist e sem cópia → `toEqual([])`; o comentário acima do `expect` diz "copie byte a byte para supabase/migrations".
- `a allowlist só tem quem ainda não tem cópia, e não cresce`: `SO_EM_DATABASE.length <= 8`; todo nome existe em `database/` e **não** existe em `supabase/` (se ganhou cópia, sai da lista).
- `não está cega`: comparou `>= 60` arquivos de `supabase/`.

- [ ] **Step 2: Ver falhar, três vezes (não commitar nenhuma)**

Run, para cada defeito plantado: `npx jest database/__tests__/pastas-de-migration.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`

- apagar `supabase/migrations/20261026125000_rota_encerrada_nao_volta.sql` → FAIL no 2º teste, nomeando o arquivo;
- acrescentar um espaço ao fim dessa cópia → FAIL no 1º;
- copiar `database/migrations/20261004120000_dedup_logs_por_parada.sql` para `supabase/` → FAIL no 3º.
  Desfazer cada um com `git checkout -- supabase/migrations` e `git clean -n supabase/migrations` (conferir, depois `-f` só no arquivo plantado).

- [ ] **Step 3: Ver passar e atualizar `MIGRATIONS.md` e `CLAUDE.md`**

Run: o mesmo comando sem defeito.
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add database/__tests__/pastas-de-migration.test.ts database/MIGRATIONS.md CLAUDE.md
git commit -m "test(migrations): guarda de paridade entre as pastas, com allowlist das 8 retroativas"
```

### Tarefa 7: Debounce testado com fake timers (1.14)

**Files:**

- Modify: `src/components/gestor/mapa-rota/hooks/useMapaRotaData.ts:16` (`export const DEBOUNCE_RECARGA_MS = 300;` — única mudança de produção da Parte 1, só o `export`)
- Test: `src/components/gestor/mapa-rota/hooks/__tests__/useMapaRotaData.realtime.test.ts` (`:161`, `:214`, `:322-368`)
- Test: `src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts` (`:339`, `:365`)

**Interfaces:**

- Consumes: `DEBOUNCE_REVALIDACAO_TIMELINE_MS` (já exportado, `src/hooks/gestao-rotas/useTimelineData.ts:47`) e `DEBOUNCE_RECARGA_MS`.

- [ ] **Step 1: Reescrever as esperas**

Nos testes afetados: `jest.useFakeTimers()` antes do `renderHook` (o `waitFor` do RNTL 13 avança relógio falso sozinho; modelo: `src/hooks/nova-entrega/__tests__/useDistanceCalculation.test.ts`) e `afterEach(() => jest.useRealTimers())` no `describe`. Cada `setTimeout(r, 600|800)`/`esperar(500)` vira `await act(async () => { jest.advanceTimersByTime(<CONSTANTE> + 1); })`. Nos testes que afirmam "recarregou", acrescentar antes um `advanceTimersByTime(<CONSTANTE> - 1)` com `expect` de que **ainda não** recarregou. O `esperar(0)` de `:343,368` vira `await act(async () => {})`.

- [ ] **Step 2: Prova de que o teste depende do prazo (não commitar)**

Trocar o `setTimeout(…, DEBOUNCE_RECARGA_MS)` de `useMapaRotaData.ts:247` por `setTimeout(…, 0)`; depois, em `useTimelineData.ts:215`, por `DEBOUNCE_REVALIDACAO_TIMELINE_MS * 2`.
Run: `npx jest src/components/gestor/mapa-rota/hooks/__tests__/useMapaRotaData.realtime.test.ts src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`
Expected: FAIL nos testes de "antes do prazo" (primeiro defeito) e de "depois do prazo" (segundo). Desfazer à mão as duas linhas (`:247` e `:215`) — **não** `git checkout` da pasta, que levaria junto o `export` e os testes — e conferir que `git diff --ignore-cr-at-eol -- src` mostra só o `export` e os dois arquivos de teste.

- [ ] **Step 3: Ver passar, em ordem e embaralhado**

Run: o comando do Step 2 sem defeito, depois com `--randomize`.
Expected: PASS nas duas execuções; o tempo dos dois arquivos cai (antes ~4 s de espera real).

- [ ] **Step 4: Commit**

```bash
git add src/components/gestor/mapa-rota/hooks/useMapaRotaData.ts src/components/gestor/mapa-rota/hooks/__tests__/useMapaRotaData.realtime.test.ts src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts
git commit -m "test(debounce): fake timers e a constante do código no lugar de esperas reais"
```

### Tarefa 8: Docs desatualizadas e verificação final (0.7)

**Files:**

- Modify: `CLAUDE.md:120` (número e data do `scan:morto`)
- Modify: `.claude/refs/design-system.md:58` ("Google Places via Edge Function, com Photon e ViaCEP de fallback") e `:72` (a vitrine é rota publicada, não "dev-only")
- Delete: `__tests__/README.md` (a fonte é `docs/TESTING.md`)

- [ ] **Step 1: Medir o knip agora**

Run: `npx knip --no-progress 2>&1 | grep -E "^(Unused exports|Unused exported types|Duplicate exports) \("`
Expected: as três contagens (em 03/11 eram 216, 210 e 25; outras trilhas mescladas mudam isso). Rodar `npm run scan:morto:autoteste` antes de ler um número baixo.

- [ ] **Step 2: Atualizar o `CLAUDE.md:120`**: "sai com **<N> `Unused exports`** e exit 1 (medido em <data>; eram 285 em 21/09)", mantendo o resto do parágrafo. Ajustar `design-system.md` e apagar `__tests__/README.md` (`git grep -n "__tests__/README"` sem resultado).

- [ ] **Step 3: Verificação final**

Run, no worktree:

- `npx jest --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers` → todas verdes; arquivos = base da Tarefa 1 − 0 + 3 novos (`npm-scripts-…`, `pastas-de-migration`, `migration-helpers`)
- `npm run type-check` → exit 0
- `npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings=0 --ignore-pattern ".claude/**"` → exit 0
- `npm run scan:morto:arquivos` → lista vazia
- `npm run scan:nao-declarado` → sem achado
- `git diff --ignore-cr-at-eol main --stat` → só os arquivos deste plano

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md .claude/refs/design-system.md __tests__/README.md
git commit -m "docs: número atual do knip, design system e README de testes obsoleto"
```

## Riscos

- **`.bat` de uso manual:** os quatro `.bat` deixados fora (Ajustes, 0.6) precisam de decisão do gestor; não apagar sem ela.
- **CI só no PR:** a Tarefa 2 muda `test.yml` e a guarda só lê texto; o efeito real do upload só aparece no próximo PR (não se dispara workflow aqui).
- **Mock global:** a Tarefa 1 afeta a suíte inteira; a contagem igual de testes do Step 5 é a prova, não só "verde".
- **Outras trilhas em paralelo:** a contagem do knip e `CLAUDE.md` mudam com elas; a Tarefa 8 vai por último e mede na hora. Conflito provável só em `CLAUDE.md`.
- **Fake timers e promessas:** se algum teste da Tarefa 7 travar com relógio falso (promessa que espera timer interno do mock), manter o relógio real naquele `it` e registrar o motivo em comentário, em vez de afrouxar a asserção.

---

## Parte 2 — executar só depois que as trilhas lib, gestor, motorista e mapas forem mescladas

Motivo: os ~24 arquivos com cadeia falsa (`setupSupabaseChain`, `const chain`, `cadeia`, `mockQueryBuilder`; 18 com construtor nomeado, 24 com `then: (resolve` à mão) são testes de hooks e telas que essas trilhas reescrevem. Antes de começar: `git pull --ff-only` na `main`, nova branch `refactor/varredura-cadeia-supabase` e novo levantamento com `git grep -l -E "setupSupabaseChain|const (chain|cadeia|mockQueryBuilder)\b|then: *\(resolve" -- '*.test.ts' '*.test.tsx'`. Mesmas Global Constraints.

**Decisão (spec 1.13, alternativa A):** helper fino, troca mecânica, sem mudar o que cada teste afirma. A migração para `consultaFalsa`/`postgrestFalso` (filtro real) fica para quando cada hook for tocado (alternativa B, Onda 3).

### Tarefa 9: `criarCadeia` e migração dos construtores locais (1.13)

**Files:**

- Create: `src/__tests__/helpers/cadeiaSupabase.ts`
- Test: `src/__tests__/helpers/__tests__/cadeiaSupabase.test.ts`
- Modify: os arquivos do levantamento, começando por `src/hooks/main-card-data/__tests__/useLastRoute.test.ts:27-38` e `useExpiredRoute.test.ts:26-37`

**Interfaces:**

- Produces: `criarCadeia<T>(resultado: { data: T; error: unknown; count?: number }): CadeiaFalsa`, onde `CadeiaFalsa` tem `select, insert, update, delete, upsert, eq, neq, gt, gte, lt, lte, in, is, not, or, order, limit, range` como `jest.fn` que devolvem a própria cadeia, `single` e `maybeSingle` como `jest.fn` que resolvem `resultado`, e `then` que resolve `resultado` (cadeia aguardável sem terminal).

- [ ] **Step 1: Teste do helper**: `await criarCadeia(r).select('*').eq('a', 1)` resolve `r`; `await criarCadeia(r).maybeSingle()` resolve `r`; `cadeia.eq` registra `('a', 1)`.
- [ ] **Step 2: Ver falhar** (`Cannot find module`) com `npx jest src/__tests__/helpers --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`.
- [ ] **Step 3: Implementar `criarCadeia`.**
- [ ] **Step 4: Ver passar.**
- [ ] **Step 5: Migrar em lotes de ~6 arquivos**, trocando o construtor local pelo import e mantendo cada `expect`. Construtor com comportamento próprio (resultado por tabela, erro na 2ª chamada) fica local, com comentário de uma linha.
- [ ] **Step 6: Por lote, conferir** `npx jest <arquivos do lote> --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers` com a mesma contagem de `Tests:` de antes do lote; commit `test(supabase): <lote> usa criarCadeia`.
- [ ] **Step 7: Verificação final** das Global Constraints.
