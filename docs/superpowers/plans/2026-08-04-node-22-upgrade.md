# Upgrade Node 20 → 22 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar todos os ambientes (dev, CI, EAS, Vercel) de Node 20 (EOL) para Node 22 (LTS), incluindo o `size-limit` 13 destravado, com validação de CI + web (Vercel) + nativo (EAS) antes do merge.

**Architecture:** Uma branch/PR que troca a versão de Node por linha (`22.x`) em todos os pontos de configuração e regenera o lockfile. O CI do próprio PR já roda em Node 22, então o `size-limit` 13 é validado dentro do mesmo PR. A validação nativa é um build EAS de teste (sem submissão).

**Tech Stack:** Node 22.x, Expo SDK 56 / RN 0.85, GitHub Actions, EAS Build, Vercel, size-limit 13.

## Global Constraints

- **Node alvo:** linha `22.x` (não pin exato) — `.nvmrc: 22`, workflows `22.x`, `engines: >=22`.
- **size-limit:** `>=13.0.1` (o 13.0.0 tinha regressão de glob).
- **Premissa de base:** esta branch parte da `main` **já com o #342 mergeado** (que leva o fix do flaky `reset-password`). Se ao executar o #342 ainda não estiver na `main`, a suíte pode falhar só nesse teste flaky — nesse caso, mergear #342 antes, OU aplicar o mesmo fix (`{ timeout: 6000 }` em `app/__tests__/integration/auth/reset-password.test.tsx`).
- **Build EAS:** apenas validar (`--profile preview`), **nunca submeter** neste plano.
- **Vercel dashboard** (Node 22.x) é ação **externa do gestor** — não é código.
- **Timing:** executar só depois de estabilizar o lançamento (#341/#342/#343 mergeados).
- Cada commit termina com a trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## Task 1: Aplicar Node 22 + size-limit 13 e regenerar o lockfile

**Files:**

- Modify: `.nvmrc`
- Modify: `.github/workflows/quality.yml`
- Modify: `.github/workflows/test.yml`
- Modify: `.github/workflows/update-snapshots.yml`
- Modify: `package.json`
- Modify: `package-lock.json` (regenerado)

- [ ] **Step 1: `.nvmrc` → 22**

Escrever no `.nvmrc` exatamente (uma linha):

```
22
```

- [ ] **Step 2: `quality.yml` — 2 pins**

Substituir **todas** as ocorrências (2, nas linhas 21 e 67) de:

```yaml
node-version: '20.x'
```

por:

```yaml
node-version: '22.x'
```

- [ ] **Step 3: `test.yml` — 3 pins**

Substituir **todas** as ocorrências (3, nas linhas 28, 76, 130) de:

```yaml
node-version: [20.x]
```

por:

```yaml
node-version: [22.x]
```

- [ ] **Step 4: `update-snapshots.yml` — 1 pin**

Substituir (linha 16):

```yaml
node-version: [20.x]
```

por:

```yaml
node-version: [22.x]
```

- [ ] **Step 5: `package.json` — engines + size-limit**

Três substituições:

```
"node": ">=20"                    →  "node": ">=22"
"size-limit": "^12.0.0"           →  "size-limit": "^13.0.1"
"@size-limit/preset-app": "^12.1.0"  →  "@size-limit/preset-app": "^13.0.1"
```

- [ ] **Step 6: Regenerar o lockfile**

Run: `npm install`
Expected: conclui sem erro; `package-lock.json` atualizado (size-limit 13.x, preset-app 13.x). Um `EBADENGINE` warning pode aparecer se o Node local for <22 — ignore se o Node local for ≥22.

- [ ] **Step 7: Conferir o diff**

Run: `git status --short && git diff --stat`
Expected: exatamente estes arquivos modificados: `.nvmrc`, os 3 workflows, `package.json`, `package-lock.json`. Nada mais.

- [ ] **Step 8: Commit**

```bash
git add .nvmrc .github/workflows/quality.yml .github/workflows/test.yml .github/workflows/update-snapshots.yml package.json package-lock.json
git commit -m "chore: upgrade Node 20 -> 22 e size-limit 13 (fecha #332 #335)"
```

---

## Task 2: Validação local

**Files:** nenhum — verificação.

- [ ] **Step 1: Garantir Node ≥ 22**

Run: `node --version`
Expected: `v22.x` (ideal) ou `v24.x`/`v26.x` (mesma família ≥22, aceitável para validar a lógica). Se houver `nvm`/`fnm` e o Node local for 20, trocar: `nvm install 22 && nvm use 22`.
Se o Node local for **20**, PARE — o `size-limit` 13 não roda; troque para 22+ antes de continuar.

- [ ] **Step 2: Validação (type-check + lint + test)**

Run: `npm run validate`
Expected: type-check + lint (0 warnings) + suíte de testes, tudo verde.
Se falhar **apenas** em `reset-password › esconder mismatch` (flaky de timeout): confirme que a base tem o fix do #342 (`{ timeout: 6000 }`); se não, aplique-o (ver Global Constraints) e re-rode.

- [ ] **Step 3: Build web**

Run: `npm run build:web`
Expected: conclui; gera `dist/` e injeta meta tags. (Roda `prebuild:web` = `tsc --noEmit` antes.)

- [ ] **Step 4: Bundle size (size-limit 13 em Node 22)**

Run: `npm run size`
Expected: `Web Bundle (JS)` e `Total Web Assets` ambos em ~3.3 MB gzip, **limite 3.5 MB** → passa. Exit 0. (Isto confirma que o size-limit 13 roda no Node atual e o bundle cabe.)

---

## Task 3: PR e validação de CI

**Files:** nenhum — o CI do PR é a validação canônica em Node 22.

- [ ] **Step 1: Push**

```bash
git push -u origin chore/node-22-upgrade
```

- [ ] **Step 2: Abrir o PR**

```bash
gh pr create --base main --head chore/node-22-upgrade \
  --title "chore: upgrade Node 20 -> 22 (+ size-limit 13, fecha #332 #335)" \
  --body "Migra dev/CI/EAS/Vercel para Node 22 (Node 20 EOL 30/04/2026). Inclui size-limit 13, destravado pelo Node 22. Requer setar Node 22.x no dashboard do Vercel. Ver docs/superpowers/specs/2026-08-04-node-22-upgrade-design.md."
```

- [ ] **Step 3: Aguardar e confirmar o CI (em Node 22.x)**

Run: `gh pr checks <PR> --watch`
Expected: todos verdes — **Run Tests (22.x)**, **TypeScript & Linting**, **Bundle Size Check** (agora com size-limit 13 rodando em Node 22), **Visual Regression (22.x)**, **Design System Drift (22.x)**, **Vercel**.
Confirme nos logs de um job que o runner subiu **Node 22** (`Setup Node.js` step). Se algum job falhar, diagnostique antes de seguir — não prossiga com CI vermelho.

---

## Task 4: Validação Vercel (web) + EAS (nativo)

**Files:** nenhum — validação de build em ambientes reais.

- [ ] **Step 1: (Gestor) Vercel → Node 22.x**

No dashboard: **Vercel → projeto rotamestre-app → Settings → Node.js Version → 22.x** e salvar. Depois, redeploy do preview do PR (ou push vazio) para pegar a versão nova.

- [ ] **Step 2: Confirmar o deploy de preview do PR**

Verificar no Vercel (deployment do commit da branch): status **Ready**, e no **Build Logs** a linha de versão do Node mostrando **22.x**. O build web precisa concluir sem erro.

- [ ] **Step 3: Build EAS de teste (Node 22 via `.nvmrc`)**

Run: `npx eas build --platform android --profile preview`
Expected: o build conclui com sucesso (gera `.apk` interno). Nos logs do EAS, confirmar que a versão de Node usada é **22** (lida do `.nvmrc`). **NÃO** submeter (`eas submit`) — este build é só validação.
Se o build nativo falhar por causa do Node 22, PARE e escale — é o risco principal que este passo existe para pegar.

- [ ] **Step 4: (Opcional) Smoke no `.apk`**

Instalar o `.apk` de preview num device Android e confirmar que o app inicia (login + uma tela). Opcional mas recomendado antes do merge.

---

## Task 5: Merge e pós-merge

**Files:** nenhum.

- [ ] **Step 1: Gate final**

Confirmar: Task 3 (CI verde em 22.x) + Task 4 (Vercel preview em 22 OK + build EAS em 22 OK). Só prosseguir com os três verdes.

- [ ] **Step 2: Merge (gestor, na UI)**

Como este PR toca `package.json`/lock, garanta que os PRs de deps anteriores (#342/#343) já mergearam; se pedir "Update branch", atualizar e aguardar o CI de novo. Merge via UI do GitHub (admin bypass da proteção — o `gh pr merge --admin` é bloqueado pela salvaguarda local).

- [ ] **Step 3: Pós-merge**

- Confirmar o deploy de **produção** do Vercel (`app.rotamestre.tec.br`) **Ready** em Node 22.
- Confirmar que o Dependabot fechou **#332** e **#335** (mesmas versões na `main`); se não, fechar manualmente.
- No **próximo build de release** (EAS), confirmar que roda em Node 22 (já validado pelo build de teste, mas monitorar o primeiro release real).
- Atualizar `docs/PROJECT_CONTEXT.md` registrando a migração para Node 22.

---

## Self-Review (autor do plano)

**1. Cobertura do spec:**

- `.nvmrc`/workflows/engines/size-limit → Task 1. ✓
- Validação local → Task 2. ✓
- CI em 22.x → Task 3. ✓
- Vercel dashboard (externo) + preview → Task 4 (Steps 1–2). ✓
- Build EAS de teste → Task 4 (Step 3). ✓
- Merge + fechar #332/#335 + pós-merge → Task 5. ✓
- Premissa do fix do flaky (#342) → Global Constraints + Task 2 Step 2. ✓

**2. Placeholders:** nenhum "TBD/TODO"; todo edit tem o texto exato e todo comando tem output esperado. ✓

**3. Consistência:** versões (`22`, `22.x`, `>=22`, `^13.0.1`) idênticas entre spec, mapa e edits. ✓
