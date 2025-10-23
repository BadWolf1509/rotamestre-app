/**
 * ============================================
 * EXEMPLO: Componente Card de Rota
 * ============================================
 *
 * Este exemplo mostra como usar os design tokens
 * do Brand Guidelines em um componente real.
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows, getBadgeColor } from '@/lib/design-tokens';

interface RouteCardProps {
  driverName: string;
  routeId: string;
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  completedStops: number;
  totalStops: number;
  distanceKm: number;
  onPress?: () => void;
}

export default function RouteCard({
  driverName,
  routeId,
  status,
  completedStops,
  totalStops,
  distanceKm,
  onPress,
}: RouteCardProps) {
  const badgeColor = getBadgeColor(status);
  const progress = totalStops > 0 ? (completedStops / totalStops) : 0;

  const statusLabels = {
    pendente: 'Pendente',
    em_andamento: 'Em Andamento',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header com nome e status */}
      <View style={styles.header}>
        <Text style={styles.driverName}>{driverName}</Text>

        {/* Badge de Status */}
        <View style={[
          styles.badge,
          { backgroundColor: badgeColor.background }
        ]}>
          <Text style={[
            styles.badgeText,
            { color: badgeColor.text }
          ]}>
            {statusLabels[status]}
          </Text>
        </View>
      </View>

      {/* Route ID */}
      <Text style={styles.routeId}>{routeId}</Text>

      {/* Stats (Paradas e Distância) */}
      <View style={styles.stats}>
        {/* Paradas */}
        <View style={styles.stat}>
          <Ionicons
            name="location-outline"
            size={16}
            color={colors.gray[600]}
          />
          <Text style={styles.statText}>
            {completedStops}/{totalStops} paradas
          </Text>
        </View>

        {/* Distância */}
        <View style={styles.stat}>
          <Ionicons
            name="car-outline"
            size={16}
            color={colors.gray[600]}
          />
          <Text style={styles.statText}>
            {distanceKm.toFixed(1)} km
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBackground}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%` }
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {Math.round(progress * 100)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Card Container
  card: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card, // Sombra conforme Brand Guidelines
  },

  // Header (Nome + Badge)
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  // Driver Name - H3 do Brand Guidelines
  driverName: {
    ...typography.styles.h3, // Importa estilo H3 completo
    flex: 1,
  },

  // Badge de Status
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },

  badgeText: {
    ...typography.styles.caption, // Usa caption do Brand Guidelines
    fontFamily: typography.fontFamily.semibold, // Mas usa SemiBold
    fontSize: typography.fontSize.xs,
  },

  // Route ID
  routeId: {
    ...typography.styles.caption, // Caption do Brand Guidelines
    marginBottom: spacing.md,
  },

  // Stats Container
  stats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },

  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs, // 4px entre ícone e texto
  },

  statText: {
    ...typography.styles.body, // Body do Brand Guidelines
    fontSize: typography.fontSize.xs,
  },

  // Progress Bar
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  progressBackground: {
    flex: 1,
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full, // Pill shape
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.full,
  },

  progressText: {
    ...typography.styles.caption,
    fontFamily: typography.fontFamily.semibold,
    color: colors.primary.main,
    minWidth: 35,
    textAlign: 'right',
  },
});

/**
 * ============================================
 * EXEMPLO DE USO
 * ============================================
 *
 * import RouteCard from '@/components/examples/RouteCard';
 *
 * <RouteCard
 *   driverName="João Silva"
 *   routeId="Rota #1234"
 *   status="em_andamento"
 *   completedStops={3}
 *   totalStops={8}
 *   distanceKm={12.5}
 *   onPress={() => console.log('Card pressionado')}
 * />
 */
