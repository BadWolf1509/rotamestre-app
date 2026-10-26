/**
 * useTimelineData — dados da timeline da rota (carga inicial + paginação + realtime).
 *
 * Dono dos dados: encapsula todo acesso ao Supabase e devolve eventos CRUS
 * (TimelineEventMapped, sem cor/isNew/isUnseen). O componente deriva a view.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { PAGE_SIZE } from '@/components/timeline/types';
import { useAoVoltarParaPrimeiroPlano } from '@/hooks/useAoVoltarParaPrimeiroPlano';
import { useCachedData } from '@/hooks/useCachedData';
import { CACHE_TTL } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { nomeDeCanalUnico } from '@/lib/realtime';
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

/**
 * Janela que junta a reconexão (`SUBSCRIBED`) e a volta ao primeiro plano:
 * na volta ao app os dois costumam disparar juntos, e cada um recarregava
 * (o `refresh` ignora a deduplicação do cache). Revisão da tarefa 7, M2.
 */
export const DEBOUNCE_REVALIDACAO_TIMELINE_MS = 500;

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
  paginas = 1,
): Promise<TimelineCachePayload> {
  const [logsRes, paradasRes, incidentesRes] = await Promise.all([
    supabase
      .from('logs')
      .select('id, evento, timestamp, detalhes')
      .eq('rota_id', rotaId)
      .order('timestamp', { ascending: false })
      .limit(PAGE_SIZE * paginas),
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
    hasMore: (logsRes.data?.length || 0) >= PAGE_SIZE * paginas,
  };
}

export function useTimelineData(
  rotaId: string,
  opts: { realtime?: boolean } = {},
): UseTimelineDataResult {
  const { realtime = true } = opts;

  const currentPageRef = useRef(1);
  // Páginas a recarregar: o refresh grava aqui quantas páginas de "Carregar
  // mais" estão abertas e o fetcher consome (volta a 1). Carga inicial e troca
  // de rota ficam em 1. Alternativas: (a) refazer só a página 1 e mesclar com
  // o que estava na tela — mantém evento apagado e hasMore velho; (b) recarregar
  // as N páginas de uma vez (escolhida) — a lista visível é exatamente o que o
  // banco tem agora, e o evento ao vivo não descarta o que o gestor abriu.
  const paginasDaRecargaRef = useRef(1);
  const fetcher = useCallback(() => {
    const paginas = paginasDaRecargaRef.current;
    paginasDaRecargaRef.current = 1;
    return fetchTimelinePage1(rotaId, paginas);
  }, [rotaId]);

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

  // Reset de paginação ao trocar de rota.
  useEffect(() => {
    currentPageRef.current = 1;
    paginasDaRecargaRef.current = 1;
  }, [rotaId]);

  const events = data?.events ?? EMPTY_EVENTS;
  const hasMore = data?.hasMore ?? false;

  const refresh = useCallback(async () => {
    // Mantém as páginas abertas (currentPageRef não zera).
    paginasDaRecargaRef.current = currentPageRef.current;
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

  // Revalidação (reconexão, volta ao app) com debounce: uma recarga só.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  const revalidacaoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agendarRevalidacao = useCallback(() => {
    if (revalidacaoRef.current) clearTimeout(revalidacaoRef.current);
    revalidacaoRef.current = setTimeout(() => {
      revalidacaoRef.current = null;
      void refreshRef.current();
    }, DEBOUNCE_REVALIDACAO_TIMELINE_MS);
  }, []);
  useEffect(
    () => () => {
      if (revalidacaoRef.current) clearTimeout(revalidacaoRef.current);
    },
    [],
  );

  // Realtime: hook é dono do canal.
  useEffect(() => {
    if (!realtime) return;
    let jaInscreveu = false;
    const channel = supabase
      .channel(nomeDeCanalUnico(`route-timeline-${rotaId}`))
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
      .subscribe((status) => {
        // A 1ª inscrição corre junto com a carga inicial; as seguintes são
        // reconexão, e o que mudou com o socket caído não chega por evento.
        if (status !== 'SUBSCRIBED') return;
        // Com o app em segundo plano não recarrega ali: a volta ao primeiro
        // plano revalida (e já com o debounce).
        if (jaInscreveu && AppState.currentState !== 'background') {
          agendarRevalidacao();
        }
        jaInscreveu = true;
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [rotaId, realtime, refresh, agendarRevalidacao]);

  // Em segundo plano o socket cai; ao voltar, recarrega a primeira página.
  useAoVoltarParaPrimeiroPlano(agendarRevalidacao, realtime);

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
