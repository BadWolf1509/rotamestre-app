import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';

import { RotaCardSkeleton } from '@/components/motorista/RotaCardSkeleton';
import { useUser } from '@/hooks/useUser';
import { parseLocalDate } from '@/lib/dateUtils';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

type FiltroStatus = 'todos' | 'concluida' | 'pendente' | 'em_andamento' | 'cancelada' | 'nao_executada';
type FiltroPeriodo = 'todos' | 'hoje' | 'semana' | 'mes';

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

interface Metricas {
  rotasTotais: number;
  rotasConcluidas: number;
  rotasMes: number;
  paradasTotais: number;
  paradasConcluidas: number;
  distanciaTotal: number;
  tempoMedioMinutos: number;
  taxaSucesso: number;
}

export default function HistoricoMotorista() {
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const [rotas, setRotas] = useState<RotaHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRotaId, setExpandedRotaId] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>('todos');

  // Calcular métricas a partir das rotas
  const metricas = useMemo((): Metricas => {
    if (rotas.length === 0) {
      return {
        rotasTotais: 0,
        rotasConcluidas: 0,
        rotasMes: 0,
        paradasTotais: 0,
        paradasConcluidas: 0,
        distanciaTotal: 0,
        tempoMedioMinutos: 0,
        taxaSucesso: 0,
      };
    }

    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    let totalParadas = 0;
    let paradasConcluidas = 0;
    let distanciaTotal = 0;
    let tempoTotalMinutos = 0;
    let rotasComTempo = 0;
    let rotasMes = 0;
    let rotasConcluidas = 0;

    rotas.forEach((rota) => {
      totalParadas += rota.paradas_count || 0;
      paradasConcluidas += rota.paradas_concluidas || 0;
      distanciaTotal += rota.distancia_total || 0;

      if (rota.status === 'concluida') {
        rotasConcluidas++;
      }

      // Contar rotas do mês
      const dataRota = parseLocalDate(rota.data);
      if (dataRota && dataRota >= inicioMes) {
        rotasMes++;
      }

      // Calcular tempo médio
      if (rota.iniciada_em && rota.concluida_em) {
        const inicio = new Date(rota.iniciada_em);
        const fim = new Date(rota.concluida_em);
        const diffMinutos = (fim.getTime() - inicio.getTime()) / (1000 * 60);
        if (diffMinutos > 0 && diffMinutos < 1440) {
          // Menos de 24h
          tempoTotalMinutos += diffMinutos;
          rotasComTempo++;
        }
      }
    });

    const taxaSucesso =
      totalParadas > 0 ? Math.round((paradasConcluidas / totalParadas) * 100) : 0;

    const tempoMedioMinutos =
      rotasComTempo > 0 ? Math.round(tempoTotalMinutos / rotasComTempo) : 0;

    return {
      rotasTotais: rotas.length,
      rotasConcluidas,
      rotasMes,
      paradasTotais: totalParadas,
      paradasConcluidas,
      distanciaTotal: Math.round(distanciaTotal * 10) / 10,
      tempoMedioMinutos,
      taxaSucesso,
    };
  }, [rotas]);

  // Filtrar rotas baseado nos filtros selecionados
  const rotasFiltradas = useMemo(() => {
    let resultado = [...rotas];

    // Filtrar por status
    if (filtroStatus !== 'todos') {
      resultado = resultado.filter((r) => r.status === filtroStatus);
    }

    // Filtrar por período
    if (filtroPeriodo !== 'todos') {
      const agora = new Date();
      const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

      resultado = resultado.filter((r) => {
        const dataRota = parseLocalDate(r.data);
        if (!dataRota) return false;

        switch (filtroPeriodo) {
          case 'hoje':
            return dataRota >= hoje;
          case 'semana': {
            const inicioSemana = new Date(hoje);
            inicioSemana.setDate(hoje.getDate() - hoje.getDay());
            return dataRota >= inicioSemana;
          }
          case 'mes': {
            const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
            return dataRota >= inicioMes;
          }
          default:
            return true;
        }
      });
    }

    return resultado;
  }, [rotas, filtroStatus, filtroPeriodo]);

  const loadHistorico = useCallback(async () => {
    if (!userData?.id) {
      setRotas([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);

      // 1. Buscar todas as rotas do motorista
      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select('id, data, status, distancia_total, iniciada_em, concluida_em, unidades(nome)')
        .eq('motorista_id', userData.id)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false });

      if (rotasError) throw rotasError;

      if (!rotasData || rotasData.length === 0) {
        setRotas([]);
        return;
      }

      // 2. Buscar TODAS as paradas em UMA única query (resolve N+1)
      const rotaIds = rotasData.map((r) => r.id);
      const { data: todasParadas, error: paradasError } = await supabase
        .from('paradas')
        .select('rota_id, id, status, is_checkpoint')
        .in('rota_id', rotaIds);

      if (paradasError) {
        console.error('Erro ao buscar paradas:', paradasError);
      }

      // 3. Agrupar paradas por rota_id no JavaScript
      type ParadaItem = { rota_id: string; id: string; status: string; is_checkpoint: boolean | null };
      const paradasPorRota: Record<string, ParadaItem[]> = {};
      (todasParadas || []).forEach((parada) => {
        if (!paradasPorRota[parada.rota_id]) {
          paradasPorRota[parada.rota_id] = [];
        }
        paradasPorRota[parada.rota_id].push(parada);
      });

      // 4. Montar rotas com contagem de paradas
      const rotasComParadas = rotasData.map((rota) => {
        const paradasDaRota = paradasPorRota[rota.id] || [];
        // Filtrar apenas paradas reais (sem checkpoints base)
        const paradasReais = paradasDaRota.filter(
          (parada) => parada.is_checkpoint !== false
        );

        return {
          ...rota,
          paradas_count: paradasReais.length,
          paradas_concluidas: paradasReais.filter((p) => p.status === 'concluida').length,
        };
      });

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
    const isNaoExecutada = item.status === 'nao_executada';

    const taxaConclusao =
      item.paradas_count && item.paradas_count > 0
        ? Math.round((item.paradas_concluidas! / item.paradas_count) * 100)
        : 0;

    // Calcular paradas pendentes para rotas expiradas
    const paradasPendentes = (item.paradas_count || 0) - (item.paradas_concluidas || 0);

    const tempoTotal = calcularTempoTotal(item);

    const statusLabel = isPendente
      ? 'pendente'
      : isEmAndamento
        ? 'em andamento'
        : isConcluida
          ? 'concluída'
          : isNaoExecutada
            ? 'não executada'
            : 'cancelada';

    return (
      <TouchableOpacity
        style={[
          styles.rotaCard,
          isPendente && styles.rotaCardPendente,
          isEmAndamento && styles.rotaCardEmAndamento,
          isConcluida && styles.rotaCardConcluida,
          isCancelada && styles.rotaCardCancelada,
          isNaoExecutada && styles.rotaCardNaoExecutada,
        ]}
        onPress={() => toggleExpand(item.id)}
        activeOpacity={0.7}
        accessibilityLabel={`Rota ${statusLabel} de ${item.unidades.nome}, ${item.paradas_count || 0} paradas`}
        accessibilityRole="button"
        accessibilityHint={isExpanded ? 'Toque para recolher detalhes' : 'Toque para ver mais detalhes'}
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
              isNaoExecutada && styles.statusBadgeNaoExecutada,
            ]}
          >
            <Text style={[
              styles.statusBadgeText,
              isNaoExecutada && styles.statusBadgeTextNaoExecutada,
            ]}>
              {isPendente && 'Pendente'}
              {isEmAndamento && 'Em Andamento'}
              {isConcluida && 'Concluída'}
              {isCancelada && 'Cancelada'}
              {isNaoExecutada && '⚠️ Não Executada'}
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

            {/* Aviso especial para rotas não executadas */}
            {isNaoExecutada && paradasPendentes > 0 && (
              <View style={styles.naoExecutadaInfo}>
                <Ionicons name="warning" size={16} color={theme.colors.warning} />
                <Text style={styles.naoExecutadaInfoText}>
                  {paradasPendentes} {paradasPendentes === 1 ? 'parada ficou pendente' : 'paradas ficaram pendentes'}
                </Text>
              </View>
            )}

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
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.colors.primary}
          />
          <Text style={styles.expandIndicatorText}>
            {isExpanded ? 'Menos detalhes' : 'Mais detalhes'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

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

  // Formatar tempo em horas e minutos
  function formatarTempo(minutos: number): string {
    if (minutos === 0) return '-';
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas === 0) return `${mins}min`;
    return `${horas}h ${mins}min`;
  }

  // Renderizar botão de filtro
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

  return (
    <View style={styles.container}>
      {/* Header Compacto - sem repetir título (já está no header azul) */}
      <View style={styles.headerCompact}>
        {/* Linha 1: Contagem de rotas */}
        <Text style={styles.headerTitle}>
          {rotas.length} {rotas.length === 1 ? 'rota' : 'rotas'}
        </Text>

        {/* Linha 2: Stats inline */}
        <View style={styles.statsInline}>
          <Text style={styles.statsInlineText}>
            {metricas.rotasMes} este mês ·{' '}
            <Text style={{ color: theme.colors.success }}>{metricas.rotasConcluidas}✓</Text> ·{' '}
            <Text style={{ color: theme.colors.purple600 }}>{metricas.taxaSucesso}%</Text> ·{' '}
            {formatarTempo(metricas.tempoMedioMinutos)} média
          </Text>
        </View>

        {/* Linha 3: Stats secundários */}
        <Text style={styles.statsSecondaryText}>
          📍 {metricas.paradasConcluidas}/{metricas.paradasTotais} paradas · 🚗 {metricas.distanciaTotal} km
        </Text>
      </View>

      {/* Filtros */}
      <View style={styles.filtersContainer}>
        {/* Filtro por Período */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>Período:</Text>
          <View style={styles.filterButtons}>
            {renderFilterButton('Todos', filtroPeriodo === 'todos', () =>
              setFiltroPeriodo('todos')
            )}
            {renderFilterButton('Hoje', filtroPeriodo === 'hoje', () =>
              setFiltroPeriodo('hoje')
            )}
            {renderFilterButton('Semana', filtroPeriodo === 'semana', () =>
              setFiltroPeriodo('semana')
            )}
            {renderFilterButton('Mês', filtroPeriodo === 'mes', () =>
              setFiltroPeriodo('mes')
            )}
          </View>
        </View>

        {/* Filtro por Status */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>Status:</Text>
          <View style={styles.filterButtons}>
            {renderFilterButton('Todos', filtroStatus === 'todos', () =>
              setFiltroStatus('todos')
            )}
            {renderFilterButton('Concluída', filtroStatus === 'concluida', () =>
              setFiltroStatus('concluida')
            )}
            {renderFilterButton('Pendente', filtroStatus === 'pendente', () =>
              setFiltroStatus('pendente')
            )}
            {renderFilterButton('Cancelada', filtroStatus === 'cancelada', () =>
              setFiltroStatus('cancelada')
            )}
            {renderFilterButton('Expirada', filtroStatus === 'nao_executada', () =>
              setFiltroStatus('nao_executada')
            )}
          </View>
        </View>

        {/* Contador de resultados filtrados */}
        {(filtroStatus !== 'todos' || filtroPeriodo !== 'todos') && (
          <Text style={styles.filterResultCount}>
            Mostrando {rotasFiltradas.length} de {rotas.length} rotas
          </Text>
        )}
      </View>

      {/* Lista de Rotas */}
      <FlatList
        data={rotasFiltradas}
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
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
  // Header compacto (padrão Checkpoints)
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
    fontWeight: '400',
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
    fontWeight: '500',
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
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: theme.colors.white,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
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
    paddingBottom: theme.spacing.md,
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
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  rotaCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.gray300,
    ...theme.shadows.sm,
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
  rotaCardNaoExecutada: {
    borderLeftColor: theme.colors.warning,
    backgroundColor: '#fffbeb', // yellow-50
  },
  rotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  rotaHeaderLeft: {
    flex: 1,
  },
  rotaData: {
    fontSize: theme.typography.base,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  rotaUnidade: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
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
  statusBadgeNaoExecutada: {
    backgroundColor: theme.colors.yellow100,
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  statusBadgeText: {
    fontSize: theme.typography.xs,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  statusBadgeTextNaoExecutada: {
    color: theme.colors.warning,
  },
  rotaStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: theme.spacing.sm,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: theme.typography.xl,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.gray500,
  },
  rotaDetalhes: {
    marginTop: theme.spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.gray300,
    marginVertical: theme.spacing.md,
  },
  detalheRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  detalheLabel: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    fontWeight: '500',
  },
  detalheValue: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
    fontWeight: '600',
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.md,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.success,
    borderRadius: theme.borderRadius.sm,
  },
  expandIndicator: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  expandIndicatorText: {
    fontSize: theme.typography.xs,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  naoExecutadaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.yellow100,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  naoExecutadaInfoText: {
    fontSize: theme.typography.sm,
    color: theme.colors.warning,
    fontWeight: '600',
    flex: 1,
  },
}));
