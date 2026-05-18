---
name: regenerate-supabase-types
description: Regenerate TypeScript types from the live Supabase schema into src/types/database.ts. Use after applying a migration in database/migrations/ or supabase/migrations/, when the Supabase schema diverges from the domain types in src/types/, or when adding a new table that the app needs to query. Triggers on requests like "atualizar tipos do supabase", "regerar types", "schema mudou".
disable-model-invocation: true
---

# Regenerate Supabase Types

## When to run

Run this skill after:

1. Applying a migration that adds/changes tables, columns, enums, RPC functions, or views.
2. Pulling changes from `main` that include migrations you didn't author.
3. Seeing `TS2353`/`TS2339` errors on Supabase query results that don't match the schema.

Do NOT run this if you only modified RLS policies, indexes, or triggers — those don't affect generated types.

## Project context

- **Project ID:** `xezslsyxjivunmhhyxtd`
- **Generated types target:** `src/types/database.ts` (this file is overwritten — do not hand-edit)
- **Domain types live alongside:** `src/types/rota.ts`, `src/types/usuario.ts`, etc. The generated types are the **raw** DB shape; domain types remain hand-curated and are the public API of `src/types/index.ts`.
- **Supabase client:** `src/lib/supabase.ts` — currently uses `createClient` without the `<Database>` generic. After the first run of this skill, optionally type the client.

## Command

The repo has `supabase` in `devDependencies`, so use npx (no global install needed):

```bash
npx supabase gen types typescript --project-id xezslsyxjivunmhhyxtd --schema public > src/types/database.ts
```

If you need types for `auth`, `storage`, or other schemas, append `--schema auth` etc. and merge into a single file.

**Login first if you haven't:** `npx supabase login` (one-time, opens browser).

## Workflow steps

1. **Confirm migrations are applied to the remote DB.** This skill reads the _live_ schema. If the migration was only added to `database/migrations/` but not yet executed via Supabase Dashboard / `apply-migration.js`, the types will be stale. Check `database/MIGRATIONS.md` for the canonical apply procedure.

2. **Run the gen command** (above). It overwrites `src/types/database.ts`.

3. **Diff the result.** `git diff src/types/database.ts` — look for:
   - New tables → the domain types in `src/types/<entity>.ts` may need new fields
   - Removed fields → consumers will break at the next `npm run type-check`
   - Enum changes → check string-literal unions in domain types (e.g., `StatusRota` in `src/types/rota.ts`)

4. **Reconcile domain types.** Generated DB types are _not_ what the app imports. The app imports from `src/types/index.ts`, which re-exports hand-curated domain types. Compare:
   - `Database['public']['Tables']['rotas']['Row']` (generated) vs `Rota` in `src/types/rota.ts` (domain)
   - If they diverge, update the domain type OR document why they intentionally differ (e.g., enriched with relations).

5. **Optionally type the client.** First time only — edit `src/lib/supabase.ts`:

   ```typescript
   import type { Database } from '@/types/database';
   supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
     /* ... */
   });
   ```

   Then `npm run type-check` to surface any latent mismatches.

6. **Verify.** Run:
   ```bash
   npm run type-check
   npm run lint
   ```
   Both must pass.

## Pitfalls

- **`pg_net` and PostGIS extension types** can show up in generated output as `unknown` — that's expected; don't try to "fix" them.
- The generated file is **large** (often 1000+ lines). Don't review it line by line; rely on `npm run type-check` to surface real breakage.
- If `npx supabase gen` fails with auth errors, run `npx supabase login` again. Tokens expire.
- Do not commit your Supabase access token. The CLI stores it in your home dir, not the repo.

## Verification

After running, the following must hold:

- `src/types/database.ts` exists and contains an exported `Database` type
- `npm run type-check` exits 0
- `npm run lint` exits 0
- Any change to `src/types/database.ts` is committed together with the migration SQL file
