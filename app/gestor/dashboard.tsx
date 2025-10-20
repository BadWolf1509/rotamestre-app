import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';

interface Stats {
  total: number;
  emAndamento: number;
  concluidas: number;
  distanciaTotal: number;
}

interface RotaResumo {
  id: string;
  data: string;
  status: string;
  motorista_nome: string;
  total_paradas: number;
  paradas_concluidas: number;
  distancia_total: number;
}

export default function Dashboard() {
  const router = useRouter();
  const { userData, loading: userLoading } = useUser();
  const [stats, setStats] = useState<Stats>({
    total: 0,
    emAndamento: 0,
    concluidas: 0,
    distanciaTotal: 0,
  });
  const [rotas, setRotas] = useState<RotaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (userData?.unidade_id) {
      loadDashboard();
    }
  }, [userData]);

  async function loadDashboard() {
    try {
      setLoading(true);

      // Buscar rotas da unidade (hoje)
      const hoje = new Date().toISOString().split('T')[0];

      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select(`
          id,
          data,
          status,
          distancia_total,
          usuarios!motorista_id (nome)
        `)
        .eq('unidade_id', userData!.unidade_id)
        .gte('data', hoje)
        .order('created_at', { ascending: false });

      if (rotasError) throw rotasError;

      // Buscar paradas para cada rota
      const rotasComDetalhes = await Promise.all(
        (rotasData || []).map(async (rota: any) => {
          const { data: paradas } = await supabase
            .from('paradas')
            .select('id, status')
            .eq('rota_id', rota.id);

          return {
            id: rota.id,
            data: rota.data,
            status: rota.status,
            motorista_nome: rota.usuarios?.nome || 'Sem motorista',
            total_paradas: paradas?.length || 0,
            paradas_concluidas: paradas?.filter((p: any) => p.status === 'concluida').length || 0,
            distancia_total: rota.distancia_total || 0,
          };
        })
      );

      // Calcular estatísticas
      const statsCalculadas: Stats = {
        total: rotasComDetalhes.length,
        emAndamento: rotasComDetalhes.filter(r => r.status === 'em_andamento').length,
        concluidas: rotasComDetalhes.filter(r => r.status === 'concluida').length,
        distanciaTotal: rotasComDetalhes.reduce((acc, r) => acc + (r.distancia_total || 0), 0),
      };

      setStats(statsCalculadas);
      setRotas(rotasComDetalhes);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadDashboard();
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'pendente': return '#f59e0b';
      case 'em_andamento': return '#3b82f6';
      case 'concluida': return '#10b981';
      case 'cancelada': return '#ef4444';
      default: return '#6b7280';
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'pendente': return 'Pendente';
      case 'em_andamento': return 'Em Andamento';
      case 'concluida': return 'Concluída';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
  }

  if (userLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D5A9C" />
        <Text style={styles.loadingText}>Carregando dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {userData?.nome}!</Text>
          <Text style={styles.subtitle}>{userData?.unidades?.nome}</Text>
        </View>
      </View>

      {/* Cards de Estatísticas */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#0D5A9C' }]}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Hoje</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#FF8C00' }]}>
          <Text style={styles.statValue}>{stats.emAndamento}</Text>
          <Text style={styles.statLabel}>Em Andamento</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#10b981' }]}>
          <Text style={styles.statValue}>{stats.concluidas}</Text>
          <Text style={styles.statLabel}>Concluídas</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#8b5cf6' }]}>
          <Text style={styles.statValue}>{stats.distanciaTotal.toFixed(1)}</Text>
          <Text style={styles.statLabel}>km Total</Text>
        </View>
      </View>

      {/* Ações Rápidas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/gestor/nova-entrega')}
        >
          <Text style={styles.actionButtonText}>+ Nova Rota de Entrega</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => router.push('/gestor/motoristas')}
        >
          <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
            Gerenciar Motoristas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => router.push('/gestor/historico')}
        >
          <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
            Ver Histórico
          </Text>
        </TouchableOpacity>
      </View>

      {/* Rotas Recentes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rotas de Hoje</Text>

        {rotas.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Nenhuma rota cadastrada hoje</Text>
            <Text style={styles.emptyStateSubtext}>
              Crie sua primeira rota de entrega
            </Text>
          </View>
        ) : (
          rotas.map((rota) => (
            <TouchableOpacity
              key={rota.id}
              style={styles.rotaCard}
              onPress={() => {
                // Navegar para detalhes da rota
                console.log('Ver detalhes da rota:', rota.id);
              }}
            >
              <View style={styles.rotaHeader}>
                <Text style={styles.rotaMotorista}>{rota.motorista_nome}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(rota.status) },
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {getStatusLabel(rota.status)}
                  </Text>
                </View>
              </View>

              <Text style={styles.rotaData}>
                {new Date(rota.data).toLocaleDateString('pt-BR')}
              </Text>

              <View style={styles.rotaStats}>
                <Text style={styles.rotaStat}>
                  📍 {rota.paradas_concluidas}/{rota.total_paradas} paradas
                </Text>
                {rota.distancia_total > 0 && (
                  <Text style={styles.rotaStat}>
                    🚗 {rota.distancia_total.toFixed(1)} km
                  </Text>
                )}
              </View>

              {/* Barra de progresso */}
              {rota.total_paradas > 0 && (
                <View style={styles.progressContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${(rota.paradas_concluidas / rota.total_paradas) * 100}%`,
                      },
                    ]}
                  />
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#fff',
    marginTop: 5,
    opacity: 0.9,
  },
  section: {
    padding: 20,
    paddingTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 15,
  },
  actionButton: {
    backgroundColor: '#0D5A9C',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#0D5A9C',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: '#0D5A9C',
  },
  emptyState: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyStateText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  emptyStateSubtext: {
    color: '#6b7280',
    fontSize: 14,
  },
  rotaCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rotaMotorista: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  rotaData: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  rotaStats: {
    flexDirection: 'row',
    gap: 15,
  },
  rotaStat: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10b981',
  },
});
