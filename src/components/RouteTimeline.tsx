/**
 * RouteTimeline - Timeline de eventos da rota com melhorias v2.0
 *
 * Componentes extraídos para melhor manutenção:
 * - TimelineFilters: Filtros por tipo de evento
 * - TimelineDateHeader: Cabeçalho de grupo por data
 * - TimelineEventCard: Card individual de evento
 * - TimelineSkeleton: Estado de loading
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Platform,
  TouchableOpacity,
  RefreshControl,
  Animated,
  LayoutAnimation,
  UIManager,
} from 'react-native';

import { useTimelineLastSeen } from '@/hooks/useTimelineLastSeen';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import {
  getDateGroup,
  groupBy,
  mapLogToTimelineEvent,
  mapParadaToTimelineEvent,
  mapIncidenteToTimelineEvent,
  type TimelineSemanticColor,
} from '@/lib/utils';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import {
  TimelineFilters,
  TimelineDateHeader,
  TimelineEventCard,
  TimelineSkeleton,
  type TimelineEvent,
  type FilterType,
  PAGE_SIZE,
} from './timeline';

// Habilitar LayoutAnimation no Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface RouteTimelineProps {
  rotaId: string;
  rotaCreatedAt?: string;
  realtime?: boolean;
  onStateChange?: (state: { loading: boolean; events: number }) => void;
  showFilters?: boolean;
  defaultFilter?: FilterType;
  enableUnseenBadge?: boolean;
  onUnseenCountChange?: (count: number) => void;
}

/**
 * Cria um resolver de cores semânticas baseado no theme
 */
const createColorResolver = (theme: Theme) => {
  const colorMap: Record<TimelineSemanticColor, string> = {
    info: theme.colors.info,
    success: theme.colors.success,
    error: theme.colors.error,
    warning: theme.colors.warning,
    purple: theme.colors.purple,
    blue: theme.colors.blue500,
    gray: theme.colors.gray500,
  };
  return (semantic: TimelineSemanticColor): string =>
    colorMap[semantic] || theme.colors.gray500;
};

export function RouteTimeline({
  rotaId,
  rotaCreatedAt,
  realtime = true,
  onStateChange,
  showFilters = true,
  defaultFilter = 'todos',
  enableUnseenBadge = true,
  onUnseenCountChange,
}: RouteTimelineProps) {
  const { theme } = useUnistyles();

  // State
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>(defaultFilter);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Hook para gerenciar "último visto"
  const {
    isNewEvent: isUnseenEvent,
    markAllAsSeen,
    loading: lastSeenLoading,
  } = useTimelineLastSeen(rotaId, rotaCreatedAt);

  // Refs
  const previousEventIds = useRef<Set<string>>(new Set());
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hasMarkedAsSeen = useRef(false);
  const loadIdRef = useRef(0);
  const hasUpdatedUnseenRef = useRef(false);

  // Verificar se há eventos críticos
  const hasCriticalEvents = useMemo(
    () => events.some((e) => e.isCritical),
    [events]
  );

  // Resolver de cores
  const getColor = useMemo(() => createColorResolver(theme), [theme]);
  const getColorRef = useRef(getColor);
  getColorRef.current = getColor;

  // Animação de pulse para eventos críticos
  useEffect(() => {
    if (!hasCriticalEvents) return;
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, [hasCriticalEvents, pulseAnim]);

  // Load timeline data
  const loadTimeline = useCallback(async (isRefresh = false) => {
    const thisLoadId = ++loadIdRef.current;
    try {
      if (!isRefresh) setLoading(true);

      const [logsRes, paradasRes, incidentesRes] = await Promise.all([
        supabase.from('logs').select('id, evento, timestamp, detalhes').eq('rota_id', rotaId).order('timestamp', { ascending: false }).limit(PAGE_SIZE),
        supabase.from('paradas').select('id, ordem, endereco, status, concluida_em, is_checkpoint, foto_url').eq('rota_id', rotaId).not('concluida_em', 'is', null),
        supabase.from('incidentes').select('id, categoria, descricao, created_at, foto_url').eq('rota_id', rotaId),
      ]);

      if (thisLoadId !== loadIdRef.current) return;

      if (logsRes.error) logger.error('[RouteTimeline] Erro ao buscar logs:', logsRes.error);
      if (paradasRes.error) logger.error('[RouteTimeline] Erro ao buscar paradas:', paradasRes.error);
      if (incidentesRes.error) logger.error('[RouteTimeline] Erro ao buscar incidentes:', incidentesRes.error);

      setHasMore((logsRes.data?.length || 0) >= PAGE_SIZE);

      const timelineEvents: TimelineEvent[] = [];

      logsRes.data?.forEach((log: any) => {
        const mapped = mapLogToTimelineEvent(log);
        if (mapped) {
          timelineEvents.push({
            ...mapped,
            icon: mapped.icon as keyof typeof Ionicons.glyphMap,
            color: getColorRef.current(mapped.colorKey),
          });
        }
      });

      paradasRes.data?.forEach((parada: any) => {
        const mapped = mapParadaToTimelineEvent(parada);
        if (mapped) {
          timelineEvents.push({
            ...mapped,
            icon: mapped.icon as keyof typeof Ionicons.glyphMap,
            color: getColorRef.current(mapped.colorKey),
          });
        }
      });

      incidentesRes.data?.forEach((incidente: any) => {
        const mapped = mapIncidenteToTimelineEvent(incidente);
        timelineEvents.push({
          ...mapped,
          icon: mapped.icon as keyof typeof Ionicons.glyphMap,
          color: getColorRef.current(mapped.colorKey),
        });
      });

      timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const currentIds = new Set(timelineEvents.map((e) => e.id));
      const isInitialLoad = previousEventIds.current.size === 0;
      const newEvents = timelineEvents.map((event) => ({
        ...event,
        isNew: !isInitialLoad && !previousEventIds.current.has(event.id),
        isUnseen: false,
      }));
      previousEventIds.current = currentIds;

      if (!isInitialLoad && newEvents.some((e) => e.isNew)) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }

      setEvents(newEvents);
    } catch (error) {
      logger.error('[RouteTimeline] Erro ao carregar timeline:', error);
    } finally {
      if (thisLoadId === loadIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [rotaId]);

  useEffect(() => { loadTimeline(); }, [loadTimeline]);

  // Atualizar isUnseen quando lastSeen carregar
  useEffect(() => {
    if (lastSeenLoading || !enableUnseenBadge || hasUpdatedUnseenRef.current) return;
    setEvents((prev) => {
      if (prev.length === 0) return prev;
      hasUpdatedUnseenRef.current = true;
      return prev.map((event) => ({ ...event, isUnseen: isUnseenEvent(event.timestamp) }));
    });
  }, [lastSeenLoading, enableUnseenBadge, isUnseenEvent]);

  useEffect(() => { hasUpdatedUnseenRef.current = false; }, [rotaId]);

  // Notificar pai sobre contagem de não vistos
  useEffect(() => {
    if (!enableUnseenBadge || lastSeenLoading || events.length === 0) return;
    onUnseenCountChange?.(events.filter((e) => e.isUnseen).length);
  }, [events, enableUnseenBadge, lastSeenLoading, onUnseenCountChange]);

  // Marcar como vistos após delay
  useEffect(() => {
    if (!enableUnseenBadge || loading || lastSeenLoading || events.length === 0 || hasMarkedAsSeen.current) return;
    const timer = setTimeout(() => {
      markAllAsSeen(events.map((e) => ({ timestamp: e.timestamp })));
      hasMarkedAsSeen.current = true;
    }, 1500);
    return () => clearTimeout(timer);
  }, [enableUnseenBadge, loading, lastSeenLoading, events, markAllAsSeen]);

  // Realtime subscriptions
  useEffect(() => {
    if (!realtime) return;
    const channel = supabase
      .channel(`route-timeline-${rotaId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs', filter: `rota_id=eq.${rotaId}` }, (payload) => {
        const newLog = payload.new as { id: string; evento: string; timestamp: string; detalhes?: Record<string, any> | null };
        const mapped = mapLogToTimelineEvent(newLog);
        if (mapped) {
          setEvents((prev) => {
            if (prev.some((e) => e.id === mapped.id)) return prev;
            const newEvent: TimelineEvent = { ...mapped, icon: mapped.icon as keyof typeof Ionicons.glyphMap, color: getColorRef.current(mapped.colorKey), isNew: true, isUnseen: enableUnseenBadge };
            const updated = [newEvent, ...prev].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            previousEventIds.current.add(newEvent.id);
            return updated;
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'paradas', filter: `rota_id=eq.${rotaId}` }, () => loadTimeline())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidentes', filter: `rota_id=eq.${rotaId}` }, () => loadTimeline())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [rotaId, realtime, loadTimeline, enableUnseenBadge]);

  useEffect(() => { onStateChange?.({ loading, events: events.length }); }, [loading, events.length, onStateChange]);

  // Handlers
  const handleRefresh = useCallback(() => { setRefreshing(true); loadTimeline(true); }, [loadTimeline]);
  const toggleExpanded = useCallback((eventId: string) => {
    setExpandedEvents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) newSet.delete(eventId);
      else newSet.add(eventId);
      return newSet;
    });
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const offset = currentPage * PAGE_SIZE;
      const { data: logsRes } = await supabase.from('logs').select('id, evento, timestamp, detalhes').eq('rota_id', rotaId).order('timestamp', { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
      if (!logsRes || logsRes.length === 0) { setHasMore(false); return; }
      setHasMore(logsRes.length >= PAGE_SIZE);
      setCurrentPage(nextPage);
      const newEvents: TimelineEvent[] = [];
      logsRes.forEach((log: any) => {
        const mapped = mapLogToTimelineEvent(log);
        if (mapped) {
          newEvents.push({ ...mapped, icon: mapped.icon as keyof typeof Ionicons.glyphMap, color: getColorRef.current(mapped.colorKey), isUnseen: enableUnseenBadge && !lastSeenLoading && isUnseenEvent(mapped.timestamp) });
        }
      });
      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const uniqueNewEvents = newEvents.filter((e) => !existingIds.has(e.id));
        return [...prev, ...uniqueNewEvents].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      });
    } catch (error) {
      logger.error('[RouteTimeline] Erro ao carregar mais eventos:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, currentPage, rotaId, enableUnseenBadge, lastSeenLoading, isUnseenEvent]);

  // Computed values
  const filteredEvents = useMemo(() => {
    if (activeFilter === 'todos') return events;
    return events.filter((event) => {
      switch (activeFilter) {
        case 'status': return event.type === 'status_change';
        case 'paradas': return event.type === 'parada_update';
        case 'incidentes': return event.type === 'incidente';
        default: return true;
      }
    });
  }, [events, activeFilter]);

  const groupedEvents = useMemo(() => {
    const grouped = groupBy(filteredEvents, (event) => getDateGroup(event.timestamp));
    const groups: { date: string; events: TimelineEvent[] }[] = [];
    const orderedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'Hoje') return -1;
      if (b === 'Hoje') return 1;
      if (a === 'Ontem') return -1;
      if (b === 'Ontem') return 1;
      return new Date(b.split('/').reverse().join('-')).getTime() - new Date(a.split('/').reverse().join('-')).getTime();
    });
    orderedKeys.forEach((key) => { groups.push({ date: key, events: grouped[key] }); });
    return groups;
  }, [filteredEvents]);

  const filterCounts = useMemo(() => ({
    todos: events.length,
    status: events.filter((e) => e.type === 'status_change').length,
    paradas: events.filter((e) => e.type === 'parada_update').length,
    incidentes: events.filter((e) => e.type === 'incidente').length,
  }), [events]);

  // Render
  if (loading) return <TimelineSkeleton showFilters={showFilters} />;

  if (events.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="time-outline" size={48} color={theme.colors.gray300} />
        <Text style={styles.emptyText}>Nenhum evento registrado</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showFilters && (
        <TimelineFilters
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          filterCounts={filterCounts}
        />
      )}

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.info]}
            tintColor={theme.colors.info}
          />
        }
      >
        {groupedEvents.map((group, groupIndex) => (
          <View key={group.date}>
            <TimelineDateHeader date={group.date} />
            {group.events.map((event, index) => (
              <TimelineEventCard
                key={event.id}
                event={event}
                isLastInGroup={index === group.events.length - 1}
                nextEvent={group.events[index + 1]}
                isExpanded={expandedEvents.has(event.id)}
                onToggleExpand={() => toggleExpanded(event.id)}
                pulseAnim={event.isCritical ? pulseAnim : undefined}
              />
            ))}
            {groupIndex < groupedEvents.length - 1 && <View style={styles.groupSpacer} />}
          </View>
        ))}

        {hasMore && !loading && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={handleLoadMore}
            disabled={loadingMore}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={loadingMore ? 'Carregando mais eventos' : 'Carregar mais eventos'}
          >
            {loadingMore ? (
              <Text style={styles.loadMoreText}>Carregando...</Text>
            ) : (
              <>
                <Ionicons name="chevron-down" size={16} color={theme.colors.info} />
                <Text style={styles.loadMoreText}>Carregar mais eventos</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl * 1.6 },
  emptyText: { marginTop: theme.spacing.md, fontSize: theme.typography.fontSize.sm, color: theme.colors.gray500 },
  groupSpacer: { height: theme.spacing.sm },
  loadMoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg, marginHorizontal: theme.spacing.lg, marginVertical: theme.spacing.sm, backgroundColor: theme.colors.gray50, borderRadius: theme.borderRadius.lg, borderWidth: 1, borderColor: theme.colors.gray200, gap: theme.spacing.sm },
  loadMoreText: { fontSize: theme.typography.fontSize.sm, fontFamily: theme.typography.fontSansMedium, color: theme.colors.info },
}));
