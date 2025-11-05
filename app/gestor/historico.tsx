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
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { useResponsive } from '@/hooks/useResponsive';
import { DesktopLayout } from '@/components/desktop';
import { DataTable, DataTableColumn, DataTableAction } from '@/components/DataTable';
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
  const { isDesktop } = useResponsive();
  const { toast: toastState, showToast, hideToast, withToast } = useToast();

  const [rotas, setRotas] = useState<RotaHistorico[]>([]);
  const [rotasFiltradas, setRotasFiltradas] = useState<RotaHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todas');

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

      // Para cada rota, buscar contagem de paradas
      const rotasComParadas = await Promise.all(
        (rotasData || []).map(async (rota) => {
          const { data: paradasData } = await supabase
            .from('paradas')
            .select('id, status')
            .eq('rota_id', rota.id);

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

  async function cancelarRota(rota: RotaHistorico) {
    // Validar se pode cancelar
    if (rota.status !== 'pendente' && rota.status !== 'em_andamento') {
      Alert.alert('Atenção', 'Apenas rotas pendentes ou em andamento podem ser canceladas');
      return;
    }

    const mensagem = `Tem certeza que deseja cancelar esta rota?\nMotorista: ${rota.motorista?.nome || 'Sem motorista'}\nParadas: ${rota.paradas_count || 0}`;

    if (Platform.OS === 'web') {
      if (!confirm(mensagem)) return;
    } else {
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
      return;
    }

    executarCancelamento(rota);
  }

  async function executarCancelamento(rota: RotaHistorico) {
    try {
      await withToast(
        async () => {
          const { error } = await supabase
            .from('rotas')
            .update({ status: 'cancelada' })
            .eq('id', rota.id);

          if (error) throw error;

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
        },
        {
          loading: 'Cancelando rota...',
          success: 'Rota cancelada com sucesso!',
          error: 'Não foi possível cancelar a rota',
        }
      );

      // Recarregar histórico
      loadHistorico();
    } catch (error) {
      console.error('Erro ao cancelar rota:', error);
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
      label: 'Cancelar',
      icon: '🚫',
      type: 'danger',
      onPress: cancelarRota,
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
      <DesktopLayout scrollable>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Histórico de Rotas</Text>
          <Text style={styles.subtitle}>
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
          itemsPerPage={isDesktop ? 20 : 10}
          pagination
          isLoading={loading}
          skeletonRows={isDesktop ? 10 : 5}
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
      </DesktopLayout>

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
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  header: {
    paddingVertical: theme.spacing['2xl'],
  },
  title: {
    fontSize: theme.typography.fontSize['3xl'] - 2,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  filtrosContainer: {
    marginBottom: theme.spacing['2xl'],
  },
  filtrosLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.gray700,
    marginBottom: theme.spacing.md,
  },
  filtrosButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  filtroButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  filtroButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filtroButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '500',
    color: theme.colors.gray700,
  },
  filtroButtonTextActive: {
    color: theme.colors.white,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm - 2,
    borderRadius: theme.borderRadius.lg,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing['6xl'] - 4,
  },
  emptyStateText: {
    fontSize: 48,
    marginBottom: theme.spacing.lg,
  },
  emptyStateTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  emptyStateSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
}));
