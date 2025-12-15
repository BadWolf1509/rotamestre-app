/**
 * TimelineCollapsible - Timeline colapsável para o rodapé
 * Ocupa largura total quando expandido, minimiza quando não é prioridade
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';

import { RouteTimeline } from '@/components/RouteTimeline';
import { supabase } from '@/lib/supabase';
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
  initialExpanded?: boolean;
}

export function TimelineCollapsible({ rotaId, initialExpanded = false }: TimelineCollapsibleProps) {
  const { theme } = useUnistyles();
  const [expanded, setExpanded] = useState(initialExpanded);
  const [preview, setPreview] = useState<TimelinePreview>({
    loading: true,
    eventCount: 0,
    lastEvent: null,
  });

  // Buscar preview leve (apenas contagem e último evento)
  useEffect(() => {
    async function fetchPreview() {
      try {
        // Buscar em paralelo: logs, paradas concluídas, incidentes
        const [logsRes, paradasRes, incidentesRes] = await Promise.all([
          supabase
            .from('logs')
            .select('id, evento, created_at')
            .eq('rota_id', rotaId)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('paradas')
            .select('id, ordem, status, concluida_em')
            .eq('rota_id', rotaId)
            .not('concluida_em', 'is', null),
          supabase
            .from('incidentes')
            .select('id, categoria, created_at')
            .eq('rota_id', rotaId),
        ]);

        // Calcular total de eventos
        const logsCount = logsRes.data?.filter((log: any) => {
          const evento = log.evento.toLowerCase();
          return evento.includes('iniciou') || evento.includes('concluiu') ||
                 evento.includes('cancelou') || evento === 'motorista_iniciou_rota' ||
                 evento === 'motorista_concluiu_rota' || evento === 'rota_cancelada';
        }).length || 0;
        const paradasCount = paradasRes.data?.length || 0;
        const incidentesCount = incidentesRes.data?.length || 0;
        const totalCount = logsCount + paradasCount + incidentesCount;

        // Encontrar último evento
        let lastEvent: TimelinePreview['lastEvent'] = null;
        const allEvents: Array<{ timestamp: string; title: string; type: TimelinePreview['lastEvent'] extends null ? never : NonNullable<TimelinePreview['lastEvent']>['type'] }> = [];

        // Processar logs
        logsRes.data?.forEach((log: any) => {
          const evento = log.evento.toLowerCase();
          if (evento.includes('iniciou') || evento === 'motorista_iniciou_rota') {
            allEvents.push({ timestamp: log.created_at, title: 'Rota iniciada', type: 'inicio' });
          } else if (evento.includes('concluiu') || evento === 'motorista_concluiu_rota') {
            allEvents.push({ timestamp: log.created_at, title: 'Rota concluída', type: 'conclusao' });
          } else if (evento.includes('cancelou') || evento === 'rota_cancelada') {
            allEvents.push({ timestamp: log.created_at, title: 'Rota cancelada', type: 'outro' });
          }
        });

        // Processar paradas
        paradasRes.data?.forEach((parada: any) => {
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

        setPreview({ loading: false, eventCount: totalCount, lastEvent });
      } catch (error) {
        console.error('[TimelineCollapsible] Erro ao buscar preview:', error);
        setPreview({ loading: false, eventCount: 0, lastEvent: null });
      }
    }

    fetchPreview();
  }, [rotaId]);

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, []);

  const hasEvents = preview.eventCount > 0;

  // Formatar timestamp para exibição
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

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
      >
        <View style={styles.headerLeft}>
          <View style={[styles.iconWrapper, { backgroundColor: theme.colors.infoBg }]}>
            <Ionicons name="time-outline" size={16} color={theme.colors.info} />
          </View>
          <Text style={styles.title}>Timeline</Text>
          {!expanded && hasEvents && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{preview.eventCount}</Text>
            </View>
          )}
          {preview.loading && (
            <Text style={styles.loadingText}>Carregando...</Text>
          )}
        </View>

        <View style={styles.headerRight}>
          {!expanded && hasEvents && (
            <Text style={styles.previewText}>
              {preview.eventCount} evento{preview.eventCount !== 1 ? 's' : ''}
            </Text>
          )}
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
            realtime={true}
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
              {formatTime(preview.lastEvent.timestamp)}
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
    borderRadius: 8,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.white,
  },
  loadingText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray400,
    fontStyle: 'italic',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  previewText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
  },
  content: {
    padding: theme.spacing.md,
    paddingTop: 0,
    maxHeight: 300,
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
    borderRadius: 4,
  },
  previewItemText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray600,
    flex: 1,
  },
  previewTime: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray400,
    marginLeft: theme.spacing.sm,
  },
  emptyPreview: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray400,
    fontStyle: 'italic',
  },
}));
