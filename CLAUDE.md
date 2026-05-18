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
