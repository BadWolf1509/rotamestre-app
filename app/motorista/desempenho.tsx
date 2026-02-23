import { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MobileCard, MobileLoading } from '@/design-system';
import { useDesempenhoStats, type Periodo } from '@/hooks/motorista/useDesempenhoStats';
import { useAlert } from '@/hooks/useAlert';
import { useUser } from '@/hooks/useUser';
import { StyleSheet, type Theme, useUnistyles } from '@/utils/styles';

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'all', label: 'Total' },
];

export default function DesempenhoScreen() {
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const { showError, AlertDialog } = useAlert();

  const {
    stats,
    loading,
    refreshing,
    periodo,
    setPeriodo,
    refresh,
    error,
  } = useDesempenhoStats(userData?.id);

  // Show error feedback when hook reports an error
  useEffect(() => {
    if (error) {
      showError({ title: 'Erro', message: error });
    }
  }, [error, showError]);

  if (loading) {
    return <MobileLoading message="Carregando estatísticas..." />;
  }

  return (
    <ErrorBoundary>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        {/* Seletor de Período */}
        <View style={styles.periodoContainer}>
          {PERIODOS.map((p) => (
            <TouchableOpacity
              key={p.value}
              style={[
                styles.periodoButton,
                periodo === p.value && styles.periodoButtonActive,
              ]}
              onPress={() => setPeriodo(p.value)}
            >
              <Text
                style={[
                  styles.periodoText,
                  periodo === p.value && styles.periodoTextActive,
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {stats ? (
          <>
            {/* Card Principal - Taxa de Sucesso */}
            <View style={styles.mainStatCard}>
              <View style={styles.mainStatCircle}>
                <Text style={styles.mainStatValue}>{stats.taxaSucesso}%</Text>
                <Text style={styles.mainStatLabel}>Taxa de Sucesso</Text>
              </View>
              <Text style={styles.mainStatDescription}>
                {stats.rotasConcluidas} de {stats.totalRotas} rotas concluídas
              </Text>
            </View>

            {/* Grid de Estatísticas */}
            <MobileCard title="Estatísticas de Rotas">
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Text style={styles.statIconText}>🗺️</Text>
                  </View>
                  <Text style={styles.statValue}>{stats.totalRotas}</Text>
                  <Text style={styles.statLabel}>Rotas</Text>
                </View>

                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: theme.colors.success + '20' }]}>
                    <Text style={styles.statIconText}>✓</Text>
                  </View>
                  <Text style={styles.statValue}>{stats.rotasConcluidas}</Text>
                  <Text style={styles.statLabel}>Concluídas</Text>
                </View>

                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: theme.colors.error + '20' }]}>
                    <Text style={styles.statIconText}>✕</Text>
                  </View>
                  <Text style={styles.statValue}>{stats.rotasCanceladas}</Text>
                  <Text style={styles.statLabel}>Canceladas</Text>
                </View>

                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: theme.colors.blue100 }]}>
                    <Text style={styles.statIconText}>📏</Text>
                  </View>
                  <Text style={styles.statValue}>{stats.totalKm.toFixed(0)}</Text>
                  <Text style={styles.statLabel}>Km rodados</Text>
                </View>
              </View>
            </MobileCard>

            {/* Estatísticas de Paradas */}
            <MobileCard title="Estatísticas de Paradas">
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: theme.colors.gray100 }]}>
                    <Text style={styles.statIconText}>📍</Text>
                  </View>
                  <Text style={styles.statValue}>{stats.totalParadas}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>

                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: theme.colors.green100 }]}>
                    <Text style={styles.statIconText}>✓</Text>
                  </View>
                  <Text style={styles.statValue}>{stats.paradasConcluidas}</Text>
                  <Text style={styles.statLabel}>Concluídas</Text>
                </View>

                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: theme.colors.yellow100 }]}>
                    <Text style={styles.statIconText}>⊘</Text>
                  </View>
                  <Text style={styles.statValue}>{stats.paradasPuladas}</Text>
                  <Text style={styles.statLabel}>Puladas</Text>
                </View>

                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: theme.colors.purple + '20' }]}>
                    <Text style={styles.statIconText}>📊</Text>
                  </View>
                  <Text style={styles.statValue}>{stats.mediaParadasPorRota}</Text>
                  <Text style={styles.statLabel}>Média/Rota</Text>
                </View>
              </View>
            </MobileCard>

            {/* Mensagem Motivacional */}
            <View style={styles.motivationalCard}>
              {stats.taxaSucesso >= 90 ? (
                <>
                  <Text style={styles.motivationalIcon}>🏆</Text>
                  <Text style={styles.motivationalText}>Excelente desempenho! Continue assim!</Text>
                </>
              ) : stats.taxaSucesso >= 70 ? (
                <>
                  <Text style={styles.motivationalIcon}>💪</Text>
                  <Text style={styles.motivationalText}>Bom trabalho! Você está no caminho certo.</Text>
                </>
              ) : stats.totalRotas === 0 ? (
                <>
                  <Text style={styles.motivationalIcon}>🚀</Text>
                  <Text style={styles.motivationalText}>Comece sua primeira rota e acompanhe seu desempenho!</Text>
                </>
              ) : (
                <>
                  <Text style={styles.motivationalIcon}>📈</Text>
                  <Text style={styles.motivationalText}>Há espaço para melhorar. Vamos em frente!</Text>
                </>
              )}
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>Sem dados disponíveis</Text>
            <Text style={styles.emptySubtitle}>
              Complete algumas rotas para ver suas estatísticas
            </Text>
          </View>
        )}

        <View style={styles.footer} />
      </ScrollView>
      {AlertDialog}
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  periodoContainer: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  periodoButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    alignItems: 'center',
  },
  periodoButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  periodoText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray600,
  },
  periodoTextActive: {
    color: theme.colors.white,
  },
  mainStatCard: {
    backgroundColor: theme.colors.white,
    margin: theme.spacing.md,
    marginTop: 0,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mainStatCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: theme.colors.primary + '15',
    borderWidth: 6,
    borderColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  mainStatValue: {
    fontSize: theme.typography['4xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.primary,
  },
  mainStatLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
  },
  mainStatDescription: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray600,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  statIconText: {
    fontSize: theme.typography.xl,
  },
  statValue: {
    fontSize: theme.typography['2xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  statLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
  },
  motivationalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.green50,
    margin: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.green100,
    gap: theme.spacing.md,
  },
  motivationalIcon: {
    fontSize: theme.typography['3xl'],
  },
  motivationalText: {
    flex: 1,
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.green800,
  },
  emptyState: {
    alignItems: 'center',
    padding: theme.spacing['2xl'],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  footer: {
    height: theme.spacing['3xl'],
  },
}));
