/**
 * ParadaCardHeader - Header with order, status and type badges
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { View, Text } from 'react-native';

import { useUnistyles } from '@/utils/styles';

import { styles } from './ParadaCard.styles';
import { getTipoInfo, getStatusBadgeText, type ParadaTipo } from './ParadaCard.types';

interface ParadaCardHeaderProps {
  ordem: number;
  tipo: ParadaTipo;
  isConcluida: boolean;
  isPulada: boolean;
  isEmAndamento: boolean;
  isPendente: boolean;
  isSummary: boolean;
}

export const ParadaCardHeader = memo(function ParadaCardHeader({
  ordem,
  tipo,
  isConcluida,
  isPulada,
  isEmAndamento,
  isPendente,
  isSummary,
}: ParadaCardHeaderProps) {
  const { theme } = useUnistyles();
  const tipoInfo = getTipoInfo(tipo);
  const statusBadgeText = getStatusBadgeText(isConcluida, isPulada, isEmAndamento, isSummary);

  return (
    <View style={styles.paradaHeader}>
      {/* Ordem badge */}
      <View style={styles.ordemBadge}>
        <Text style={styles.ordemText}>{ordem}</Text>
      </View>

      {/* Status badge */}
      <View
        style={[
          styles.statusBadge,
          isConcluida && styles.statusBadgeConcluida,
          isPulada && styles.statusBadgePulada,
          isEmAndamento && styles.statusBadgeEmAndamento,
          isPendente && !isEmAndamento && styles.statusBadgePendente,
        ]}
      >
        <Text style={styles.statusBadgeText}>{statusBadgeText}</Text>
      </View>

      {/* Tipo badge */}
      <View style={[styles.tipoBadge, styles[tipoInfo.badgeStyleKey]]}>
        <View style={styles.tipoBadgeContent}>
          <Ionicons
            name={tipoInfo.icon as keyof typeof Ionicons.glyphMap}
            size={12}
            color={theme.colors.gray900}
          />
          <Text style={styles.tipoBadgeText}>{tipoInfo.label}</Text>
        </View>
      </View>
    </View>
  );
});
