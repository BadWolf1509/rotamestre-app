# Docs Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bloated, stale Claude Code documentation across the RotaMestre monorepo with three lean CLAUDE.md files (root + 2 subprojects) plus one design-system reference, cutting auto-injected context from ~1,300 lines to ~350.

**Architecture:** Replacement-in-place. Write four new files first (refs → app → painel → root, dependency order). Then delete deprecated paths with `git rm`. Single commit captures the whole transition. A local `.docs-restructure-backup/` directory snapshots the deletions for one-commit recovery and is cleaned up after verification.

**Tech Stack:** Markdown files. `git`, `node` (already in repo), `grep` via the harness `Grep` tool. No code dependencies change.

---

## Rules audit (decisions locked in)

Read of the to-be-deleted/rewritten files concluded the following classification of every distinct rule or fact. Engineers executing this plan should NOT re-audit; trust this table.

| Old location                                                        | What it said                                              | Decision                        | New home                                                                                                                             |
| ------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `D:\RotaMestre\.claude\behavior.md` §"Research First"               | "Always WebSearch when unsure"                            | Drop                            | (let Claude Code's default behavior + skills carry it; the rule isn't load-bearing in a CLAUDE.md)                                   |
| `behavior.md` §"Quality Over Speed", §"SaaS Best Practices"         | Generic SaaS advice (input validation, perf, scalability) | Drop                            | (generic; not RotaMestre-specific)                                                                                                   |
| `behavior.md` §"Code Standards" (TS/React examples)                 | Code patterns                                             | Drop content, keep rule names   | Absorbed: "Required patterns" section in app CLAUDE.md (logger, forms, queries, responsive, ErrorBoundary, no `as any`)              |
| `behavior.md` §"Git Workflow"                                       | Conventional commits                                      | Absorbed                        | Root CLAUDE.md "Cross-project rules"                                                                                                 |
| `behavior.md` §"Documentation"                                      | "Update CLAUDE.md when arch changes"                      | Drop                            | (implicit; the new files have `Last verified` footers)                                                                               |
| `behavior.md` §"Red Flags"                                          | When to stop and research                                 | Drop                            | (covered by general Claude behavior)                                                                                                 |
| `D:\RotaMestre\.claude\stack.md` §framework                         | RN/Expo/TS versions                                       | Drop versions, keep names       | App CLAUDE.md "Stack" — versions live in `package.json` only                                                                         |
| `stack.md` §database tables (DDL)                                   | Full DDL for 6 tables                                     | Drop                            | Live via `mcp__supabase__list_tables`                                                                                                |
| `stack.md` §Google Maps API                                         | Google Directions/Geocoding/Places usage                  | Drop (factually wrong now)      | Migrated to OSRM + Photon — captured in app CLAUDE.md "Stack"                                                                        |
| `stack.md` §RLS examples                                            | One sample policy SQL                                     | Drop                            | (use `rls-policy-reviewer` agent; live policies via Supabase MCP)                                                                    |
| `stack.md` §Storage buckets, deployment, env vars                   | Operational details                                       | Drop or absorb                  | Bucket name `fotos-entrega` mentioned in app CLAUDE.md design-system ref under CameraUpload                                          |
| Root CLAUDE.md §Tech Stack                                          | Duplicate of stack.md                                     | Drop                            | (project-specific CLAUDEs own this)                                                                                                  |
| Root CLAUDE.md §AI Behavior Rules                                   | 6 sub-sections, most generic                              | Drop most, keep critical        | New root "Cross-project rules" (4 bullets)                                                                                           |
| Root CLAUDE.md §Common Commands                                     | npm scripts list                                          | Drop                            | (visible in `package.json`; not load-bearing context)                                                                                |
| Root CLAUDE.md §Environment Variables                               | Listed env var names                                      | Drop                            | (visible in `.env.example`)                                                                                                          |
| Root CLAUDE.md §When to Search the Web                              | Search heuristics                                         | Drop                            | (duplicate of behavior.md, both gone)                                                                                                |
| Root CLAUDE.md §Database Schema                                     | Tables overview                                           | Drop                            | Live via MCP                                                                                                                         |
| Root CLAUDE.md §Main User Flows                                     | 3 user flow descriptions                                  | Drop                            | (out of date; flows are visible in `app/gestor/` and `app/motorista/` route trees)                                                   |
| Root CLAUDE.md §Documentation Structure / Rules                     | Meta-doc                                                  | Drop                            | (the new structure speaks for itself)                                                                                                |
| Root CLAUDE.md §Current Status                                      | Stale status table                                        | Drop                            | (replaced by `Last verified` footers)                                                                                                |
| Root CLAUDE.md §Workflow for New Features                           | 7-step generic process                                    | Drop                            | (covered by Claude Code default behavior)                                                                                            |
| Root CLAUDE.md §Philosophy                                          | Vibe-coding manifesto                                     | Drop                            | (not coding-relevant)                                                                                                                |
| Root CLAUDE.md §Available MCP Servers                               | Names list                                                | Absorbed                        | Root CLAUDE.md "MCP servers"                                                                                                         |
| App CLAUDE.md §Purpose, Users, Flow                                 | Project description                                       | Absorbed and compressed         | New app CLAUDE.md "Purpose & users"                                                                                                  |
| App CLAUDE.md §Tech Stack                                           | Versioned list                                            | De-versioned, absorbed          | New app CLAUDE.md "Stack"                                                                                                            |
| App CLAUDE.md §Project Structure                                    | Tree                                                      | Updated and absorbed            | New app CLAUDE.md "Layout (depth 2)"                                                                                                 |
| App CLAUDE.md §Design System inline                                 | Colors + Unistyles snippet                                | Moved                           | `.claude/refs/design-system.md`                                                                                                      |
| App CLAUDE.md §Code Patterns (Supabase, Responsive, Forms)          | Code blocks                                               | Absorbed as bullet rules        | New "Required patterns"                                                                                                              |
| App CLAUDE.md §Maps Migration narrative                             | History of removing Google APIs                           | Drop (one-time event, complete) | (relevant facts in "Stack" line; history is in git)                                                                                  |
| App CLAUDE.md §Known Issues & Fixes                                 | 3 metro/maps/CORS notes                                   | Drop                            | (1 of 3 is still relevant — `metro.config.js` `unstable_enablePackageExports`; this lives in `metro.config.js` already as a comment) |
| App CLAUDE.md §Phase 2 status (CSV export, real-time tracking, ...) | Roadmap status                                            | Drop                            | (use `git log --oneline` + GitHub issues)                                                                                            |
| App CLAUDE.md §Related Files                                        | List of file pointers                                     | Absorbed into "Phonebook"       |
| Panel CLAUDE.md §all sections                                       | Most are stale or duplicated                              | Rewritten in new file           |                                                                                                                                      |
| `D:\RotaMestre\docs\brand-guidelines.md`                            | Brand colors + typography + tokens                        | Absorbed                        | `.claude/refs/design-system.md`                                                                                                      |
| `rotamestre-app/docs/design-system-accessibility.md`                | A11y rules                                                | Absorbed                        | `.claude/refs/design-system.md` "Accessibility"                                                                                      |
| `rotamestre-app/docs/design-system-tokens.md`                       | Token list snapshot                                       | Absorbed                        | `.claude/refs/design-system.md` references `src/lib/design-tokens.ts` as live source                                                 |
| `rotamestre-app/docs/design-system-hex-report.md`                   | Generated audit report                                    | Drop (regenerable)              | Note in design-system.md to run `npm run report:hex`                                                                                 |
| `rotamestre-app/docs/design-system-release-notes.md`                | Historical change log                                     | Drop                            | (git log is canonical)                                                                                                               |
| `.claude/md-files-analysis.json`                                    | Orphan metadata                                           | Drop                            | (no consumer)                                                                                                                        |
| `.claude/commands/` empty dir                                       | Unused                                                    | Drop                            |                                                                                                                                      |

If an executor finds a rule or fact in a deleted file that ISN'T in this table, stop and surface it — don't decide to drop it silently.

---

## File structure

```
RotaMestre/
├── CLAUDE.md                                       ← NEW content (~50 lines)
├── .claude/
│   ├── behavior.md                                 ← DELETED
│   ├── stack.md                                    ← DELETED
│   ├── md-files-analysis.json                      ← DELETED
│   ├── commands/                                   ← DELETED (empty dir)
│   └── settings.local.json                         ← (untouched, gitignored)
├── docs/
│   └── brand-guidelines.md                         ← DELETED
│
├── rotamestre-app/
│   ├── CLAUDE.md                                   ← NEW content (~150 lines)
│   ├── .claude/refs/design-system.md               ← NEW file (~80 lines)
│   └── docs/
│       ├── design-system-accessibility.md          ← DELETED
│       ├── design-system-hex-report.md             ← DELETED
│       ├── design-system-release-notes.md          ← DELETED
│       └── design-system-tokens.md                 ← DELETED
│
└── rotamestre-painel/
    └── CLAUDE.md                                   ← NEW content (~120 lines)
```

Every other file under `RotaMestre/` is untouched.

---

## Task 1: Preflight checks

**Files:** None modified — read-only checks.

- [ ] **Step 1: Confirm clean working tree before starting**

Run:

```bash
cd D:/RotaMestre/rotamestre-app && git status --short
```

Expected output: untracked files (`.claude/scheduled_tasks.lock`, `docs/plans/...`, `docs/superpowers/plans/`) but NO modified or staged files in `app/`, `src/`, or `database/`. If staged or modified work exists, stop and resolve before proceeding.

- [ ] **Step 2: Scan for external consumers of files marked for deletion**

Run (one command, will print matches across the monorepo):

```bash
cd D:/RotaMestre && grep -rIn --include='*.md' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.cjs' --include='*.json' --include='*.yml' --include='*.yaml' -E '(\.claude/behavior\.md|\.claude/stack\.md|\.claude/troubleshooting\.md|md-files-analysis\.json|docs/brand-guidelines\.md|BRAND_GUIDELINES\.md|design-system-accessibility|design-system-hex-report|design-system-release-notes|design-system-tokens|project-context\.md)' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=dist --exclude-dir=coverage 2>/dev/null | head -100
```

Expected output: only matches inside the files that are themselves being deleted (the docs reference each other) and inside the spec file `docs/superpowers/specs/2026-05-18-docs-restructure-design.md`. If you find a match in `tools/`, `scripts/`, `.github/workflows/`, `vercel.json`, `package.json`, or anywhere else outside the deletion set, STOP. Add a task to that surfaced location before proceeding with deletions.

- [ ] **Step 3: Confirm exactly which files exist at the deletion paths**

Run:

```bash
ls D:/RotaMestre/.claude/behavior.md D:/RotaMestre/.claude/stack.md D:/RotaMestre/.claude/md-files-analysis.json D:/RotaMestre/docs/brand-guidelines.md 2>&1
ls D:/RotaMestre/rotamestre-app/docs/design-system-accessibility.md D:/RotaMestre/rotamestre-app/docs/design-system-hex-report.md D:/RotaMestre/rotamestre-app/docs/design-system-release-notes.md D:/RotaMestre/rotamestre-app/docs/design-system-tokens.md 2>&1
ls -la D:/RotaMestre/.claude/commands/ 2>&1
```

Expected output: each file listed with a size > 0. `.claude/commands/` should list `.` and `..` only (empty dir). Note any unexpected differences (e.g., an unexpected file in `commands/`) — surface before proceeding.

---

## Task 2: Snapshot deletions to local backup

**Files:**

- Create: `D:\RotaMestre\.docs-restructure-backup\` (gitignored — temporary)

- [ ] **Step 1: Create the backup directory and copy all to-be-deleted files**

Run:

```bash
cd D:/RotaMestre && mkdir -p .docs-restructure-backup
cp .claude/behavior.md .docs-restructure-backup/root-claude-behavior.md
cp .claude/stack.md .docs-restructure-backup/root-claude-stack.md
cp .claude/md-files-analysis.json .docs-restructure-backup/root-claude-md-files-analysis.json
cp docs/brand-guidelines.md .docs-restructure-backup/docs-brand-guidelines.md
cp CLAUDE.md .docs-restructure-backup/root-CLAUDE.md
cp rotamestre-app/CLAUDE.md .docs-restructure-backup/app-CLAUDE.md
cp rotamestre-painel/CLAUDE.md .docs-restructure-backup/painel-CLAUDE.md
cp rotamestre-app/docs/design-system-accessibility.md .docs-restructure-backup/app-design-system-accessibility.md
cp rotamestre-app/docs/design-system-hex-report.md .docs-restructure-backup/app-design-system-hex-report.md
cp rotamestre-app/docs/design-system-release-notes.md .docs-restructure-backup/app-design-system-release-notes.md
cp rotamestre-app/docs/design-system-tokens.md .docs-restructure-backup/app-design-system-tokens.md
ls -la .docs-restructure-backup/
```

Expected output: 11 files listed in `.docs-restructure-backup/`, each > 0 bytes.

- [ ] **Step 2: Ensure the backup folder is gitignored**

Run:

```bash
cd D:/RotaMestre && grep -q '^\.docs-restructure-backup/$' rotamestre-app/.gitignore || echo '.docs-restructure-backup/' >> rotamestre-app/.gitignore
grep -q '^\.docs-restructure-backup/$' rotamestre-painel/.gitignore || echo '.docs-restructure-backup/' >> rotamestre-painel/.gitignore
git -C D:/RotaMestre/rotamestre-app check-ignore -v ../.docs-restructure-backup/root-CLAUDE.md 2>&1 || echo "NOTE: app .gitignore does not cover parent — backup lives at repo root, which is outside the app git tree. Check the repos involved."
```

Note: `.docs-restructure-backup/` lives at `D:\RotaMestre\` (parent), not inside either subproject git tree. It is OUTSIDE the tracked tree, so `git status` will never see it. No `.gitignore` change is strictly required, but adding it to each subproject is harmless safety in case the layout changes later. Confirm via:

```bash
git -C D:/RotaMestre/rotamestre-app status --porcelain | grep -i backup || echo "(clean - backup not visible to app git)"
git -C D:/RotaMestre/rotamestre-painel status --porcelain | grep -i backup || echo "(clean - backup not visible to panel git)"
```

Expected: both print `(clean...)`. If either shows the backup, stop and adjust.

---

## Task 3: Create `rotamestre-app/.claude/refs/design-system.md`

**Files:**

- Create: `D:\RotaMestre\rotamestre-app\.claude\refs\design-system.md`

- [ ] **Step 1: Create the `refs/` directory**

Run:

```bash
mkdir -p D:/RotaMestre/rotamestre-app/.claude/refs
```

- [ ] **Step 2: Write the file**

Write to `D:\RotaMestre\rotamestre-app\.claude\refs\design-system.md` the following content exactly:

````markdown
# RotaMestre Design System

This file is the canonical design reference for the app. Live source of truth is `src/lib/design-tokens.ts` — regenerate snapshots from there with `npm run report:hex` when needed.

## Brand colors

- **Primary** — Orange `#FF8C42` — CTAs, primary actions, route status accents.
- **Secondary** — Blue `#4A90E2` — informational UI (links, secondary actions).
- **Success** — Green `#2ECC71` — completed deliveries, positive state.
- **Warning** — Yellow `#F1C40F` — pending/in-progress states.
- **Danger** — Red `#E74C3C` — destructive actions, errors.

Token names in `src/lib/design-tokens.ts`: `colors.primary`, `colors.secondary`, `colors.success`, `colors.warning`, `colors.danger`. Always import — never inline hex values in components.

## Typography

- **Headings:** Viga (loaded via `@expo-google-fonts/viga`).
- **Body:** Nunito Sans (loaded via `@expo-google-fonts/nunito-sans`).

Font weights for body: 400 (regular), 600 (semi-bold), 700 (bold). Don't use other weights without adding them to the font loader in `app/_layout.tsx`.

## Spacing scale

`spacing.xs|sm|md|lg|xl|xxl` in `design-tokens.ts`. Multiples of 4: 4, 8, 16, 24, 32, 48 px.

Use spacing tokens, never raw numbers. `padding: spacing.md` not `padding: 16`.

## Breakpoints

```typescript
import { useResponsive } from '@/hooks/useResponsive';
const { isMobile, isTablet, isDesktop, width } = useResponsive();
```

- **Mobile:** width < 768
- **Tablet:** 768 ≤ width < 1024
- **Desktop:** width ≥ 1024

Always prefer the hook over raw `Dimensions.get('window')`.

## Accessibility (WCAG 2.1 AA target)

Required on every interactive component:

- `accessibilityLabel` for visual labels that aren't text (icons, images).
- `accessibilityRole` per role (`button`, `header`, `link`, etc.).
- `accessibilityState` for toggleable controls (`{ disabled, selected, checked, expanded }`).
- Minimum touch target: 44×44 px (use `hitSlop` to extend if visual size is smaller).
- Contrast: text against background ≥ 4.5:1 (≥ 3:1 for large text and UI components).

## Base components

Build with these unless there's a specific reason not to:

- `AppButton` (`src/components/AppButton.tsx`) — variants: `primary`, `secondary`, `ghost`, `danger`.
- `AppCard` (`src/components/AppCard.tsx`) — container with shadow + radius.
- `AppInput` (`src/components/AppInput.tsx`) — text field with label + error slot; integrates with `react-hook-form`.
- `AddressAutocomplete` — wraps Photon API for address input.
- `CameraUpload` — camera or gallery photo, auto-compressed to <500KB, uploads to Supabase Storage bucket `fotos-entrega`.
- `DataTable` — responsive table (cards on mobile, table on desktop).
- `ResponsiveContainer` — max-width wrapper for desktop layouts.

## Maintenance commands

- `npm run build:tokens` — regenerate the CSS-variables snapshot after editing `design-tokens.ts`.
- `npm run verify:design-system` — fail-loud check that no hardcoded hex values slipped into components.
- `npm run report:hex` — current usage audit (machine-readable).

## Visual QA

The `app/design-system.tsx` screen (dev-only) renders every base component for live visual review. Open via deep link or navigate directly while running the dev server.
````

- [ ] **Step 3: Verify line count and content**

Run:

```bash
wc -l D:/RotaMestre/rotamestre-app/.claude/refs/design-system.md
```

Expected: between 65 and 95 lines. If outside that range, re-read Step 2 — content may have been corrupted.

---

## Task 4: Write `rotamestre-app/CLAUDE.md`

**Files:**

- Modify (full rewrite): `D:\RotaMestre\rotamestre-app\CLAUDE.md`

- [ ] **Step 1: Overwrite the file**

Write to `D:\RotaMestre\rotamestre-app\CLAUDE.md` the following content exactly:

````markdown
# rotamestre-app

Mobile + web app for last-mile route optimization. Two user roles: **gestor** (manager — creates and assigns routes) and **motorista** (driver — executes routes with turn-by-turn nav and photo proof of delivery).

## Stack

- **Framework:** React Native + Expo + TypeScript; file-based routing via Expo Router.
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime). Client uses `ANON_KEY` and respects RLS. Service-role access lives in the panel project, never here.
- **Maps:** MapLibre GL (web + native) on OpenFreeMap / Carto tiles; OSRM for routing; Photon for geocoding. All free — no Google Maps API key needed.
- **Forms:** `react-hook-form` + Zod via `@hookform/resolvers/zod`.
- **State:** React hooks + `AsyncStorage` (no Redux/Zustand).
- **Error tracking:** Sentry, web production only (`src/lib/sentry.ts`).
- **Testing:** Jest + `@testing-library/react-native` (unit), Playwright (E2E), custom visual regression (`tools/scripts/run-visual-tests.cjs`).
- **Deploy:** Vercel (web) + EAS (Android `.aab`). iOS not yet configured.

Versions live in `package.json` — never duplicate them here.

## Layout (depth 2)

```
rotamestre-app/
├── app/                  # Expo Router screens (file-based)
│   ├── (auth)/           # Login, register, forgot-password
│   ├── gestor/           # Manager screens
│   └── motorista/        # Driver screens
├── src/
│   ├── components/       # Reusable UI (~318 files; feature-grouped + design-system base)
│   ├── hooks/            # Domain-organized (~184 hooks; auth/, gestao-rotas/, motorista/, etc.)
│   ├── lib/              # Utilities: supabase, logger, sentry, photon, osrm wrapper, navigation
│   ├── context/          # React Contexts (notifications, route status)
│   ├── types/            # Hand-curated domain types (Rota, Parada, Usuario, ...)
│   └── constants/        # App-wide constants (DEBOUNCE, LIMITS, CACHE_TTL)
├── database/migrations/  # SQL migrations (YYYYMMDDhhmmss prefix; canonical dir)
├── supabase/migrations/  # Subset for `supabase db push` / branch workflows (drift-prone — see migration-drift-auditor)
├── tools/scripts/        # Build helpers, visual tests, asset copy
├── scripts/              # Dev/release scripts (bump-android-version, coverage-report, ...)
└── docs/                 # Human-readable docs (TESTING, deployment, plans, superpowers)
```

## Multi-tenancy

Tenant-scoped tables have an `unidade_id uuid` column. Users belong to one or many `unidades` via the `usuario_unidades` join table (enabled by `database/migrations/20251204000001_update_rls_multi_unidade.sql`). Policies scope reads/writes via `get_user_unidade()` (legacy single-unidade) or `usuario_unidades` (preferred for new code).

Roles in `usuarios.papel`: `gestor` (CRUD their unidade), `motorista` (route assignment + own paradas). Admin actions happen in the panel project, never here.

## Required patterns

- **Logging:** `logger.warn(message, error)` (max 2 args). Critical catches: log + fallback. Non-critical catches: silent with an explaining comment. Tests spy on `logger.error/warn`, not `console`.
- **Forms:** always Zod schema + `useForm({ resolver: zodResolver(schema) })`. Live example: `src/components/gestor/nova-entrega/FormularioParada.tsx`.
- **Queries:** prefer `useCachedData` / `useSupabaseQuery` hooks over raw `supabase.from(...).select(...)` in components. The cached layer implements SWR semantics.
- **Responsive:** always `useResponsive()` from `@/hooks/useResponsive`. Breakpoints: mobile <768, tablet 768–1023, desktop ≥1024.
- **ErrorBoundary:** every screen route under `app/` gets one (current coverage 27/27).
- **Type safety:** no `as any` in production code (Unistyles web styles are the documented exception). Use `.returns<T>()` on Supabase queries when inference fails, with comments.
- **Async UX:** wrap async operations with `useToast.withToast()` — handles loading + success + error feedback in one call.

## Skills, agents, hook

Installed in `.claude/`:

- `/regenerate-supabase-types` (user-invoke) — after schema-changing migrations, regenerate types into `src/types/database.ts`.
- `/new-migration` (both Claude + user) — scaffold a SQL migration with RLS + SECURITY DEFINER + FK-index checklist.
- Agent `rls-policy-reviewer` — review migrations for multi-tenant security holes. Use BEFORE merging schema changes.
- Agent `migration-drift-auditor` — detect drift between `database/migrations/`, `supabase/migrations/`, `MIGRATIONS.md`, and the live DB.
- Hook `block-sensitive-files` (PreToolUse) — refuses edits to `.env*`, `*.keystore`, `eas.json`, `google-services.json`, `play-store-credentials.json`, and SSH keys.

## Phonebook

| Looking for                                | Where                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Current versions of any dep                | `package.json`                                                                     |
| Live DB schema / data                      | `mcp__rotamestre-db__*` or `mcp__supabase__list_tables` (verify project_ref first) |
| Design system (colors, typography, tokens) | `.claude/refs/design-system.md`                                                    |
| Test commands, coverage, layout            | `docs/TESTING.md`                                                                  |
| Migration conventions + history            | `database/MIGRATIONS.md` (also see `/new-migration` skill)                         |
| Sentry configuration                       | `src/lib/sentry.ts`                                                                |
| Supabase client setup                      | `src/lib/supabase.ts`                                                              |
| Logger                                     | `src/lib/logger.ts`                                                                |
| Photon geocoding wrapper                   | `src/lib/photon.ts`                                                                |
| OSRM routing wrapper                       | `src/lib/google.ts` (legacy name; wraps OSRM)                                      |
| Maps (web vs mobile)                       | `src/components/MapaWebMapLibre.tsx` / `src/components/MapaRN.tsx`                 |
| Camera/upload                              | `src/components/CameraUpload.tsx`                                                  |
| External nav apps (Waze, Google Maps)      | `src/lib/navigation.ts`                                                            |
| Play Store deploy notes                    | `docs/GOOGLE_PLAY_DEPLOYMENT.md`                                                   |

## External services in use

- **Supabase** project `xezslsyxjivunmhhyxtd` — Postgres + Auth + Storage + Realtime.
- **Sentry** — web production only; DSN via `EXPO_PUBLIC_SENTRY_DSN`.
- **Vercel** — auto-deploy on push to `main`; CSP whitelists Supabase, OSRM, Photon, OpenStreetMap tiles, Sentry.
- **EAS** — Android builds (production = `.aab`).
- **Asaas** — billing pending; `unidades.asaas_customer_id` is the join key when work begins.

---

**Last verified:** 2026-05-18 (Expo 55, RN 0.83.1, ~5438 tests / ~74% coverage)
**Refresh checklist:** `cd rotamestre-app && grep -E '"(expo|react-native|@supabase)"' package.json` for version snapshot. Re-read `database/MIGRATIONS.md` after migrations land. Confirm Sentry DSN still set in Vercel env vars.
````

- [ ] **Step 2: Verify line count**

Run:

```bash
wc -l D:/RotaMestre/rotamestre-app/CLAUDE.md
```

Expected: between 130 and 170 lines. Outside that range, re-read Step 1.

---

## Task 5: Write `rotamestre-painel/CLAUDE.md`

**Files:**

- Modify (full rewrite): `D:\RotaMestre\rotamestre-painel\CLAUDE.md`

- [ ] **Step 1: Overwrite the file**

Write to `D:\RotaMestre\rotamestre-painel\CLAUDE.md` the following content exactly:

````markdown
# rotamestre-painel

Internal admin panel for the RotaMestre platform. Users are the internal team (admins + support), **not** clients. Used to onboard unidades, manage users, view metrics (MRR, churn, conversion), and — when shipped — handle Asaas billing.

## Stack

- **Framework:** Next.js (App Router) + TypeScript.
- **Styling:** Tailwind CSS 4 (CSS-first config, no `tailwind.config.js`) + shadcn/ui + Radix primitives + Lucide icons.
- **Forms:** `react-hook-form` + Zod.
- **Backend:** Supabase with the **SERVICE_ROLE_KEY** — bypasses ALL Row Level Security. See "Critical security" below.
- **Maps:** `@react-google-maps/api` (web).
- **Deploy:** Vercel.

Versions live in `package.json` — never duplicate them here.

## Critical security

⚠️ **This project uses `SUPABASE_SERVICE_ROLE_KEY` and bypasses RLS entirely.**

- Never expose the key to client-side code. Server Components and API routes only.
- Every admin action must validate `usuarios.admin_role` in application logic — RLS will not catch a misuse here.
- The key is set in Vercel env vars; never commit it.

## Layout

```
rotamestre-painel/
├── app/
│   ├── (auth)/login/       # Admin login (admin_role gate)
│   ├── (dashboard)/        # Protected admin routes
│   │   ├── page.tsx        # Metrics dashboard
│   │   ├── unidades/       # Units CRUD
│   │   ├── usuarios/       # Users management
│   │   └── relatorios/     # Reports (pending — Phase 8)
│   ├── api/                # API routes (rate-limited)
│   └── layout.tsx
├── components/
│   ├── ui/                 # shadcn/ui base (button, card, table, dialog, ...)
│   └── custom/             # Project-specific (UnidadeCard, MetricsCard, ...)
├── lib/
│   ├── supabase.ts         # Service Role client
│   ├── date-utils.ts       # calcularPeriodo('7d'|'30d'|'90d')
│   ├── rate-limiter.ts     # In-memory rate limiter
│   └── services/admin-auth.ts # getAdminUser()
├── hooks/useAuth.ts        # Admin auth hook
├── database/migrations/    # Panel-specific migrations (admin_logs, etc.)
└── scripts/reset-admin-password.js
```

## Roles & auth flow

`usuarios.admin_role` values: `'admin'` (full CRUD), `'suporte'` (view + edit), or `null` (regular gestor/motorista — not allowed here).

After Supabase Auth login, every protected route validates `admin_role` via `useAuth.ts`. Non-admins are redirected to `/unauthorized`. API routes use `getAdminUser()` from `lib/services/admin-auth.ts` to identify the actor and log audit entries.

## Required patterns

- **Server Components by default.** Add `'use client'` only when needed (interactivity, browser APIs, hooks like `useState`).
- **Audit logging is mandatory.** Every admin write (create / edit / delete on `unidades`, `usuarios`, plan changes) writes a row to `admin_logs` with `dados_antes` + `dados_depois`. Use `getAdminUser()` to identify the actor.
- **Forms:** Zod schema + `useForm({ resolver: zodResolver(schema) })`.
- **Rate limiting:** wrap public-facing API routes with `checkRateLimit(identifier, opts)` from `lib/rate-limiter.ts`. Current limits: `/api/cnpj/[cnpj]` 3/min, `/api/usuarios/[id]/reset-password` 5/5min, `/api/auth/dev-login` 10/min. Upgrade to Upstash Redis when scaling beyond Vercel serverless.
- **Tailwind 4 specifics:** import via `@import "tailwindcss"` in CSS; theme via CSS variables. No JS config file.

## Skills, agents, hooks

None yet for this project. The app project (`../rotamestre-app/.claude/`) has the model setup — replicate analogously when this panel reaches feature parity for migrations and tests.

## Phonebook

| Looking for                  | Where                                                                |
| ---------------------------- | -------------------------------------------------------------------- |
| Current versions of any dep  | `package.json`                                                       |
| Live DB schema / data        | `mcp__supabase__list_tables` or directly via the Service Role client |
| Admin login flow             | `app/(auth)/login/page.tsx`, `hooks/useAuth.ts`                      |
| Supabase Service Role client | `lib/supabase.ts`                                                    |
| Rate limiter usage           | `lib/rate-limiter.ts`                                                |
| Audit log helper             | `lib/services/admin-auth.ts` + the `admin_logs` table                |
| shadcn/ui components added   | `components/ui/` (one file per component)                            |
| Admin password reset script  | `scripts/reset-admin-password.js`                                    |

## External services in use

- **Supabase** — same project as the app (`xezslsyxjivunmhhyxtd`), but with SERVICE_ROLE access here.
- **Vercel** — staging at `painel.rotamestre.tec.br`.
- **Asaas** — pending integration; `unidades.asaas_customer_id` is the join key when work begins.

---

**Last verified:** 2026-05-18 (Next.js App Router + Tailwind 4 + shadcn/ui)
**Refresh checklist:** `cd rotamestre-painel && grep -E '"(next|react|@supabase|tailwindcss)"' package.json` for version snapshot. Spot-check `admin_logs` has recent entries via Supabase Dashboard.
````

- [ ] **Step 2: Verify line count**

Run:

```bash
wc -l D:/RotaMestre/rotamestre-painel/CLAUDE.md
```

Expected: between 100 and 140 lines.

---

## Task 6: Write root `CLAUDE.md`

**Files:**

- Modify (full rewrite): `D:\RotaMestre\CLAUDE.md`

- [ ] **Step 1: Overwrite the file**

Write to `D:\RotaMestre\CLAUDE.md` the following content exactly:

````markdown
# RotaMestre

Multi-tenant SaaS for last-mile route optimization. Serves the Mestre da Obra rental-equipment franchise network.

## Monorepo

```
RotaMestre/
├── rotamestre-app/      # Client app (React Native + Expo) — gestor + motorista UX
├── rotamestre-painel/   # Admin panel (Next.js) — internal team only
├── tools/               # MCP servers + helper scripts
└── docs/                # Cross-project documentation
```

When working under `rotamestre-app/` or `rotamestre-painel/`, also read that project's `CLAUDE.md`. It carries the active patterns, file pointers, and skills/agents for that codebase.

## Cross-project rules

Apply everywhere — app, panel, scripts, migrations.

- **Multi-tenancy:** every tenant-scoped table filters by `unidade_id`. Never bypass RLS without auditing the affected rows. Use the `rls-policy-reviewer` agent if in doubt.
- **Logging:** use `logger` from the project's logger module. Never use `console.*` in tracked code. Logger accepts max 2 args: `logger.error(message, error)`.
- **Commits:** conventional commits (`type(scope): description`). Never auto-commit without explicit user request.
- **Verify before claiming:** query, read, or test before concluding. Don't guess — use MCP tools, Grep, or run scripts.

## MCP servers (when connected)

- `rotamestre-db` — direct DB tools (listar_rotas, listar_unidades, listar_logs, …).
- `rotamestre-git-app` — Git operations on the app repo.
- `rotamestre-fs-app` — filesystem access on the app repo.
- `supabase` (official) — Supabase Cloud API. ⚠️ Verify project scope before SQL ops — the HTTP `project_ref=` query is not honored; check via `mcp__supabase__get_project_url`.
- `sentry` — production error querying.
- `playwright` — browser automation for the E2E suite.
- `context7` — library docs lookup.

---

**Last verified:** 2026-05-18 (Expo 55, RN 0.83.1, Next.js App Router; ~5438 tests in app).
**Refresh checklist:** `git -C rotamestre-app log -10 --oneline` for recent stack changes. Check `package.json` files for version drift. Re-read `database/MIGRATIONS.md` after migrations land.
````

- [ ] **Step 2: Verify line count**

Run:

```bash
wc -l D:/RotaMestre/CLAUDE.md
```

Expected: between 40 and 60 lines.

---

## Task 7: Cross-reference verification

**Files:** None modified — read-only checks.

- [ ] **Step 1: Search for references to deleted paths**

Run:

```bash
cd D:/RotaMestre && grep -rIn --include='*.md' -E '(\.claude/behavior\.md|\.claude/stack\.md|md-files-analysis\.json|docs/brand-guidelines\.md|BRAND_GUIDELINES\.md|design-system-accessibility|design-system-hex-report|design-system-release-notes|design-system-tokens|\.claude/troubleshooting\.md|\.claude/project-context\.md)' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=dist --exclude-dir=coverage 2>/dev/null
```

Expected output: matches ONLY inside `.docs-restructure-backup/` (the snapshots) and inside `rotamestre-app/docs/superpowers/specs/2026-05-18-docs-restructure-design.md` (the spec describing what's being deleted). NOTHING from the new CLAUDE.md files (root, app, painel) or `refs/design-system.md`. If a new file references something being deleted, fix the reference before proceeding.

- [ ] **Step 2: Confirm the new files reference each other correctly**

Run:

```bash
cd D:/RotaMestre && grep -n 'design-system.md' rotamestre-app/CLAUDE.md
grep -n 'rotamestre-app' CLAUDE.md
grep -n 'rotamestre-painel' CLAUDE.md
grep -n 'MIGRATIONS.md\|TESTING.md\|GOOGLE_PLAY_DEPLOYMENT.md' rotamestre-app/CLAUDE.md
```

Expected: each grep returns at least one match. The app CLAUDE.md should reference `.claude/refs/design-system.md`, `docs/TESTING.md`, `database/MIGRATIONS.md`, `docs/GOOGLE_PLAY_DEPLOYMENT.md`. Root CLAUDE.md should reference both subprojects.

- [ ] **Step 3: Confirm referenced files actually exist**

Run:

```bash
ls D:/RotaMestre/rotamestre-app/docs/TESTING.md D:/RotaMestre/rotamestre-app/docs/GOOGLE_PLAY_DEPLOYMENT.md D:/RotaMestre/rotamestre-app/database/MIGRATIONS.md D:/RotaMestre/rotamestre-app/.claude/refs/design-system.md D:/RotaMestre/rotamestre-app/src/lib/sentry.ts D:/RotaMestre/rotamestre-app/src/lib/supabase.ts D:/RotaMestre/rotamestre-app/src/lib/logger.ts D:/RotaMestre/rotamestre-app/src/lib/photon.ts D:/RotaMestre/rotamestre-app/src/lib/google.ts D:/RotaMestre/rotamestre-app/src/lib/navigation.ts D:/RotaMestre/rotamestre-painel/lib/supabase.ts D:/RotaMestre/rotamestre-painel/lib/rate-limiter.ts D:/RotaMestre/rotamestre-painel/lib/services/admin-auth.ts D:/RotaMestre/rotamestre-painel/hooks/useAuth.ts 2>&1
```

Expected: every file listed without error. If `ls` reports "No such file or directory" for any item, edit the new CLAUDE.md to remove or correct the reference before deleting the old files.

---

## Task 8: Delete deprecated files

**Files:**

- Delete: `D:\RotaMestre\.claude\behavior.md`
- Delete: `D:\RotaMestre\.claude\stack.md`
- Delete: `D:\RotaMestre\.claude\md-files-analysis.json`
- Delete: `D:\RotaMestre\.claude\commands\` (empty directory)
- Delete: `D:\RotaMestre\docs\brand-guidelines.md`
- Delete: `D:\RotaMestre\rotamestre-app\docs\design-system-accessibility.md`
- Delete: `D:\RotaMestre\rotamestre-app\docs\design-system-hex-report.md`
- Delete: `D:\RotaMestre\rotamestre-app\docs\design-system-release-notes.md`
- Delete: `D:\RotaMestre\rotamestre-app\docs\design-system-tokens.md`

Note: `D:\RotaMestre\` is NOT a git repository — only `rotamestre-app/` and `rotamestre-painel/` are. So root-level files (CLAUDE.md, .claude/_, docs/_) need plain `rm`, not `git rm`. Only files inside `rotamestre-app/` go through `git rm`.

- [ ] **Step 1: Delete root-level files with plain `rm`**

Run:

```bash
rm -f D:/RotaMestre/.claude/behavior.md D:/RotaMestre/.claude/stack.md D:/RotaMestre/.claude/md-files-analysis.json D:/RotaMestre/docs/brand-guidelines.md
rmdir D:/RotaMestre/.claude/commands 2>&1
ls D:/RotaMestre/.claude/ 2>&1
ls D:/RotaMestre/docs/ 2>&1
```

Expected: `.claude/` no longer lists `behavior.md`, `stack.md`, `md-files-analysis.json`, or `commands/`. `docs/` no longer lists `brand-guidelines.md`. If `rmdir` fails for `commands/`, check whether it's actually empty (`ls -la D:/RotaMestre/.claude/commands/`). If empty, retry; if not, surface the contents.

- [ ] **Step 2: Delete app-level files with `git rm`**

Run:

```bash
cd D:/RotaMestre/rotamestre-app && git rm docs/design-system-accessibility.md docs/design-system-hex-report.md docs/design-system-release-notes.md docs/design-system-tokens.md
git status --short docs/
```

Expected: each file shows `D` (deleted, staged). No other modifications to `docs/`.

---

## Task 9: Sanity checks before commit

**Files:** None modified — verification only.

- [ ] **Step 1: TypeScript still type-checks**

Run:

```bash
cd D:/RotaMestre/rotamestre-app && npm run type-check 2>&1 | tail -20
```

Expected: exit code 0, "Found 0 errors" or no error output. Any TS error indicates a code file referenced a doc path in a JSDoc/comment and the deletion broke a link checker — unlikely but free check.

- [ ] **Step 2: ESLint still passes**

Run:

```bash
cd D:/RotaMestre/rotamestre-app && npm run lint 2>&1 | tail -20
```

Expected: exit code 0. Same rationale as Step 1.

- [ ] **Step 3: Confirm git status looks right**

Run:

```bash
cd D:/RotaMestre/rotamestre-app && git status --short
```

Expected: shows `M CLAUDE.md`, four `D docs/design-system-*.md` lines, and (if not already tracked) `?? .claude/refs/design-system.md`. Nothing in `src/`, `app/`, `tools/`, or `scripts/` should be modified.

If `.claude/refs/design-system.md` shows as `??`, that's expected — it's a new file. The next step stages it.

- [ ] **Step 4: Stage new files and review the full diff**

Run:

```bash
cd D:/RotaMestre/rotamestre-app && git add .claude/refs/design-system.md CLAUDE.md
git diff --staged --stat
```

Expected:

- `CLAUDE.md` shows large negatives and ~150 positives (full rewrite — Git treats it as delete + add of similar content)
- `.claude/refs/design-system.md` shows as new file with ~80 positive lines
- 4× `docs/design-system-*.md` show as deletions
- No other files

- [ ] **Step 5: Open a fresh Claude Code conversation in `rotamestre-app/` to test auto-inject**

This is a manual verification step. From a separate terminal (NOT the executing session):

```bash
# In a separate terminal, with Claude Code installed:
cd D:/RotaMestre/rotamestre-app
claude
# Once Claude starts, eyeball the initial context for:
#   - Root CLAUDE.md content (~50 lines from D:\RotaMestre\CLAUDE.md)
#   - App CLAUDE.md content (~150 lines)
# Confirm no errors about missing files. Exit with /exit.
```

Expected: Claude shows the new monorepo map, the cross-project rules, then the app-specific stack, layout, patterns, skills/agents, and phonebook. No mentions of behavior.md, stack.md, brand-guidelines.md, design-system-\*.md.

If you cannot do an interactive check (running in a non-interactive subagent), skip Step 5 and rely on Step 1–4. Note the skip in the commit message.

---

## Task 10: Commit

**Files:** Commit the full transition (new files, rewritten file, deletions).

- [ ] **Step 1: Final pre-commit state check**

Run:

```bash
cd D:/RotaMestre/rotamestre-app && git status --short
```

Expected to be staged:

- `A  .claude/refs/design-system.md`
- `M  CLAUDE.md`
- `D  docs/design-system-accessibility.md`
- `D  docs/design-system-hex-report.md`
- `D  docs/design-system-release-notes.md`
- `D  docs/design-system-tokens.md`

Plus untracked files unrelated to this change (e.g., `.claude/scheduled_tasks.lock`, `docs/superpowers/plans/2026-05-18-docs-restructure.md`) — those are NOT included in this commit.

- [ ] **Step 2: Stage this plan file as well**

Run:

```bash
cd D:/RotaMestre/rotamestre-app && git add docs/superpowers/plans/2026-05-18-docs-restructure.md
git status --short
```

Expected: now includes `A docs/superpowers/plans/2026-05-18-docs-restructure.md`.

- [ ] **Step 3: Commit**

Run:

```bash
cd D:/RotaMestre/rotamestre-app && git commit -m "$(cat <<'EOF'
docs(claude): restructure for context efficiency

- Slim root CLAUDE.md to monorepo map + cross-project rules (~50 lines)
- Rewrite app and panel CLAUDE.md with current stack and pointers
- Consolidate 5 design-system docs into .claude/refs/design-system.md
- Delete .claude/behavior.md, .claude/stack.md (stale + duplicated);
  content absorbed into CLAUDE.md or sourced live (package.json, MCP)
- Reference the skills, agents, and hook committed in 71acf1e

Cuts auto-injected docs from ~1,300 lines to ~350. No code changes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected output: husky pre-commit (`npx lint-staged`) runs prettier on the new/modified `.md` files, then commit succeeds. Commit message includes 5 bullets and a summary line.

- [ ] **Step 4: Note that root-level deletions are not in this app commit**

The deletions in `D:\RotaMestre\.claude\` and `D:\RotaMestre\docs\` are OUTSIDE the app git tree (the root is not a repo). They were performed by Task 8 Step 1 with plain `rm`. They are gone from disk but no git history records the change at the root level. This is by design — those files were never tracked by either subproject's git.

If you discover the root has its own git repo (e.g., `D:\RotaMestre\.git\` exists), surface that and treat the root-level deletions as a separate commit there.

---

## Task 11: Post-commit verification

**Files:** None modified.

- [ ] **Step 1: Confirm the commit landed**

Run:

```bash
cd D:/RotaMestre/rotamestre-app && git log -1 --stat
```

Expected: shows the new commit with the 5 bullets + summary. Stat lists `+`/`-` for `CLAUDE.md`, `.claude/refs/design-system.md`, four `design-system-*.md` deletions, and the plan file.

- [ ] **Step 2: Verify the disk reflects the intended end state**

Run:

```bash
ls D:/RotaMestre/.claude/ 2>&1
ls D:/RotaMestre/docs/ 2>&1
ls D:/RotaMestre/rotamestre-app/.claude/refs/ 2>&1
ls D:/RotaMestre/rotamestre-app/docs/ 2>&1
```

Expected:

- `D:/RotaMestre/.claude/`: only `settings.local.json` (and any per-user files that may exist)
- `D:/RotaMestre/docs/`: empty or has only unrelated files (no `brand-guidelines.md`)
- `D:/RotaMestre/rotamestre-app/.claude/refs/`: `design-system.md` only
- `D:/RotaMestre/rotamestre-app/docs/`: still has `TESTING.md`, `GOOGLE_PLAY_DEPLOYMENT.md`, `app-store-metadata.md`, `play-store-metadata.md`, `plans/`, `superpowers/` — NO `design-system-*.md`

- [ ] **Step 3: Measure the token-count win**

Run:

```bash
wc -l D:/RotaMestre/CLAUDE.md D:/RotaMestre/rotamestre-app/CLAUDE.md D:/RotaMestre/rotamestre-painel/CLAUDE.md D:/RotaMestre/rotamestre-app/.claude/refs/design-system.md
```

Expected: each within its target range (root ~50, app ~150, panel ~120, refs ~80). Sum of the three CLAUDE.md files: ≤ 400 lines. Original total was ~1,300 lines. Note the actual numbers in your handoff summary.

---

## Task 12: Cleanup backup

**Files:**

- Delete: `D:\RotaMestre\.docs-restructure-backup\`

- [ ] **Step 1: Verify the new docs are good before deleting backup**

If any verification step in Task 11 surfaced a regression, restore from the backup BEFORE running this task. The recovery procedure is:

```bash
cp D:/RotaMestre/.docs-restructure-backup/root-CLAUDE.md D:/RotaMestre/CLAUDE.md
cp D:/RotaMestre/.docs-restructure-backup/app-CLAUDE.md D:/RotaMestre/rotamestre-app/CLAUDE.md
cp D:/RotaMestre/.docs-restructure-backup/painel-CLAUDE.md D:/RotaMestre/rotamestre-painel/CLAUDE.md
# Then `git reset --hard HEAD~1` in rotamestre-app if the commit needs reversing.
```

- [ ] **Step 2: Remove the backup**

Run:

```bash
rm -rf D:/RotaMestre/.docs-restructure-backup
ls D:/RotaMestre/ 2>&1 | grep backup || echo "(backup removed)"
```

Expected: `(backup removed)`.

- [ ] **Step 3: (Optional) Push the commit**

Per project convention, push is opt-in. If the user explicitly asked for `git push`, run it. Otherwise, leave the commit local.

```bash
cd D:/RotaMestre/rotamestre-app && git status -sb
# Confirm "ahead of origin/main by 1 commit" or similar.
```

---

## Done criteria

All of the following must hold:

1. `D:\RotaMestre\CLAUDE.md` exists, ~50 lines, references both subprojects + cross-project rules + MCP server list.
2. `D:\RotaMestre\rotamestre-app\CLAUDE.md` exists, ~150 lines, references skills/agents/hook + `.claude/refs/design-system.md`.
3. `D:\RotaMestre\rotamestre-painel\CLAUDE.md` exists, ~120 lines, flags the SERVICE_ROLE_KEY caveat.
4. `D:\RotaMestre\rotamestre-app\.claude\refs\design-system.md` exists, ~80 lines, consolidates the 5 design files.
5. All deleted files in the plan are gone from disk.
6. `git log -1` in `rotamestre-app/` shows the `docs(claude): restructure for context efficiency` commit.
7. `npm run type-check` and `npm run lint` both exit 0 in the app.
8. No surviving references to deleted file paths (Task 7 Step 1 returns clean).
9. The local backup folder is removed (Task 12 Step 2).
