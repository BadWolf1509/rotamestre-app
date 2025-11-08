import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { StyleSheet, useUnistyles } from '@/utils/styles';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { DataTable, DataTableColumn, DataTableAction } from '@/components/DataTable';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';

// ============================================
// TYPES
// ============================================

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

// ============================================
// COMPONENT
// ============================================

export default function HistoricoGestor() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { userData } = useUser();
  const { toast: toastState, showToast, hideToast, withToast } = useToast();

  const [rotas, setRotas] = useState<RotaHistorico[]>([]);
  const [rotasFiltradas, setRotasFiltradas] = useState<RotaHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todas');

  // Estado para modal de confirmação
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [rotaToDelete, setRotaToDelete] = useState<RotaHistorico | null>(null);

  useEffect(() => {
    if (userData?.unidade_id) {
      loadHistorico();
    }
  }, [userData]);

  useEffect(() => {
    aplicarFiltros();
  }, [rotas, filtroStatus]);

  // ============================================
  // DATA LOADING
  // ============================================

  async function loadHistorico() {
    try {
      setLoading(true);

      // Buscar rotas da unidade
      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select('id, data, status, distancia_total, iniciada_em, concluida_em, motorista_id, usuarios!rotas_motorista_id_fkey(id, nome)')
        .eq('unidade_id', userData!.unidade_id)
        .order('data', { ascending: false })
        .limit(100); // Limitar a 100 rotas

      if (rotasError) throw rotasError;

      // Para cada rota, buscar contagem de paradas (apenas entregas reais, não base)
      const rotasComParadas = await Promise.all(
        (rotasData || []).map(async (rota) => {
          const { data: paradasData } = await supabase
            .from('paradas')
            .select('id, status')
            .eq('rota_id', rota.id)
            .eq('is_checkpoint', true); // Filtra apenas entregas reais

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
    }
  }

  function aplicarFiltros() {
    let resultado = [...rotas];

    // Filtrar por status
    if (filtroStatus !== 'todas') {
      resultado = resultado.filter((rota) => rota.status === filtroStatus);
    }

    setRotasFiltradas(resultado);
  }

  // ============================================
  // ACTIONS
  // ============================================

  function verDetalhes(rota: RotaHistorico) {
    router.push(`/gestor/mapa-rota?id=${rota.id}`);
  }

  async function excluirRota(rota: RotaHistorico) {
    // Web: usar modal customizado
    if (Platform.OS === 'web') {
      setRotaToDelete(rota);
      setShowConfirmModal(true);
    } else {
      // Mobile: usar Alert.alert nativo
      const mensagem = `Tem certeza que deseja excluir esta rota?\n\nMotorista: ${rota.motorista?.nome || 'Sem motorista'}\nParadas: ${rota.paradas_count || 0}\n\nEsta ação não pode ser desfeita.`;
      Alert.alert(
        'Confirmar Exclusão',
        mensagem,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: () => executarExclusao(rota),
          },
        ]
      );
    }
  }

  const handleConfirmDelete = () => {
    setShowConfirmModal(false);
    if (rotaToDelete) {
      executarExclusao(rotaToDelete);
      setRotaToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirmModal(false);
    setRotaToDelete(null);
  };

  async function executarExclusao(rota: RotaHistorico) {
    try {
      await withToast(
        async () => {
          const { error } = await supabase
            .from('rotas')
            .delete()
            .eq('id', rota.id);

          if (error) throw error;

          // Log da ação
          await supabase.from('logs').insert({
            usuario_id: userData!.id,
            rota_id: rota.id,
            evento: 'rota_excluida',
            detalhes: {
              motivo: 'Excluída pelo gestor no histórico',
              motorista: rota.motorista?.nome,
              paradas_count: rota.paradas_count,
              status_anterior: rota.status,
            },
          });
        },
        {
          loading: 'Excluindo rota...',
          success: 'Rota excluída com sucesso!',
          error: 'Não foi possível excluir a rota',
        }
      );

      // Recarregar histórico
      loadHistorico();
    } catch (error) {
      console.error('Erro ao excluir rota:', error);
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'pendente': return 'Pendente';
      case 'em_andamento': return 'Em Andamento';
      case 'concluida': return 'Concluída';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'pendente': return '#f59e0b'; // Amarelo
      case 'em_andamento': return '#3b82f6'; // Azul
      case 'concluida': return '#10b981'; // Verde
      case 'cancelada': return '#ef4444'; // Vermelho
      default: return '#6b7280';
    }
  }

  function formatarData(dataStr: string): string {
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR');
  }

  // ============================================
  // DATA TABLE CONFIG
  // ============================================

  const columns: DataTableColumn<RotaHistorico>[] = [
    {
      key: 'data',
      label: 'Data',
      width: 120,
      sortable: true,
      render: (rota) => formatarData(rota.data),
    },
    {
      key: 'motorista',
      label: 'Motorista',
      width: 180,
      sortable: true,
      render: (rota) => rota.motorista?.nome || 'Sem motorista',
    },
    {
      key: 'paradas',
      label: 'Paradas',
      width: 120,
      align: 'center',
      render: (rota) => `${rota.paradas_concluidas || 0}/${rota.paradas_count || 0}`,
    },
    {
      key: 'distancia',
      label: 'Distância',
      width: 120,
      align: 'right',
      desktopOnly: true,
      render: (rota) => rota.distancia_total ? `${rota.distancia_total.toFixed(1)} km` : '-',
    },
    {
      key: 'iniciada_em',
      label: 'Iniciada',
      width: 140,
      desktopOnly: true,
      render: (rota) => rota.iniciada_em
        ? new Date(rota.iniciada_em).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })
        : '-',
    },
    {
      key: 'concluida_em',
      label: 'Concluída',
      width: 140,
      desktopOnly: true,
      render: (rota) => rota.concluida_em
        ? new Date(rota.concluida_em).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })
        : '-',
    },
    {
      key: 'status',
      label: 'Status',
      width: 140,
      sortable: true,
      render: (rota) => (
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
      ),
    },
  ];

  const actions: DataTableAction<RotaHistorico>[] = [
    {
      label: 'Ver Detalhes',
      icon: '👁️',
      type: 'primary',
      onPress: verDetalhes,
    },
    {
      label: 'Excluir',
      icon: '🗑️',
      type: 'danger',
      onPress: excluirRota,
    },
  ];

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando histórico...</Text>
      </View>
    );
  }

  return (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Histórico de Rotas</Text>
            <Text style={styles.headerSubtitle}>
              {userData?.unidades?.nome}
            </Text>
          </View>
          {/* Quick Actions - apenas desktop */}
          {Platform.OS === 'web' && (
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => router.push('/gestor/nova-entrega')}
              >
                <Text style={styles.quickActionText}>+ Nova Rota</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {rotasFiltradas.length} rota(s) encontrada(s)
          </Text>
        </View>

        {/* Filtros */}
        <View style={styles.filtrosContainer}>
          <Text style={styles.filtrosLabel}>Filtrar por Status:</Text>
          <View style={styles.filtrosButtons}>
            {(['todas', 'pendente', 'em_andamento', 'concluida', 'cancelada'] as FiltroStatus[]).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filtroButton,
                  filtroStatus === status && styles.filtroButtonActive,
                ]}
                onPress={() => setFiltroStatus(status)}
              >
                <Text
                  style={[
                    styles.filtroButtonText,
                    filtroStatus === status && styles.filtroButtonTextActive,
                  ]}
                >
                  {status === 'todas' ? 'Todas' : getStatusLabel(status)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* DataTable */}
        <DataTable
          data={rotasFiltradas}
          columns={columns}
          actions={actions}
          keyExtractor={(rota) => rota.id}
          itemsPerPage={20}
          pagination
          isLoading={loading}
          skeletonRows={10}
          emptyState={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>📋</Text>
              <Text style={styles.emptyStateTitle}>Nenhuma rota encontrada</Text>
              <Text style={styles.emptyStateSubtitle}>
                {filtroStatus !== 'todas'
                  ? 'Tente alterar os filtros'
                  : 'Crie sua primeira rota de entrega'}
              </Text>
            </View>
          }
        />
        </View>
      </ScrollView>

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        visible={showConfirmModal}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir esta rota?\n\nMotorista: ${rotaToDelete?.motorista?.nome || 'Sem motorista'}\nParadas: ${rotaToDelete?.paradas_count || 0}\nStatus: ${rotaToDelete?.status ? getStatusLabel(rotaToDelete.status) : '-'}\n\nEsta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Toast de Feedback */}
      <Toast {...toastState} onDismiss={hideToast} />
    </>
  );
}

// ============================================
// STYLES
// ============================================

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
    marginTop: theme.spacing.lg,
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
  header: {
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['2xl'],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  quickActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  quickActionButton: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  quickActionText: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  content: {
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['2xl'],
    maxWidth: theme.layout.containerMaxWidth,
    marginHorizontal: 'auto',
    width: '100%',
  },
  infoBox: {
    backgroundColor: theme.colors.info + '10',
    borderWidth: 1,
    borderColor: theme.colors.info + '30',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing['2xl'],
  },
  infoText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.info,
    textAlign: 'center',
  },
  filtrosContainer: {
    marginBottom: theme.spacing['2xl'],
  },
  filtrosLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
    marginBottom: theme.spacing.lg,
  },
  filtrosButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  filtroButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
  },
  filtroButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filtroButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  filtroButtonTextActive: {
    color: theme.colors.white,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    color: theme.colors.white,
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing['3xl'],
  },
  emptyStateText: {
    fontSize: 48,
    marginBottom: theme.spacing['2xl'],
  },
  emptyStateTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
  },
  emptyStateSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
}));
