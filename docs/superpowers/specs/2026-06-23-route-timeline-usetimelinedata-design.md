# RouteTimeline → `useTimelineData` — Design

**Date:** 2026-06-23
**Branch:** `refactor/timeline-usetimelinedata`
**Roadmap item:** `improvements-roadmap-2026-06` — "RouteTimeline.tsx → extrair as queries cruas para um hook `useTimelineData` com `useCachedData` (muda comportamento → precisa teste de UI)."

## Problem

`src/components/RouteTimeline.tsx` does raw `supabase.from(...)`/`supabase.channel(...)` access inline, violating the CLAUDE.md required pattern ("prefer `useCachedData`/`useSupabaseQuery` over raw `supabase.from` in components"). Data access is tangled with three concerns sharing one `events` state — initial 3-query load, realtime subscription, pagination — plus view-derived fields (theme `color`, `isNew`, `isUnseen`) computed at fetch time.

Note: there are currently **zero** consumers of `useCachedData`/`useSupabaseQuery` in the repo. This refactor is the first real adoption and doubles as the reference example.

## Goal

Extract all Supabase access into a `useTimelineData` hook backed by `useCachedData`, drawing a clean **data vs view** boundary. **No behavior or visual change.** The component keeps look/flags; the hook owns data.

Non-goals: changing timeline behavior or appearance; touching `TimelineCollapsible`; mobile-vs-desktop differences (the timeline is shared). Adopting `useCachedData` elsewhere is out of scope.

## The boundary (already exists in code)

The codebase already has the exact seam:

- **Raw (hook):** `TimelineEventMapped` (`src/lib/timeline.ts`) — `id, type, timestamp, title, description, icon: string, colorKey, isCritical?, fullDescription?, hasPhoto?, photoUrl?`. No resolved color, no flags.
- **View (component):** `TimelineEvent` (`src/components/timeline/types.ts`) — adds `color: string`, `icon` as `keyof Ionicons.glyphMap`, `isNew?`, `isUnseen?`.

The hook returns `TimelineEventMapped[]`; the component maps raw → view (resolve `color` from `colorKey` via theme, derive `isNew`/`isUnseen`, group by date, animate, render). **No `supabase` import remains in `RouteTimeline.tsx`.**

## Hook interface

File: `src/hooks/gestao-rotas/useTimelineData.ts` (domain layout; export from `src/hooks/gestao-rotas/index.ts`).

```ts
interface UseTimelineDataResult {
  events: TimelineEventMapped[]; // raw, sorted desc by timestamp, deduped by id
  loading: boolean;
  isStale: boolean; // SWR cache-hit (from useCachedData)
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>; // reload page 1, reset pagination
}

function useTimelineData(
  rotaId: string,
  opts?: { realtime?: boolean }, // default true
): UseTimelineDataResult;
```

## Source of truth + caching

Built on `useCachedData<TimelineCachePayload>` where:

```ts
interface TimelineCachePayload {
  events: TimelineEventMapped[]; // raw only — NO color/isNew/isUnseen
  hasMore: boolean;
}
```

- **Key:** `` `timeline_${rotaId}` `` · **TTL:** `CACHE_TTL.SHORT` (1 min). Rationale: realtime surface; cache exists only to give an instant first paint when a route is reopened, after which the live subscription takes over.
- **Fetcher (page 1):** the 3 parallel queries (`logs` `.limit(PAGE_SIZE)`, `paradas` concluídas, `incidentes`), mapped via the existing `mapLogToTimelineEvent`/`mapParadaToTimelineEvent`/`mapIncidenteToTimelineEvent`, sorted desc → returns `{ events, hasMore: logsPage.length >= PAGE_SIZE }`.
- Caching **raw** events (no theme color, no `isNew`) avoids stale-color and meaningless-flag-on-cache-hit problems; the component re-derives view fields each render.
- `loadMore`: fetch next `logs` page via `.range(offset, offset+PAGE_SIZE-1)` (pagination is logs-only, as today), map, then `cached.update(prev => ({ events: dedupeSortDesc([...prev.events, ...next]), hasMore }))`; bump an internal `currentPageRef`. Guarded by a `loadingMore` state + early-return when `!hasMore`.
- `refresh`: reset `currentPageRef = 1`, then `cached.refresh()` (re-runs the page-1 fetcher, ignoring cache).

## Realtime (hook-owned)

When `opts.realtime` (default true), the hook subscribes to `` `route-timeline-${rotaId}` `` and tears down on unmount / `rotaId` change (same lifecycle as today):

- `logs` **INSERT** → map → `cached.update(prev => ({ events: dedupeSortDesc([mapped, ...prev.events]), hasMore: prev.hasMore }))`.
- `paradas` **UPDATE** / `incidentes` **\*** → `refresh()`.

This **preserves the current quirk**: a realtime reload from paradas/incidentes collapses already-loaded pages back to page 1 (today's `loadTimeline()` replaces `events` with the page-1 set). Not improving it here keeps the change behavior-neutral.

`useCachedData` already guards against concurrent fetches (`fetchingRef`), which subsumes the component's current `loadIdRef` race guard for the initial-load path.

## The `isNew` / animation subtlety (stays in the component)

Provenance matters and the events array alone can't express it:

- Realtime-arrived / initial-new events → `isNew = true` + `LayoutAnimation`.
- `loadMore`-appended (older) events → must **not** be flagged new (today `handleLoadMore` never sets `isNew`).

Mechanism: the component keeps `previousEventIds` (ref) + a `paginatingRef`. It sets `paginatingRef` around `loadMore()` so the resulting append is folded into `previousEventIds` **without** flagging/animating; any other change to the hook's `events` (realtime INSERT, refresh) flags only genuinely-new ids and triggers the animation. `isUnseen` continues to come from `useTimelineLastSeen` exactly as today.

This is the highest-regression-risk part of the change and gets a dedicated test.

## Testing strategy

**Component (`src/components/__tests__/RouteTimeline.test.tsx`):**

- Add `jest.mock('@/lib/cache', …)` returning an always-miss no-op (`getCache → null`, `setCache → noop`, `clearCache → noop`, plus `CACHE_TTL`). Reason: the cache's module-level memory `Map` would otherwise leak data across tests that share `rotaId="123"`. With the cache no-op'd, every test is a cache miss → fetch fresh → **the 5 existing assertions pass with only the mock added** (skeleton-on-load, events render, empty state, realtime subscribe / no-subscribe).
- **New:** a `loadMore`-appended (older) event is **not** rendered as `isNew` (the regression the boundary risks).

**Hook (`src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts`, new), via `renderHook` with mocked `@/lib/supabase` + `@/lib/cache`:**

- initial fetch maps + sorts desc + dedupes; `hasMore` reflects page size.
- cache-hit returns `isStale = true` then revalidates.
- `loadMore` appends older logs, dedupes, updates `hasMore`; no-op when `!hasMore`.
- realtime `logs` INSERT prepends + dedupes; `paradas`/`incidentes` change → triggers a refresh (page-1 reload).

## Success criteria

- No `supabase` import in `RouteTimeline.tsx`.
- All existing RouteTimeline tests green (assertions unchanged); new hook + flag tests green.
- `tsc` + lint clean; full suite green in CI.
- No visual/behavioral diff (visual-regression check stays green).
