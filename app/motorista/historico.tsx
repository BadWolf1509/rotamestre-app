import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';

import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface RotaHistorico {
  id: string;
  data: string;
  status: string;
  distancia_total?: number;
  iniciada_em?: string;
  concluida_em?: string;
  unidades: {
    nome: string;
  };
  paradas_count?: number;
  paradas_concluidas?: number;
}

export default function HistoricoMotorista() {
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const [rotas, setRotas] = useState<RotaHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRotaId, setExpandedRotaId] = useState<string | null>(null);

  const loadHistorico = useCallback(async () => {
    if (!userData?.id) {
      setRotas([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);

      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select('id, data, status, distancia_total, iniciada_em, concluida_em, unidades(nome)')
        .eq('motorista_id', userData.id)
        .order('data', { ascending: false });

      if (rotasError) throw rotasError;

      const rotasComParadas = await Promise.all(
        (rotasData || []).map(async (rota) => {
          const { data: paradasData, error: paradasError } = await supabase
            .from('paradas')
            .select('id, status, is_checkpoint')
            .eq('rota_id', rota.id);

          if (paradasError) {
            console.error('Erro ao buscar paradas:', paradasError);
            return {
              ...rota,
              paradas_count: 0,
              paradas_concluidas: 0,
            };
          }

          // Filtrar apenas paradas reais (sem checkpoints base)
          const paradasReais = (paradasData || []).filter(
            (parada) => parada.is_checkpoint !== false
          );

          return {
            ...rota,
            paradas_count: paradasReais.length,
            paradas_concluidas:
              paradasReais.filter((p) => p.status === 'concluida').length,
          };
        })
      );

      setRotas(rotasComParadas as unknown as RotaHistorico[]);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      Alert.alert('Erro', 'Não foi possível carregar o histórico');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userData?.id]);

  useEffect(() => {
    loadHistorico();
  }, [loadHistorico]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadHistorico();
  }, [loadHistorico]);

  function toggleExpand(rotaId: string) {
    setExpandedRotaId(expandedRotaId === rotaId ? null : rotaId);
  }

  function parseLocalDate(dataStr: string): Date | null {
    if (!dataStr) return null;
    const [year, month, day] = dataStr.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  function calcularTempoTotal(rota: RotaHistorico) {
    if (!rota.iniciada_em || !rota.concluida_em) return null;
    const inicio = new Date(rota.iniciada_em);
    const fim = new Date(rota.concluida_em);
    const diffMs = fim.getTime() - inicio.getTime();
    const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHoras}h ${diffMinutos}min`;
  }

  const renderRota = ({ item }: { item: RotaHistorico }) => {
    const isExpanded = expandedRotaId === item.id;
    const isPendente = item.status === 'pendente';
    const isEmAndamento = item.status === 'em_andamento';
    const isConcluida = item.status === 'concluida';
    const isCancelada = item.status === 'cancelada';

    const taxaConclusao =
      item.paradas_count && item.paradas_count > 0
        ? Math.round((item.paradas_concluidas! / item.paradas_count) * 100)
        : 0;

    const tempoTotal = calcularTempoTotal(item);

    return (
      <TouchableOpacity
        style={[
          styles.rotaCard,
          isPendente && styles.rotaCardPendente,
          isEmAndamento && styles.rotaCardEmAndamento,
          isConcluida && styles.rotaCardConcluida,
          isCancelada && styles.rotaCardCancelada,
        ]}
        onPress={() => toggleExpand(item.id)}
        activeOpacity={0.7}
      >
        {/* Header do Card */}
        <View style={styles.rotaHeader}>
          <View style={styles.rotaHeaderLeft}>
            <Text style={styles.rotaData}>
              {parseLocalDate(item.data)?.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }) || item.data}
            </Text>
            <Text style={styles.rotaUnidade}>{item.unidades.nome}</Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              isPendente && styles.statusBadgePendente,
              isEmAndamento && styles.statusBadgeEmAndamento,
              isConcluida && styles.statusBadgeConcluida,
              isCancelada && styles.statusBadgeCancelada,
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {isPendente && 'Pendente'}
              {isEmAndamento && 'Em Andamento'}
              {isConcluida && 'Concluída'}
              {isCancelada && 'Cancelada'}
            </Text>
          </View>
        </View>

        {/* Stats Rápidas */}
        <View style={styles.rotaStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.paradas_count || 0}</Text>
            <Text style={styles.statLabel}>Paradas</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.success }]}>
              {item.paradas_concluidas || 0}
            </Text>
            <Text style={styles.statLabel}>Concluídas</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.purple600 }]}>
              {taxaConclusao}%
            </Text>
            <Text style={styles.statLabel}>Taxa</Text>
          </View>
        </View>

        {/* Detalhes Expandidos */}
        {isExpanded && (
          <View style={styles.rotaDetalhes}>
            <View style={styles.divider} />

            {item.iniciada_em && (
              <View style={styles.detalheRow}>
                <Text style={styles.detalheLabel}>Início:</Text>
                <Text style={styles.detalheValue}>
                  {new Date(item.iniciada_em).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}

            {item.concluida_em && (
              <View style={styles.detalheRow}>
                <Text style={styles.detalheLabel}>Conclusão:</Text>
                <Text style={styles.detalheValue}>
                  {new Date(item.concluida_em).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}

            {tempoTotal && (
              <View style={styles.detalheRow}>
                <Text style={styles.detalheLabel}>Tempo Total:</Text>
                <Text style={styles.detalheValue}>{tempoTotal}</Text>
              </View>
            )}

            {item.distancia_total && (
              <View style={styles.detalheRow}>
                <Text style={styles.detalheLabel}>Distância:</Text>
                <Text style={styles.detalheValue}>
                  {item.distancia_total.toFixed(1)} km
                </Text>
              </View>
            )}

            {item.paradas_count && item.paradas_count > 0 && (
              <View style={styles.detalheRow}>
                <Text style={styles.detalheLabel}>Progresso:</Text>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${taxaConclusao}%` },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* Indicador de Expansão */}
        <View style={styles.expandIndicator}>
          <Text style={styles.expandIndicatorText}>
            {isExpanded ? '▲ Menos detalhes' : '▼ Mais detalhes'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando histórico...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Histórico de Rotas</Text>
        <Text style={styles.headerSubtitle}>
          {rotas.length} {rotas.length === 1 ? 'rota' : 'rotas'} registradas
        </Text>
      </View>

      {/* Lista de Rotas */}
      <FlatList
        data={rotas}
        keyExtractor={(item) => item.id}
        renderItem={renderRota}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>📋</Text>
            <Text style={styles.emptyText}>Nenhuma rota registrada</Text>
            <Text style={styles.emptySubtext}>
              Suas rotas aparecerão aqui após serem criadas
            </Text>
          </View>
        }
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
    marginTop: theme.spacing.lg,
    fontSize: 14,
    color: theme.colors.gray500,
  },
  header: {
    backgroundColor: theme.colors.white,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray300,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.gray500,
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  rotaCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.gray300,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  rotaCardPendente: {
    borderLeftColor: theme.colors.warning,
  },
  rotaCardEmAndamento: {
    borderLeftColor: theme.colors.blue500,
  },
  rotaCardConcluida: {
    borderLeftColor: theme.colors.success,
  },
  rotaCardCancelada: {
    borderLeftColor: theme.colors.error,
    opacity: 0.7,
  },
  rotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  rotaHeaderLeft: {
    flex: 1,
  },
  rotaData: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  rotaUnidade: {
    fontSize: 14,
    color: theme.colors.gray500,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgePendente: {
    backgroundColor: theme.colors.yellow100,
  },
  statusBadgeEmAndamento: {
    backgroundColor: theme.colors.blue100,
  },
  statusBadgeConcluida: {
    backgroundColor: theme.colors.green100,
  },
  statusBadgeCancelada: {
    backgroundColor: theme.colors.red100,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  rotaStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.gray500,
  },
  rotaDetalhes: {
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.gray300,
    marginVertical: 12,
  },
  detalheRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detalheLabel: {
    fontSize: 13,
    color: theme.colors.gray500,
    fontWeight: '500',
  },
  detalheValue: {
    fontSize: 13,
    color: theme.colors.gray900,
    fontWeight: '600',
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: theme.colors.gray300,
    borderRadius: 3,
    marginLeft: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.success,
    borderRadius: 3,
  },
  expandIndicator: {
    marginTop: 12,
    alignItems: 'center',
  },
  expandIndicatorText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
}));
