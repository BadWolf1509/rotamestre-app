/**
 * TimelineCollapsible - Timeline colapsável para o rodapé
 * Ocupa largura total quando expandido, minimiza quando não é prioridade
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';

import { RouteTimeline } from '@/components/RouteTimeline';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// Habilitar LayoutAnimation no Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface TimelineCollapsibleProps {
  rotaId: string;
  initialExpanded?: boolean;
}

export function TimelineCollapsible({ rotaId, initialExpanded = false }: TimelineCollapsibleProps) {
  const { theme } = useUnistyles();
  const [expanded, setExpanded] = useState(initialExpanded);
  const [timelineState, setTimelineState] = useState<{ loading: boolean; events: number }>({
    loading: true,
    events: 0,
  });

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, []);

  const hasEvents = timelineState.events > 0;

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
              <Text style={styles.badgeText}>{timelineState.events}</Text>
            </View>
          )}
          {timelineState.loading && (
            <Text style={styles.loadingText}>Carregando...</Text>
          )}
        </View>

        <View style={styles.headerRight}>
          {!expanded && hasEvents && (
            <Text style={styles.previewText}>
              {timelineState.events} evento{timelineState.events !== 1 ? 's' : ''}
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
            onStateChange={setTimelineState}
          />
        </View>
      )}

      {/* Preview quando colapsado (mostra últimos eventos) */}
      {!expanded && hasEvents && (
        <View style={styles.preview}>
          <View style={styles.previewItem}>
            <View style={[styles.previewDot, { backgroundColor: theme.colors.success }]} />
            <Text style={styles.previewItemText} numberOfLines={1}>
              Último evento registrado
            </Text>
          </View>
        </View>
      )}

      {/* Estado vazio */}
      {!expanded && !hasEvents && !timelineState.loading && (
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
