/**
 * TimelineCollapsible - Timeline colapsável para o rodapé
 * Ocupa largura total quando expandido, minimiza quando não é prioridade
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';

import { RouteTimeline } from '@/components/RouteTimeline';
import { useTimelineLastSeen } from '@/hooks/useTimelineLastSeen';
import { supabase } from '@/lib/supabase';
import {
  formatRelativeTime,
  isTimelineLogEvent,
  mapLogToTimelinePreview,
  type TimelinePreviewEvent,
} from '@/lib/utils';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// Habilitar LayoutAnimation no Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface TimelinePreview {
  loading: boolean;
  eventCount: number;
  lastEvent: {
    title: string;
    timestamp: string;
    type: 'inicio' | 'conclusao' | 'parada' | 'incidente' | 'outro';
  } | null;
}

interface TimelineCollapsibleProps {
  rotaId: string;
  /** Timestamp de criação da rota - usado como baseline para badges "novo" */
  rotaCreatedAt?: string;
  initialExpanded?: boolean;
}

export function TimelineCollapsible({ rotaId, rotaCreatedAt, initialExpanded = false }: TimelineCollapsibleProps) {
  const { theme } = useUnistyles();
  const [expanded, setExpanded] = useState(initialExpanded);
  const [preview, setPreview] = useState<TimelinePreview>({
    loading: true,
    eventCount: 0,
    lastEvent: null,
  });
  const [unseenCount, setUnseenCount] = useState(0);

  // Hook para calcular eventos não vistos no preview
  // Passa rotaCreatedAt como fallback: eventos após criação da rota são "novos"
  const {
    countNewEvents,
    markAllAsSeen: _markAllAsSeen,
    loading: lastSeenLoading,
  } = useTimelineLastSeen(rotaId, rotaCreatedAt);


  // Ref para armazenar eventos para cálculo de unseen
  const allEventsRef = useRef<TimelinePreviewEvent[]>([]);

  // Buscar preview leve (apenas contagem e último evento)
  useEffect(() => {
    let cancelled = false;

    async function fetchPreview() {
      try {
        // Buscar em paralelo: logs, paradas concluídas, incidentes
        const [logsRes, paradasRes, incidentesRes] = await Promise.all([
          supabase
            .from('logs')
            .select('id, evento, timestamp')
            .eq('rota_id', rotaId)
            .order('timestamp', { ascending: false }),
          supabase
            .from('paradas')
            .select('id, ordem, status, concluida_em, is_checkpoint')
            .eq('rota_id', rotaId)
            .not('concluida_em', 'is', null),
          supabase
            .from('incidentes')
            .select('id, categoria, created_at')
            .eq('rota_id', rotaId),
        ]);

        // Verificar se foi cancelado
        if (cancelled) return;

        // Calcular total de eventos (usando função centralizada)
        const logsCount = logsRes.data?.filter((log: any) =>
          isTimelineLogEvent(log.evento)
        ).length || 0;

        // Excluir checkpoints (is_checkpoint === false) da contagem
        const paradasCount = paradasRes.data?.filter(
          (parada: any) => parada.is_checkpoint !== false
        ).length || 0;

        const incidentesCount = incidentesRes.data?.length || 0;
        const totalCount = logsCount + paradasCount + incidentesCount;

        // Encontrar último evento
        let lastEvent: TimelinePreview['lastEvent'] = null;
        const allEvents: TimelinePreviewEvent[] = [];

        // Processar logs usando função centralizada (apenas os 5 mais recentes)
        logsRes.data?.slice(0, 5).forEach((log: any) => {
          const mapped = mapLogToTimelinePreview(log);
          if (mapped) {
            allEvents.push(mapped);
          }
        });

        // Processar paradas (excluir checkpoints)
        paradasRes.data
          ?.filter((parada: any) => parada.is_checkpoint !== false)
          .forEach((parada: any) => {
            if (parada.concluida_em) {
              allEvents.push({
                timestamp: parada.concluida_em,
                title: `Parada #${parada.ordem} ${parada.status === 'concluida' ? 'concluída' : 'pulada'}`,
                type: 'parada',
              });
            }
          });

        // Processar incidentes
        incidentesRes.data?.forEach((inc: any) => {
          allEvents.push({ timestamp: inc.created_at, title: 'Incidente registrado', type: 'incidente' });
        });

        // Ordenar e pegar o mais recente
        if (allEvents.length > 0) {
          allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          lastEvent = allEvents[0];
        }

        // Salvar eventos para cálculo posterior de unseen
        allEventsRef.current = allEvents;

        setPreview({ loading: false, eventCount: totalCount, lastEvent });
      } catch (error) {
        console.error('[TimelineCollapsible] Erro ao buscar preview:', error);
        if (!cancelled) {
          setPreview({ loading: false, eventCount: 0, lastEvent: null });
        }
      }
    }

    fetchPreview();

    return () => {
      cancelled = true;
    };
  }, [rotaId]);

  // Calcular eventos não vistos separadamente (após preview e lastSeen carregarem)
  useEffect(() => {
    if (lastSeenLoading || preview.loading || allEventsRef.current.length === 0) return;

    const unseenEvents = countNewEvents(allEventsRef.current);
    setUnseenCount(unseenEvents);
  }, [lastSeenLoading, countNewEvents, preview.loading]);

  // Ref para evitar cliques múltiplos
  const isTogglingRef = useRef(false);

  const toggleExpanded = useCallback(() => {
    // Evitar cliques múltiplos durante a animação
    if (isTogglingRef.current) {
      return;
    }

    isTogglingRef.current = true;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);

    // Reset após animação completar
    setTimeout(() => {
      isTogglingRef.current = false;
    }, 350);
  }, []);

  // Callback estável para evitar re-renders desnecessários
  const handleUnseenCountChange = useCallback((count: number) => {
    setUnseenCount(count);
  }, []);

  const hasEvents = preview.eventCount > 0;

  // Cor do dot baseada no tipo de evento
  const getEventColor = (type: NonNullable<TimelinePreview['lastEvent']>['type']) => {
    switch (type) {
      case 'inicio': return theme.colors.info;
      case 'conclusao': return theme.colors.success;
      case 'parada': return theme.colors.success;
      case 'incidente': return theme.colors.error;
      default: return theme.colors.gray500;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header clicável */}
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Timeline. ${preview.eventCount} evento${preview.eventCount !== 1 ? 's' : ''}${unseenCount > 0 ? `. ${unseenCount} novo${unseenCount !== 1 ? 's' : ''}` : ''}`}
        accessibilityHint={expanded ? 'Toque para recolher' : 'Toque para expandir'}
      >
        <View style={styles.headerLeft}>
          <View style={[styles.iconWrapper, { backgroundColor: theme.colors.infoBg }]}>
            <Ionicons name="time-outline" size={16} color={theme.colors.info} />
          </View>
          <Text style={styles.title}>Timeline</Text>
          {/* Badge de contagem total ou skeleton loading */}
          {!expanded && preview.loading && (
            <View style={styles.badgeSkeleton} />
          )}
          {!expanded && !preview.loading && hasEvents && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{preview.eventCount}</Text>
            </View>
          )}
          {/* Badge de eventos novos (não vistos) */}
          {!expanded && !preview.loading && unseenCount > 0 && (
            <View style={styles.unseenBadge}>
              <Text style={styles.unseenBadgeText}>
                {unseenCount} novo{unseenCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.headerRight}>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.colors.gray500}
          />
        </View>
      </TouchableOpacity>

      {/* Conteúdo expandido */}
      {expanded && (
        <View style={styles.content}>
          <RouteTimeline
            rotaId={rotaId}
            rotaCreatedAt={rotaCreatedAt}
            realtime={true}
            enableUnseenBadge={true}
            onUnseenCountChange={handleUnseenCountChange}
          />
        </View>
      )}

      {/* Preview quando colapsado (mostra último evento) */}
      {!expanded && hasEvents && preview.lastEvent && (
        <View style={styles.preview}>
          <View style={styles.previewItem}>
            <View style={[styles.previewDot, { backgroundColor: getEventColor(preview.lastEvent.type) }]} />
            <Text style={styles.previewItemText} numberOfLines={1}>
              {preview.lastEvent.title}
            </Text>
            <Text style={styles.previewTime}>
              {formatRelativeTime(preview.lastEvent.timestamp)}
            </Text>
          </View>
        </View>
      )}

      {/* Estado vazio */}
      {!expanded && !hasEvents && !preview.loading && (
        <View style={styles.emptyPreview}>
          <Text style={styles.emptyText}>Nenhum evento registrado</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  badge: {
    backgroundColor: theme.colors.info,
    paddingHorizontal: theme.spacing['1.5'],
    paddingVertical: theme.spacing['0.5'],
    borderRadius: theme.borderRadius.lg,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: theme.typography.fontSize.xs, // Min readable (WCAG AA)
    fontWeight: '700',
    color: theme.colors.white,
  },
  badgeSkeleton: {
    width: 24,
    height: 20,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.gray200,
  },
  unseenBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing['2'],
    paddingVertical: theme.spacing['0.5'],
    borderRadius: theme.borderRadius.lg,
  },
  unseenBadgeText: {
    fontSize: theme.typography.fontSize.xs, // Min readable (WCAG AA)
    fontWeight: '700',
    color: theme.colors.white,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  content: {
    padding: theme.spacing.md,
    paddingTop: 0,
    maxHeight: 600, // ~10 eventos visíveis
  },
  preview: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: theme.borderRadius.xs,
  },
  previewItemText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray600,
    flex: 1,
  },
  previewTime: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500, // WCAG AA: 4.64:1
    marginLeft: theme.spacing.sm,
  },
  emptyPreview: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500, // WCAG AA: 4.64:1
    fontStyle: 'italic',
  },
}));
