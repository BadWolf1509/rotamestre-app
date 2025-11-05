/**
 * TODO: DEPRECATED - Este arquivo está deprecated e deve ser removido.
 * Use historico.tsx ao invés deste arquivo.
 *
 * Motivo: historico.tsx possui melhor estrutura, usa Toast e está mais atualizado.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { useResponsive } from '@/hooks/useResponsive';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { DataTable, DataTableColumn, DataTableAction } from '@/components/DataTable';

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
  const { theme } = useUnistyles();
  const router = useRouter();
  const { userData } = useUser();
  const { isDesktop, isMobile } = useResponsive();
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

  // Modal de confirmação de cancelamento
  const [showCancelarModal, setShowCancelarModal] = useState(false);
  const [rotaParaCancelar, setRotaParaCancelar] = useState<RotaHistorico | null>(null);

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

  // Cancelar rota (apenas pendentes)
  function cancelarRota(rota: RotaHistorico) {
    console.log('🔵 cancelarRota() chamada para rota:', rota.id);

    if (Platform.OS === 'web') {
      // Abrir modal customizado
      setRotaParaCancelar(rota);
      setShowCancelarModal(true);
    } else {
      // Para mobile, usamos Alert nativo
      const mensagem = `Tem certeza que deseja cancelar esta rota?${rota.motorista ? `\nMotorista: ${rota.motorista.nome}` : ''}\nParadas: ${rota.paradas_count || 0}`;
      Alert.alert(
        'Cancelar Rota',
        mensagem,
        [
          { text: 'Não', style: 'cancel' },
          {
            text: 'Sim, Cancelar',
            style: 'destructive',
            onPress: () => executarCancelamento(rota),
          },
        ]
      );
    }
  }

  // Função auxiliar para executar o cancelamento
  async function executarCancelamento(rota: RotaHistorico) {
    // Fechar modal se estiver aberto
    setShowCancelarModal(false);
    setRotaParaCancelar(null);

    try {
      console.log('🚫 Cancelando rota:', rota.id);

      const { error } = await supabase
        .from('rotas')
        .update({ status: 'cancelada' })
        .eq('id', rota.id);

      if (error) throw error;

      console.log('✅ Rota cancelada com sucesso');

      // Log da ação
      await supabase.from('logs').insert({
        usuario_id: userData!.id,
        rota_id: rota.id,
        evento: 'rota_cancelada',
        detalhes: {
          motivo: 'Cancelada pelo gestor',
          paradas_count: rota.paradas_count,
        },
      });

      // Recarregar histórico
      loadHistorico();

      // Feedback de sucesso (apenas mobile usa Alert)
      if (Platform.OS !== 'web') {
        Alert.alert('Sucesso!', 'Rota cancelada com sucesso');
      }
    } catch (error) {
      console.error('❌ Erro ao cancelar rota:', error);

      if (Platform.OS === 'web') {
        alert('Erro: Não foi possível cancelar a rota');
      } else {
        Alert.alert('Erro', 'Não foi possível cancelar a rota');
      }
    }
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

            {/* Botões de Ação */}
            <View style={{ gap: 10 }} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.verMapaButton}
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  router.push(`/gestor/mapa-rota?id=${item.id}`);
                }}
                pointerEvents="auto"
              >
                <Text style={styles.verMapaButtonText}>🗺️ Ver Rota no Mapa</Text>
              </TouchableOpacity>

              {/* Botão Cancelar (apenas para rotas pendentes) */}
              {isPendente && (
                <TouchableOpacity
                  style={styles.cancelarButton}
                  onPress={(e: any) => {
                    console.log('🚫 Botão Cancelar clicado!');
                    e?.stopPropagation?.();
                    cancelarRota(item);
                  }}
                  pointerEvents="auto"
                >
                  <Text style={styles.cancelarButtonText}>🚫 Cancelar Rota</Text>
                </TouchableOpacity>
              )}
            </View>
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
        <ActivityIndicator size="large" color={theme.colors.primaryDark} />
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

      {/* Modal de Confirmação de Cancelamento */}
      <Modal
        visible={showCancelarModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowCancelarModal(false);
          setRotaParaCancelar(null);
        }}
      >
        <View style={styles.modalOverlayCancelar}>
          <View style={styles.modalContentCancelar}>
            <View style={styles.modalHeaderCancelar}>
              <Text style={styles.modalTitleCancelar}>🚫 Cancelar Rota</Text>
            </View>

            <View style={styles.modalBodyCancelar}>
              <Text style={styles.modalTextCancelar}>
                Tem certeza que deseja cancelar esta rota?
              </Text>

              {rotaParaCancelar && (
                <View style={styles.rotaInfoCancelar}>
                  {rotaParaCancelar.motorista && (
                    <View style={styles.infoRowCancelar}>
                      <Text style={styles.infoLabelCancelar}>Motorista:</Text>
                      <Text style={styles.infoValueCancelar}>
                        {rotaParaCancelar.motorista.nome}
                      </Text>
                    </View>
                  )}
                  <View style={styles.infoRowCancelar}>
                    <Text style={styles.infoLabelCancelar}>Paradas:</Text>
                    <Text style={styles.infoValueCancelar}>
                      {rotaParaCancelar.paradas_count || 0}
                    </Text>
                  </View>
                  <View style={styles.infoRowCancelar}>
                    <Text style={styles.infoLabelCancelar}>Data:</Text>
                    <Text style={styles.infoValueCancelar}>
                      {new Date(rotaParaCancelar.data).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={styles.modalWarningCancelar}>
                Esta ação não pode ser desfeita.
              </Text>
            </View>

            <View style={styles.modalFooterCancelar}>
              <TouchableOpacity
                style={styles.modalButtonCancelarSecondary}
                onPress={() => {
                  setShowCancelarModal(false);
                  setRotaParaCancelar(null);
                }}
              >
                <Text style={styles.modalButtonTextSecondary}>Não, Manter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalButtonCancelarPrimary}
                onPress={() => {
                  if (rotaParaCancelar) {
                    executarCancelamento(rotaParaCancelar);
                  }
                }}
              >
                <Text style={styles.modalButtonTextPrimary}>Sim, Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
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
    marginTop: theme.spacing.sm + 2,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  header: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  filtroButton: {
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    position: 'relative',
  },
  filtroButtonActive: {
    backgroundColor: theme.colors.primaryDark,
  },
  filtroButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.gray700,
  },
  filtroButtonTextActive: {
    color: theme.colors.white,
  },
  filtroIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.error,
    borderWidth: 2,
    borderColor: theme.colors.white,
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
    padding: theme.spacing.lg,
  },
  emptyContainer: {
    padding: theme.spacing['6xl'] - 4,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 64,
    marginBottom: theme.spacing.lg,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: theme.colors.primaryDark,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.sm,
  },
  emptyButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
  },
  rotaCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.gray200,
    ...theme.shadows.sm,
  },
  rotaCardPendente: {
    borderLeftColor: theme.colors.warning,
  },
  rotaCardEmAndamento: {
    borderLeftColor: theme.colors.info,
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
  verMapaButton: {
    backgroundColor: theme.colors.success,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  verMapaButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
  },
  cancelarButton: {
    backgroundColor: theme.colors.error,
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  cancelarButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
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
    backgroundColor: theme.colors.primaryDark,
    padding: theme.spacing.sm + 6,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.white,
  },
  // Estilos do Modal de Cancelamento
  modalOverlayCancelar: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContentCancelar: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeaderCancelar: {
    backgroundColor: '#fee2e2',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
  },
  modalTitleCancelar: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#991b1b',
    textAlign: 'center',
  },
  modalBodyCancelar: {
    padding: 24,
  },
  modalTextCancelar: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  rotaInfoCancelar: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoRowCancelar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabelCancelar: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoValueCancelar: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  modalWarningCancelar: {
    fontSize: 13,
    color: '#dc2626',
    textAlign: 'center',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  modalFooterCancelar: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalButtonCancelarSecondary: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  modalButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalButtonCancelarPrimary: {
    flex: 1,
    backgroundColor: '#dc2626',
    padding: theme.spacing.sm + 6,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  modalButtonTextPrimary: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.white,
  },
}));
