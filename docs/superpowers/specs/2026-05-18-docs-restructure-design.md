# Documentation Restructure for Context Efficiency

**Date:** 2026-05-18
**Status:** Draft (awaiting user review)
**Owner:** Wellington (solo dev)

---

## Context

The RotaMestre monorepo accumulated ~2,000+ lines of Claude-facing documentation across `CLAUDE.md` (root + 2 subprojects) and `.claude/behavior.md` + `.claude/stack.md`. Audit findings:

1. **Heavy staleness.** Root CLAUDE.md claims "RN 0.81 / Expo 54 / Google Maps API" — actual stack is RN 0.83.1 / Expo 55 / MapLibre+OSRM+Photon. `behavior.md` claims "Manual testing only" — actual: 5,438 tests, ~74% coverage. `stack.md` says "Next.js 16.0.0" while panel CLAUDE.md says "14.2".
2. **Massive duplication.** Tech stack documented in 4 places. Database schema in 3. "When to Search the Web" in 2. "Git Workflow" in 2.
3. **Wrong-place content.** Business model/MRR pricing in CLAUDE.md (not coding-relevant). TS/React code examples in `behavior.md` (better in skills). Full DDL in `stack.md` (use `mcp__supabase__list_tables` live).
4. **Broken references.** Root CLAUDE.md cites `.claude/troubleshooting.md` (doesn't exist). Cites `docs/BRAND_GUIDELINES.md` — actual file is lowercase `docs/brand-guidelines.md`.
5. **Recent automation un-referenced.** The skills, agents, and hook committed in `71acf1e` aren't mentioned anywhere.

Result: Claude pays a token cost on every session for inaccurate, redundant context — and still has to re-verify everything against the code because the docs lie. This spec restructures the docs around three principles:

- **Lean auto-inject:** what's loaded in every session must be accurate, focused, and unique.
- **Live truth:** prefer querying the source (package.json, MCP, code) over duplicating into docs.
- **Single ownership:** each fact lives in exactly one file.

---

## Goals

1. Reduce auto-injected CLAUDE.md content from ~1,300 lines (across 3 files) to ~350 lines (~73% cut).
2. Eliminate inter-file duplication: each fact lives in exactly one place.
3. Zero stale facts at delivery (versions/stack/test counts/MCP names verified against live code).
4. Recently-added Claude Code infrastructure (skills, agents, hook) is discoverable from the project CLAUDE.md.
5. New convention: a `Last verified` footer on each CLAUDE.md as a low-cost anti-rot signal.

### Non-goals

- Anti-rot automation (skill `/audit-claude-md`, scheduled checks) — deferred.
- Touching user-level memory (`~/.claude/projects/.../memory/MEMORY.md`).
- Renaming or refactoring `rotamestre-app/docs/TESTING.md`, `GOOGLE_PLAY_DEPLOYMENT.md`, `app-store-metadata.md`, `play-store-metadata.md`, or `docs/plans/` — these are human-facing docs in good shape.
- Reorganizing skills/agents/hooks beyond referencing them. They were redesigned in commit `71acf1e`.
- Touching the panel project beyond rewriting its CLAUDE.md (panel has no `docs/`, no skills/agents yet).

---

## Final structure

### Deletions

| Path                                                               | Reason                                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `D:\RotaMestre\.claude\behavior.md`                                | 391 lines of mostly-stale rules + code examples; essentials absorbed into new CLAUDE.md |
| `D:\RotaMestre\.claude\stack.md`                                   | 449 lines of stack details + DDL; live truth via package.json + MCP                     |
| `D:\RotaMestre\.claude\md-files-analysis.json`                     | Orphan metadata file, no consumer found                                                 |
| `D:\RotaMestre\.claude\commands\` (empty dir)                      | Unused                                                                                  |
| `D:\RotaMestre\docs\brand-guidelines.md`                           | Content consolidated into `rotamestre-app/.claude/refs/design-system.md`                |
| `D:\RotaMestre\rotamestre-app\docs\design-system-accessibility.md` | Consolidated                                                                            |
| `D:\RotaMestre\rotamestre-app\docs\design-system-hex-report.md`    | Generated artifact, regenerable via `npm run report:hex`                                |
| `D:\RotaMestre\rotamestre-app\docs\design-system-release-notes.md` | Historical release notes; git log is canonical                                          |
| `D:\RotaMestre\rotamestre-app\docs\design-system-tokens.md`        | Consolidated                                                                            |

### New / rewritten files

| Path                                                         | Type         | Target lines |
| ------------------------------------------------------------ | ------------ | ------------ |
| `D:\RotaMestre\CLAUDE.md`                                    | Full rewrite | ~50          |
| `D:\RotaMestre\rotamestre-app\CLAUDE.md`                     | Full rewrite | ~150         |
| `D:\RotaMestre\rotamestre-painel\CLAUDE.md`                  | Full rewrite | ~150         |
| `D:\RotaMestre\rotamestre-app\.claude\refs\design-system.md` | New file     | ~80          |

### Untouched

- `D:\RotaMestre\rotamestre-app\.claude\skills\` (skills are stable)
- `D:\RotaMestre\rotamestre-app\.claude\agents\` (agents are stable)
- `D:\RotaMestre\rotamestre-app\.claude\hooks\` (hook is stable)
- `D:\RotaMestre\rotamestre-app\.claude\settings.json` (stable)
- `D:\RotaMestre\rotamestre-app\.claude\launch.json` (tracked, stable)
- `D:\RotaMestre\rotamestre-app\docs\TESTING.md` (current, accurate)
- `D:\RotaMestre\rotamestre-app\docs\GOOGLE_PLAY_DEPLOYMENT.md`
- `D:\RotaMestre\rotamestre-app\docs\app-store-metadata.md`
- `D:\RotaMestre\rotamestre-app\docs\play-store-metadata.md`
- `D:\RotaMestre\rotamestre-app\docs\plans\*` (active planning artifacts)
- `D:\RotaMestre\rotamestre-app\docs\superpowers\*` (untracked workspace + this spec)
- `D:\RotaMestre\rotamestre-app\database\MIGRATIONS.md` (referenced by `/new-migration` skill)
- All gitignored files (`.env`, `.claude/settings.local.json`, `.mcp.json`)

---

## Content allocation

### Root `CLAUDE.md` (~50 lines)

Sections (each ≤ 5 lines unless noted):

1. **What** — one-line description: "Multi-tenant SaaS for last-mile route optimization (franchise rental network)."
2. **Monorepo map** — fenced code block with tree showing `rotamestre-app/`, `rotamestre-painel/`, `tools/`, `docs/` with one-line purpose each.
3. **Working in a subproject** — pointer: "When working under `rotamestre-app/` or `rotamestre-painel/`, also read that project's CLAUDE.md."
4. **Cross-project rules** (the only behavior content here — applies to all 3 projects):
   - RLS: every tenant-scoped table filters by `unidade_id`. Never bypass without auditing.
   - Logging: use `logger` from `@/lib/logger`, never `console.*`.
   - Commits: conventional commits (`type(scope): description`); **never** auto-commit without explicit user request.
   - Verify before claiming: query/read/test before concluding.
5. **MCP servers available** — 3-line list of relevant servers (`rotamestre-db`, `rotamestre-git-app`, `rotamestre-fs-app`, `supabase` official, `sentry`, `playwright`, `context7`) — names only.
6. **Footer** — `Last verified: 2026-05-18` + 2-line refresh checklist.

### `rotamestre-app/CLAUDE.md` (~150 lines)

Sections:

1. **Purpose & users** — 3 lines: "Mobile + web app. Gestor creates routes; motorista executes them; routes optimized via OSRM."
2. **Stack** (no version numbers — version drift is the #1 source of staleness):
   - Framework: React Native + Expo + TypeScript (file-based routing via Expo Router)
   - Backend: Supabase (Postgres + Auth + Storage + Realtime); client uses ANON_KEY, respects RLS
   - Maps: MapLibre (web + native) + OpenFreeMap/Carto tiles + OSRM (routing) + Photon (geocoding) — all free
   - Forms: react-hook-form + Zod
   - Error tracking: Sentry (web production only)
   - Testing: Jest + Playwright (E2E) + custom visual regression
   - Deploy: Vercel (web), EAS (Android)
3. **Directory tree** — annotated code block, depth 2 (root + first level under `app/` and `src/`). Each line ends with one-clause purpose.
4. **Multi-tenancy & roles** — 5-line paragraph: gestor / motorista, RLS by `unidade_id`, `usuario_unidades` for multi-unit users, `auth.uid()` patterns.
5. **Required patterns** (the rules Claude must follow on every change):
   - Use `logger.warn(message, error)` (2-arg only). Tests spy on `logger.error/warn`.
   - Catches: critical use logger + fallback; non-critical silent with explaining comment.
   - Forms: Zod schema + react-hook-form + `zodResolver`.
   - Queries: prefer `useCachedData` / `useSupabaseQuery` hooks over raw `supabase.from(...).select(...)` in components.
   - Responsive: always use `useResponsive` from `@/hooks/useResponsive`.
   - ErrorBoundary: every screen route under `app/` gets one (27/27 currently covered).
   - TypeScript: no `as any` in production (Unistyles web styles are the documented exception).
6. **Skills, agents, hook** — bullet list with one-line trigger each:
   - `/regenerate-supabase-types` — after schema-changing migrations
   - `/new-migration` — scaffold SQL migration with RLS checklist
   - Agent `rls-policy-reviewer` — review migrations for tenant-security holes
   - Agent `migration-drift-auditor` — detect drift between dirs + live DB
   - PreToolUse hook — blocks edits to `.env`, keystores, `eas.json`, service accounts
7. **Where to find things** (the most-used pointers; treat as a phone-book):
   - Stack versions → `package.json`
   - Live DB schema → `mcp__supabase__list_tables` or `mcp__rotamestre-db__listar_*`
   - Design system → `.claude/refs/design-system.md`
   - Testing → `docs/TESTING.md`
   - Migrations → `database/MIGRATIONS.md` (use `/new-migration` skill)
   - Sentry config → `src/lib/sentry.ts`
   - Supabase client → `src/lib/supabase.ts`
   - Logger → `src/lib/logger.ts`
8. **External services in active use** — Sentry, Supabase, Vercel, EAS, Asaas (billing, pending integration). One line each with link target if useful.
9. **Footer** — `Last verified: 2026-05-18 (Expo 55, RN 0.83.1, 5438 tests passing)` + refresh checklist (3 lines).

### `rotamestre-painel/CLAUDE.md` (~150 lines)

Mirror of the app file with these differences:

- **Purpose:** internal admin panel for managing unidades, users, billing — not client-facing.
- **Stack:** Next.js App Router + Tailwind 4 + shadcn/ui + Radix UI.
- **CRITICAL section near top:** "Uses SERVICE_ROLE_KEY (bypasses RLS). Never expose to client-side. Validate `admin_role` in application logic."
- **Auth:** `admin_role` in `usuarios` table (`'admin'`, `'suporte'`, or null). `useAuth.ts` hook handles the gate.
- **Server vs Client Components:** default to server. `'use client'` only when needed (interactivity, hooks).
- **Audit logs mandatory:** every admin action writes to `admin_logs`. Pattern in `lib/services/admin-auth.ts` + the `logAdminAction` helper.
- **Rate limiting:** `lib/rate-limiter.ts` — in-memory MVP (Upgrade to Upstash Redis when scaling).
- **No skills/agents/hooks yet** — explicit note that this project hasn't been set up with `.claude/skills/` etc.; reference the app project as the model if/when you do.
- **Where to find** — same phonebook structure, painel paths.
- **Footer** — `Last verified: 2026-05-18 (Next.js + Tailwind 4)` + refresh checklist.

### `rotamestre-app/.claude/refs/design-system.md` (~80 lines)

Consolidates content from `docs/brand-guidelines.md` (root) + 4 `rotamestre-app/docs/design-system-*.md` files.

Sections:

1. **Brand colors** — primary/secondary/accent hex values + Unistyles token names.
2. **Typography** — Viga (headings), Nunito Sans (body); font weight rules.
3. **Spacing & breakpoints** — `spacing` token scale; mobile/tablet/desktop breakpoints + `useResponsive()` hook output.
4. **Accessibility rules** — WCAG 2.1 AA; minimum touch target, contrast ratios; existing patterns in `src/components/Skip*`.
5. **Component conventions** — when to use which base component (AppButton vs raw Pressable, AppCard vs raw View, etc.).
6. **Where tokens live** — `src/lib/design-tokens.ts` is canonical; `npm run build:tokens` regenerates.
7. **No release notes** — git log is canonical for design system changes (don't maintain a separate file).

---

## Migration plan (execution order)

1. **Rules audit (manual).** Read the 5 files being deleted/rewritten (`.claude/behavior.md`, `.claude/stack.md`, and the 3 old `CLAUDE.md`). List every rule/fact that won't appear in the new files. For each, decide: (a) absorb into new CLAUDE.md, (b) document in commit message as intentional removal, or (c) move to a skill/ref. Write findings into a working `audit.txt` (will be discarded after commit).
2. **External consumer check.** `git grep` (and search `tools/`, `scripts/`, `.github/workflows/`) for any reference to the files being deleted (`behavior.md`, `stack.md`, `brand-guidelines`, `md-files-analysis.json`, `troubleshooting.md`, `project-context.md`, the four `design-system-*.md`). Any match must be addressed before deletion.
3. **Snapshot deletions.** Capture content of the to-be-deleted files in a temporary backup (`.docs-restructure-backup/` at repo root, added to `.gitignore` only if needed; the backup is local-only and deleted after step 8). This is recovery insurance during the commit and immediately after.
4. **Write the new files** in this order (each step depends on the previous):
   - `rotamestre-app/.claude/refs/design-system.md` first (referenced by app CLAUDE.md)
   - `rotamestre-app/CLAUDE.md` next (referenced by root CLAUDE.md as the working doc)
   - `rotamestre-painel/CLAUDE.md` (also referenced by root CLAUDE.md)
   - `D:\RotaMestre\CLAUDE.md` last (points at the others; written when they exist)
5. **Re-verify cross-references in the new files.** `git grep` again across `D:\RotaMestre\` for the deleted paths. New CLAUDE.md files must not reference anything that's being deleted.
6. **Delete the deprecated files** (see Deletions table) using `git rm` so the deletions are staged.
7. **Run sanity checks:**
   - `cd rotamestre-app && npm run type-check` (catches any TSDoc/comment reference that breaks)
   - `git diff --stat` shows expected deltas (additions in new files, deletions in old)
   - Open a fresh Claude Code session in `rotamestre-app/` and confirm the new CLAUDE.md auto-injects cleanly (no errors, no missing-file warnings)
8. **Single commit** with message:

   ```
   docs(claude): restructure for context efficiency

   - Slim root CLAUDE.md to monorepo map + cross-project rules (~50 lines)
   - Rewrite app and panel CLAUDE.md with current stack and pointers
   - Consolidate 5 design-system docs into .claude/refs/design-system.md
   - Delete .claude/behavior.md, .claude/stack.md (stale + duplicated);
     content absorbed into CLAUDE.md or sourced live (package.json, MCP)
   - Reference the skills, agents, and hook committed in 71acf1e

   Cuts auto-injected docs from ~1,300 lines to ~350. No code changes.
   ```

9. **Delete the backup folder.** Once the commit is in and verified, `rm -rf .docs-restructure-backup/` (not a separate commit — local-only cleanup).

---

## Verification

After the commit:

1. **Static checks:** `git grep -i "behavior.md\|stack.md\|brand-guidelines\|project-context\|troubleshooting.md"` returns zero matches (or only known-fine matches like git log references).
2. **Auto-inject check:** open a fresh Claude Code conversation in `rotamestre-app/`. The system prompt should now show the new (small) CLAUDE.md files. Eyeball-confirm no broken references.
3. **Skill discoverability:** ask Claude "what skills are available for this project?" — it should mention `/regenerate-supabase-types`, `/new-migration` based on the new CLAUDE.md.
4. **Truth check:** ask Claude "what's the React Native version?" — it should know to check `package.json` (not assert from memory).
5. **Repo health:** `npm run type-check` and `npm run lint` both pass in `rotamestre-app/`.
6. **Token count:** measure new total auto-inject = sum of `wc -l` for root + app + painel CLAUDE.md. Target: ≤ 400 lines (was ~1,300). Capture in commit message body.

---

## Out of scope (deferred)

- Anti-rot automation (`/audit-claude-md` skill, scheduled drift checks) — defer until we see if the `Last verified` footer is enough.
- Adding skills/agents/hook to the panel project — separate exercise; the new CLAUDE.md will call this out as a known gap.
- User-level MEMORY.md cleanup — out of scope per user direction.
- Reorganizing `rotamestre-app/docs/` beyond the design-system consolidation (TESTING.md, deployment docs, plans, superpowers all stay).
- Changes to `database/MIGRATIONS.md` (sub-problem of the migration drift work, separate effort).

---

## Risks & mitigations

| Risk                                                                       | Mitigation                                                                                                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical rule gets lost in the cut                                         | Step 1 of the migration plan is the explicit rules audit. The `audit.txt` working file documents every omission and justification.                      |
| Future Claude sessions don't find context that used to be auto-injected    | The "Where to find things" phone-book in each project CLAUDE.md is the recovery path. If a fact gets asked about repeatedly, promote it back.           |
| New file gets out of date next month                                       | `Last verified` footer makes staleness visible. If experimental, schedule a re-audit in 90 days.                                                        |
| Some doc that _looks_ deletable is actually consumed by an external script | Pre-commit: `grep -r "behavior.md\|stack.md\|brand-guidelines"` over `tools/`, `scripts/`, `.github/workflows/`. If any match, address before deleting. |
