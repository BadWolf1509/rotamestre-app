# rotamestre-app

Mobile + web app for last-mile route optimization. Two user roles: **gestor** (manager — creates and assigns routes) and **motorista** (driver — executes routes with turn-by-turn nav and photo proof of delivery).

## Stack

- **Framework:** React Native + Expo + TypeScript; file-based routing via Expo Router.
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime). Client uses `ANON_KEY` and respects RLS. Service-role access lives in the panel project, never here.
- **Maps:** MapLibre GL (web + native) on OpenFreeMap / Carto tiles. **OSRM** for routing (free). **Address geocoding/autocomplete uses the Google Places API** via Supabase Edge Functions (`google-places-autocomplete`, `google-place-details`) — `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is **required** (~R$2.83 / 1000 sessions); Photon + ViaCEP are fallbacks. (A Google Distance Matrix path exists but is **disabled** — OSRM table service is used for the optimizer instead.)
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
│   ├── auth/             # Login, register, forgot/reset/confirm password
│   ├── gestor/           # Manager screens
│   └── motorista/        # Driver screens
├── src/
│   ├── components/       # Reusable UI (~400 files; feature-grouped + design-system base)
│   ├── hooks/            # Domain-organized (~190 files; auth/, gestao-rotas/, motorista/, etc.)
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

Tenant-scoped tables have an `unidade_id uuid` column. Users belong to one or many `unidades` via the `usuario_unidades` join table (enabled by `database/migrations/20251204000001_update_rls_multi_unidade.sql`). Policies scope reads/writes via `get_user_unidade()` (legacy single-unidade) or, preferred for new code, the multi-unidade helpers `get_my_unidade_ids()` (SETOF uuid, uses `auth.uid()`) / `usuario_unidades`. Storage (`storage.objects`) is now unidade-scoped too — see Fotos/Storage below.

Roles in `usuarios.papel`: `gestor` (CRUD their unidade), `motorista` (route assignment + own paradas). Admin actions happen in the panel project, never here.

## Required patterns

- **Logging:** `logger.warn(message, error)` (max 2 args). Critical catches: log + fallback. Non-critical catches: silent with an explaining comment. Tests spy on `logger.error/warn`, not `console`.
- **Forms:** always Zod schema + `useForm({ resolver: zodResolver(schema) })` + `Controller`. Inline field errors via `src/components/auth/FieldError.tsx` (raw inputs) or the design-system `Input` `error` prop; server/auth errors stay in `Dialog`/`useAlert`. Live examples: `src/components/gestor/nova-entrega/FormularioParada.tsx` and the four auth forms (`app/auth/{login,register,forgot-password,reset-password}.tsx`).
- **Queries:** prefer `useCachedData` / `useSupabaseQuery` hooks over raw `supabase.from(...).select(...)` in components. The cached layer implements SWR semantics.
- **Responsive:** always `useResponsive()` from `@/hooks/useResponsive`. Breakpoints: mobile <768, tablet 768–1023, desktop ≥1024.
- **ErrorBoundary:** every screen route under `app/` gets one (verifique com `grep -rl ErrorBoundary app/`).
- **Type safety:** no `as any` in production code (Unistyles web styles are the documented exception). Use `.returns<T>()` on Supabase queries when inference fails, with comments.
- **Async UX:** wrap async operations with `useToast.withToast()` — handles loading + success + error feedback in one call.
- **Fotos/Storage:** o bucket `fotos-entrega` é **privado** com **RLS por unidade** em `storage.objects` (C3 Fase 1+2, PRs #285/#294). **Nunca** renderize foto por URL pública — use `useSignedUrl(foto_url)` (`src/hooks/storage/useSignedUrl.ts`; resolve on-read com cache + dedupe, pass-through de URL externa). **Uploads persistem o `path`** (não a URL), no formato `{unidadeId}/{rotaId}/{paradaId}_{ts}.jpg` (entrega), `perfis/…`, `incidentes/…`. Helpers `getStoragePath` / `createSignedUrlForFoto` em `src/lib/storage.ts` aceitam URL legada **ou** path (sem backfill). Policy SELECT (`20260703120000_c3_fase2_…`): owner OU 1º segmento do path ∈ unidades ativas (`get_my_unidade_ids()`) OU perfil/incidente referenciado por linha visível — **invariante:** afrouxar o RLS de `usuarios`/`incidentes` afrouxa a leitura das fotos.

## Skills, agents, hook

Installed in `.claude/`:

- `/regenerate-supabase-types` (user-invoke) — after schema-changing migrations, regenerate types into `src/types/database.ts`.
- `/new-migration` (both Claude + user) — scaffold a SQL migration with RLS + SECURITY DEFINER + FK-index checklist.
- Agent `rls-policy-reviewer` — review migrations for multi-tenant security holes. Use BEFORE merging schema changes.
- Agent `migration-drift-auditor` — detect drift between `database/migrations/`, `supabase/migrations/`, `MIGRATIONS.md`, and the live DB.
- Hook `block-sensitive-files` (PreToolUse) — refuses edits to `.env*`, `*.keystore`, `eas.json`, `google-services.json`, `play-store-credentials.json`, and SSH keys.

## Phonebook

| Looking for                                | Where                                                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Current versions of any dep                | `package.json`                                                                                                          |
| Live DB schema / data                      | `mcp__rotamestre-db__*` or `mcp__supabase__list_tables` (verify project_ref first)                                      |
| Design system (colors, typography, tokens) | `.claude/refs/design-system.md`                                                                                         |
| Test commands, coverage, layout            | `docs/TESTING.md`                                                                                                       |
| Migration conventions + history            | `database/MIGRATIONS.md` (also see `/new-migration` skill)                                                              |
| Fluxo de recuperação de senha              | `docs/PASSWORD_RECOVERY.md`                                                                                             |
| Sentry configuration                       | `src/lib/sentry.ts`                                                                                                     |
| Supabase client setup                      | `src/lib/supabase.ts`                                                                                                   |
| Logger                                     | `src/lib/logger.ts`                                                                                                     |
| Auth form schemas + inline errors          | `src/lib/schemas/auth.ts` (login/register/forgot/reset) + `src/components/auth/FieldError.tsx`                          |
| Address geocoding/autocomplete             | `src/lib/geocoding.ts` (router) → `src/lib/googlePlaces.ts` (Google Places via Edge Fn); `src/lib/photon.ts` = fallback |
| Routing wrapper (OSRM)                     | `src/lib/google.ts` (legacy name; routing→OSRM, but its geocoding helpers still call Google)                            |
| Maps (web vs mobile)                       | `src/components/MapaWebMapLibre.tsx` / `src/components/MapaRN.tsx`                                                      |
| Camera/upload                              | `src/components/CameraUpload.tsx`                                                                                       |
| Fotos: signed URLs (bucket privado)        | `src/hooks/storage/useSignedUrl.ts` + `src/lib/storage.ts` (`getStoragePath`, `createSignedUrlForFoto`)                 |
| External nav apps (Waze, Google Maps)      | `src/lib/navigation.ts`                                                                                                 |
| Play Store deploy notes                    | `docs/GOOGLE_PLAY_DEPLOYMENT.md`                                                                                        |

## External services in use

- **Supabase** project `xezslsyxjivunmhhyxtd` — Postgres + Auth + Storage + Realtime. The one platform account never lost (data + backend live here).
- **App identity** (rebuilt 2026-06 after the original Firebase/Play/Expo accounts were lost — see memory + `docs/REBUILD_RELAUNCH_PLAN.md`): Android package **`br.tec.rotamestre.app`** · EAS project **`c6401a59-af97-484a-93b7-c75016bf331d`** (owner `@wellington.ribeiro.mkt`) · Firebase **`rota-mestre-97084`** (FCM push, validated end-to-end). All wired in `app.config.js`.
- **Sentry** — web production only; DSN via `EXPO_PUBLIC_SENTRY_DSN`.
- **Vercel** — auto-deploy on push to `main`; CSP whitelists Supabase, OSRM, Photon, OpenStreetMap tiles, Sentry.
- **EAS** — Android builds (production `.aab`; internal/preview `.apk` with install link/QR). Supabase env vars live **per-environment on EAS** (`eas env:*`), NOT in the repo — a local build without them falls back to `placeholder.supabase.co`. Submit ao Play via `eas submit -p android --profile internal` usa a service account em `play-store-credentials.json` (raiz, gitignored). Bump de versão obrigatório antes de cada build: `version` + `androidVersionCode` no `package.json` (fluxo completo em `docs/GOOGLE_PLAY_DEPLOYMENT.md`).
- **Asaas** — billing pending; `unidades.asaas_customer_id` is the join key when work begins.

---

**Last verified:** 2026-07-03 (Expo 56, RN 0.85.3, ~5747 tests / ~74% coverage; app nativo **v1.12.1 / versionCode 3020**. **C3 Fase 1+2 em produção** — bucket `fotos-entrega` privado + signed URLs + **RLS por unidade** em `storage.objects`, PRs #285/#294; build v1.12.1 submetido ao Play track internal via service account #295. Deps: `xlsx`→SheetJS CDN 0.20.3 + `supabase-js` 2.110, `npm audit` de produção sem high/critical #293; scroll-ao-marcador mobile + PhotoModal signed-URL fixes #292; senha exige minúscula #284; auth forms em `useForm`+`zodResolver` #281/#282; app rebuilt under new package/EAS/Firebase — see memory)
**Refresh checklist:** `grep -E '"(expo|react-native|@supabase|version|androidVersionCode)":' package.json` for version snapshot. Re-read `database/MIGRATIONS.md` after migrations land. Confirm Sentry DSN still set in Vercel env vars. Para release nativo (build/submit EAS→Play), ver `docs/GOOGLE_PLAY_DEPLOYMENT.md`.
