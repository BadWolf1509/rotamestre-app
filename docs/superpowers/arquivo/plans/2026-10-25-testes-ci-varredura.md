# Testes, CI e dependências (varredura de 25/10) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fechar os achados de testes/CI/dependências da varredura de 25/10 (TST-2 a TST-9 e DAT-6) sem deixar o e2e mais instável e sem escrever no banco.

**Architecture:** mudanças pequenas e independentes, uma tarefa por achado (ou par de achados que mexem nos mesmos arquivos). Cada tarefa traz uma guarda que falha se o defeito voltar — guarda validada **quebrando** antes de passar.

**Tech Stack:** Jest (jest-expo), Playwright, GitHub Actions, Node 22, npm.

**Spec:** a tarefa recebida da sessão principal (achados TST-2..TST-9 e DAT-6 em arquivo local confidencial — **não copie trechos dele para o repositório**).

## Global Constraints

- Tudo em PT-BR: comentários, commits, PR, narração.
- Nunca escrever no banco (nem por script, nem pelo MCP). Não tocar em `database/`, `supabase/migrations/`, `supabase/functions/` (há uma trilha de banco em paralelo).
- Não tocar em `tools/scripts/create-notificacoes.cjs`, `tools/scripts/fix-triggers.cjs`, `tools/scripts/db/apply-migration-direct.cjs` (TST-1 é da sessão principal).
- Nunca `npm ci`/`npm install` que escreva em `node_modules`: ele é uma junção para o checkout principal, compartilhado com outras sessões. Mudança de dependência: `npm install <pkg>@<versão> --package-lock-only`.
- Nunca `--no-verify`. Nunca `python -` com heredoc. Sem bump de SDK/React Native.
- Jest de um arquivo: `npx jest <caminho> --testPathIgnorePatterns=/node_modules/`. Suíte: `npx jest --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers`. Lint: `npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings=0` e `npx tsc --noEmit`.
- **Antes de cada decisão de desenho, compare pelo menos 2 alternativas e registre o porquê** (no commit ou no relatório da tarefa).
- Guarda nova só conta depois de vista **vermelha** com o defeito reintroduzido.

## Rulings (decisões já tomadas, com a alternativa descartada)

1. **TST-2 — remover, não consertar.** Alternativa: trocar para `chaveSecreta` + exigir `--confirmar`. Descartada: nenhum dos 9 scripts tem chamador (nem `package.json` raiz, nem workflow, nem doc viva; `tools/scripts/package.json` aponta para caminhos que nem existem mais), e consertar manteria vivo código que escreve em produção sem uso. O git guarda o histórico. Guarda nova impede `SUPABASE_SERVICE_ROLE_KEY` de voltar a scripts locais.
2. **TST-3/4 — métodos mortos dos page objects saem; os vivos esperam estado observável.** Alternativa: reescrever todos com esperas boas. Descartada: 15 métodos sem chamador não têm como ser validados (YAGNI). Esperas antes de screenshot (`design-system.e2e.ts`, `visual-critical.e2e.ts`) e o recuo de retry do `global-setup.ts` **ficam**: a baseline visual é Linux e não dá para validar daqui, e recuo entre tentativas é espera legítima, não condição faltante.
3. **TST-5 — restringir no próprio UPDATE + compare-and-set.** Alternativa: projeto de staging do Supabase. Descartada aqui: exige conta/infra (decisão do usuário); fica registrada como pendência. O UPDATE passa a filtrar por `unidade_id` demo e pelo estado lido (`status`), e exige exatamente 1 linha afetada — PR concorrente que já restaurou não é sobrescrito.
4. **TST-6 — imprimir só contadores, falhar em `success != true`.** Alternativa: abrir issue automática na falha. Descartada nesta branch: precisa `issues: write` (alarga o token num repo público) e é decisão do usuário; o e-mail padrão do Actions continua sendo o alerta. Registrado como pendência do usuário.
5. **TST-7 — fixar por SHA em todos os workflows**, não só nos dois com segredo. Alternativa: só `eas-build-android.yml`/`update-snapshots.yml`/`test.yml`. Descartada: a guarda fica mais simples (regra única) e o Dependabot de `github-actions` já atualiza SHA + comentário.
6. **DAT-6 — apagar `useSupabaseQuery`/`useFreshData` e corrigir o CLAUDE.md.** Alternativa: adotar o hook nas telas. Descartada: o hook tem defeitos que o `useCachedData` já perdeu, zero chamadores, e migrar telas invade as trilhas gestor/motorista em paralelo.
7. **TST-9 — só patch/minor com lock atualizado por `--package-lock-only`; validação pelo CI** (que roda `npm ci`). Alternativa: `npx expo install --fix` local. Descartada: escreveria no `node_modules` compartilhado.
8. **TST-8 — teste de lógica sem rede do `locationTracking` e fim das exclusões mortas.** Testes de RLS e das Edge Functions de Places ficam **adiados**: o primeiro exige banco (proibido), o segundo é trilha de banco/Edge.

## Review Focus

1. **e2e mais instável depois da troca de esperas** — espera por elemento que não existe em todas as larguras (mobile/desktop). Cada `goto*` deve esperar um sinal que existe nas duas; validar rodando o arquivo local 2× seguidas.
2. **Servidor do e2e de outro checkout** — `reuseExistingServer: true` na porta 8082 reaproveita um `serve-dist` de outra sessão. Rodar local com `PORT=8092 E2E_BASE_URL=http://localhost:8092` e conferir que o `dist/` servido é deste worktree.
3. **Compare-and-set da fixture devolvendo 0 linhas quando outro PR acabou de restaurar** — tem de reler e seguir (estado já serve), não lançar erro. Teste unitário cobre.
4. **Cron que responde 200 com `success:false`** — o job tem de falhar. Teste da guarda cobre o texto do workflow.
5. **Cobertura caindo abaixo do threshold ao tirar exclusões** — medir `--coverage` antes/depois; se cair, manter a exclusão com comentário do porquê.

---

### Task 1: TST-2 — remover scripts órfãos que dependem da service_role desligada

**Files:**

- Delete: `scripts/create-test-users.js`, `tools/scripts/apply-trigger-fix.js`, `tools/scripts/auth/create-test-users.js`, `tools/scripts/auth/update-user-emails.js`, `tools/scripts/auth/validate-emails.js`, `tools/scripts/db/apply-security-migration.js`, `tools/scripts/db/apply-seed.js`, `tools/scripts/db/check-functions-search-path.cjs`, `tools/scripts/db/check-users-and-rls.js`
- Modify: `tools/scripts/package.json` (remover o bloco `scripts` — os três apontam para arquivos removidos; **manter** `"type": "module"`, que muda a semântica dos `.js` vizinhos)
- Create: `scripts/lib/__tests__/scripts-sem-service-role.test.ts`

- [ ] **Step 1:** Reconferir referências antes de apagar: `git grep -n "<nome>"` para cada arquivo (fora o próprio e `tools/scripts/migration/migrate-structure.sh`, que é script de migração de estrutura de 2025 e só cita caminhos). Se aparecer chamador vivo, pare e reporte.
- [ ] **Step 2: Guarda** `scripts-sem-service-role.test.ts`: lista `git ls-files scripts tools` (via `execSync`) filtrando `.js/.cjs/.mjs/.ts/.sh/.bat`, e espera que nenhum contenha `SUPABASE_SERVICE_ROLE_KEY`. Mensagem de falha nomeia o arquivo e explica que a chave JWT foi desligada em 22/10/2026 (ver `supabase/functions/_shared/chaves.ts`).
- [ ] **Step 3:** Rodar a guarda → FAIL listando os 9 arquivos.
- [ ] **Step 4:** Apagar os 9 e editar `tools/scripts/package.json`.
- [ ] **Step 5:** Guarda → PASS; `npm run scan:nao-declarado` e lint → verdes.
- [ ] **Step 6:** Commit `chore(scripts): remove scripts órfãos que dependiam da service_role desligada`.

### Task 2: TST-3 — asserções que sempre passam

**Files:**

- Modify: `src/lib/__tests__/routeOptimization.test.ts:73-79`, `src/utils/__tests__/notificationSound.test.ts:196-202`, `e2e/gestor-team-management.e2e.ts` (testes "should have add motorista button", "should display motoristas list or empty state", "should show driver statistics if drivers exist")

- [ ] **Step 1 (jest):** trocar `expect(true).toBe(true)` por asserção do efeito: em `precarregarCache`, `await expect(precarregarCache()).resolves.toBeUndefined()` **e** que o storage foi lido (`AsyncStorage.getItem` chamado com a chave do cache, o mock já existe no arquivo); em `cleanupNotificationSounds`, `await expect(cleanupNotificationSounds()).resolves.toBeUndefined()`. Validar quebrando: fazer a função lançar temporariamente e ver o teste falhar.
- [ ] **Step 2 (e2e):** apagar "should have add motorista button" (o teste seguinte já exige o botão visível). Nos outros dois, trocar a cadeia de `bodyText.includes(...)` (que casa com o menu lateral) por `expect(lista.or(vazio)).toBeVisible()` com locators específicos da tela de Motoristas (ache testID ou texto exclusivo em `app/gestor/motoristas.tsx` e componentes; se não houver testID, acrescente um — mudança de `testID` em componente é permitida). O de estatísticas deve exigir o texto real do contador da tela, não `/\d+/`.
- [ ] **Step 3:** rodar os dois jest e lint; o e2e roda na Task 3.
- [ ] **Step 4:** Commit `test: troca asserções que sempre passavam por asserções do efeito`.

### Task 3: TST-4 — esperas cegas e catch que mascara falha no e2e

**Files:**

- Modify: `e2e/pages/gestor.page.ts`, `e2e/pages/motorista.page.ts`, `e2e/pages/login.page.ts`, `e2e/fixtures/test-fixtures.ts`, `e2e/gestor-team-management.e2e.ts`, `e2e/auth.e2e.ts`, `e2e/smoke.e2e.ts`, `e2e/motorista-route-execution.e2e.ts:60`, `e2e/gestor-route-creation.e2e.ts:158`
- Fora de escopo (Ruling 2): `e2e/design-system.e2e.ts`, `e2e/visual-critical.e2e.ts`, `e2e/global-setup.ts`

**Interfaces:**

- Produces: `GestorPage.goto*()` e `MotoristaPage.goto()/navigateTo*()` passam a resolver só com a tela pronta (sinal observável), sem `waitForTimeout`.

- [ ] **Step 1:** Apagar os métodos sem chamador (conferir com `git grep "\.<metodo>("` em `e2e/` fora de `pages/`): em `GestorPage` — `fillParadaForm`, `addParada`, `optimizeRoute`, `selectMotorista`, `generateRoute`, `openAddMotoristaModal`, `fillMotoristaForm`, `submitMotoristaForm`, `filterByStatus`, `searchRoutes`, `exportRoutes`, `getParadasCount`, `waitForLoading` (o `.catch(() => {})`), `expectToastMessage`, `selectTipoEntrega/Retirada` se sem uso; em `MotoristaPage` — `startRoute`, `hasActiveRoute`, `logout` se sem uso. Remover locators que ficarem sem uso.
- [ ] **Step 2:** Cada `goto*` do gestor: depois do `page.goto`, `await expect(<sinal>).toBeVisible({ timeout: 30000 })`, onde o sinal é o título da página de `src/constants/gestorPageMeta.ts` (ex.: "Gestão de Rotas", "Motoristas", "Nova Rota de Entrega") ou testID já existente (`gestor-dashboard-stats`, `gestao-rotas-table`) — confira que existe em desktop e mobile. Motorista: `goto` espera o `tabBar` ou o conteúdo da Início; `navigateTo*` espera o conteúdo da aba (`paradasList.or(paradasEmpty)`, `mapaView.or(mapaEmpty)`, `historicoList.or(historicoEmpty)`); `expectOnMotoristaDashboard` sem espera fixa.
- [ ] **Step 3:** Nos specs listados, trocar cada `waitForTimeout` pela condição que o teste depois verifica (`toBeVisible`, `toHaveURL`, `waitForURL`). Onde um `waitForTimeout` não tiver condição clara, documente no relatório em vez de inventar.
- [ ] **Step 4: Rodar local (não escreve no banco).** `npm run build:web`; carregar `.env` do checkout principal sem copiá-lo (`set -a; . D:/rota-mestre/rotamestre-app/.env; set +a` no Git Bash); `PORT=8092 E2E_BASE_URL=http://localhost:8092 npx playwright test --project=chromium --grep-invert "mapa"` (o teste do mapa chama a fixture que faz UPDATE). Rodar **2×**; registrar tempo e resultado e comparar com a linha de base do Step 0.
- [ ] **Step 0 (antes do Step 1):** rodar a mesma linha de comando do Step 4 no estado atual e anotar a linha de base (passaram/falharam/flaky, tempo).
- [ ] **Step 5:** `npx tsc --noEmit` e lint verdes. Contagem: `git grep -c waitForTimeout -- e2e` só nos arquivos fora de escopo.
- [ ] **Step 6:** Commit `test(e2e): esperas por estado observável no lugar de esperas fixas`.

### Task 4: TST-5 — fixture do mapa: UPDATE restrito e compare-and-set

**Files:**

- Modify: `e2e/fixtures/garantir-rota-do-mapa.ts`
- Create: `e2e/fixtures/decidirRestauracao.ts`, `e2e/fixtures/__tests__/decidirRestauracao.test.ts` (o jest já roda `e2e/fixtures/__tests__`, ver `entregasAbertas.test.ts`)

**Interfaces:**

- Produces: `decidirRestauracao(rota: {status: string; data: string; iniciada_em: string|null; concluida_em: string|null}, pendentes: number, agora: Date): { restaurarRota: boolean; reabrirParadas: boolean }` — a lógica de `rotaServe`/`paradasServem` hoje inline, movida sem mudar comportamento.

- [ ] **Step 1: Testes** de `decidirRestauracao`: rota `em_andamento` de hoje com `iniciada_em` de hoje e 1 pendente → nada; `concluida` → restaurar; `em_andamento` com `data` de 7 dias atrás → restaurar; `iniciada_em` null → restaurar; `concluida_em` preenchido → restaurar; 0 pendentes → reabrir paradas. Datas em dia local (mesma função `diaLocal` do arquivo, que vai junto para o módulo novo).
- [ ] **Step 2:** FAIL (módulo não existe) → implementar movendo a lógica → PASS.
- [ ] **Step 3:** Restringir as escritas em `garantir-rota-do-mapa.ts`:
  - SELECT de `rotas` também `.eq('unidade_id', UNIDADE_DEMO)` (motorista com vínculo em outra loja não pode levar a fixture a uma rota de fora da demo).
  - UPDATE de `rotas`: `.eq('id', rota.id).eq('unidade_id', UNIDADE_DEMO).eq('status', rota.status).select('id')`. Se voltar 0 linhas: reler a rota; se agora serve (`decidirRestauracao` diz não restaurar), seguir; senão lançar erro dizendo que o estado mudou durante a fixture.
  - UPDATE de `paradas`: `.eq('rota_id', rota.id).neq('status', 'pendente').select('id')` (só toca o que precisa reabrir; confira no `src/types` se `paradas` tem `unidade_id` e, se tiver, filtre também).
  - Atualizar o comentário de POSTURA com o porquê do compare-and-set (PRs concorrentes).
- [ ] **Step 4:** `npx tsc --noEmit`, lint, jest de `e2e/fixtures/__tests__`. **Não** rodar o e2e do mapa (escreve no banco) — a validação real é o CI do PR.
- [ ] **Step 5:** Commit `test(e2e): fixture do mapa só escreve na loja demo e não sobrescreve estado alheio`.

### Task 5: TST-6 + TST-7 — cron sem corpo no log e actions fixadas por SHA

**Files:**

- Modify: `.github/workflows/expire-routes.yml`, `test.yml`, `quality.yml`, `eas-build-android.yml`, `update-snapshots.yml`
- Modify: `scripts/lib/__tests__/workflows-seguranca.test.ts`

- [ ] **Step 1: Guardas** em `workflows-seguranca.test.ts`:
  - para os 5 workflows, toda linha `uses:` casa `/uses:\s*[\w.-]+\/[\w./-]+@[0-9a-f]{40}\s+#\s*v\d+\.\d+\.\d+/`;
  - `expire-routes.yml` não contém `echo "Response: $body"` nem `echo "$body"`, e cada um dos 3 jobs testa `success` do corpo (`jq -e '.success == true'`).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3 (TST-7):** resolver o SHA de cada action pela tag de versão completa: `gh api repos/<owner>/<repo>/git/ref/tags/<vX.Y.Z>` (se for tag anotada, seguir `object.url` até o commit). Descubra a versão completa a que a tag major aponta comparando o SHA de `vN` com o das releases (`gh api repos/<o>/<r>/releases --jq '.[].tag_name'`). Formato: `uses: actions/checkout@<sha40> # v7.x.y`. Inclui `codecov/codecov-action`.
- [ ] **Step 4 (TST-6):** nos 3 jobs do cron: `curl -sS -o resposta.json -w '%{http_code}'`; falha se HTTP ≠ 200 **ou** `jq -e '.success == true' resposta.json` falhar; imprime só contadores com `jq -c '{routes_found, reminders_sent}'` (lembretes) e `jq -c '{expired_count, notifications_sent, localizacoes_apagadas}'` (expiração) — campos conferidos em `supabase/functions/{remind,expire}-routes/index.ts` (só leitura). Em erro, imprimir só o HTTP e `jq -r '.error // "sem campo error"'`. Atualizar o comentário do topo dizendo que o corpo não vai ao log porque o repositório é público.
- [ ] **Step 5:** PASS; validar a sintaxe YAML (`node -e "require('js-yaml')..."` se disponível, ou `npx yaml-lint`/`actionlint` se houver; senão, o CI do PR valida). Testar o trecho shell de um job com um `resposta.json` de exemplo local (`success:true` → 0; `success:false` → ≠0).
- [ ] **Step 6:** Commit `ci: actions fixadas por SHA e cron sem corpo de resposta no log público`.

### Task 6: TST-8 — cobertura do locationTracking e exclusões mortas

**Files:**

- Create: `src/services/__tests__/locationTracking.test.ts`
- Modify: `jest.config.js` (`collectCoverageFrom`)

- [ ] **Step 0:** medir a linha de base: `npx jest --coverage --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=.superpowers` e anotar os 4 percentuais globais (rodar em segundo plano; demora).
- [ ] **Step 1: Testes** (mocks de `expo-location`, `expo-task-manager`, AsyncStorage e `@/lib/motorista/filaPosicoes` já usados em outros testes do repo — reaproveite os padrões de `src/lib/__tests__/navigation.test.ts`):
  - `processLocationUpdate` ignora posição com `accuracy > 50`;
  - chegada dentro de 50 m da parada é anunciada **uma vez** por parada (segunda leitura no mesmo lugar não repete);
  - `getNavigationPreferences` sem nada salvo devolve `PREFERENCIAS_PADRAO`; com JSON salvo parcial, mescla sobre o padrão; com JSON inválido, devolve o padrão e chama `logger.warn`;
  - `updateNavigationPreferences` grava a mescla;
  - `restaurarPreferenciasPadrao` volta ao padrão.
    Ajuste os nomes ao comportamento real lido no arquivo; se um caso acima não corresponder ao código, teste o que o código faz e anote.
- [ ] **Step 2:** rodar → verde (testes de caracterização; valide cada um quebrando a linha correspondente temporariamente).
- [ ] **Step 3:** `jest.config.js`: remover `MapaRN.tsx` e `MapaWeb.tsx` (arquivos não existem), `src/services/locationTracking.ts` e `useDashboardData.ts` (tem 2 suítes). Remeasure; se algum threshold global cair abaixo do configurado, devolva a exclusão que derrubou com comentário do porquê. Comentar as exclusões que ficam (`supabase*.ts`: cliente criado no carregamento do módulo com env; `*.web.tsx` de mapa: maplibre só roda em navegador, coberto pelo e2e).
- [ ] **Step 4:** Commit `test: cobre o rastreamento do modo navegação e tira exclusões mortas da cobertura`.

### Task 7: DAT-6 — apagar `useSupabaseQuery`/`useFreshData`, corrigir o CLAUDE.md

**Files:**

- Delete: `src/hooks/useSupabaseQuery.ts`, `src/hooks/__tests__/useSupabaseQuery.test.ts`
- Modify: `src/hooks/useCachedData.ts` (remover `useFreshData`), `src/hooks/__tests__/useCachedData.test.ts` (remover o `describe('useFreshData')`), `CLAUDE.md` linha "Queries"

- [ ] **Step 1:** `git grep -n "useSupabaseQuery\|useFreshData\|useSupabaseQueryNoCache"` → só os próprios arquivos e docs de specs antigos (não editar specs históricos).
- [ ] **Step 2:** apagar/remover; `npx tsc --noEmit`, lint, `npm run scan:morto:arquivos`, jest de `useCachedData.test.ts`.
- [ ] **Step 3:** CLAUDE.md, linha "Queries": dizer que o hook com cache é `useCachedData` (SWR, chave por loja leva `unidadeId`) e que telas que consultam direto devem descartar resposta velha com contador de requisição — cite um exemplo real do código (procure `requestIdRef`/`reqId`/"contador" em `src/hooks`). Uma linha, sem duplicar o PROJECT_CONTEXT.
- [ ] **Step 4:** Commit `refactor(hooks): remove useSupabaseQuery e useFreshData sem chamadores; CLAUDE.md aponta o padrão real`.

### Task 8: TST-9 — patches de dependências

**Files:**

- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1:** `npm outdated` e `npm run audit:prod` → anotar. Candidatos: `@supabase/supabase-js` (minor 2.x), `@typescript-eslint/*` (8.x). `expo` patch só se `npx expo install --check` (não escreve) apontar e se a versão nova for 57.x. `@maplibre/maplibre-react-native` e `@types/react` **não** (nativo sem aparelho; tipos fixados pelo SDK).
- [ ] **Step 2:** para cada um: `npm install <pkg>@<versão exata> --package-lock-only` (sem tocar o `node_modules`). Conferir `git diff package-lock.json` que só o pacote e suas dependências diretas mudaram.
- [ ] **Step 3:** `npm run audit:prod` (lê o lock) → verde. Se algum advisory da allowlist for corrigido pela versão nova, remova o ID da allowlist em `scripts/audit-producao.js` (validar: audit ainda verde).
- [ ] **Step 4:** a suíte local roda contra o `node_modules` antigo — registrar isso; a validação real é o CI (`npm ci`). Commit `chore(deps): patches de supabase-js e typescript-eslint`.

### Task 9: Fechamento

- [ ] Suíte jest completa, lint e tsc verdes.
- [ ] `docs/PROJECT_CONTEXT.md`: só se alguma pendência nova para o usuário surgir (staging para o e2e; alerta ativo do cron) — uma linha cada, no formato das pendências.
- [ ] Revisão final da branch, push, PR (PT-BR, neutro), CI verde.
