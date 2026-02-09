import { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RotaHistoricoCard } from '@/components/motorista/historico/RotaHistoricoCard';
import { RotaCardSkeleton } from '@/components/motorista/RotaCardSkeleton';
import { Text } from '@/design-system';
import {
  useHistoricoData,
  useHistoricoFilters,
  useHistoricoMetrics,
  formatarTempo,
  type RotaHistorico,
} from '@/hooks/motorista/historico';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export default function HistoricoMotorista() {
  const { theme } = useUnistyles();
  const { rotas, loading, refreshing, onRefresh, AlertDialog } = useHistoricoData();
  const metricas = useHistoricoMetrics(rotas);
  const { filtroStatus, setFiltroStatus, filtroPeriodo, setFiltroPeriodo, rotasFiltradas } =
    useHistoricoFilters(rotas);
  const [expandedRotaId, setExpandedRotaId] = useState<string | null>(null);

  const toggleExpand = useCallback((rotaId: string) => {
    setExpandedRotaId(prev => prev === rotaId ? null : rotaId);
  }, []);

  const renderRota = useCallback(({ item }: { item: RotaHistorico }) => (
    <RotaHistoricoCard
      item={item}
      isExpanded={expandedRotaId === item.id}
      onToggle={() => toggleExpand(item.id)}
    />
  ), [expandedRotaId, toggleExpand]);

  const renderFilterButton = (
    label: string,
    isActive: boolean,
    onPress: () => void
  ) => (
    <TouchableOpacity
      style={[styles.filterButton, isActive && styles.filterButtonActive]}
      onPress={onPress}
      accessibilityLabel={`Filtrar por ${label}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <Text
        style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerCompact}>
          <Text style={styles.headerTitle}>Carregando...</Text>
        </View>
        <View style={styles.listContainer}>
          <RotaCardSkeleton />
          <RotaCardSkeleton />
          <RotaCardSkeleton />
        </View>
      </View>
    );
  }

  return (
    <ErrorBoundary>
    <View style={styles.container}>
      {/* Header Compacto */}
      <View style={styles.headerCompact}>
        <Text style={styles.headerTitle}>
          {rotas.length} {rotas.length === 1 ? 'rota' : 'rotas'}
        </Text>

        <View style={styles.statsInline}>
          <Text style={styles.statsInlineText}>
            {metricas.rotasMes} este mês ·{' '}
            <Text style={{ color: theme.colors.success }}>{metricas.rotasConcluidas}✓</Text> ·{' '}
            <Text style={{ color: theme.colors.purple600 }}>{metricas.taxaSucesso}%</Text> ·{' '}
            {formatarTempo(metricas.tempoMedioMinutos)} média
          </Text>
        </View>

        <Text style={styles.statsSecondaryText}>
          📍 {metricas.paradasConcluidas}/{metricas.paradasTotais} paradas · 🚗 {metricas.distanciaTotal} km
        </Text>
      </View>

      {/* Filtros */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>Período:</Text>
          <View style={styles.filterButtons}>
            {renderFilterButton('Todos', filtroPeriodo === 'todos', () => setFiltroPeriodo('todos'))}
            {renderFilterButton('Hoje', filtroPeriodo === 'hoje', () => setFiltroPeriodo('hoje'))}
            {renderFilterButton('Semana', filtroPeriodo === 'semana', () => setFiltroPeriodo('semana'))}
            {renderFilterButton('Mês', filtroPeriodo === 'mes', () => setFiltroPeriodo('mes'))}
          </View>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>Status:</Text>
          <View style={styles.filterButtons}>
            {renderFilterButton('Todos', filtroStatus === 'todos', () => setFiltroStatus('todos'))}
            {renderFilterButton('Concluída', filtroStatus === 'concluida', () => setFiltroStatus('concluida'))}
            {renderFilterButton('Pendente', filtroStatus === 'pendente', () => setFiltroStatus('pendente'))}
            {renderFilterButton('Cancelada', filtroStatus === 'cancelada', () => setFiltroStatus('cancelada'))}
            {renderFilterButton('Expirada', filtroStatus === 'nao_executada', () => setFiltroStatus('nao_executada'))}
          </View>
        </View>

        {(filtroStatus !== 'todos' || filtroPeriodo !== 'todos') && (
          <Text style={styles.filterResultCount}>
            Mostrando {rotasFiltradas.length} de {rotas.length} rotas
          </Text>
        )}
      </View>

      {/* Lista de Rotas */}
      <FlatList
        testID="motorista-historico-list"
        data={rotasFiltradas}
        keyExtractor={(item) => item.id}
        renderItem={renderRota}
        contentContainerStyle={styles.listContainer}
        initialNumToRender={5}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer} testID="motorista-historico-empty">
            <Text style={styles.emptyTitle}>📋</Text>
            <Text style={styles.emptyText}>Nenhuma rota registrada</Text>
            <Text style={styles.emptySubtext}>
              Suas rotas aparecerão aqui após serem criadas
            </Text>
          </View>
        }
      />
      {AlertDialog}
    </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  headerCompact: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  headerTitle: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.xl,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  statsInline: {
    marginBottom: theme.spacing.xs,
  },
  statsInlineText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray600,
  },
  statsSecondaryText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
  },
  filtersContainer: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  filterGroup: {
    marginBottom: theme.spacing.xs,
  },
  filterGroupLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontSansMedium,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  filterButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray100,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterButtonText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray600,
    fontFamily: theme.typography.fontSansMedium,
  },
  filterButtonTextActive: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
    textShadowColor: withOpacity(theme.colors.black, 0.15),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  filterResultCount: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginTop: theme.spacing.sm,
    fontStyle: 'italic',
  },
  listContainer: {
    padding: theme.spacing.md,
  },
  itemSeparator: {
    height: theme.spacing.sm,
  },
  emptyContainer: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 64,
    marginBottom: theme.spacing.lg,
  },
  emptyText: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
}));
