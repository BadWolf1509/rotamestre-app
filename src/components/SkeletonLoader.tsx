import React, { useEffect, useRef } from 'react';
import { View, Animated, type ViewStyle, type DimensionValue } from 'react-native';

import { StyleSheet, type Theme, useUnistyles } from '@/utils/styles';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Componente base de skeleton com efeito shimmer animado
 */
export function Skeleton({ width = '100%', height = 20, borderRadius = 4, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as DimensionValue,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

// ============================================
// Skeletons genéricos
// ============================================

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <Skeleton width={60} height={60} borderRadius={30} style={{ marginBottom: 12 }} />
      <Skeleton width="80%" height={20} style={{ marginBottom: 8 }} />
      <Skeleton width="60%" height={16} />
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  // ⚠️ PERFORMANCE: Limitar a 7 skeletons para evitar lag em dispositivos antigos
  const safeCount = Math.min(count, 7);

  return (
    <View>
      {Array.from({ length: safeCount }).map((_, i) => (
        <View key={i} style={styles.listItem}>
          <Skeleton width={40} height={40} borderRadius={8} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Skeleton width="70%" height={16} style={{ marginBottom: 8 }} />
            <Skeleton width="50%" height={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SkeletonDashboard() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Skeleton width={150} height={24} style={{ marginBottom: 8 }} />
        <Skeleton width={100} height={16} />
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.statCard}>
            <Skeleton width={50} height={40} style={{ marginBottom: 8 }} />
            <Skeleton width={60} height={14} />
          </View>
        ))}
      </View>

      {/* List */}
      <SkeletonList count={5} />
    </View>
  );
}

// ============================================
// Skeletons específicos do Motorista
// ============================================

/**
 * Skeleton para a StatusSection (header com avatar e status)
 */
export function StatusSectionSkeleton() {
  const { theme } = useUnistyles();

  return (
    <View style={[styles.statusSection, { backgroundColor: theme.colors.white, borderBottomColor: theme.colors.gray200 }]}>
      <View style={styles.statusRow}>
        {/* Avatar skeleton */}
        <Skeleton width={52} height={52} borderRadius={26} />

        {/* Text content skeleton */}
        <View style={styles.statusTextContainer}>
          <Skeleton width={80} height={14} style={{ marginBottom: 4 }} />
          <Skeleton width={120} height={22} style={{ marginBottom: 4 }} />
          <Skeleton width={100} height={12} />
        </View>

        {/* Status badge skeleton */}
        <Skeleton width={100} height={28} borderRadius={14} />
      </View>
    </View>
  );
}

/**
 * Skeleton para o MainCard do motorista
 */
export function MainCardSkeleton() {
  const { theme } = useUnistyles();

  return (
    <View style={[styles.mainCard, { backgroundColor: theme.colors.white, borderColor: theme.colors.gray200 }]}>
      {/* Header */}
      <View style={styles.mainCardHeader}>
        <View style={styles.mainCardHeaderLeft}>
          <Skeleton width={40} height={40} borderRadius={20} />
          <View style={{ marginLeft: 12 }}>
            <Skeleton width={100} height={16} style={{ marginBottom: 4 }} />
            <Skeleton width={140} height={14} />
          </View>
        </View>
        <Skeleton width={60} height={24} borderRadius={12} />
      </View>

      {/* Stats row */}
      <View style={styles.mainCardStatsRow}>
        <View style={styles.mainCardStatItem}>
          <Skeleton width={50} height={28} style={{ marginBottom: 4 }} />
          <Skeleton width={60} height={12} />
        </View>
        <View style={styles.mainCardStatItem}>
          <Skeleton width={50} height={28} style={{ marginBottom: 4 }} />
          <Skeleton width={60} height={12} />
        </View>
        <View style={styles.mainCardStatItem}>
          <Skeleton width={50} height={28} style={{ marginBottom: 4 }} />
          <Skeleton width={60} height={12} />
        </View>
      </View>

      {/* Button */}
      <View style={{ marginTop: 8 }}>
        <Skeleton width="100%" height={48} borderRadius={12} />
      </View>
    </View>
  );
}

/**
 * Skeleton para barra de progresso
 */
export function ProgressBarSkeleton() {
  return (
    <View style={styles.progressBarContainer}>
      <Skeleton width="100%" height={4} borderRadius={2} />
      <Skeleton width={32} height={14} style={{ marginLeft: 8 }} />
    </View>
  );
}

/**
 * Skeleton para item de parada na lista
 */
export function ParadaSkeleton() {
  const { theme } = useUnistyles();

  return (
    <View style={[styles.paradaItem, { backgroundColor: theme.colors.white, borderColor: theme.colors.gray200 }]}>
      {/* Left indicator */}
      <View style={styles.paradaLeft}>
        <Skeleton width={32} height={32} borderRadius={16} />
        <View style={{ marginTop: 4 }}>
          <Skeleton width={2} height={40} />
        </View>
      </View>

      {/* Content */}
      <View style={styles.paradaContent}>
        <Skeleton width="70%" height={16} style={{ marginBottom: 4 }} />
        <Skeleton width="90%" height={14} style={{ marginBottom: 4 }} />
        <Skeleton width={80} height={12} />
      </View>

      {/* Right action */}
      <Skeleton width={40} height={40} borderRadius={20} />
    </View>
  );
}

/**
 * Skeleton para lista de paradas
 */
export function ParadasListSkeleton({ count = 3 }: { count?: number }) {
  const safeCount = Math.min(count, 5);

  return (
    <View style={styles.paradasList}>
      {Array.from({ length: safeCount }).map((_, index) => (
        <ParadaSkeleton key={index} />
      ))}
    </View>
  );
}

/**
 * Skeleton para QuickActions
 */
export function QuickActionsSkeleton({ count = 4 }: { count?: number }) {
  const { theme } = useUnistyles();

  return (
    <View style={[styles.quickActionsContainer, { backgroundColor: theme.colors.white, borderColor: theme.colors.gray200 }]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.quickActionItem}>
          <Skeleton width={48} height={48} borderRadius={24} />
          <Skeleton width={50} height={12} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton completo para a tela inicial do motorista
 */
export function HomeScreenSkeleton() {
  return (
    <View style={styles.homeScreen}>
      <StatusSectionSkeleton />
      <View style={styles.homeContent}>
        <MainCardSkeleton />
        <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
          <QuickActionsSkeleton />
        </View>
      </View>
    </View>
  );
}

/**
 * Skeleton para card de rota no histórico
 */
export function RotaCardSkeleton() {
  const { theme } = useUnistyles();

  return (
    <View style={[styles.rotaCard, { backgroundColor: theme.colors.white, borderColor: theme.colors.gray200 }]}>
      <View style={styles.rotaCardHeader}>
        <Skeleton width={100} height={16} />
        <Skeleton width={60} height={20} borderRadius={10} />
      </View>
      <View style={styles.rotaCardBody}>
        <Skeleton width="80%" height={14} style={{ marginBottom: 4 }} />
        <Skeleton width="60%" height={14} />
      </View>
      <View style={styles.rotaCardFooter}>
        <Skeleton width={80} height={12} />
        <Skeleton width={80} height={12} />
      </View>
    </View>
  );
}

/**
 * Skeleton para lista de rotas no histórico
 */
export function RotasListSkeleton({ count = 3 }: { count?: number }) {
  const safeCount = Math.min(count, 5);

  return (
    <View>
      {Array.from({ length: safeCount }).map((_, index) => (
        <RotaCardSkeleton key={index} />
      ))}
    </View>
  );
}

/**
 * Skeleton para tela de checkpoints
 */
export function CheckpointsScreenSkeleton() {
  return (
    <View style={styles.container}>
      {/* Progress header */}
      <View style={styles.checkpointsHeader}>
        <Skeleton width={150} height={20} style={{ marginBottom: 8 }} />
        <ProgressBarSkeleton />
      </View>

      {/* Lista de paradas */}
      <ParadasListSkeleton count={4} />
    </View>
  );
}

// ============================================
// Skeletons específicos do Gestor
// ============================================

/**
 * Skeleton para visualização de mapa
 */
export function MapSkeleton() {
  const { theme } = useUnistyles();

  return (
    <View style={[styles.mapContainer, { backgroundColor: theme.colors.gray100 }]}>
      {/* Mapa placeholder */}
      <View style={styles.mapPlaceholder}>
        <Skeleton width="100%" height={400} borderRadius={0} style={{ flex: 1 }} />
      </View>

      {/* Controles do mapa */}
      <View style={styles.mapControls}>
        <Skeleton width={40} height={40} borderRadius={8} style={{ marginBottom: 8 }} />
        <Skeleton width={40} height={40} borderRadius={8} />
      </View>

      {/* Info card no mapa */}
      <View style={[styles.mapInfoCard, { backgroundColor: theme.colors.white }]}>
        <View style={styles.mapInfoHeader}>
          <Skeleton width={32} height={32} borderRadius={16} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Skeleton width="60%" height={16} style={{ marginBottom: 4 }} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
        <Skeleton width="100%" height={36} borderRadius={8} style={{ marginTop: 12 }} />
      </View>
    </View>
  );
}

/**
 * Skeleton para tabela de rotas do gestor (desktop)
 */
export function RotasTableSkeleton({ rows = 5 }: { rows?: number }) {
  const { theme } = useUnistyles();
  const safeRows = Math.min(rows, 10);

  return (
    <View style={[styles.tableContainer, { backgroundColor: theme.colors.white }]}>
      {/* Header da tabela */}
      <View style={[styles.tableHeader, { borderBottomColor: theme.colors.gray200 }]}>
        <Skeleton width={100} height={14} />
        <Skeleton width={80} height={14} />
        <Skeleton width={120} height={14} />
        <Skeleton width={60} height={14} />
        <Skeleton width={80} height={14} />
      </View>

      {/* Linhas da tabela */}
      {Array.from({ length: safeRows }).map((_, index) => (
        <View key={index} style={[styles.tableRow, { borderBottomColor: theme.colors.gray100 }]}>
          <Skeleton width={90} height={14} />
          <Skeleton width={70} height={22} borderRadius={11} />
          <Skeleton width={110} height={14} />
          <Skeleton width={50} height={14} />
          <View style={styles.tableActions}>
            <Skeleton width={28} height={28} borderRadius={14} />
            <Skeleton width={28} height={28} borderRadius={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton para card de incidente
 */
export function IncidenteCardSkeleton() {
  const { theme } = useUnistyles();

  return (
    <View style={[styles.incidenteCard, { backgroundColor: theme.colors.white, borderColor: theme.colors.gray200 }]}>
      <View style={styles.incidenteHeader}>
        <View style={styles.incidenteHeaderLeft}>
          <Skeleton width={60} height={20} borderRadius={10} />
          <Skeleton width={80} height={20} borderRadius={10} style={{ marginLeft: 8 }} />
        </View>
        <Skeleton width={90} height={14} />
      </View>

      <View style={styles.incidenteBody}>
        <Skeleton width="100%" height={14} style={{ marginBottom: 4 }} />
        <Skeleton width="70%" height={14} />
      </View>

      <View style={styles.incidenteFooter}>
        <View style={styles.incidenteMotoristaBadge}>
          <Skeleton width={24} height={24} borderRadius={12} />
          <Skeleton width={100} height={14} style={{ marginLeft: 8 }} />
        </View>
        <Skeleton width={80} height={28} borderRadius={14} />
      </View>
    </View>
  );
}

/**
 * Skeleton para lista de incidentes
 */
export function IncidentesListSkeleton({ count = 3 }: { count?: number }) {
  const safeCount = Math.min(count, 5);

  return (
    <View>
      {Array.from({ length: safeCount }).map((_, index) => (
        <IncidenteCardSkeleton key={index} />
      ))}
    </View>
  );
}

/**
 * Skeleton para tela de gestão de rotas
 */
export function GestaoRotasScreenSkeleton() {
  return (
    <View style={styles.container}>
      {/* Filtros */}
      <View style={styles.gestaoFilters}>
        <Skeleton width={120} height={40} borderRadius={8} />
        <Skeleton width={120} height={40} borderRadius={8} />
        <Skeleton width={120} height={40} borderRadius={8} />
      </View>

      {/* Stats cards */}
      <View style={styles.gestaoStats}>
        <View style={styles.gestaoStatCard}>
          <Skeleton width={40} height={32} style={{ marginBottom: 4 }} />
          <Skeleton width={60} height={12} />
        </View>
        <View style={styles.gestaoStatCard}>
          <Skeleton width={40} height={32} style={{ marginBottom: 4 }} />
          <Skeleton width={60} height={12} />
        </View>
        <View style={styles.gestaoStatCard}>
          <Skeleton width={40} height={32} style={{ marginBottom: 4 }} />
          <Skeleton width={60} height={12} />
        </View>
      </View>

      {/* Tabela */}
      <RotasTableSkeleton rows={6} />
    </View>
  );
}

/**
 * Skeleton para tela de incidentes
 */
export function IncidentesScreenSkeleton() {
  return (
    <View style={styles.container}>
      {/* Header com resumo */}
      <View style={styles.incidentesResumo}>
        <View style={styles.incidentesResumoCard}>
          <Skeleton width={32} height={28} style={{ marginBottom: 4 }} />
          <Skeleton width={50} height={12} />
        </View>
        <View style={styles.incidentesResumoCard}>
          <Skeleton width={32} height={28} style={{ marginBottom: 4 }} />
          <Skeleton width={50} height={12} />
        </View>
        <View style={styles.incidentesResumoCard}>
          <Skeleton width={32} height={28} style={{ marginBottom: 4 }} />
          <Skeleton width={50} height={12} />
        </View>
      </View>

      {/* Filtros */}
      <View style={styles.incidentesFiltros}>
        <Skeleton width={100} height={32} borderRadius={16} />
        <Skeleton width={100} height={32} borderRadius={16} />
        <Skeleton width={100} height={32} borderRadius={16} />
      </View>

      {/* Lista */}
      <IncidentesListSkeleton count={4} />
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  skeleton: {
    backgroundColor: theme.colors.gray200,
  },
  card: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
  listItem: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.md,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: theme.spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },

  // StatusSection skeleton
  statusSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTextContainer: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },

  // MainCard skeleton
  mainCard: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    padding: theme.spacing.lg,
  },
  mainCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  mainCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainCardStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.md,
  },
  mainCardStatItem: {
    alignItems: 'center',
  },

  // Progress bar skeleton
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Parada skeleton
  paradaItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
  },
  paradaLeft: {
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  paradaContent: {
    flex: 1,
  },
  paradasList: {
    paddingHorizontal: theme.spacing.lg,
  },

  // QuickActions skeleton
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: theme.spacing.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickActionItem: {
    alignItems: 'center',
  },

  // Home screen skeleton
  homeScreen: {
    flex: 1,
  },
  homeContent: {
    flex: 1,
  },

  // Rota card skeleton
  rotaCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    padding: theme.spacing.md,
  },
  rotaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  rotaCardBody: {
    marginBottom: theme.spacing.sm,
  },
  rotaCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  // Checkpoints skeleton
  checkpointsHeader: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.white,
    marginBottom: theme.spacing.md,
  },

  // Map skeleton
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapPlaceholder: {
    flex: 1,
  },
  mapControls: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  mapInfoCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: theme.spacing.md,
    ...theme.shadows.md,
  },
  mapInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Table skeleton
  tableContainer: {
    borderRadius: 12,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    marginBottom: theme.spacing.md,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
  },
  tableActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },

  // Incidente skeleton
  incidenteCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    padding: theme.spacing.md,
  },
  incidenteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  incidenteHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  incidenteBody: {
    marginBottom: theme.spacing.md,
  },
  incidenteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  incidenteMotoristaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Gestão rotas skeleton
  gestaoFilters: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  gestaoStats: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  gestaoStatCard: {
    flex: 1,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },

  // Incidentes screen skeleton
  incidentesResumo: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  incidentesResumoCard: {
    flex: 1,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  incidentesFiltros: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
}));
