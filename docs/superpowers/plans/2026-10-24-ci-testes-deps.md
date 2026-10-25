# CI, testes e dependências

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:**

- o CI não fica verde sem testar;
- os e2e afirmam o que dizem testar;
- as dependências ficam atualizadas antes de a allowlist do audit vencer (01/11/2026);
- a CSP e o build da Vercel batem com o que o código usa e com o que o CI testa.

**Origem (spec):** a varredura de 24/10/2026, relatório `testes-ci.md` (TC1–TC9). Os requisitos abaixo são a autoridade.

**Tech Stack:** GitHub Actions, Jest, Playwright, Vercel (`vercel.json`), npm.

## Global Constraints

- Tudo em PT-BR. Não rodar Playwright localmente contra o banco: os e2e escrevem em produção. A validação dos e2e é pelo CI do PR (`gh workflow run test.yml --ref <branch>` quando precisar dos secrets).
- Nunca `--no-verify`, nunca `[skip ci]`.
- Atualização de dependência: só patch e minor compatíveis. Rodar `npm ci` limpo + jest + tsc + eslint + `npm run audit:prod`. Bump nativo (expo, expo-location, expo-notifications) exige validar no aparelho com dev client antes do release; deixe isso registrado no relatório e no PR.
- **`node_modules` isolado:** os outros worktrees compartilham o `node_modules` do checkout principal por junction. Neste worktree, o controlador troca a junction por um `node_modules` próprio antes da Task 1. Nunca rode `npm ci`/`npm install` em outro worktree nem no checkout principal.
- Allowlist do audit **por ID de advisory**, com motivo e data de revisão (`scripts/audit-producao.js`).

## Review Focus

1. PR do Dependabot sem secrets: o check de e2e não pode aparecer como "passou". Tem de ficar visível que foi pulado.
2. e2e cujo elemento não aparece: o teste falha, em vez de passar sem fazer nada.
3. Deploy da Vercel instala as mesmas versões do lockfile que o CI testou.
4. Mapa web em produção continua carregando tiles depois da limpeza da CSP (OpenFreeMap liberado, Carto e tile.openstreetmap fora).
5. Suíte jest local com worktrees em `.claude/worktrees` não conta os testes deles.

---

### Task 1: dependências e allowlist do audit (TC9)

A revisão da allowlist (8 advisories) vence em 01/11/2026. Há patches disponíveis: supabase-js 2.118.0, expo 57.0.31, expo-location, expo-notifications.

- Atualizar para os patches compatíveis (`npx expo install --check` para os pacotes expo) e regenerar o lockfile.
- Reavaliar cada advisory da allowlist. Remover o que o patch resolveu. Para o que fica, nova data de revisão e motivo atualizado.
- `npm run audit:prod` verde. A suíte completa passa.
- PR com a lista do que precisa de validação no aparelho.

### Task 2: CI que não mascara falha (TC1, TC4, TC8)

- **TC1:** `jest.config.js` sem `modulePathIgnorePatterns`/`testPathIgnorePatterns` para `.claude/worktrees`. Acrescentar, para a suíte local não contar os worktrees. O CI não muda.
- **TC4:** `.github/workflows/test.yml:294-300` e o passo do mapa (~257) saem com `exit 0` sem os secrets de e2e. O pulo tem de ficar visível: anotação `::warning::` + resumo do job. Compare `exit 0` com aviso contra marcar o job como `skipped` por `if:` e decida. O PR de humano com secrets ausentes deve falhar.
- **TC8:**
  - `timeout-minutes` em todos os jobs de `test.yml` e `quality.yml`;
  - tirar o `--update-snapshots || true` (`test.yml:312`) ou justificá-lo;
  - `update-snapshots.yml:59-62`: o `git push || echo "Nothing to push"` não pode esconder push falho; distinguir "nada a commitar" de falha.
- Validação: lint do workflow (`actionlint`, se disponível via npx) e o CI do PR.

### Task 3: e2e que afirmam (TC2, TC3)

26 pontos `if (await x.isVisible()) {...}` sem else passam sem testar nada:

- `e2e/motorista-drawer-menu.e2e.ts` (62, 83, 106, 126, 147, 153, 219, 230, 253, 291, 297, 356…);
- `dashboard-reports.e2e.ts:100,230`;
- `gestor-route-creation.e2e.ts:62,97,143`;
- `gestor-team-management.e2e.ts:117,144`;
- `fixtures/test-fixtures.ts:108`.

O que fazer:

- Cada um vira asserção (`await expect(x).toBeVisible()`) ou `test.skip(condição, motivo)` explícito, quando o elemento depende de dado. Use os page objects (`e2e/pages`), nunca `getByText(...).first()` para clicar em aba.
- `dashboard-reports.e2e.ts:228` clica `getByText(/ver.*detalhes|mapa|detalhes/i).first()`: trocar por seletor estável.
- **TC3:** nos arquivos tocados, trocar `waitForTimeout` fixo por espera por estado (`expect(...).toBeVisible()`, `waitForResponse`). Não precisa zerar os 117; registre quantos sobraram.
- Validação: `npx tsc` e eslint em `e2e`, e o CI do PR com secrets (`gh workflow run test.yml --ref <branch>`).

### Task 4: CSP e build da Vercel (TC5, TC6)

- **TC5:** `vercel.json`, a CSP enforced.
  - Remover `*.basemaps.cartocdn.com` e `*.tile.openstreetmap.org`, que nenhum código usa (confira com grep).
  - Acrescentar `object-src 'none'` e `base-uri 'self'`.
  - Avaliar tirar `unsafe-eval`: verifique se o bundle web precisa dele, por grep do build ou por teste de carga.
  - Alinhar a Report-Only, ou removê-la se não houver endpoint de report.
- **TC6:** o `installCommand` da Vercel usa `npm install --legacy-peer-deps`, e o CI usa `npm ci`. Passar a `npm ci`, com `--legacy-peer-deps` só se o lockfile exigir. Confira com `npm ci` local limpo.
- Validação: o preview deploy da Vercel no PR carrega o mapa web e o login sem violação de CSP no console. Abra o preview no navegador embutido e leia o console.

### Task 5: teste da `remind-routes` (TC7, parte)

`supabase/functions/remind-routes/index.ts` não tem teste.

- Extrair a lógica de decisão (quem lembrar, quando) para uma função pura testável, no padrão de `tokensDaConta.ts` da `send-push-notification`.
- Testar no runner que o repo já usa para Edge Functions. Se não houver, Jest com o módulo puro.
- Não mudar o comportamento.
