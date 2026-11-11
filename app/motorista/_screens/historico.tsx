import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ScrollView,
} from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RotaHistoricoCard } from '@/components/motorista/historico/RotaHistoricoCard';
import { RotaCardSkeleton } from '@/components/motorista/RotaCardSkeleton';
import { SeletorPeriodo } from '@/components/periodo';
import { Text } from '@/design-system';
import {
  useHistoricoData,
  useHistoricoFilters,
  useHistoricoMetrics,
  formatarTempo,
  type RotaHistorico,
} from '@/hooks/motorista/historico';
import { useUser } from '@/hooks/useUser';
import { formatarDecimal } from '@/lib/formatNumber';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export default function HistoricoMotorista() {
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const {
    filtroStatus,
    setFiltroStatus,
    periodo,
    definirPeriodo,
    carregado,
    de,
    ate,
    textoDoPeriodo,
  } = useHistoricoFilters();
  const {
    rotas,
    total,
    temMais,
    loading,
    carregandoMais,
    refreshing,
    onRefresh,
    carregarMais,
    AlertDialog,
  } = useHistoricoData({ carregado, de, ate, status: filtroStatus });
  const {
    metricas,
    carregando: carregandoMetricas,
    recarregar: recarregarMetricas,
  } = useHistoricoMetrics({
    habilitado: carregado,
    motoristaId: userData?.id,
    de,
    ate,
    ehEsteMes: periodo.tipo === 'este_mes',
  });

  const onRefreshTudo = useCallback(() => {
    onRefresh();
    recarregarMetricas();
  }, [onRefresh, recarregarMetricas]);

  // Y de "Mostrando X de Y": com status "Todos", o total do resumo do período;
  // com um status escolhido, o count da própria consulta.
  const totalDaLista =
    filtroStatus === 'todos' && metricas ? metricas.rotasTotais : total;
  const filtrado = filtroStatus !== 'todos' || periodo.tipo !== 'todo';
  const [expandedRotaId, setExpandedRotaId] = useState<string | null>(null);

  const toggleExpand = useCallback((rotaId: string) => {
    setExpandedRotaId((prev) => (prev === rotaId ? null : rotaId));
  }, []);

  const renderRota = useCallback(
    ({ item }: { item: RotaHistorico }) => (
      <RotaHistoricoCard
        item={item}
        isExpanded={expandedRotaId === item.id}
        onToggle={() => toggleExpand(item.id)}
      />
    ),
    [expandedRotaId, toggleExpand],
  );

  const renderFilterButton = (
    label: string,
    isActive: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      style={[styles.filterButton, isActive && styles.filterButtonActive]}
      onPress={onPress}
      accessibilityLabel={`Filtrar por ${label}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <Text
        style={[
          styles.filterButtonText,
          isActive && styles.filterButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {/* Header Compacto */}
        <View style={styles.headerCompact}>
          <Text style={styles.headerTitle}>
            {metricas
              ? `${metricas.rotasTotais} ${metricas.rotasTotais === 1 ? 'rota' : 'rotas'}`
              : carregandoMetricas
                ? 'Carregando...'
                : 'Rotas'}
          </Text>
          <Text style={styles.statsSecondaryText}>{textoDoPeriodo}</Text>

          {metricas && (
            <>
              <View style={styles.statsInline}>
                <Text style={styles.statsInlineText}>
                  {metricas.rotasMes} este mês ·{' '}
                  <Text style={{ color: theme.colors.success }}>
                    {metricas.rotasConcluidas}✓
                  </Text>{' '}
                  ·{' '}
                  <Text style={{ color: theme.colors.purple600 }}>
                    {metricas.taxaSucesso}%
                  </Text>{' '}
                  · {formatarTempo(metricas.tempoMedioMinutos)} média
                </Text>
              </View>

              <Text style={styles.statsSecondaryText}>
                📍 {metricas.paradasConcluidas}/{metricas.paradasTotais} paradas
                · 🚗 {formatarDecimal(metricas.distanciaTotal)} km
              </Text>
            </>
          )}
        </View>

        {/* Filtros */}
        <View style={styles.filtersContainer}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupLabel}>Período:</Text>
            <SeletorPeriodo
              valor={periodo}
              aoMudar={definirPeriodo}
              testID="seletor-periodo-historico"
            />
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupLabel}>Status:</Text>
            <View style={styles.filterButtons}>
              {renderFilterButton('Todos', filtroStatus === 'todos', () =>
                setFiltroStatus('todos'),
              )}
              {renderFilterButton(
                'Concluída',
                filtroStatus === 'concluida',
                () => setFiltroStatus('concluida'),
              )}
              {renderFilterButton('Pendente', filtroStatus === 'pendente', () =>
                setFiltroStatus('pendente'),
              )}
              {renderFilterButton(
                'Cancelada',
                filtroStatus === 'cancelada',
                () => setFiltroStatus('cancelada'),
              )}
              {renderFilterButton(
                'Expirada',
                filtroStatus === 'nao_executada',
                () => setFiltroStatus('nao_executada'),
              )}
            </View>
          </View>

          {!loading && rotas.length > 0 && rotas.length < totalDaLista && (
            <Text style={styles.filterResultCount}>
              Mostrando {rotas.length} de {totalDaLista} rotas
            </Text>
          )}
        </View>

        {/* Lista de Rotas, ou o vazio no lugar dela. Não como ListEmptyComponent:
          ali o vazio ficava DENTRO da lista, e as duas âncoras (lista e vazio)
          apareciam juntas — o e2e as trata como exclusivas. */}
        {loading ? (
          <View style={styles.listContainer}>
            <RotaCardSkeleton />
            <RotaCardSkeleton />
            <RotaCardSkeleton />
          </View>
        ) : rotas.length === 0 ? (
          <ScrollView
            testID="motorista-historico-empty"
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefreshTudo}
                colors={[theme.colors.primary]}
              />
            }
          >
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>📋</Text>
              {/* Com rotas e nenhuma no filtro, o vazio fala do filtro. */}
              <Text style={styles.emptyText}>
                {filtroStatus !== 'todos'
                  ? 'Nenhuma rota com esse filtro'
                  : filtrado
                    ? 'Nenhuma rota neste período'
                    : 'Nenhuma rota registrada'}
              </Text>
              <Text style={styles.emptySubtext}>
                {filtrado
                  ? 'Troque o período ou o status para ver as outras rotas'
                  : 'Suas rotas aparecerão aqui após serem criadas'}
              </Text>
            </View>
          </ScrollView>
        ) : (
          <FlatList
            testID="motorista-historico-list"
            data={rotas}
            keyExtractor={(item) => item.id}
            renderItem={renderRota}
            contentContainerStyle={styles.listContainer}
            initialNumToRender={5}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
            ListFooterComponent={
              carregandoMais ? (
                <ActivityIndicator
                  style={styles.carregarMais}
                  color={theme.colors.primary}
                />
              ) : temMais ? (
                <TouchableOpacity
                  style={styles.carregarMais}
                  onPress={carregarMais}
                  accessibilityRole="button"
                  accessibilityLabel="Carregar mais rotas"
                  testID="motorista-historico-carregar-mais"
                >
                  <Text style={styles.carregarMaisTexto}>Carregar mais</Text>
                </TouchableOpacity>
              ) : undefined
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefreshTudo}
                colors={[theme.colors.primary]}
              />
            }
          />
        )}
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
  carregarMais: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  carregarMaisTexto: {
    fontSize: theme.typography.sm,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
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
