# RouteTimeline → `useTimelineData` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract all Supabase access from `RouteTimeline.tsx` into a `useTimelineData` hook backed by `useCachedData`, with no behavior or visual change.

**Architecture:** The hook owns data (initial 3-query load via `useCachedData`, logs pagination, realtime subscription) and returns raw `TimelineEventMapped[]`. The component owns view derivation (theme `color`, `isNew`/`isUnseen` flags, grouping, `LayoutAnimation`) and rendering. The raw/view boundary already exists as two types: `TimelineEventMapped` (lib) and `TimelineEvent` (component).

**Tech Stack:** React Native + Expo, TypeScript, Supabase JS client, Jest + `@testing-library/react-native`, existing `useCachedData` SWR hook, `@/lib/cache`.

**Spec:** `docs/superpowers/specs/2026-06-23-route-timeline-usetimelinedata-design.md`

## Global Constraints

- Logging: `logger.error(message, error)` / `logger.warn(message, error)` — max 2 args (matches current RouteTimeline usage).
- No `as any` in production code (test files may use it; the existing tests already do).
- Hooks live under domain folders: this hook goes in `src/hooks/gestao-rotas/` and is re-exported from `src/hooks/gestao-rotas/index.ts` (`export { X } from "./X"` style).
- Test imports: `import { renderHook, act, render, waitFor } from '@testing-library/react-native'`.
- `PAGE_SIZE` is `50`, imported from `@/components/timeline/types`.
- Pagination is **logs-only** (paradas/incidentes are fully loaded on page 1) — preserve exactly.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. A pre-commit hook runs prettier on staged files — expect reformatting.
- Branch: `refactor/timeline-usetimelinedata` (already created off `main`).

## File Structure

- `src/lib/timeline.ts` — **modify:** add pure helper `computeNewlyAddedIds`.
- `src/lib/__tests__/timeline.test.ts` — **modify:** test the helper.
- `src/hooks/gestao-rotas/useTimelineData.ts` — **create:** the hook.
- `src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts` — **create:** hook tests.
- `src/hooks/gestao-rotas/index.ts` — **modify:** re-export the hook + its result type.
- `src/components/RouteTimeline.tsx` — **modify:** consume the hook; remove all `supabase` access; derive view events.
- `src/components/__tests__/RouteTimeline.test.tsx` — **modify:** mock `@/lib/cache` (always-miss); assertions unchanged.

---

### Task 1: Pure helper `computeNewlyAddedIds`

This encodes the highest-risk rule: which ids are "newly added" for the `isNew` flag + entrance animation. Initial population and pagination appends must return **empty** (nothing flagged new); only genuinely-new ids from a realtime insert / refresh count.

**Files:**

- Modify: `src/lib/timeline.ts` (append at end)
- Test: `src/lib/__tests__/timeline.test.ts`

**Interfaces:**

- Produces: `computeNewlyAddedIds(currentIds: string[], previousIds: Set<string>, isPagination: boolean): Set<string>`

- [ ] **Step 1: Write the failing test** — append to `src/lib/__tests__/timeline.test.ts`

```ts
import { computeNewlyAddedIds } from '../timeline';

describe('computeNewlyAddedIds', () => {
  it('retorna vazio na carga inicial (previousIds vazio)', () => {
    const result = computeNewlyAddedIds(['a', 'b', 'c'], new Set(), false);
    expect(result.size).toBe(0);
  });

  it('retorna apenas ids novos quando já havia eventos', () => {
    const result = computeNewlyAddedIds(
      ['c', 'a', 'b'],
      new Set(['a', 'b']),
      false,
    );
    expect([...result]).toEqual(['c']);
  });

  it('retorna vazio quando a mudança é paginação (eventos antigos anexados)', () => {
    const result = computeNewlyAddedIds(
      ['a', 'b', 'old1'],
      new Set(['a', 'b']),
      true,
    );
    expect(result.size).toBe(0);
  });

  it('retorna vazio quando nada mudou', () => {
    const result = computeNewlyAddedIds(['a', 'b'], new Set(['a', 'b']), false);
    expect(result.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/timeline.test.ts -t computeNewlyAddedIds`
Expected: FAIL — `computeNewlyAddedIds is not a function` (or import error).

- [ ] **Step 3: Write minimal implementation** — append to `src/lib/timeline.ts`

```ts
// ============================================================================
// VIEW HELPERS (for RouteTimeline isNew derivation)
// ============================================================================

/**
 * Determina quais ids são "recém-adicionados" para fins de flag isNew + animação.
 * - Carga inicial (previousIds vazio) → vazio (nada é "novo").
 * - Paginação (isPagination) → vazio (eventos antigos anexados não são novos).
 * - Caso contrário → ids presentes agora e ausentes antes.
 */
export function computeNewlyAddedIds(
  currentIds: string[],
  previousIds: Set<string>,
  isPagination: boolean,
): Set<string> {
  if (isPagination || previousIds.size === 0) {
    return new Set();
  }
  return new Set(currentIds.filter((id) => !previousIds.has(id)));
}
```

Then re-export it from `@/lib/utils` (a **selective** re-export, so new symbols must be added explicitly) so the component imports it consistently with the other timeline functions. In `src/lib/utils.ts`, add `computeNewlyAddedIds,` to the `// Functions` group of the named re-export from `./timeline` (alongside `getDateGroup`, `calculateDurationBetween`):

```ts
  // Functions
  isTimelineLogEvent,
  mapLogToTimelinePreview,
  mapLogToTimelineEvent,
  mapParadaToTimelineEvent,
  mapIncidenteToTimelineEvent,
  formatRelativeTime,
  getDateGroup,
  calculateDurationBetween,
  computeNewlyAddedIds,
} from './timeline';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/timeline.test.ts -t computeNewlyAddedIds`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline.ts src/lib/utils.ts src/lib/__tests__/timeline.test.ts
git commit -m "$(cat <<'EOF'
feat(timeline): helper puro computeNewlyAddedIds para flag isNew

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `useTimelineData` — initial load (useCachedData) + barrel export

**Files:**

- Create: `src/hooks/gestao-rotas/useTimelineData.ts`
- Modify: `src/hooks/gestao-rotas/index.ts`
- Test: `src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts`

**Interfaces:**

- Consumes: `useCachedData` (`@/hooks/useCachedData`), `CACHE_TTL` (`@/lib/cache`), the three mappers + `TimelineEventMapped` (`@/lib/timeline`), `PAGE_SIZE` (`@/components/timeline/types`), `supabase`, `logger`.
- Produces:

  ```ts
  interface UseTimelineDataResult {
    events: TimelineEventMapped[];
    loading: boolean;
    isStale: boolean;
    hasMore: boolean;
    loadingMore: boolean;
    loadMore: () => Promise<void>;
    refresh: () => Promise<void>;
  }
  function useTimelineData(
    rotaId: string,
    opts?: { realtime?: boolean },
  ): UseTimelineDataResult;
  ```

- [ ] **Step 1: Write the failing test** — create `src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts`

```ts
import { renderHook, waitFor } from '@testing-library/react-native';

import { supabase } from '@/lib/supabase';

import { useTimelineData } from '../useTimelineData';

jest.mock('@/lib/cache', () => ({
  getCache: jest.fn(async () => null),
  setCache: jest.fn(async () => {}),
  clearCache: jest.fn(async () => {}),
  CACHE_TTL: { SHORT: 60000, USER_DATA: 300000 },
}));

jest.mock('@/lib/utils', () => ({
  mapLogToTimelineEvent: (log: any) =>
    log.evento === 'skip'
      ? null
      : {
          id: `log-${log.id}`,
          type: 'status_change',
          timestamp: log.timestamp,
          title: 'L',
          description: '',
          icon: 'flag',
          colorKey: 'info',
        },
  mapParadaToTimelineEvent: (p: any) => ({
    id: `parada-${p.id}`,
    type: 'parada_update',
    timestamp: p.concluida_em,
    title: 'P',
    description: '',
    icon: 'location',
    colorKey: 'success',
  }),
  mapIncidenteToTimelineEvent: (i: any) => ({
    id: `incidente-${i.id}`,
    type: 'incidente',
    timestamp: i.created_at,
    title: 'I',
    description: '',
    icon: 'alert-circle',
    colorKey: 'error',
    isCritical: true,
  }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn(),
    removeChannel: jest.fn(),
    from: jest.fn(),
  },
}));

const chain = (resolveData: any[]) => {
  const m: any = {};
  m.select = jest.fn(() => m);
  m.eq = jest.fn(() => m);
  m.order = jest.fn(() => m);
  m.not = jest.fn(() => m);
  m.limit = jest.fn(() => Promise.resolve({ data: resolveData, error: null }));
  m.range = jest.fn(() => Promise.resolve({ data: [], error: null }));
  m.then = (resolve: any) =>
    Promise.resolve({ data: resolveData, error: null }).then(resolve);
  return m;
};

beforeEach(() => {
  jest.clearAllMocks();
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table === 'logs')
      return chain([
        { id: '1', evento: 'x', timestamp: '2023-01-01T10:00:00Z' },
      ]);
    if (table === 'paradas') {
      const m = chain([]);
      m.not = jest.fn(() =>
        Promise.resolve({
          data: [{ id: 'p1', concluida_em: '2023-01-01T10:30:00Z' }],
          error: null,
        }),
      );
      return m;
    }
    if (table === 'incidentes') {
      const m = chain([]);
      m.eq = jest.fn(() =>
        Promise.resolve({
          data: [{ id: 'i1', created_at: '2023-01-01T10:15:00Z' }],
          error: null,
        }),
      );
      return m;
    }
    return chain([]);
  });
});

describe('useTimelineData — carga inicial', () => {
  it('busca, mapeia e ordena desc por timestamp', async () => {
    const { result } = renderHook(() =>
      useTimelineData('123', { realtime: false }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.events.map((e) => e.id)).toEqual([
      'parada-p1', // 10:30
      'incidente-i1', // 10:15
      'log-1', // 10:00
    ]);
    expect(result.current.hasMore).toBe(false); // 1 log < PAGE_SIZE
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts`
Expected: FAIL — cannot find module `../useTimelineData`.

- [ ] **Step 3: Write minimal implementation** — create `src/hooks/gestao-rotas/useTimelineData.ts`

```ts
/**
 * useTimelineData — dados da timeline da rota (carga inicial + paginação + realtime).
 *
 * Dono dos dados: encapsula todo acesso ao Supabase e devolve eventos CRUS
 * (TimelineEventMapped, sem cor/isNew/isUnseen). O componente deriva a view.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { PAGE_SIZE } from '@/components/timeline/types';
import { useCachedData } from '@/hooks/useCachedData';
import { CACHE_TTL } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import {
  mapLogToTimelineEvent,
  mapParadaToTimelineEvent,
  mapIncidenteToTimelineEvent,
  type TimelineEventMapped,
} from '@/lib/utils';

interface TimelineCachePayload {
  events: TimelineEventMapped[];
  hasMore: boolean;
}

export interface UseTimelineDataResult {
  events: TimelineEventMapped[];
  loading: boolean;
  isStale: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

const EMPTY_EVENTS: TimelineEventMapped[] = [];

function sortDesc(events: TimelineEventMapped[]): TimelineEventMapped[] {
  return [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

function dedupeById(events: TimelineEventMapped[]): TimelineEventMapped[] {
  const seen = new Set<string>();
  const out: TimelineEventMapped[] = [];
  for (const e of events) {
    if (!seen.has(e.id)) {
      seen.add(e.id);
      out.push(e);
    }
  }
  return out;
}

async function fetchTimelinePage1(
  rotaId: string,
): Promise<TimelineCachePayload> {
  const [logsRes, paradasRes, incidentesRes] = await Promise.all([
    supabase
      .from('logs')
      .select('id, evento, timestamp, detalhes')
      .eq('rota_id', rotaId)
      .order('timestamp', { ascending: false })
      .limit(PAGE_SIZE),
    supabase
      .from('paradas')
      .select(
        'id, ordem, endereco, status, concluida_em, is_checkpoint, foto_url',
      )
      .eq('rota_id', rotaId)
      .not('concluida_em', 'is', null),
    supabase
      .from('incidentes')
      .select('id, categoria, descricao, created_at, foto_url')
      .eq('rota_id', rotaId),
  ]);

  if (logsRes.error)
    logger.error('[useTimelineData] Erro ao buscar logs:', logsRes.error);
  if (paradasRes.error)
    logger.error('[useTimelineData] Erro ao buscar paradas:', paradasRes.error);
  if (incidentesRes.error)
    logger.error(
      '[useTimelineData] Erro ao buscar incidentes:',
      incidentesRes.error,
    );

  const events: TimelineEventMapped[] = [];
  logsRes.data?.forEach((log: any) => {
    const mapped = mapLogToTimelineEvent(log);
    if (mapped) events.push(mapped);
  });
  paradasRes.data?.forEach((parada: any) => {
    const mapped = mapParadaToTimelineEvent(parada);
    if (mapped) events.push(mapped);
  });
  incidentesRes.data?.forEach((incidente: any) => {
    events.push(mapIncidenteToTimelineEvent(incidente));
  });

  return {
    events: dedupeById(sortDesc(events)),
    hasMore: (logsRes.data?.length || 0) >= PAGE_SIZE,
  };
}

export function useTimelineData(
  rotaId: string,
  opts: { realtime?: boolean } = {},
): UseTimelineDataResult {
  const { realtime = true } = opts;

  const fetcher = useCallback(() => fetchTimelinePage1(rotaId), [rotaId]);

  const {
    data,
    loading,
    isStale,
    update,
    refresh: cachedRefresh,
  } = useCachedData<TimelineCachePayload>(`timeline_${rotaId}`, fetcher, {
    ttl: CACHE_TTL.SHORT,
  });

  // update() identity muda quando data muda — usar ref para handlers estáveis.
  const updateRef = useRef(update);
  useEffect(() => {
    updateRef.current = update;
  }, [update]);

  const [loadingMore, setLoadingMore] = useState(false);
  const currentPageRef = useRef(1);

  // Reset de paginação ao trocar de rota.
  useEffect(() => {
    currentPageRef.current = 1;
  }, [rotaId]);

  const events = data?.events ?? EMPTY_EVENTS;
  const hasMore = data?.hasMore ?? false;

  const refresh = useCallback(async () => {
    currentPageRef.current = 1;
    await cachedRefresh();
  }, [cachedRefresh]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const offset = currentPageRef.current * PAGE_SIZE;
      const { data: logsRes } = await supabase
        .from('logs')
        .select('id, evento, timestamp, detalhes')
        .eq('rota_id', rotaId)
        .order('timestamp', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      const page = logsRes ?? [];
      const mapped: TimelineEventMapped[] = [];
      page.forEach((log: any) => {
        const m = mapLogToTimelineEvent(log);
        if (m) mapped.push(m);
      });

      currentPageRef.current += 1;
      await updateRef.current((prev) => ({
        events: dedupeById(sortDesc([...(prev?.events ?? []), ...mapped])),
        hasMore: page.length >= PAGE_SIZE,
      }));
    } catch (error) {
      logger.error('[useTimelineData] Erro ao carregar mais eventos:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, rotaId]);

  // Realtime — placeholder até Task 4 (mantém assinatura estável).
  useEffect(() => {
    if (!realtime) return;
    // implementado na Task 4
    return;
  }, [realtime, rotaId]);

  return { events, loading, isStale, hasMore, loadingMore, loadMore, refresh };
}
```

> Note: the hook imports the mappers + `TimelineEventMapped` from `@/lib/utils` (which re-exports `@/lib/timeline` — confirm `mapLogToTimelineEvent` and `TimelineEventMapped` are exported from `@/lib/utils`; the current `RouteTimeline.tsx` imports them from `@/lib/utils`, so use the same path for consistency). `computeNewlyAddedIds` (Task 1) is consumed by the component, not the hook.

- [ ] **Step 4: Add barrel export** — in `src/hooks/gestao-rotas/index.ts`, add after the other `export {…} from` lines:

```ts
export { useTimelineData } from './useTimelineData';
export type { UseTimelineDataResult } from './useTimelineData';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts`
Expected: PASS (1 test). If timestamps sort wrong, verify the mock data timestamps.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/gestao-rotas/useTimelineData.ts src/hooks/gestao-rotas/index.ts src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts
git commit -m "$(cat <<'EOF'
feat(timeline): useTimelineData com carga inicial via useCachedData

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `useTimelineData` — `loadMore` pagination

**Files:**

- Modify: `src/hooks/gestao-rotas/useTimelineData.ts` (loadMore already written in Task 2; this task adds its test and verifies)
- Test: `src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts`

**Interfaces:**

- Consumes: `loadMore`, `events`, `hasMore`, `loadingMore` from Task 2.

- [ ] **Step 1: Write the failing test** — add a `describe` block to the hook test. First make page 1 report `hasMore` by returning a full page of logs. Add this test-local helper + case:

```ts
describe('useTimelineData — loadMore', () => {
  it('anexa logs antigos, deduplica e atualiza hasMore', async () => {
    const fullPage = Array.from({ length: 50 }, (_, i) => ({
      id: `${i}`,
      evento: 'x',
      timestamp: `2023-01-02T${String(i % 24).padStart(2, '0')}:00:00Z`,
    }));
    const olderPage = [
      { id: 'old', evento: 'x', timestamp: '2022-12-01T10:00:00Z' },
    ];

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'logs') {
        const m = chain(fullPage); // page 1 via limit()
        m.range = jest.fn(() =>
          Promise.resolve({ data: olderPage, error: null }),
        ); // page 2 via range()
        return m;
      }
      if (table === 'paradas') {
        const m = chain([]);
        m.not = jest.fn(() => Promise.resolve({ data: [], error: null }));
        return m;
      }
      if (table === 'incidentes') {
        const m = chain([]);
        m.eq = jest.fn(() => Promise.resolve({ data: [], error: null }));
        return m;
      }
      return chain([]);
    });

    const { result } = renderHook(() =>
      useTimelineData('123', { realtime: false }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasMore).toBe(true); // 50 logs == PAGE_SIZE
    const countBefore = result.current.events.length;

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.events.some((e) => e.id === 'log-old')).toBe(true);
    expect(result.current.events.length).toBe(countBefore + 1);
    expect(result.current.hasMore).toBe(false); // older page had 1 < PAGE_SIZE
  });

  it('loadMore é no-op quando hasMore é false', async () => {
    const { result } = renderHook(() =>
      useTimelineData('123', { realtime: false }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasMore).toBe(false);
    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.loadingMore).toBe(false);
  });
});
```

Add `act` to the import: `import { renderHook, act, waitFor } from '@testing-library/react-native';`

- [ ] **Step 2: Run test to verify behavior**

Run: `npx jest src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts -t loadMore`
Expected: PASS (the loadMore implementation already exists from Task 2). If it FAILS, fix `loadMore` in `useTimelineData.ts` until green — do not change the test.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts src/hooks/gestao-rotas/useTimelineData.ts
git commit -m "$(cat <<'EOF'
test(timeline): cobre loadMore (paginação logs) do useTimelineData

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `useTimelineData` — realtime subscription

**Files:**

- Modify: `src/hooks/gestao-rotas/useTimelineData.ts` (replace the Task-2 placeholder realtime effect)
- Test: `src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts`

**Interfaces:**

- Consumes: `updateRef`, `refresh`, `rotaId`, `realtime` from Task 2.

- [ ] **Step 1: Write the failing test** — add to the hook test file. Capture the realtime handlers registered via `.on()`:

```ts
describe('useTimelineData — realtime', () => {
  it('assina o canal quando realtime=true e remove no unmount', async () => {
    const { unmount } = renderHook(() =>
      useTimelineData('123', { realtime: true }),
    );
    await waitFor(() =>
      expect(supabase.channel).toHaveBeenCalledWith('route-timeline-123'),
    );
    expect((supabase.channel('') as any).subscribe).toHaveBeenCalled();
    unmount();
    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  it('NÃO assina quando realtime=false', async () => {
    renderHook(() => useTimelineData('123', { realtime: false }));
    await waitFor(() => {});
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('insere no topo ao receber INSERT de log via realtime', async () => {
    const handlers: Record<string, (payload: any) => void> = {};
    (supabase.on as jest.Mock).mockImplementation(
      (_evt: string, cfg: any, cb: (p: any) => void) => {
        if (cfg.table === 'logs') handlers.logInsert = cb;
        return supabase;
      },
    );

    const { result } = renderHook(() =>
      useTimelineData('123', { realtime: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = result.current.events.length;

    await act(async () => {
      handlers.logInsert({
        new: { id: '999', evento: 'x', timestamp: '2099-01-01T00:00:00Z' },
      });
    });

    expect(result.current.events[0].id).toBe('log-999');
    expect(result.current.events.length).toBe(before + 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts -t realtime`
Expected: FAIL — channel not created (placeholder effect does nothing).

- [ ] **Step 3: Implement the realtime effect** — in `src/hooks/gestao-rotas/useTimelineData.ts`, replace the placeholder effect with:

```ts
// Realtime: hook é dono do canal.
useEffect(() => {
  if (!realtime) return;
  const channel = supabase
    .channel(`route-timeline-${rotaId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'logs',
        filter: `rota_id=eq.${rotaId}`,
      },
      (payload: any) => {
        const mapped = mapLogToTimelineEvent(payload.new);
        if (!mapped) return;
        updateRef.current((prev) => ({
          events: dedupeById(sortDesc([mapped, ...(prev?.events ?? [])])),
          hasMore: prev?.hasMore ?? false,
        }));
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'paradas',
        filter: `rota_id=eq.${rotaId}`,
      },
      () => {
        void refresh();
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'incidentes',
        filter: `rota_id=eq.${rotaId}`,
      },
      () => {
        void refresh();
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}, [rotaId, realtime, refresh]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts`
Expected: PASS (all hook tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/gestao-rotas/useTimelineData.ts src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts
git commit -m "$(cat <<'EOF'
feat(timeline): subscription realtime dentro do useTimelineData

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Refactor `RouteTimeline.tsx` to consume the hook

Remove all `supabase` access and the manual `events`/load/realtime/pagination state. Consume `useTimelineData`; derive `TimelineEvent[]` (view) from the raw events using theme color + `computeNewlyAddedIds` + `useTimelineLastSeen`.

**Files:**

- Modify: `src/components/RouteTimeline.tsx`
- Modify: `src/components/__tests__/RouteTimeline.test.tsx`

**Interfaces:**

- Consumes: `useTimelineData` (`@/hooks/gestao-rotas`), `computeNewlyAddedIds` (`@/lib/utils`), existing `useTimelineLastSeen`, `createColorResolver` (already in the file).

- [ ] **Step 1: Add an always-miss cache mock to the component test** — in `src/components/__tests__/RouteTimeline.test.tsx`, add near the other `jest.mock` calls:

```ts
jest.mock('@/lib/cache', () => ({
  getCache: jest.fn(async () => null),
  setCache: jest.fn(async () => {}),
  clearCache: jest.fn(async () => {}),
  CACHE_TTL: { SHORT: 60000, USER_DATA: 300000 },
}));
```

Also add `computeNewlyAddedIds` to the existing `jest.mock('@/lib/utils', …)` factory:

```ts
    computeNewlyAddedIds: (currentIds: string[], previousIds: Set<string>, isPagination: boolean) =>
      isPagination || previousIds.size === 0
        ? new Set()
        : new Set(currentIds.filter((id) => !previousIds.has(id))),
```

- [ ] **Step 2: Run the existing tests against the (still old) component to confirm the mocks are harmless**

Run: `npx jest src/components/__tests__/RouteTimeline.test.tsx`
Expected: PASS (5 tests) — the cache mock + extra util are inert until the component changes.

- [ ] **Step 3: Refactor the component — replace imports**

In `src/components/RouteTimeline.tsx`:

- Remove `import { supabase } from '@/lib/supabase';`
- Change the `@/lib/utils` import to add `computeNewlyAddedIds`:

```ts
import {
  getDateGroup,
  groupBy,
  mapLogToTimelineEvent,
  mapParadaToTimelineEvent,
  mapIncidenteToTimelineEvent,
  computeNewlyAddedIds,
  type TimelineSemanticColor,
} from '@/lib/utils';
```

(The three mappers are no longer used directly — remove the unused ones; keep only what the component still references. After the refactor the component uses none of the mappers, so remove `mapLogToTimelineEvent`/`mapParadaToTimelineEvent`/`mapIncidenteToTimelineEvent`. Keep `getDateGroup`, `groupBy`, `computeNewlyAddedIds`, `TimelineSemanticColor`.)

- Add: `import { useTimelineData } from '@/hooks/gestao-rotas';`

- [ ] **Step 4: Refactor the component — replace data state with the hook**

Replace the state block + `loadTimeline` + the load `useEffect` + the realtime `useEffect` + `handleLoadMore` (current lines ~98–320) with the hook call and view derivation. The new body section:

```ts
// Dados (hook é dono): carga inicial + paginação + realtime.
const {
  events: rawEvents,
  loading,
  hasMore,
  loadingMore,
  loadMore,
  refresh,
} = useTimelineData(rotaId, { realtime });

const [refreshing, setRefreshing] = useState(false);
const [activeFilter, setActiveFilter] = useState<FilterType>(defaultFilter);
const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
const [newIds, setNewIds] = useState<Set<string>>(new Set());

const {
  isNewEvent: isUnseenEvent,
  markAllAsSeen,
  loading: lastSeenLoading,
} = useTimelineLastSeen(rotaId, rotaCreatedAt);

const previousEventIds = useRef<Set<string>>(new Set());
const paginatingRef = useRef(false);
const pulseAnim = useRef(new Animated.Value(1)).current;
const hasMarkedAsSeen = useRef(false);

const getColor = useMemo(() => createColorResolver(theme), [theme]);

// isNew + animação: deriva quais ids são recém-adicionados a cada mudança.
useEffect(() => {
  const currentIds = rawEvents.map((e) => e.id);
  const added = computeNewlyAddedIds(
    currentIds,
    previousEventIds.current,
    paginatingRef.current,
  );
  if (added.size > 0) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }
  setNewIds(added);
  previousEventIds.current = new Set(currentIds);
  paginatingRef.current = false;
}, [rawEvents]);

// Eventos de view: aplica cor + isNew + isUnseen sobre os eventos crus.
const events = useMemo<TimelineEvent[]>(() => {
  const showUnseen = enableUnseenBadge && !lastSeenLoading;
  return rawEvents.map((e) => ({
    ...e,
    icon: e.icon as keyof typeof Ionicons.glyphMap,
    color: getColor(e.colorKey),
    isNew: newIds.has(e.id),
    isUnseen: showUnseen ? isUnseenEvent(e.timestamp) : false,
  }));
}, [
  rawEvents,
  getColor,
  newIds,
  enableUnseenBadge,
  lastSeenLoading,
  isUnseenEvent,
]);

const hasCriticalEvents = useMemo(
  () => events.some((e) => e.isCritical),
  [events],
);
```

Then update the handlers:

```ts
const handleRefresh = useCallback(async () => {
  setRefreshing(true);
  try {
    await refresh();
  } finally {
    setRefreshing(false);
  }
}, [refresh]);

const handleLoadMore = useCallback(async () => {
  paginatingRef.current = true;
  await loadMore();
}, [loadMore]);
```

Keep unchanged: `createColorResolver`, the pulse animation effect (now keyed on `hasCriticalEvents`/`pulseAnim`), `toggleExpanded`, `filteredEvents`, `groupedEvents`, `filterCounts`, `flatListData`, `keyExtractor`, `renderItem`, `getItemType`, the `onStateChange` effect, the `onUnseenCountChange` effect, the "mark as seen after delay" effect, and the entire render (skeleton / empty / FlashList). The `markAllAsSeen` effect and unseen-count effect already read `events`/`loading`/`lastSeenLoading`, which still exist.

Remove now-dead refs/vars: `loadIdRef`, `hasUpdatedUnseenRef`, `getColorRef`, `currentPage`, `setHasMore`, `setLoadingMore`, `setEvents`, `setLoading`, and the standalone "Atualizar isUnseen quando lastSeen carregar" effect (its job is now folded into the `events` useMemo). Delete the `hasUpdatedUnseenRef = false` reset effect. Verify no remaining reference to a removed symbol (tsc will catch).

- [ ] **Step 5: Run tsc + lint to catch removed-symbol references**

Run: `npx tsc --noEmit` and `npx eslint src/components/RouteTimeline.tsx`
Expected: no errors. Fix any dangling references to removed state/refs.

- [ ] **Step 6: Run the component tests**

Run: `npx jest src/components/__tests__/RouteTimeline.test.tsx`
Expected: PASS (5 tests). The supabase mock now intercepts calls made inside the hook; rendered output is unchanged.

- [ ] **Step 7: Run the full timeline-related suite + the new hook suite**

Run: `npx jest src/components/__tests__/RouteTimeline.test.tsx src/hooks/gestao-rotas/__tests__/useTimelineData.test.ts src/lib/__tests__/timeline.test.ts`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/RouteTimeline.tsx src/components/__tests__/RouteTimeline.test.tsx
git commit -m "$(cat <<'EOF'
refactor(timeline): RouteTimeline consome useTimelineData (sem supabase cru)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm no supabase import remains in the component**

Run: `grep -n "supabase" src/components/RouteTimeline.tsx`
Expected: no matches.

- [ ] **Step 2: Typecheck + lint (whole project)**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Full test suite**

Run: `npm test -- --watchAll=false`
Expected: all green (suite count = previous + new hook tests + new helper tests).

- [ ] **Step 4: Push branch + open PR**

```bash
git push -u origin refactor/timeline-usetimelinedata
gh pr create --fill --base main
```

Then watch CI (Run Tests + TypeScript & Linting required; Visual Regression must stay green = no visual diff).

## Self-Review

**Spec coverage:**

- Boundary (raw hook / view component) → Tasks 2 & 5. ✓
- Hook interface → Task 2 (defined), 3 (loadMore), 4 (realtime). ✓
- Caching raw payload, key `timeline_${rotaId}`, TTL SHORT → Task 2. ✓
- loadMore logs-only + dedupe + hasMore → Task 3. ✓
- Realtime: logs INSERT prepend, paradas/incidentes → refresh → Task 4. ✓
- isNew/pagination subtlety → Task 1 (rule) + Task 5 (wiring). ✓
- Tests: existing 5 unchanged-assertions + cache mock → Task 5; hook tests → Tasks 2–4; isNew rule → Task 1. ✓
- Success criteria (no supabase import, green tests, tsc/lint, no visual diff) → Task 6. ✓

**Placeholder scan:** Task 2 leaves a deliberate realtime _placeholder effect_ that Task 4 replaces — this is intentional sequencing, not an unfilled gap, and Task 4 supplies the full code. No other TBD/TODO.

**Type consistency:** `useTimelineData` / `UseTimelineDataResult` (Tasks 2, 5), `TimelineEventMapped` (lib), `TimelineEvent` (component view), `computeNewlyAddedIds(currentIds, previousIds, isPagination)` (Tasks 1, 5), `TimelineCachePayload` (hook-internal) — names consistent across tasks.

**Deviations from spec (deliberate, behavior-equivalent):**

- The "loadMore-appended event is not isNew" rule is tested at the pure-helper level (Task 1) rather than via fragile rendered-output assertions, since triggering `loadMore` through the FlashList in a test is brittle. The component wiring (`paginatingRef`) is simple and reviewable.
- `newIds` is **replaced** (not accumulated) on each `rawEvents` change, so `isNew` reflects the most-recent change's additions. Faithful for the entrance animation; the 5 existing tests don't assert `isNew`.
- **Import paths (resolved):** `@/lib/utils` selectively re-exports `@/lib/timeline`, already including the three mappers and `TimelineEventMapped`. Task 1 adds `computeNewlyAddedIds` to both `@/lib/timeline` and that re-export list, so the hook (Task 2) and component (Task 5) import every timeline symbol from `@/lib/utils` consistently.
