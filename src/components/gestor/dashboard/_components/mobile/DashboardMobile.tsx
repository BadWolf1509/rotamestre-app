import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';

import { AnimatedListItem } from '@/components/AnimatedListItem';
import { EmptyState } from '@/components/EmptyState';
import { RouteFilters } from '@/components/RouteFilters';
import type { RouteFiltersState as RouteFiltersType } from '@/components/RouteFilters';
import { Text, Toast } from '@/design-system';
import { useSignedUrl } from '@/hooks/storage/useSignedUrl';
import { useMotoristas } from '@/hooks/useMotoristas';
import { useToast } from '@/hooks/useToast';
import { withOpacity } from '@/utils/color';
import { getGreeting } from '@/utils/motivationalMessages';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { RotaCard } from '../shared/RotaCard';
import { StatsCard } from '../shared/StatsCard';

import type { DashboardData, RotaResumo } from '../../_hooks/useDashboardData';

interface DashboardMobileProps extends DashboardData {
  filters: RouteFiltersType;
  onFiltersChange: (filters: RouteFiltersType) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTempo(minutos: number): string {
  if (!minutos || minutos <= 0 || isNaN(minutos)) return '--';
  return `${Math.floor(minutos / 60)}h ${minutos % 60}m`;
}

/**
 * Layout mobile do Dashboard do Gestor
 * Usa FlatList com lazy loading para performance otimizada
 */
export function DashboardMobile({
  stats,
  todayStats,
  kpis,
  rotas,
  loading,
  refreshing,
  onRefresh,
  userData,
  filters,
  onFiltersChange,
}: DashboardMobileProps) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { toast: toastState, hideToast } = useToast();

  const { motoristas } = useMotoristas();
  const { url: avatarUrl } = useSignedUrl(userData?.foto_url);

  // ============================================================================
  // DERIVED DATA
  // ============================================================================

  const firstName = userData?.nome?.split(' ')[0] || '';
  const avatarInitial = firstName.charAt(0).toUpperCase();

  // KPI config for data-driven rendering
  const kpiConfig = useMemo(
    () => [
      {
        value: String(kpis.rotasMes),
        label: 'Rotas no Mês',
        icon: 'calendar-outline' as keyof typeof Ionicons.glyphMap,
        color: theme.colors.primary,
      },
      {
        value: `${kpis.taxaSucesso}%`,
        label: 'Taxa Sucesso',
        icon: 'checkmark-circle-outline' as keyof typeof Ionicons.glyphMap,
        color: theme.colors.success,
      },
      {
        value: formatTempo(kpis.tempoMedioMinutos),
        label: 'Tempo Médio',
        icon: 'timer-outline' as keyof typeof Ionicons.glyphMap,
        color: theme.colors.kpiDistancia,
      },
      {
        value: String(kpis.rotasSemana ?? 0),
        label: 'Esta Semana',
        icon: 'trending-up-outline' as keyof typeof Ionicons.glyphMap,
        color: theme.colors.secondary,
      },
    ],
    [kpis, theme.colors],
  );

  // ============================================================================
  // MEMOIZED CALLBACKS
  // ============================================================================

  const handleRotaPress = useCallback(
    (rotaId: string) => {
      router.push(`/gestor/mapa-rota?id=${rotaId}`);
    },
    [router],
  );

  const handleIncidentesPress = useCallback(() => {
    router.push('/gestor/incidentes');
  }, [router]);

  const handleNovaEntregaPress = useCallback(() => {
    router.push('/gestor/nova-entrega');
  }, [router]);

  const handleMotoristasPress = useCallback(() => {
    router.push('/gestor/motoristas');
  }, [router]);

  const handleGestaoRotasPress = useCallback(() => {
    router.push('/gestor/gestao-rotas');
  }, [router]);

  // ============================================================================
  // FLATLIST RENDER FUNCTIONS
  // ============================================================================

  const keyExtractor = useCallback((item: RotaResumo) => item.id, []);

  const renderRotaItem = useCallback(
    ({ item, index }: { item: RotaResumo; index: number }) => (
      <AnimatedListItem index={index}>
        <View style={styles.rotaItemContainer}>
          <RotaCard rota={item} onPress={() => handleRotaPress(item.id)} />
        </View>
      </AnimatedListItem>
    ),
    [handleRotaPress],
  );

  // Header component com stats, KPIs e ações
  const ListHeaderComponent = useMemo(
    () => (
      <>
        {/* Phase 3: Header with Avatar & Time-Based Greeting */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarInitial}</Text>
              </View>
            )}
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>
                {getGreeting()}, {firstName}!
              </Text>
              <View style={styles.headerSubtitleRow}>
                <Ionicons
                  name="business-outline"
                  size={12}
                  color={theme.colors.gray600}
                />
                <Text style={styles.headerSubtitle}>
                  {userData?.unidades?.nome}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Phase 1: Horizontal Scroll Stats Strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsStrip}
          testID="gestor-dashboard-stats"
          accessibilityLabel="Estatísticas do dia"
          accessibilityHint="Deslize para ver mais estatísticas"
        >
          <AnimatedListItem index={0}>
            <View style={styles.statsStripCard}>
              <StatsCard
                value={todayStats.totalHoje}
                label="Total Hoje"
                backgroundColor={theme.colors.primaryDark}
                icon="car-outline"
              />
            </View>
          </AnimatedListItem>
          <AnimatedListItem index={1}>
            <View style={styles.statsStripCard}>
              <StatsCard
                value={stats.emAndamento}
                label="Em Andamento"
                backgroundColor={theme.colors.secondary}
                icon="navigate-circle-outline"
              />
            </View>
          </AnimatedListItem>
          <AnimatedListItem index={2}>
            <View style={styles.statsStripCard}>
              <StatsCard
                value={stats.concluidas}
                label="Concluídas"
                backgroundColor={theme.colors.kpiConcluidas}
                icon="checkmark-circle-outline"
              />
            </View>
          </AnimatedListItem>
          <AnimatedListItem index={3}>
            <View style={styles.statsStripCard}>
              <StatsCard
                value={stats.distanciaTotal.toFixed(1)}
                label="km Total"
                backgroundColor={theme.colors.kpiDistanciaDark}
                icon="speedometer-outline"
              />
            </View>
          </AnimatedListItem>
          <AnimatedListItem index={4}>
            <TouchableOpacity
              style={styles.statsStripCard}
              onPress={handleIncidentesPress}
              activeOpacity={0.8}
            >
              <StatsCard
                value={stats.incidentesAbertos || 0}
                label="Incidentes Abertos"
                backgroundColor={theme.colors.kpiIncidentes}
                icon="warning-outline"
              />
            </TouchableOpacity>
          </AnimatedListItem>
        </ScrollView>

        {/* Phase 5: Section Divider */}
        <View style={styles.sectionDivider} />

        {/* Phase 2 + 5: KPIs with Icons & Section Title Accent */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleAccent} />
            <Text style={styles.sectionTitle}>Performance do Mês</Text>
          </View>

          <View style={styles.kpisGrid}>
            {kpiConfig.map((kpi) => (
              <View
                key={kpi.label}
                style={[styles.kpiCard, { borderLeftColor: kpi.color }]}
              >
                <View
                  style={[
                    styles.kpiIconCircle,
                    { backgroundColor: withOpacity(kpi.color, 0.15) },
                  ]}
                >
                  <Ionicons name={kpi.icon} size={18} color={kpi.color} />
                </View>
                <Text style={styles.kpiValue}>{kpi.value}</Text>
                <Text style={styles.kpiLabel}>{kpi.label}</Text>
              </View>
            ))}
          </View>

          {/* Phase 4: Motorista Destaque Card Redesign */}
          {kpis.motoristaDestaque && (
            <View style={styles.destaqueCard}>
              <View style={styles.destaqueAccentBar} />
              <View style={styles.destaqueBody}>
                <View style={styles.destaqueTrophyCircle}>
                  <Ionicons
                    name="trophy"
                    size={22}
                    color={theme.colors.secondary}
                  />
                </View>
                <View style={styles.destaqueContent}>
                  <Text style={styles.destaqueLabel}>Motorista Destaque</Text>
                  <Text style={styles.destaqueNome}>
                    {kpis.motoristaDestaque.nome}
                  </Text>
                  <View style={styles.destaqueBadge}>
                    <Ionicons
                      name="checkmark-circle"
                      size={12}
                      color={theme.colors.successDark}
                    />
                    <Text style={styles.destaqueBadgeText}>
                      {kpis.motoristaDestaque.rotasConcluidas} rotas concluídas
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Phase 5: Section Divider */}
        <View style={styles.sectionDivider} />

        {/* Ações Rápidas */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleAccent} />
            <Text style={styles.sectionTitle}>Ações Rápidas</Text>
          </View>

          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={handleNovaEntregaPress}
              accessibilityRole="button"
              accessibilityLabel="Nova Rota de Entrega"
            >
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: withOpacity(theme.colors.primary, 0.1) },
                ]}
              >
                <Ionicons
                  name="add-circle"
                  size={22}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={styles.quickActionLabel}>Nova Rota</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={handleMotoristasPress}
              accessibilityRole="button"
              accessibilityLabel="Gerenciar Motoristas"
            >
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: withOpacity(theme.colors.success, 0.1) },
                ]}
              >
                <Ionicons
                  name="people"
                  size={22}
                  color={theme.colors.success}
                />
              </View>
              <Text style={styles.quickActionLabel}>Motoristas</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={handleGestaoRotasPress}
              accessibilityRole="button"
              accessibilityLabel="Gestão de Rotas"
            >
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: withOpacity(theme.colors.secondary, 0.1) },
                ]}
              >
                <Ionicons
                  name="clipboard"
                  size={22}
                  color={theme.colors.secondary}
                />
              </View>
              <Text style={styles.quickActionLabel}>Gestão</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Phase 5: Section Divider */}
        <View style={styles.sectionDivider} />

        {/* Título da seção de rotas */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleAccent} />
            <Text style={styles.sectionTitle}>Rotas de Hoje</Text>
          </View>
        </View>
      </>
    ),
    [
      userData,
      avatarUrl,
      avatarInitial,
      firstName,
      todayStats,
      stats,
      kpis,
      kpiConfig,
      theme.colors,
      handleIncidentesPress,
      handleNovaEntregaPress,
      handleMotoristasPress,
      handleGestaoRotasPress,
    ],
  );

  // Empty state quando não há rotas
  const ListEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyStateContainer}>
        <EmptyState
          icon="map-outline"
          title="Nenhuma rota cadastrada hoje"
          description="Crie sua primeira rota de entrega para começar"
          actionLabel="Nova Rota de Entrega"
          onActionPress={handleNovaEntregaPress}
        />
      </View>
    ),
    [handleNovaEntregaPress],
  );

  // Footer com espaço extra para o FAB não cobrir conteúdo
  const ListFooterComponent = useMemo(
    () => <View style={styles.listFooter} />,
    [],
  );

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primaryDark} />
        <Text style={styles.loadingText}>Carregando início...</Text>
      </View>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <View style={styles.container}>
      <FlatList
        testID="dashboard-flat-list"
        data={rotas}
        keyExtractor={keyExtractor}
        renderItem={renderRotaItem}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        // Performance optimizations
        initialNumToRender={5}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        // Evita re-renders desnecessários
        extraData={rotas.length}
        // Acessibilidade
        accessible={true}
        accessibilityLabel="Lista de rotas do dia"
      />

      {/* Toast de Feedback */}
      <Toast {...toastState} onDismiss={hideToast} />

      {/* Floating Filter Button */}
      <RouteFilters
        filters={filters}
        onFiltersChange={onFiltersChange}
        motoristas={motoristas}
        variant="mobile"
      />
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },

  // Phase 3: Header with avatar
  header: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.primary,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: theme.typography['2xl'],
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray600,
  },

  // Phase 1: Horizontal scroll stats strip
  statsStrip: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  statsStripCard: {
    width: 130,
  },

  // Phase 5: Section dividers and spacing
  sectionDivider: {
    height: 1,
    backgroundColor: theme.colors.gray200,
    marginHorizontal: theme.spacing.xl,
  },
  section: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
  },
  sectionHeader: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  sectionTitleAccent: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
  sectionTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
    textAlign: 'center',
  },
  rotaItemContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
  },
  emptyStateContainer: {
    paddingHorizontal: theme.spacing.xl,
  },
  // Empty state uses EmptyState component (no custom styles needed)

  // Phase 2: KPI cards with icons and accents
  kpisGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderLeftWidth: 3,
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  kpiIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: theme.typography['2xl'],
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
    letterSpacing: -0.5,
  },
  kpiLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
  },

  // Phase 4: Motorista destaque redesign
  destaqueCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  destaqueAccentBar: {
    height: 4,
    backgroundColor: theme.colors.secondary,
  },
  destaqueBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  destaqueTrophyCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.secondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destaqueContent: {
    flex: 1,
  },
  destaqueLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginBottom: 2,
  },
  destaqueNome: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  destaqueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.successBg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  destaqueBadgeText: {
    fontSize: theme.typography.xs,
    color: theme.colors.successDark,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  listFooter: {
    height: 100, // Espaço para o FAB não cobrir o último item
  },
}));
