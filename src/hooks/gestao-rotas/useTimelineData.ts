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

  // update() muda de identidade quando data muda — ref garante handlers estáveis.
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

  return {
    events,
    loading,
    isStale,
    hasMore,
    loadingMore,
    loadMore,
    refresh,
  };
}
