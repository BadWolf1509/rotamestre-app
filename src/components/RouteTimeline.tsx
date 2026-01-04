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
import { withOpacity } from '@/utils/color';
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

  // Ref para getColor - evita que loadTimeline dependa de theme
  const getColorRef = useRef(getColor);
  getColorRef.current = getColor;

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

  // Ref para controlar chamadas concorrentes
  const loadIdRef = useRef(0);

  const loadTimeline = useCallback(async (isRefresh = false) => {
    // Incrementar ID para invalidar chamadas anteriores
    const thisLoadId = ++loadIdRef.current;

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

      // Verificar se esta chamada ainda é válida (não foi substituída por outra)
      if (thisLoadId !== loadIdRef.current) {
        return;
      }

      // Verificar erros do Supabase
      if (logsRes.error) {
        console.error('[RouteTimeline] Erro ao buscar logs:', logsRes.error);
      }
      if (paradasRes.error) {
        console.error('[RouteTimeline] Erro ao buscar paradas:', paradasRes.error);
      }
      if (incidentesRes.error) {
        console.error('[RouteTimeline] Erro ao buscar incidentes:', incidentesRes.error);
      }

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
              color: getColorRef.current(mapped.colorKey),
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
              color: getColorRef.current(mapped.colorKey),
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
            color: getColorRef.current(mapped.colorKey),
          });
        });
      }

      // Ordenar por timestamp (mais recente primeiro)
      timelineEvents.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Detectar novos eventos para animação (apenas para eventos realtime, não inicial)
      const currentIds = new Set(timelineEvents.map(e => e.id));
      const isInitialLoad = previousEventIds.current.size === 0;
      const newEvents = timelineEvents.map(event => ({
        ...event,
        // Só marca como "novo" se não for carregamento inicial
        isNew: !isInitialLoad && !previousEventIds.current.has(event.id),
        // isUnseen será calculado em useEffect separado após lastSeen carregar
        isUnseen: false,
      }));
      previousEventIds.current = currentIds;

      // Animar entrada de novos eventos APENAS em updates (não no carregamento inicial)
      if (!isInitialLoad && newEvents.some(e => e.isNew)) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }

      setEvents(newEvents);
    } catch (error) {
      console.error('[RouteTimeline] Erro ao carregar timeline:', error);
    } finally {
      // Só atualiza estados se esta chamada ainda é a mais recente
      if (thisLoadId === loadIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [rotaId]); // getColor removido - usa getColorRef para evitar re-renders

  // Carregar timeline apenas quando rotaId muda
  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  // Ref para rastrear se já atualizamos os badges de "não visto"
  const hasUpdatedUnseenRef = useRef(false);

  // Atualizar isUnseen quando lastSeen carregar (separado do loading principal)
  useEffect(() => {
    // Só atualiza uma vez após lastSeen carregar e haver eventos
    if (lastSeenLoading || !enableUnseenBadge || hasUpdatedUnseenRef.current) return;

    setEvents(prev => {
      if (prev.length === 0) return prev;

      hasUpdatedUnseenRef.current = true;
      return prev.map(event => ({
        ...event,
        isUnseen: isUnseenEvent(event.timestamp),
      }));
    });
  }, [lastSeenLoading, enableUnseenBadge, isUnseenEvent]);

  // Reset do ref quando rotaId muda
  useEffect(() => {
    hasUpdatedUnseenRef.current = false;
  }, [rotaId]);

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
                color: getColorRef.current(mapped.colorKey),
                isNew: true,
                // Eventos realtime são sempre "novos" (não vistos ainda)
                isUnseen: enableUnseenBadge,
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
  }, [rotaId, realtime, loadTimeline, enableUnseenBadge]); // getColor removido - usa ref

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
            color: getColorRef.current(mapped.colorKey),
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
  }, [loadingMore, hasMore, currentPage, rotaId, enableUnseenBadge, lastSeenLoading, isUnseenEvent]); // getColor removido - usa ref

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
    padding: theme.spacing.xl * 1.6,
  },
  emptyText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },

  // Filters
  filtersContainer: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  filtersContent: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.gray100,
    marginRight: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  filterChipActive: {
    backgroundColor: theme.colors.info,
  },
  filterChipText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray500,
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  filterBadge: {
    backgroundColor: theme.colors.gray200,
    paddingHorizontal: theme.spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: theme.borderRadius.md,
    marginLeft: theme.spacing.xs,
  },
  filterBadgeActive: {
    backgroundColor: withOpacity(theme.colors.white, 0.3),
  },
  filterBadgeText: {
    fontSize: theme.typography.fontSize.xs - 2,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
  },
  filterBadgeTextActive: {
    color: theme.colors.white,
  },

  // Date Header
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.gray200,
  },
  dateHeaderText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
    paddingHorizontal: theme.spacing.md,
    textTransform: 'uppercase',
  },

  // Event
  eventContainer: {
    flexDirection: 'row',
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
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
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.lg,
    borderWidth: 3,
    borderColor: theme.colors.white,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: theme.spacing.xs,
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
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
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
    marginBottom: theme.spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  photoIcon: {
    marginLeft: theme.spacing.xs + 2,
  },
  criticalBadge: {
    backgroundColor: theme.colors.error,
    width: theme.spacing.lg,
    height: theme.spacing.lg,
    borderRadius: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.xs + 2,
  },
  criticalBadgeText: {
    fontSize: theme.typography.fontSize.xs - 2,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.white,
  },
  unseenBadge: {
    backgroundColor: theme.colors.info,
    paddingHorizontal: theme.spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
  unseenBadgeText: {
    fontSize: theme.typography.fontSize.xs - 3,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.white,
    letterSpacing: 0.5,
  },
  timestamp: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray500,
    marginLeft: theme.spacing.sm,
  },
  description: {
    fontSize: theme.typography.fontSize.xs + 1,
    color: theme.colors.gray600,
    lineHeight: theme.typography.fontSize.sm * 1.3,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  expandButtonText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.info,
    fontFamily: theme.typography.fontSansMedium,
  },

  // Duration
  durationContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    marginLeft: 36,
  },
  durationText: {
    fontSize: theme.typography.fontSize.xs - 2,
    color: theme.colors.gray500, // WCAG AA: 4.64:1 (era gray400: 2.68:1)
    fontFamily: theme.typography.fontSansMedium,
  },

  // Group spacer
  groupSpacer: {
    height: theme.spacing.sm,
  },

  // Skeleton styles
  skeletonFilterChip: {
    width: 70,
    height: 28,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.gray200,
    marginRight: theme.spacing.sm,
  },
  skeletonDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  skeletonDateLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.gray200,
  },
  skeletonDateText: {
    width: 50,
    height: theme.typography.fontSize.xs,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.spacing.xs,
    marginHorizontal: theme.spacing.md,
  },
  skeletonIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray200,
    marginRight: theme.spacing.lg,
  },
  skeletonContent: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  skeletonTitle: {
    width: 120,
    height: theme.typography.fontSize.sm,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.spacing.xs,
  },
  skeletonTimestamp: {
    width: 50,
    height: theme.typography.fontSize.xs,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.spacing.xs,
  },
  skeletonDescription: {
    width: '100%',
    height: theme.typography.fontSize.xs,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.spacing.xs,
  },
  skeletonDescriptionShort: {
    width: '60%',
    height: theme.typography.fontSize.xs,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.spacing.xs,
    marginTop: theme.spacing.xs + 2,
  },

  // Load More Button
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
