/**
 * Preview colapsável da próxima parada
 * Mostra informação resumida da próxima parada quando em estado active
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
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
  tipo: 'entrega' | 'retirada';
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

  // Calcular distância até a próxima parada
  const distanceInfo = useDistanceToStop(
    currentLocation,
    { latitude: nextStop.latitude, longitude: nextStop.longitude },
    { enabled: !!currentLocation }
  );

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  // Truncar endereço se muito longo
  const truncatedAddress = nextStop.endereco.length > 40 && !expanded
    ? nextStop.endereco.substring(0, 40) + '...'
    : nextStop.endereco;

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
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    backgroundColor: theme.colors.infoBg,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.colors.info + '30',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.info,
    letterSpacing: 0.5,
  },
  orderBadge: {
    backgroundColor: theme.colors.info + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  orderText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.info,
  },
  address: {
    fontSize: 13,
    color: theme.colors.gray900,
    fontWeight: '500',
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
    color: theme.colors.gray600,
    flex: 1,
  },
  chevron: {
    marginLeft: 'auto',
  },
  expandedContent: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.info + '20',
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 12,
    color: theme.colors.gray700,
  },
  observationRow: {
    backgroundColor: theme.colors.warningBg,
    padding: 8,
    borderRadius: 6,
  },
  observationText: {
    fontSize: 12,
    color: theme.colors.warningText,
    flex: 1,
  },
}));
