import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';

import { MobileLoading, MobileCard } from '@/components/mobile';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { StyleSheet, type Theme, useUnistyles } from '@/utils/styles';

interface PerformanceStats {
  totalRotas: number;
  rotasConcluidas: number;
  rotasCanceladas: number;
  taxaSucesso: number;
  totalKm: number;
  mediaParadasPorRota: number;
  totalParadas: number;
  paradasConcluidas: number;
  paradasPuladas: number;
}

type Periodo = '7d' | '30d' | 'all';

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'all', label: 'Total' },
];

export default function DesempenhoScreen() {
  const { theme } = useUnistyles();
  const { userData } = useUser();

  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>('30d');

  const loadStats = useCallback(async () => {
    if (!userData?.id) {
      setStats(null);
      setLoading(false);
      return;
    }

    try {
      // Calcular data de início baseado no período
      let dataInicio: string | null = null;
      const now = new Date();

      if (periodo === '7d') {
        const date = new Date(now);
        date.setDate(date.getDate() - 7);
        dataInicio = date.toISOString();
      } else if (periodo === '30d') {
        const date = new Date(now);
        date.setDate(date.getDate() - 30);
        dataInicio = date.toISOString();
      }

      // Buscar rotas do motorista
      let rotasQuery = supabase
        .from('rotas')
        .select('id, status, distancia_total')
        .eq('motorista_id', userData.id);

      if (dataInicio) {
        rotasQuery = rotasQuery.gte('created_at', dataInicio);
      }

      const { data: rotas, error: rotasError } = await rotasQuery;

      if (rotasError) throw rotasError;

      // Calcular estatísticas de rotas
      const rotasData = rotas || [];
      const totalRotas = rotasData.length;
      const rotasConcluidas = rotasData.filter((r) => r.status === 'concluida').length;
      const rotasCanceladas = rotasData.filter((r) => r.status === 'cancelada').length;
      const taxaSucesso = totalRotas > 0 ? Math.round((rotasConcluidas / totalRotas) * 100) : 0;
      const totalKm = rotasData.reduce((acc, r) => acc + (r.distancia_total || 0), 0);

      // Buscar paradas das rotas
      const rotaIds = rotasData.map((r) => r.id);
      let paradasData: any[] = [];

      if (rotaIds.length > 0) {
        const { data: paradas, error: paradasError } = await supabase
          .from('paradas')
          .select('id, status, rota_id')
          .in('rota_id', rotaIds)
          .or('is_checkpoint.is.null,is_checkpoint.eq.true');

        if (paradasError) throw paradasError;
        paradasData = paradas || [];
      }

      const totalParadas = paradasData.length;
      const paradasConcluidas = paradasData.filter((p) => p.status === 'concluida').length;
      const paradasPuladas = paradasData.filter((p) => p.status === 'pulada').length;
      const mediaParadasPorRota = totalRotas > 0 ? Math.round(totalParadas / totalRotas) : 0;

      setStats({
        totalRotas,
        rotasConcluidas,
        rotasCanceladas,
        taxaSucesso,
        totalKm,
        mediaParadasPorRota,
        totalParadas,
        paradasConcluidas,
        paradasPuladas,
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      setStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userData?.id, periodo]);

  useEffect(() => {
    setLoading(true);
    loadStats();
  }, [loadStats]);

  function handleRefresh() {
    setRefreshing(true);
    loadStats();
  }

  if (loading) {
    return <MobileLoading message="Carregando estatísticas..." />;
  }

  return (
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
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
    fontSize: 14,
    fontWeight: '500',
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
    shadowColor: '#000',
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
    fontSize: 36,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  mainStatLabel: {
    fontSize: 12,
    color: theme.colors.gray500,
  },
  mainStatDescription: {
    fontSize: 14,
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
    fontSize: 20,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.gray900,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray500,
    marginTop: 2,
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
    fontSize: 32,
  },
  motivationalText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
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
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  footer: {
    height: 40,
  },
}));
