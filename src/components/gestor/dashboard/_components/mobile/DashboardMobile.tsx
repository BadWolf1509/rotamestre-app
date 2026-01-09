import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';

import { RouteFilters } from '@/components/RouteFilters';
import type { RouteFiltersState as RouteFiltersType } from '@/components/RouteFilters';
import { Button, Text, Toast } from '@/design-system';
import { useMotoristas } from '@/hooks/useMotoristas';
import { useToast } from '@/hooks/useToast';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { RotaCard } from '../shared/RotaCard';
import { StatsCard } from '../shared/StatsCard';

import type { DashboardData, RotaResumo } from '../../_hooks/useDashboardData';

interface DashboardMobileProps extends DashboardData {
  filters: RouteFiltersType;
  onFiltersChange: (filters: RouteFiltersType) => void;
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

  // ============================================================================
  // MEMOIZED CALLBACKS
  // ============================================================================

  const handleRotaPress = useCallback(
    (rotaId: string) => {
      router.push(`/gestor/mapa-rota?id=${rotaId}`);
    },
    [router]
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
    ({ item }: { item: RotaResumo }) => (
      <View style={styles.rotaItemContainer}>
        <RotaCard rota={item} onPress={() => handleRotaPress(item.id)} />
      </View>
    ),
    [handleRotaPress]
  );

  // Header component com stats, KPIs e ações
  const ListHeaderComponent = useMemo(
    () => (
      <>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Olá, {userData?.nome}!</Text>
            <Text style={styles.headerSubtitle}>{userData?.unidades?.nome}</Text>
          </View>
        </View>

        {/* Cards de Estatísticas - Grid 2x2 */}
        <View style={styles.statsGrid} testID="gestor-dashboard-stats">
          <View style={styles.statsCardWrapper}>
            <StatsCard
              value={todayStats.totalHoje}
              label="Total Hoje"
              backgroundColor={theme.colors.primaryDark}
            />
          </View>
          <View style={styles.statsCardWrapper}>
            <StatsCard
              value={stats.emAndamento}
              label="Em Andamento"
              backgroundColor={theme.colors.secondary}
            />
          </View>
          <View style={styles.statsCardWrapper}>
            <StatsCard
              value={stats.concluidas}
              label="Concluídas"
              backgroundColor={theme.colors.kpiConcluidas}
            />
          </View>
          <View style={styles.statsCardWrapper}>
            <StatsCard
              value={stats.distanciaTotal.toFixed(1)}
              label="km Total"
              backgroundColor={theme.colors.kpiDistancia}
            />
          </View>
          <TouchableOpacity
            style={styles.statsCardWrapper}
            onPress={handleIncidentesPress}
            activeOpacity={0.8}
          >
            <StatsCard
              value={stats.incidentesAbertos || 0}
              label="Incidentes Abertos"
              backgroundColor={theme.colors.kpiIncidentes}
            />
          </TouchableOpacity>
        </View>

        {/* KPIs Avançados */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance do Mês</Text>

          <View style={styles.kpisGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{kpis.rotasMes}</Text>
              <Text style={styles.kpiLabel}>Rotas no Mês</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: theme.colors.success }]}>
                {kpis.taxaSucesso}%
              </Text>
              <Text style={styles.kpiLabel}>Taxa Sucesso</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>
                {kpis.tempoMedioMinutos > 0
                  ? `${Math.floor(kpis.tempoMedioMinutos / 60)}h ${kpis.tempoMedioMinutos % 60}m`
                  : '-'}
              </Text>
              <Text style={styles.kpiLabel}>Tempo Médio</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{kpis.rotasSemana}</Text>
              <Text style={styles.kpiLabel}>Esta Semana</Text>
            </View>
          </View>

          {/* Motorista Destaque */}
          {kpis.motoristaDestaque && (
            <View style={styles.destaqueCard}>
              <Ionicons name="trophy" size={20} color={theme.colors.secondary} />
              <View style={styles.destaqueContent}>
                <Text style={styles.destaqueLabel}>Motorista Destaque</Text>
                <Text style={styles.destaqueNome}>{kpis.motoristaDestaque.nome}</Text>
                <Text style={styles.destaqueStats}>
                  {kpis.motoristaDestaque.rotasConcluidas} rotas concluídas
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Ações Rápidas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ações Rápidas</Text>

          <View style={styles.actionsContainer}>
            <Button
              title="Nova Rota de Entrega"
              icon="add-circle"
              variant="primary"
              onPress={handleNovaEntregaPress}
              fullWidth
            />

            <Button
              title="Gerenciar Motoristas"
              icon="people"
              variant="outline"
              onPress={handleMotoristasPress}
              fullWidth
              style={styles.secondaryButton}
            />

            <Button
              title="Gestão de Rotas"
              icon="clipboard"
              variant="outline"
              onPress={handleGestaoRotasPress}
              fullWidth
              style={styles.secondaryButton}
            />
          </View>
        </View>

        {/* Título da seção de rotas */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Rotas de Hoje</Text>
        </View>
      </>
    ),
    [
      userData,
      todayStats,
      stats,
      kpis,
      theme.colors,
      handleIncidentesPress,
      handleNovaEntregaPress,
      handleMotoristasPress,
      handleGestaoRotasPress,
    ]
  );

  // Empty state quando não há rotas
  const ListEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyStateContainer}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>Nenhuma rota cadastrada hoje</Text>
          <Text style={styles.emptyStateSubtitle}>Crie sua primeira rota de entrega</Text>
        </View>
      </View>
    ),
    []
  );

  // Footer com espaço extra para o FAB não cobrir conteúdo
  const ListFooterComponent = useMemo(
    () => <View style={styles.listFooter} />,
    []
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
  header: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  headerTextContainer: {
    width: '100%',
  },
  headerTitle: {
    fontSize: theme.typography['3xl'],
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
  },
  headerSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  statsCardWrapper: {
    width: '48%',
  },
  section: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  sectionHeader: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.lg,
  },
  actionsContainer: {
    gap: theme.spacing.sm,
  },
  secondaryButton: {
    backgroundColor: theme.colors.white,
  },
  rotaItemContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
  },
  emptyStateContainer: {
    paddingHorizontal: theme.spacing.xl,
  },
  emptyState: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing['3xl'],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: theme.typography.base,
    color: theme.colors.gray700,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  kpisGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: theme.typography['2xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  destaqueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.secondaryBg,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.md,
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
  destaqueStats: {
    fontSize: theme.typography.sm,
    color: theme.colors.secondary,
    marginTop: 2,
  },
  listFooter: {
    height: 100, // Espaço para o FAB não cobrir o último item
  },
}));
