---
name: new-migration
description: Scaffold a new SQL migration file following the RotaMestre conventions (YYYYMMDDhhmmss prefix, RLS checklist, multi-unidade tenancy). Use when the user asks to create a migration, add a new table, alter a schema, change RLS policies, or "criar migration", "nova migration", "alterar schema". Handles the dual database/migrations + supabase/migrations directory layout.
---

# New Migration

## Convention

- **Filename:** `YYYYMMDDhhmmss_short_description.sql` (e.g., `20260315120000_add_motivo_skip.sql`)
  - Date-only prefix (`YYYYMMDD_*`) is allowed for older files but **new migrations should use the full timestamp** to avoid collisions when multiple migrations land on the same day.
  - `short_description` is `snake_case`, English or Portuguese, under ~40 chars.
- **Primary location:** `database/migrations/` (the canonical, hand-applied dir per `database/MIGRATIONS.md`)
- **Mirror to `supabase/migrations/`** _only_ if the migration is intended to be picked up by `npx supabase db push` / branch workflows. Most migrations live in `database/` only.

If unsure which directory, default to `database/migrations/` and ask the user before adding a copy to `supabase/migrations/`.

## Required checklist for every migration

Every new migration should be reviewed against these items before being saved:

### 1. Multi-tenant RLS (`unidade_id` scoping)

- If creating a new table that holds tenant data, it **must** have an `unidade_id uuid NOT NULL REFERENCES unidades(id)` column.
- Enable RLS: `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;`
- Add SELECT/INSERT/UPDATE/DELETE policies scoped via `get_user_unidade()` or `usuario_unidades` (multi-unidade users).
- Consider role-based policies: `gestor` (CRUD their unidade), `motorista` (SELECT routes assigned to them, UPDATE own paradas).
- Reference: existing patterns in `database/migrations/20251204000001_update_rls_multi_unidade.sql` and `20260208000000_fix_rls_multi_unidade.sql`.

### 2. Security definer functions

- Any `CREATE OR REPLACE FUNCTION` with `SECURITY DEFINER` **must** set `SET search_path = public` to avoid `function_search_path_mutable` warnings (see `20251022000000_fix_security_warnings.sql`).
- Views should **not** use `SECURITY DEFINER` — rely on the RLS of base tables (see Migration 3 in `MIGRATIONS.md`).

### 3. Foreign key indexes

- Postgres does not auto-index FKs. Add `CREATE INDEX IF NOT EXISTS idx_<table>_<column> ON <table>(<column>);` for any FK you add.
- Reference: `20251220_add_fk_indexes.sql`.

### 4. Triggers

- If you add a trigger that writes to `logs`, check `20251227000001_prevent_duplicate_logs.sql` first — there's a 5-second dedup guard.
- Drop any old version before recreating: `DROP TRIGGER IF EXISTS <name> ON <table>;`.

### 5. Realtime

- If the table needs realtime subscriptions, add it: `ALTER PUBLICATION supabase_realtime ADD TABLE <table>;`
- Reference: `20251220_enable_realtime.sql`, `20251221000004_enable_realtime_notificacoes.sql`.

### 6. Rollback notes

- At the bottom of the migration, add a `-- ROLLBACK:` comment block with the inverse SQL. Not executable; serves as documentation in case the migration causes problems in prod.

## Template

```sql
-- ============================================================================
-- Migration: <short description>
-- Date: YYYY-MM-DD
-- Author: <git user>
-- Purpose: <one-paragraph why>
-- ============================================================================

BEGIN;

-- 1. Schema changes
-- CREATE TABLE / ALTER TABLE / ALTER COLUMN ...

-- 2. Indexes (especially FKs)
-- CREATE INDEX IF NOT EXISTS ...

-- 3. RLS
-- ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY <name> ON <table> FOR SELECT USING (...);

-- 4. Functions / triggers
-- CREATE OR REPLACE FUNCTION ... SECURITY DEFINER SET search_path = public AS ...

-- 5. Realtime (if needed)
-- ALTER PUBLICATION supabase_realtime ADD TABLE <table>;

-- 6. Comments / documentation
-- COMMENT ON TABLE <table> IS '...';

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- -- inverse SQL here (DROP / ALTER ... DROP / etc.)
-- COMMIT;
```

## After the file is written

1. **Apply to remote DB.** The only database is **production** — there is no
   staging. Ask the user before applying, and never let a subagent write to the DB.
   - Preferred: `mcp__supabase__apply_migration`. Pass the SQL **without**
     `BEGIN`/`COMMIT` (the runner opens its own transaction). Note it records the
     migration under **its own timestamp**, not the filename's — see the drift
     section in `database/MIGRATIONS.md`.
   - `supabase db push` is only safe while the history has no pending files;
     run `npx supabase migration list` first and confirm nothing shows as local
     without a remote row.
   - Do **not** paste into the Dashboard SQL Editor: it applies the DDL without
     recording anything, which is what produced the historical drift.
   - (`tools/scripts/apply-migration.js` does not exist — ignore older references
     to it.)
2. **Update the hand-curated types.** Add the new fields to the relevant type in
   `src/types/` (e.g. `rota.ts`). **Do not** run `/regenerate-supabase-types`:
   `src/types/database.ts` does not exist and this project does not use generated
   types.
3. **Update `database/MIGRATIONS.md`.** Append an entry with the migration number, date, purpose, and status (✅/⏳).
4. **Verify in app:**
   - `npm run type-check`
   - `npm run lint`
   - Spot-check at least one affected query in `src/lib/` or `src/hooks/`.
5. **Commit** the SQL file, `MIGRATIONS.md` update, and any consumer code changes together.

## Pitfalls

- **Do not** commit a migration that hasn't been applied to the remote DB unless explicitly working on a feature branch with a separate DB.
- **Do not** mix DDL (schema changes) with DML (data backfill) in the same `BEGIN/COMMIT` without thinking about lock duration. Large data backfills on a hot table will block reads.
- **`spatial_ref_sys`** (PostGIS) is read-only — don't try to add RLS to it (see Migration 5 in `MIGRATIONS.md`).
- Beware of duplicate triggers — RotaMestre has been bitten by this twice (see Migrations 8 & 9).
