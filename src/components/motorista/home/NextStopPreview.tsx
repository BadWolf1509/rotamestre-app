/**
 * NextStopPreview - Collapsible preview of the upcoming stop
 *
 * Shows condensed information about the next stop when the motorista
 * is currently handling another stop. Expands on tap to show full details.
 *
 * Features:
 * - Expandable/collapsible with smooth animation
 * - Shows distance and duration to next stop
 * - Displays recipient and address info
 * - Delivery/pickup type indicator
 *
 * Performance Optimizations:
 * - useMemo for destination coordinates (prevents useDistanceToStop re-fetch)
 * - useMemo for truncated address (string operations)
 * - useCallback for toggleExpand handler
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';

import { useDistanceToStop } from '@/hooks/useDistanceToStop';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// Habilitar LayoutAnimation no Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Parada {
  id: string;
  ordem: number;
  endereco: string;
  destinatario?: string | null;
  telefone?: string | null;
  observacoes?: string | null;
  tipo?: 'entrega' | 'retirada' | string; // Optional to match MainCard.types.ts
  latitude: number;
  longitude: number;
}

interface NextStopPreviewProps {
  nextStop: Parada;
  currentLocation?: { latitude: number; longitude: number } | null;
  totalStops: number;
}

export function NextStopPreview({
  nextStop,
  currentLocation,
  totalStops,
}: NextStopPreviewProps) {
  const { theme } = useUnistyles();
  const [expanded, setExpanded] = useState(false);

  // Memoize destination para evitar recriação de objeto a cada render
  const destination = useMemo(() => ({
    latitude: nextStop.latitude,
    longitude: nextStop.longitude,
  }), [nextStop.latitude, nextStop.longitude]);

  // Calcular distância até a próxima parada
  const distanceInfo = useDistanceToStop(
    currentLocation,
    destination,
    { enabled: !!currentLocation }
  );

  // Memoize toggle para evitar recriação a cada render
  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }, []);

  // Memoize truncatedAddress para evitar recálculo de string
  const truncatedAddress = useMemo(() => (
    nextStop.endereco.length > 40 && !expanded
      ? nextStop.endereco.substring(0, 40) + '...'
      : nextStop.endereco
  ), [nextStop.endereco, expanded]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={toggleExpand}
      activeOpacity={0.7}
    >
      {/* Header sempre visível */}
      <View style={styles.header}>
        <View style={styles.labelContainer}>
          <View style={[styles.dot, { backgroundColor: theme.colors.info }]} />
          <Text style={styles.label}>PRÓXIMA</Text>
        </View>
        <View style={styles.orderBadge}>
          <Text style={styles.orderText}>{nextStop.ordem}/{totalStops}</Text>
        </View>
      </View>

      {/* Endereço */}
      <Text style={styles.address}>{truncatedAddress}</Text>

      {/* Info de distância */}
      <View style={styles.infoRow}>
        {distanceInfo.isLoading ? (
          <Text style={styles.distanceText}>Calculando...</Text>
        ) : (
          <>
            <Ionicons name="navigate-outline" size={14} color={theme.colors.info} />
            <Text style={[styles.distanceText, { color: theme.colors.info }]}>
              {distanceInfo.distanceKm} • {distanceInfo.durationText}
            </Text>
          </>
        )}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.colors.gray400}
          style={styles.chevron}
        />
      </View>

      {/* Detalhes expandidos */}
      {expanded && (
        <View style={styles.expandedContent}>
          {nextStop.destinatario && (
            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={14} color={theme.colors.gray500} />
              <Text style={styles.detailText}>{nextStop.destinatario}</Text>
            </View>
          )}
          {nextStop.telefone && (
            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={14} color={theme.colors.gray500} />
              <Text style={styles.detailText}>{nextStop.telefone}</Text>
            </View>
          )}
          {nextStop.observacoes && (
            <View style={[styles.detailRow, styles.observationRow]}>
              <Ionicons name="alert-circle-outline" size={14} color={theme.colors.warning} />
              <Text style={styles.observationText}>{nextStop.observacoes}</Text>
            </View>
          )}
          {nextStop.tipo && (
            <View style={styles.detailRow}>
              <Ionicons
                name={nextStop.tipo === 'entrega' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
                size={14}
                color={theme.colors.gray500}
              />
              <Text style={styles.detailText}>
                {nextStop.tipo === 'entrega' ? 'Entrega' : 'Retirada'}
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    backgroundColor: theme.colors.infoBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing['3'],
    marginTop: theme.spacing['2.5'],
    borderWidth: 1,
    borderColor: theme.colors.info + '30',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing['1.5'],
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1.5'],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.info,
    letterSpacing: 0.5,
  },
  orderBadge: {
    backgroundColor: theme.colors.info + '20',
    paddingHorizontal: theme.spacing['2'],
    paddingVertical: theme.spacing['0.5'],
    borderRadius: theme.borderRadius.md,
  },
  orderText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.info,
  },
  address: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansMedium,
    marginBottom: theme.spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1'],
  },
  distanceText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray600,
    flex: 1,
  },
  chevron: {
    marginLeft: 'auto',
  },
  expandedContent: {
    marginTop: theme.spacing['2.5'],
    paddingTop: theme.spacing['2.5'],
    borderTopWidth: 1,
    borderTopColor: theme.colors.info + '20',
    gap: theme.spacing['2'],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['2'],
  },
  detailText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray700,
  },
  observationRow: {
    backgroundColor: theme.colors.warningBg,
    padding: theme.spacing['2'],
    borderRadius: theme.borderRadius.xs,
  },
  observationText: {
    fontSize: theme.typography.xs,
    color: theme.colors.warningText,
    flex: 1,
  },
}));
