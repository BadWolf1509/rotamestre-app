import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';

interface Motorista {
  id: string;
  nome: string;
}

interface RotaHistorico {
  id: string;
  data: string;
  status: string;
  distancia_total?: number;
  iniciada_em?: string;
  concluida_em?: string;
  motorista?: Motorista;
  paradas_count?: number;
  paradas_concluidas?: number;
}

type FiltroStatus = 'todas' | 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';

export default function HistoricoGestor() {
  const { userData } = useUser();
  const [rotas, setRotas] = useState<RotaHistorico[]>([]);
  const [rotasFiltradas, setRotasFiltradas] = useState<RotaHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRotaId, setExpandedRotaId] = useState<string | null>(null);

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todas');
  const [filtroMotorista, setFiltroMotorista] = useState<string>('');
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [showFiltros, setShowFiltros] = useState(false);

  useEffect(() => {
    if (userData?.unidade_id) {
      loadMotoristas();
      loadHistorico();
    }
  }, [userData]);

  useEffect(() => {
    aplicarFiltros();
  }, [rotas, filtroStatus, filtroMotorista]);

  async function loadMotoristas() {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('unidade_id', userData!.unidade_id)
        .eq('papel', 'motorista')
        .order('nome');

      if (error) throw error;
      setMotoristas(data as Motorista[] || []);
    } catch (error) {
      console.error('Erro ao carregar motoristas:', error);
    }
  }

  async function loadHistorico() {
    try {
      setLoading(true);

      // Buscar rotas da unidade
      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select('id, data, status, distancia_total, iniciada_em, concluida_em, motorista_id, usuarios!rotas_motorista_id_fkey(id, nome)')
        .eq('unidade_id', userData!.unidade_id)
        .order('data', { ascending: false });

      if (rotasError) throw rotasError;

      // Para cada rota, buscar contagem de paradas
      const rotasComParadas = await Promise.all(
        (rotasData || []).map(async (rota) => {
          const { data: paradasData, error: paradasError } = await supabase
            .from('paradas')
            .select('id, status')
            .eq('rota_id', rota.id);

          if (paradasError) {
            console.error('Erro ao buscar paradas:', paradasError);
            return {
              ...rota,
              motorista: rota.usuarios,
              paradas_count: 0,
              paradas_concluidas: 0,
            };
          }

          return {
            ...rota,
            motorista: rota.usuarios,
            paradas_count: paradasData?.length || 0,
            paradas_concluidas:
              paradasData?.filter((p) => p.status === 'concluida').length || 0,
          };
        })
      );

      setRotas(rotasComParadas as RotaHistorico[]);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      Alert.alert('Erro', 'Não foi possível carregar o histórico');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function aplicarFiltros() {
    let resultado = [...rotas];

    // Filtrar por status
    if (filtroStatus !== 'todas') {
      resultado = resultado.filter((rota) => rota.status === filtroStatus);
    }

    // Filtrar por motorista
    if (filtroMotorista) {
      resultado = resultado.filter(
        (rota) =>
          rota.motorista?.nome.toLowerCase().includes(filtroMotorista.toLowerCase())
      );
    }

    setRotasFiltradas(resultado);
  }

  function limparFiltros() {
    setFiltroStatus('todas');
    setFiltroMotorista('');
  }

  function onRefresh() {
    setRefreshing(true);
    loadHistorico();
  }

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

  const renderFiltrosModal = () => (
    <Modal
      visible={showFiltros}
      transparent
      animationType="slide"
      onRequestClose={() => setShowFiltros(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Filtros</Text>

          {/* Filtro de Status */}
          <Text style={styles.filterLabel}>Status:</Text>
          <View style={styles.statusFilterContainer}>
            {(['todas', 'pendente', 'em_andamento', 'concluida', 'cancelada'] as FiltroStatus[]).map(
              (status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusFilterButton,
                    filtroStatus === status && styles.statusFilterButtonActive,
                  ]}
                  onPress={() => setFiltroStatus(status)}
                >
                  <Text
                    style={[
                      styles.statusFilterButtonText,
                      filtroStatus === status && styles.statusFilterButtonTextActive,
                    ]}
                  >
                    {status === 'todas' && 'Todas'}
                    {status === 'pendente' && 'Pendente'}
                    {status === 'em_andamento' && 'Em Andamento'}
                    {status === 'concluida' && 'Concluída'}
                    {status === 'cancelada' && 'Cancelada'}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>

          {/* Filtro de Motorista */}
          <Text style={styles.filterLabel}>Motorista:</Text>
          <TextInput
            style={styles.filterInput}
            placeholder="Digite o nome do motorista..."
            value={filtroMotorista}
            onChangeText={setFiltroMotorista}
            placeholderTextColor="#9ca3af"
          />

          {/* Botões de Ação */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalButtonSecondary}
              onPress={limparFiltros}
            >
              <Text style={styles.modalButtonSecondaryText}>Limpar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButtonPrimary}
              onPress={() => setShowFiltros(false)}
            >
              <Text style={styles.modalButtonPrimaryText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

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
              {new Date(item.data).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
            <Text style={styles.rotaMotorista}>
              {item.motorista?.nome || 'Sem motorista'}
            </Text>
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
            <Text style={[styles.statValue, { color: '#10b981' }]}>
              {item.paradas_concluidas || 0}
            </Text>
            <Text style={styles.statLabel}>Concluídas</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#8b5cf6' }]}>
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
        <ActivityIndicator size="large" color="#0D5A9C" />
        <Text style={styles.loadingText}>Carregando histórico...</Text>
      </View>
    );
  }

  const filtrosAtivos =
    filtroStatus !== 'todas' || filtroMotorista !== '';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Histórico de Rotas</Text>
            <Text style={styles.headerSubtitle}>
              {rotasFiltradas.length} de {rotas.length}{' '}
              {rotas.length === 1 ? 'rota' : 'rotas'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.filtroButton,
              filtrosAtivos && styles.filtroButtonActive,
            ]}
            onPress={() => setShowFiltros(true)}
          >
            <Text
              style={[
                styles.filtroButtonText,
                filtrosAtivos && styles.filtroButtonTextActive,
              ]}
            >
              🔍 Filtros
            </Text>
            {filtrosAtivos && <View style={styles.filtroIndicator} />}
          </TouchableOpacity>
        </View>

        {/* Indicador de Filtros Ativos */}
        {filtrosAtivos && (
          <View style={styles.filtrosAtivosContainer}>
            {filtroStatus !== 'todas' && (
              <View style={styles.filtroAtivoBadge}>
                <Text style={styles.filtroAtivoText}>
                  Status: {filtroStatus}
                </Text>
                <TouchableOpacity
                  onPress={() => setFiltroStatus('todas')}
                  style={styles.filtroAtivoRemove}
                >
                  <Text style={styles.filtroAtivoRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            )}
            {filtroMotorista && (
              <View style={styles.filtroAtivoBadge}>
                <Text style={styles.filtroAtivoText}>
                  Motorista: {filtroMotorista}
                </Text>
                <TouchableOpacity
                  onPress={() => setFiltroMotorista('')}
                  style={styles.filtroAtivoRemove}
                >
                  <Text style={styles.filtroAtivoRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
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
            colors={['#0D5A9C']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>📋</Text>
            <Text style={styles.emptyText}>
              {filtrosAtivos
                ? 'Nenhuma rota encontrada com esses filtros'
                : 'Nenhuma rota registrada'}
            </Text>
            {filtrosAtivos && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={limparFiltros}
              >
                <Text style={styles.emptyButtonText}>Limpar Filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Modal de Filtros */}
      {renderFiltrosModal()}
    </View>
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
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  filtroButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    position: 'relative',
  },
  filtroButtonActive: {
    backgroundColor: '#0D5A9C',
  },
  filtroButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  filtroButtonTextActive: {
    color: '#fff',
  },
  filtroIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#fff',
  },
  filtrosAtivosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  filtroAtivoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  filtroAtivoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
  filtroAtivoRemove: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1e40af',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtroAtivoRemoveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
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
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#0D5A9C',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rotaCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  rotaCardPendente: {
    borderLeftColor: '#f59e0b',
  },
  rotaCardEmAndamento: {
    borderLeftColor: '#3b82f6',
  },
  rotaCardConcluida: {
    borderLeftColor: '#10b981',
  },
  rotaCardCancelada: {
    borderLeftColor: '#ef4444',
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
    color: '#111827',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  rotaMotorista: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgePendente: {
    backgroundColor: '#fef3c7',
  },
  statusBadgeEmAndamento: {
    backgroundColor: '#dbeafe',
  },
  statusBadgeConcluida: {
    backgroundColor: '#d1fae5',
  },
  statusBadgeCancelada: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
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
    color: '#0D5A9C',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  rotaDetalhes: {
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
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
    color: '#6b7280',
    fontWeight: '500',
  },
  detalheValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    marginLeft: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  expandIndicator: {
    marginTop: 12,
    alignItems: 'center',
  },
  expandIndicatorText: {
    fontSize: 12,
    color: '#0D5A9C',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  statusFilterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statusFilterButtonActive: {
    backgroundColor: '#0D5A9C',
    borderColor: '#0D5A9C',
  },
  statusFilterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  statusFilterButtonTextActive: {
    color: '#fff',
  },
  filterInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: '#0D5A9C',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
