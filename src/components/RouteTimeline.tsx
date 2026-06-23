/**
 * RouteTimeline - Timeline de eventos da rota com melhorias v2.0
 *
 * Componentes extraídos para melhor manutenção:
 * - TimelineFilters: Filtros por tipo de evento
 * - TimelineDateHeader: Cabeçalho de grupo por data
 * - TimelineEventCard: Card individual de evento
 * - TimelineSkeleton: Estado de loading
 *
 * Dados: useTimelineData (hook é dono do acesso ao Supabase — carga inicial
 * cacheada, paginação e realtime). Este componente só deriva a view (cor,
 * isNew/isUnseen, agrupamento, animação) sobre os eventos crus.
 */

import { Ionicons } from '@expo/vector-icons';
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list';
import React, {
  useCallback,
  useEffect,
  useState,
  useRef,
  useMemo,
} from 'react';
import {
  View,
  Text,
  Platform,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  UIManager,
} from 'react-native';

import { useTimelineData } from '@/hooks/gestao-rotas';
import { useTimelineLastSeen } from '@/hooks/useTimelineLastSeen';
import {
  getDateGroup,
  groupBy,
  computeNewlyAddedIds,
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
} from './timeline';

// Types for FlashList items
type ListItemType =
  | { type: 'header'; date: string }
  | {
      type: 'event';
      event: TimelineEvent;
      isLastInGroup: boolean;
      nextEvent?: TimelineEvent;
    }
  | { type: 'loadMore' };

// Habilitar LayoutAnimation no Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
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

  // Dados (hook é dono): carga inicial + paginação + realtime.
  const {
    events: rawEvents,
    loading,
    hasMore,
    loadingMore,
    loadMore,
    refresh,
  } = useTimelineData(rotaId, { realtime });

  // View state
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>(defaultFilter);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  // Hook para gerenciar "último visto"
  const {
    isNewEvent: isUnseenEvent,
    markAllAsSeen,
    loading: lastSeenLoading,
  } = useTimelineLastSeen(rotaId, rotaCreatedAt);

  // Refs
  const previousEventIds = useRef<Set<string>>(new Set());
  const paginatingRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hasMarkedAsSeen = useRef(false);

  // Resolver de cores
  const getColor = useMemo(() => createColorResolver(theme), [theme]);

  // isNew + animação: deriva quais ids são recém-adicionados a cada mudança.
  // loadMore (paginação) e carga inicial não disparam o destaque de "novo".
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

  // Verificar se há eventos críticos
  const hasCriticalEvents = useMemo(
    () => events.some((e) => e.isCritical),
    [events],
  );

  // Animação de pulse para eventos críticos
  useEffect(() => {
    if (!hasCriticalEvents) return;
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, [hasCriticalEvents, pulseAnim]);

  // Notificar pai sobre contagem de não vistos
  useEffect(() => {
    if (!enableUnseenBadge || lastSeenLoading || events.length === 0) return;
    onUnseenCountChange?.(events.filter((e) => e.isUnseen).length);
  }, [events, enableUnseenBadge, lastSeenLoading, onUnseenCountChange]);

  // Marcar como vistos após delay
  useEffect(() => {
    if (
      !enableUnseenBadge ||
      loading ||
      lastSeenLoading ||
      events.length === 0 ||
      hasMarkedAsSeen.current
    )
      return;
    const timer = setTimeout(() => {
      markAllAsSeen(events.map((e) => ({ timestamp: e.timestamp })));
      hasMarkedAsSeen.current = true;
    }, 1500);
    return () => clearTimeout(timer);
  }, [enableUnseenBadge, loading, lastSeenLoading, events, markAllAsSeen]);

  useEffect(() => {
    onStateChange?.({ loading, events: events.length });
  }, [loading, events.length, onStateChange]);

  // Handlers
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

  const toggleExpanded = useCallback((eventId: string) => {
    setExpandedEvents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) newSet.delete(eventId);
      else newSet.add(eventId);
      return newSet;
    });
  }, []);

  // Computed values
  const filteredEvents = useMemo(() => {
    if (activeFilter === 'todos') return events;
    return events.filter((event) => {
      switch (activeFilter) {
        case 'status':
          return event.type === 'status_change';
        case 'paradas':
          return event.type === 'parada_update';
        case 'incidentes':
          return event.type === 'incidente';
        default:
          return true;
      }
    });
  }, [events, activeFilter]);

  const groupedEvents = useMemo(() => {
    const grouped = groupBy(filteredEvents, (event) =>
      getDateGroup(event.timestamp),
    );
    const groups: { date: string; events: TimelineEvent[] }[] = [];
    const orderedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'Hoje') return -1;
      if (b === 'Hoje') return 1;
      if (a === 'Ontem') return -1;
      if (b === 'Ontem') return 1;
      return (
        new Date(b.split('/').reverse().join('-')).getTime() -
        new Date(a.split('/').reverse().join('-')).getTime()
      );
    });
    orderedKeys.forEach((key) => {
      groups.push({ date: key, events: grouped[key] });
    });
    return groups;
  }, [filteredEvents]);

  const filterCounts = useMemo(
    () => ({
      todos: events.length,
      status: events.filter((e) => e.type === 'status_change').length,
      paradas: events.filter((e) => e.type === 'parada_update').length,
      incidentes: events.filter((e) => e.type === 'incidente').length,
    }),
    [events],
  );

  // Flatten grouped events for FlashList virtualization
  const flatListData = useMemo((): ListItemType[] => {
    const items: ListItemType[] = [];

    groupedEvents.forEach((group) => {
      // Add date header
      items.push({ type: 'header', date: group.date });

      // Add events
      group.events.forEach((event, index) => {
        items.push({
          type: 'event',
          event,
          isLastInGroup: index === group.events.length - 1,
          nextEvent: group.events[index + 1],
        });
      });
    });

    // Add load more button if needed
    if (hasMore && !loading) {
      items.push({ type: 'loadMore' });
    }

    return items;
  }, [groupedEvents, hasMore, loading]);

  // Key extractor for FlashList
  const keyExtractor = useCallback((item: ListItemType): string => {
    if (item.type === 'header') return `header-${item.date}`;
    if (item.type === 'event') return item.event.id;
    return 'load-more';
  }, []);

  // Render item for FlashList
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ListItemType>) => {
      if (item.type === 'header') {
        return <TimelineDateHeader date={item.date} />;
      }

      if (item.type === 'event') {
        return (
          <TimelineEventCard
            event={item.event}
            isLastInGroup={item.isLastInGroup}
            nextEvent={item.nextEvent}
            isExpanded={expandedEvents.has(item.event.id)}
            onToggleExpand={() => toggleExpanded(item.event.id)}
            pulseAnim={item.event.isCritical ? pulseAnim : undefined}
          />
        );
      }

      // Load more button
      return (
        <TouchableOpacity
          style={styles.loadMoreButton}
          onPress={handleLoadMore}
          disabled={loadingMore}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={
            loadingMore ? 'Carregando mais eventos' : 'Carregar mais eventos'
          }
        >
          {loadingMore ? (
            <Text style={styles.loadMoreText}>Carregando...</Text>
          ) : (
            <>
              <Ionicons
                name="chevron-down"
                size={16}
                color={theme.colors.info}
              />
              <Text style={styles.loadMoreText}>Carregar mais eventos</Text>
            </>
          )}
        </TouchableOpacity>
      );
    },
    [
      expandedEvents,
      toggleExpanded,
      pulseAnim,
      handleLoadMore,
      loadingMore,
      theme.colors.info,
    ],
  );

  // Get item type for FlashList optimization
  const getItemType = useCallback(
    (item: ListItemType): string => item.type,
    [],
  );

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

      <FlashList
        data={flatListData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        drawDistance={300}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: { flex: 1 },
  listContent: { paddingBottom: theme.spacing.md },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl * 1.6,
  },
  emptyText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.sm,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    gap: theme.spacing.sm,
  },
  loadMoreText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.info,
  },
}));
