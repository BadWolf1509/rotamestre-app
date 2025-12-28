/**
 * RouteTimeline - Timeline de eventos da rota com melhorias v2.0
 *
 * Melhorias implementadas:
 * 1. Tempo relativo ("há 5 min", "há 2h")
 * 2. Agrupamento por data ("Hoje", "Ontem", data)
 * 3. Indicador de foto nas paradas
 * 4. Duração entre eventos consecutivos
 * 5. Destaque para eventos críticos (SOS, incidentes)
 * 6. Descrição expansível para textos longos
 * 7. Filtros por tipo (Todos/Status/Paradas/Incidentes)
 * 8. Pull-to-refresh
 * 9. Animação de entrada para novos eventos realtime
 * 10. Badge "NOVO" para eventos não vistos (persiste via AsyncStorage)
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
import { supabase } from '@/lib/supabase';
import {
  formatRelativeTime,
  getDateGroup,
  calculateDurationBetween,
  groupBy,
  mapLogToTimelineEvent,
  mapParadaToTimelineEvent,
  mapIncidenteToTimelineEvent,
  type TimelineSemanticColor,
} from '@/lib/utils';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// Habilitar LayoutAnimation no Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================================
// TYPES
// ============================================================================

type EventType = 'status_change' | 'parada_update' | 'incidente' | 'gps_update';
type FilterType = 'todos' | 'status' | 'paradas' | 'incidentes';

interface TimelineEvent {
  id: string;
  type: EventType;
  timestamp: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  // Campos adicionais para melhorias
  hasPhoto?: boolean;
  photoUrl?: string;
  isCritical?: boolean;
  fullDescription?: string;
  isNew?: boolean; // Para animação de entrada (realtime)
  isUnseen?: boolean; // Para badge "NOVO" (não visto pelo gestor)
}

interface RouteTimelineProps {
  rotaId: string;
  /** Timestamp de criação da rota - usado como baseline para badges "novo" */
  rotaCreatedAt?: string;
  /** Se true, subscreve a realtime updates */
  realtime?: boolean;
  /** Notifica o pai sobre loading/quantidade para habilitar colapsar o card */
  onStateChange?: (state: { loading: boolean; events: number }) => void;
  /** Mostrar filtros por tipo */
  showFilters?: boolean;
  /** Filtro padrão */
  defaultFilter?: FilterType;
  /** Habilitar badge "NOVO" para eventos não vistos (padrão: true) */
  enableUnseenBadge?: boolean;
  /** Callback com quantidade de eventos não vistos */
  onUnseenCountChange?: (count: number) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DESCRIPTION_TRUNCATE_LENGTH = 80;
const PAGE_SIZE = 50; // Limite de eventos por página

const FILTER_OPTIONS: { key: FilterType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'todos', label: 'Todos', icon: 'list' },
  { key: 'status', label: 'Status', icon: 'flag' },
  { key: 'paradas', label: 'Paradas', icon: 'location' },
  { key: 'incidentes', label: 'Incidentes', icon: 'alert-circle' },
];

/**
 * Cria um resolver de cores semânticas baseado no theme
 * Função pura - não depende de hooks, evita re-renders desnecessários
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

// ============================================================================
// COMPONENT
// ============================================================================

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
  // Theme
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
    countNewEvents: _countUnseenEvents,
    loading: lastSeenLoading,
  } = useTimelineLastSeen(rotaId, rotaCreatedAt);

  // Refs para animação
  const previousEventIds = useRef<Set<string>>(new Set());
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hasMarkedAsSeen = useRef(false);

  // Verificar se há eventos críticos (para animação)
  const hasCriticalEvents = useMemo(
    () => events.some((e) => e.isCritical),
    [events]
  );

  // Resolver de cores - usa função pura de módulo para estabilidade
  const getColor = useMemo(() => createColorResolver(theme), [theme]);

  // Iniciar animação de pulse APENAS se houver eventos críticos
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
      ])
    );
    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, [hasCriticalEvents, pulseAnim]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadTimeline = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }

      // Buscar dados de múltiplas fontes (com paginação em logs)
      const [logsRes, paradasRes, incidentesRes] = await Promise.all([
        // Logs da rota - campos específicos + limite
        supabase
          .from('logs')
          .select('id, evento, timestamp, detalhes')
          .eq('rota_id', rotaId)
          .order('timestamp', { ascending: false })
          .limit(PAGE_SIZE),

        // Paradas atualizadas - incluir foto_url
        supabase
          .from('paradas')
          .select('id, ordem, endereco, status, concluida_em, is_checkpoint, foto_url')
          .eq('rota_id', rotaId)
          .not('concluida_em', 'is', null),

        // Incidentes - incluir foto_url
        supabase
          .from('incidentes')
          .select('id, categoria, descricao, created_at, foto_url')
          .eq('rota_id', rotaId),
      ]);

      // Verificar se há mais logs para carregar
      setHasMore((logsRes.data?.length || 0) >= PAGE_SIZE);

      const timelineEvents: TimelineEvent[] = [];

      // Processar logs usando função centralizada
      if (logsRes.data) {
        logsRes.data.forEach((log: any) => {
          const mapped = mapLogToTimelineEvent(log);
          if (mapped) {
            timelineEvents.push({
              ...mapped,
              icon: mapped.icon as keyof typeof Ionicons.glyphMap,
              color: getColor(mapped.colorKey),
            });
          }
        });
      }

      // Processar paradas concluídas usando função centralizada
      if (paradasRes.data) {
        paradasRes.data.forEach((parada: any) => {
          const mapped = mapParadaToTimelineEvent(parada);
          if (mapped) {
            timelineEvents.push({
              ...mapped,
              icon: mapped.icon as keyof typeof Ionicons.glyphMap,
              color: getColor(mapped.colorKey),
            });
          }
        });
      }

      // Processar incidentes usando função centralizada
      if (incidentesRes.data) {
        incidentesRes.data.forEach((incidente: any) => {
          const mapped = mapIncidenteToTimelineEvent(incidente);
          timelineEvents.push({
            ...mapped,
            icon: mapped.icon as keyof typeof Ionicons.glyphMap,
            color: getColor(mapped.colorKey),
          });
        });
      }

      // Ordenar por timestamp (mais recente primeiro)
      timelineEvents.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Detectar novos eventos para animação
      const currentIds = new Set(timelineEvents.map(e => e.id));
      const newEvents = timelineEvents.map(event => ({
        ...event,
        isNew: !previousEventIds.current.has(event.id) && previousEventIds.current.size > 0,
        // Marcar como não visto se habilitado e lastSeen já foi carregado
        isUnseen: enableUnseenBadge && !lastSeenLoading && isUnseenEvent(event.timestamp),
      }));
      previousEventIds.current = currentIds;

      // Animar entrada de novos eventos
      if (newEvents.some(e => e.isNew)) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }

      setEvents(newEvents);
    } catch (error) {
      console.error('[RouteTimeline] Erro ao carregar timeline:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rotaId, enableUnseenBadge, lastSeenLoading, isUnseenEvent, getColor]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  // Notificar pai sobre contagem de eventos não vistos
  useEffect(() => {
    if (!enableUnseenBadge || lastSeenLoading || events.length === 0) return;

    const unseenCount = events.filter(e => e.isUnseen).length;
    onUnseenCountChange?.(unseenCount);
  }, [events, enableUnseenBadge, lastSeenLoading, onUnseenCountChange]);

  // Marcar eventos como vistos quando a timeline é exibida
  useEffect(() => {
    if (
      !enableUnseenBadge ||
      loading ||
      lastSeenLoading ||
      events.length === 0 ||
      hasMarkedAsSeen.current
    ) {
      return;
    }

    // Marcar todos como vistos após um pequeno delay (para dar tempo do usuário ver)
    const timer = setTimeout(() => {
      const eventsWithTimestamps = events.map(e => ({ timestamp: e.timestamp }));
      markAllAsSeen(eventsWithTimestamps);
      hasMarkedAsSeen.current = true;
    }, 1500); // 1.5s de delay para usuário perceber os badges

    return () => clearTimeout(timer);
  }, [enableUnseenBadge, loading, lastSeenLoading, events, markAllAsSeen]);

  // Realtime subscriptions - incremental para logs, full reload para paradas/incidentes
  useEffect(() => {
    if (!realtime) return;

    const channel = supabase
      .channel(`route-timeline-${rotaId}`)
      // LOGS: Incremental update - processo apenas o novo log
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'logs',
          filter: `rota_id=eq.${rotaId}`,
        },
        (payload) => {
          // Processar apenas o novo log usando função centralizada
          const newLog = payload.new as {
            id: string;
            evento: string;
            timestamp: string;
            detalhes?: Record<string, any> | null;
          };
          const mapped = mapLogToTimelineEvent(newLog);
          if (mapped) {
            setEvents((prev) => {
              // Verificar se já existe (evitar duplicatas)
              if (prev.some((e) => e.id === mapped.id)) {
                return prev;
              }

              const newEvent: TimelineEvent = {
                ...mapped,
                icon: mapped.icon as keyof typeof Ionicons.glyphMap,
                color: getColor(mapped.colorKey),
                isNew: true,
                isUnseen: enableUnseenBadge && !lastSeenLoading && isUnseenEvent(mapped.timestamp),
              };

              // Adicionar no início e reordenar por timestamp
              const updated = [newEvent, ...prev].sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              );

              // Animar entrada
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

              // Atualizar previousEventIds
              previousEventIds.current.add(newEvent.id);

              return updated;
            });
          }
        }
      )
      // PARADAS: Full reload (update precisa atualizar evento existente)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'paradas',
          filter: `rota_id=eq.${rotaId}`,
        },
        () => loadTimeline()
      )
      // INCIDENTES: Full reload (pode ser INSERT, UPDATE ou DELETE)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incidentes',
          filter: `rota_id=eq.${rotaId}`,
        },
        () => loadTimeline()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rotaId, realtime, loadTimeline, getColor, enableUnseenBadge, lastSeenLoading, isUnseenEvent]);

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.({ loading, events: events.length });
  }, [loading, events.length, onStateChange]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadTimeline(true);
  }, [loadTimeline]);

  const toggleExpanded = useCallback((eventId: string) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const offset = currentPage * PAGE_SIZE;

      // Buscar próxima página de logs
      const { data: logsRes } = await supabase
        .from('logs')
        .select('id, evento, timestamp, detalhes')
        .eq('rota_id', rotaId)
        .order('timestamp', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (!logsRes || logsRes.length === 0) {
        setHasMore(false);
        return;
      }

      // Verificar se há mais páginas
      setHasMore(logsRes.length >= PAGE_SIZE);
      setCurrentPage(nextPage);

      // Processar novos logs
      const newEvents: TimelineEvent[] = [];
      logsRes.forEach((log: any) => {
        const mapped = mapLogToTimelineEvent(log);
        if (mapped) {
          newEvents.push({
            ...mapped,
            icon: mapped.icon as keyof typeof Ionicons.glyphMap,
            color: getColor(mapped.colorKey),
            isUnseen: enableUnseenBadge && !lastSeenLoading && isUnseenEvent(mapped.timestamp),
          });
        }
      });

      // Adicionar aos eventos existentes (evitando duplicatas)
      setEvents(prev => {
        const existingIds = new Set(prev.map(e => e.id));
        const uniqueNewEvents = newEvents.filter(e => !existingIds.has(e.id));
        return [...prev, ...uniqueNewEvents].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      });
    } catch (error) {
      console.error('[RouteTimeline] Erro ao carregar mais eventos:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, currentPage, rotaId, getColor, enableUnseenBadge, lastSeenLoading, isUnseenEvent]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  // Filtrar eventos por tipo
  const filteredEvents = useMemo(() => {
    if (activeFilter === 'todos') return events;

    return events.filter(event => {
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

  // Agrupar eventos por data
  const groupedEvents = useMemo(() => {
    const grouped = groupBy(filteredEvents, (event) => getDateGroup(event.timestamp));
    // Converter para array ordenado
    const groups: { date: string; events: TimelineEvent[] }[] = [];

    // Ordem: Hoje > Ontem > outras datas (mais recentes primeiro)
    const orderedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'Hoje') return -1;
      if (b === 'Hoje') return 1;
      if (a === 'Ontem') return -1;
      if (b === 'Ontem') return 1;
      // Para datas, ordenar mais recente primeiro
      return new Date(b.split('/').reverse().join('-')).getTime() -
             new Date(a.split('/').reverse().join('-')).getTime();
    });

    orderedKeys.forEach(key => {
      groups.push({ date: key, events: grouped[key] });
    });

    return groups;
  }, [filteredEvents]);

  // Contagem por tipo para badges
  const filterCounts = useMemo(() => ({
    todos: events.length,
    status: events.filter(e => e.type === 'status_change').length,
    paradas: events.filter(e => e.type === 'parada_update').length,
    incidentes: events.filter(e => e.type === 'incidente').length,
  }), [events]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderFilters = () => {
    if (!showFilters) return null;

    return (
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {FILTER_OPTIONS.map(option => {
            const isActive = activeFilter === option.key;
            const count = filterCounts[option.key];

            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                ]}
                onPress={() => setActiveFilter(option.key)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Filtrar por ${option.label}. ${count} evento${count !== 1 ? 's' : ''}`}
              >
                <Ionicons
                  name={option.icon}
                  size={14}
                  color={isActive ? theme.colors.white : theme.colors.gray500}
                />
                <Text style={[
                  styles.filterChipText,
                  isActive && styles.filterChipTextActive,
                ]}>
                  {option.label}
                </Text>
                {count > 0 && (
                  <View style={[
                    styles.filterBadge,
                    isActive && styles.filterBadgeActive,
                  ]}>
                    <Text style={[
                      styles.filterBadgeText,
                      isActive && styles.filterBadgeTextActive,
                    ]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderDateHeader = (date: string) => (
    <View style={styles.dateHeader}>
      <View style={styles.dateHeaderLine} />
      <Text style={styles.dateHeaderText}>{date}</Text>
      <View style={styles.dateHeaderLine} />
    </View>
  );

  const renderDuration = (currentEvent: TimelineEvent, nextEvent: TimelineEvent | undefined) => {
    if (!nextEvent) return null;

    const duration = calculateDurationBetween(nextEvent.timestamp, currentEvent.timestamp);
    if (!duration) return null;

    return (
      <View style={styles.durationContainer}>
        <Text style={styles.durationText}>{duration}</Text>
      </View>
    );
  };

  const renderEvent = (event: TimelineEvent, index: number, groupEvents: TimelineEvent[]) => {
    const isExpanded = expandedEvents.has(event.id);
    const hasLongDescription = event.fullDescription &&
      event.fullDescription.length > DESCRIPTION_TRUNCATE_LENGTH;
    const showPhoto = event.hasPhoto;

    // Container animado para eventos críticos
    const EventContainer = event.isCritical ? Animated.View : View;
    const containerStyle = event.isCritical
      ? [styles.eventContainer, { transform: [{ scale: pulseAnim }] }]
      : styles.eventContainer;

    return (
      <View key={event.id}>
        <EventContainer style={containerStyle}>
          {/* Timeline line */}
          {index < groupEvents.length - 1 && <View style={styles.timelineLine} />}

          {/* Icon */}
          <View style={[
            styles.iconContainer,
            { backgroundColor: event.color },
            event.isCritical && styles.iconContainerCritical,
          ]}>
            <Ionicons name={event.icon} size={20} color={theme.colors.white} />
          </View>

          {/* Content */}
          <TouchableOpacity
            style={[
              styles.contentContainer,
              event.isCritical && styles.contentContainerCritical,
              event.isNew && styles.contentContainerNew,
            ]}
            onPress={() => hasLongDescription && toggleExpanded(event.id)}
            activeOpacity={hasLongDescription ? 0.7 : 1}
            accessibilityRole="button"
            accessibilityLabel={`${event.title}. ${event.description}. ${formatRelativeTime(event.timestamp)}${event.isUnseen ? '. Novo evento' : ''}${event.isCritical ? '. Evento crítico' : ''}`}
            accessibilityHint={hasLongDescription ? 'Toque para expandir detalhes' : undefined}
          >
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{event.title}</Text>
                {event.isUnseen && (
                  <View style={styles.unseenBadge}>
                    <Text style={styles.unseenBadgeText}>NOVO</Text>
                  </View>
                )}
                {showPhoto && (
                  <Ionicons
                    name="camera"
                    size={14}
                    color={theme.colors.success}
                    style={styles.photoIcon}
                    accessibilityLabel="Tem foto anexada"
                  />
                )}
                {event.isCritical && (
                  <View style={styles.criticalBadge}>
                    <Text style={styles.criticalBadgeText}>!</Text>
                  </View>
                )}
              </View>
              <Text style={styles.timestamp}>
                {formatRelativeTime(event.timestamp)}
              </Text>
            </View>

            <Text
              style={styles.description}
              numberOfLines={isExpanded ? undefined : 2}
            >
              {isExpanded ? event.fullDescription : event.description}
            </Text>

            {hasLongDescription && (
              <TouchableOpacity
                onPress={() => toggleExpanded(event.id)}
                style={styles.expandButton}
              >
                <Text style={styles.expandButtonText}>
                  {isExpanded ? 'ver menos' : 'ver mais'}
                </Text>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color={theme.colors.info}
                />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </EventContainer>

        {/* Duration between events */}
        {renderDuration(event, groupEvents[index + 1])}
      </View>
    );
  };

  // ============================================================================
  // SKELETON LOADING
  // ============================================================================

  const renderSkeleton = () => (
    <View style={styles.container}>
      {/* Skeleton Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <View style={styles.filtersContent}>
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={styles.skeletonFilterChip} />
            ))}
          </View>
        </View>
      )}

      {/* Skeleton Date Header */}
      <View style={styles.skeletonDateHeader}>
        <View style={styles.skeletonDateLine} />
        <View style={styles.skeletonDateText} />
        <View style={styles.skeletonDateLine} />
      </View>

      {/* Skeleton Events */}
      {[1, 2, 3, 4].map((i, index) => (
        <View key={i} style={styles.eventContainer}>
          {/* Timeline line */}
          {index < 3 && <View style={styles.timelineLine} />}

          {/* Skeleton Icon */}
          <View style={styles.skeletonIcon} />

          {/* Skeleton Content */}
          <View style={styles.skeletonContent}>
            <View style={styles.skeletonHeader}>
              <View style={styles.skeletonTitle} />
              <View style={styles.skeletonTimestamp} />
            </View>
            <View style={styles.skeletonDescription} />
            {i % 2 === 0 && <View style={styles.skeletonDescriptionShort} />}
          </View>
        </View>
      ))}
    </View>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (loading) {
    return renderSkeleton();
  }

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
      {renderFilters()}

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
            {renderDateHeader(group.date)}
            {group.events.map((event, index) =>
              renderEvent(event, index, group.events)
            )}
            {/* Espaço entre grupos */}
            {groupIndex < groupedEvents.length - 1 && (
              <View style={styles.groupSpacer} />
            )}
          </View>
        ))}

        {/* Botão "Carregar mais" */}
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

// ============================================================================
// STYLES (Themed - Design Tokens)
// ============================================================================

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.gray500,
  },

  // Filters
  filtersContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.gray100,
    marginRight: 8,
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: theme.colors.info,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.gray500,
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  filterBadge: {
    backgroundColor: theme.colors.gray200,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 4,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.gray500,
  },
  filterBadgeTextActive: {
    color: theme.colors.white,
  },

  // Date Header
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.gray200,
  },
  dateHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.gray500,
    paddingHorizontal: 12,
    textTransform: 'uppercase',
  },

  // Event
  eventContainer: {
    flexDirection: 'row',
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 16,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 35,
    top: 40,
    bottom: -16,
    width: 2,
    backgroundColor: theme.colors.gray200,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 3,
    borderColor: theme.colors.white,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainerCritical: {
    borderColor: theme.colors.red100,
    shadowColor: theme.colors.error,
    shadowOpacity: 0.3,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  contentContainerCritical: {
    backgroundColor: theme.colors.red50,
    borderColor: theme.colors.red100,
  },
  contentContainerNew: {
    backgroundColor: theme.colors.blue50,
    borderColor: theme.colors.blue100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  photoIcon: {
    marginLeft: 6,
  },
  criticalBadge: {
    backgroundColor: theme.colors.error,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  criticalBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.white,
  },
  unseenBadge: {
    backgroundColor: theme.colors.info,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  unseenBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.white,
    letterSpacing: 0.5,
  },
  timestamp: {
    fontSize: 11,
    color: theme.colors.gray500,
    marginLeft: 8,
  },
  description: {
    fontSize: 13,
    color: theme.colors.gray600,
    lineHeight: 18,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  expandButtonText: {
    fontSize: 12,
    color: theme.colors.info,
    fontWeight: '500',
  },

  // Duration
  durationContainer: {
    alignItems: 'center',
    paddingVertical: 4,
    marginLeft: 36,
  },
  durationText: {
    fontSize: 10,
    color: theme.colors.gray500, // WCAG AA: 4.64:1 (era gray400: 2.68:1)
    fontWeight: '500',
  },

  // Group spacer
  groupSpacer: {
    height: 8,
  },

  // Skeleton styles
  skeletonFilterChip: {
    width: 70,
    height: 28,
    borderRadius: 16,
    backgroundColor: theme.colors.gray200,
    marginRight: 8,
  },
  skeletonDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  skeletonDateLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.gray200,
  },
  skeletonDateText: {
    width: 50,
    height: 12,
    backgroundColor: theme.colors.gray200,
    borderRadius: 4,
    marginHorizontal: 12,
  },
  skeletonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.gray200,
    marginRight: 16,
  },
  skeletonContent: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  skeletonTitle: {
    width: 120,
    height: 14,
    backgroundColor: theme.colors.gray200,
    borderRadius: 4,
  },
  skeletonTimestamp: {
    width: 50,
    height: 12,
    backgroundColor: theme.colors.gray200,
    borderRadius: 4,
  },
  skeletonDescription: {
    width: '100%',
    height: 12,
    backgroundColor: theme.colors.gray200,
    borderRadius: 4,
  },
  skeletonDescriptionShort: {
    width: '60%',
    height: 12,
    backgroundColor: theme.colors.gray200,
    borderRadius: 4,
    marginTop: 6,
  },

  // Load More Button
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: theme.colors.gray50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.info,
  },
}));
