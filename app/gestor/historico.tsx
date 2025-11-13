import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';

import { ConfirmModal } from '@/components/ConfirmModal';
import { DataTable, DataTableAction, DataTableColumn } from '@/components/DataTable';
import { DesktopCard } from '@/components/desktop/DesktopCard';
import { DesktopModal } from '@/components/desktop/DesktopModal';
import { DesktopPageLayout } from '@/components/desktop/DesktopPageLayout';
import { MobileCard, MobileEmptyState, MobileLoading } from '@/components/mobile';
import { Toast } from '@/components/Toast';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles } from '@/utils/styles';

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
  const { toast: toastState, hideToast, withToast } = useToast();
  const { isDesktop } = useResponsive();

  const [rotas, setRotas] = useState<RotaHistorico[]>([]);
  const [rotasFiltradas, setRotasFiltradas] = useState<RotaHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todas');

  // Estado para modal de confirmação
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [rotaToDelete, setRotaToDelete] = useState<RotaHistorico | null>(null);

const loadHistorico = useCallback(async () => {
  if (!userData?.unidade_id) return;

  try {
    setLoading(true);

    const { data: rotasData, error: rotasError } = await supabase
      .from('rotas')
      .select(
        'id, data, status, distancia_total, iniciada_em, concluida_em, motorista_id, usuarios!rotas_motorista_id_fkey(id, nome)'
      )
      .eq('unidade_id', userData.unidade_id)
      .order('data', { ascending: false })
      .limit(100);

    if (rotasError) throw rotasError;

    const rotasComParadas = await Promise.all(
      (rotasData || []).map(async (rota) => {
        const { data: paradasData } = await supabase
          .from('paradas')
          .select('id, status, is_checkpoint')
          .eq('rota_id', rota.id);

        const paradasReais = (paradasData || []).filter(
          (parada) => parada.is_checkpoint !== false
        );

        return {
          ...rota,
          motorista: rota.usuarios,
          paradas_count: paradasReais.length,
          paradas_concluidas: paradasReais.filter(
            (p) => p.status === 'concluida'
          ).length,
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
}, [userData?.unidade_id]);

useEffect(() => {
  loadHistorico();
}, [loadHistorico]);

useEffect(() => {
  let resultado = [...rotas];
  if (filtroStatus !== 'todas') {
    resultado = resultado.filter((rota) => rota.status === filtroStatus);
  }
  setRotasFiltradas(resultado);
}, [rotas, filtroStatus]);

  // ============================================
  // DATA LOADING
  // ============================================

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
      case 'pendente': return theme.colors.warning;
      case 'em_andamento': return theme.colors.blue500;
      case 'concluida': return theme.colors.success;
      case 'cancelada': return theme.colors.error;
      default: return theme.colors.gray500;
    }
  }

  function parseLocalDate(dataStr: string): Date | null {
    if (!dataStr) return null;
    const [year, month, day] = dataStr.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  function formatarData(dataStr: string): string {
    const data = parseLocalDate(dataStr);
    return data ? data.toLocaleDateString('pt-BR') : '-';
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
      width: 220,
      noWrap: true,
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

  // Desktop Layout
  if (isDesktop) {
    return (
      <>
        <DesktopPageLayout
          title="Histórico de Rotas"
          subtitle={`${userData?.unidades?.nome || 'Carregando...'}`}
          breadcrumbs={[
            { label: 'Dashboard', route: '/gestor' },
            { label: 'Histórico' }
          ]}
          actions={[
            {
              label: 'Nova Rota',
              icon: 'add-circle-outline',
              onPress: () => router.push('/gestor/nova-entrega'),
              variant: 'primary'
            },
            {
              label: 'Exportar',
              icon: 'download-outline',
              onPress: () => Alert.alert('Info', 'Funcionalidade em desenvolvimento'),
              variant: 'secondary'
            }
          ]}
          loading={loading}
          loadingText="Carregando histórico..."
        >
          {/* Filtros */}
          <DesktopCard
            title="Filtros"
            subtitle={`${rotasFiltradas.length} rota(s) encontrada(s)`}
            icon="filter-outline"
            iconColor={theme.colors.primary}
          >
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
          </DesktopCard>

          {/* Tabela de Rotas */}
          <View style={{ marginTop: 24 }}>
            <DesktopCard
              title="Rotas"
              noPadding
              variant="elevated"
            >
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
            </DesktopCard>
          </View>
        </DesktopPageLayout>

        {/* Modal de Confirmação - Desktop */}
        <DesktopModal
          visible={showConfirmModal}
          onClose={handleCancelDelete}
          title="Confirmar Exclusão"
          size="sm"
        >
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 16, marginBottom: 20, lineHeight: 24 }}>
              Tem certeza que deseja excluir esta rota?
            </Text>

            <View style={{ backgroundColor: theme.colors.gray50, padding: 16, borderRadius: 8, marginBottom: 20 }}>
              <Text style={{ fontSize: 14, marginBottom: 8 }}>
                <Text style={{ fontWeight: '600' }}>Motorista:</Text> {rotaToDelete?.motorista?.nome || 'Sem motorista'}
              </Text>
              <Text style={{ fontSize: 14, marginBottom: 8 }}>
                <Text style={{ fontWeight: '600' }}>Paradas:</Text> {rotaToDelete?.paradas_count || 0}
              </Text>
              <Text style={{ fontSize: 14 }}>
                <Text style={{ fontWeight: '600' }}>Status:</Text> {rotaToDelete?.status ? getStatusLabel(rotaToDelete.status) : '-'}
              </Text>
            </View>

            <Text style={{ fontSize: 14, color: theme.colors.error, marginBottom: 24 }}>
              ⚠️ Esta ação não pode ser desfeita.
            </Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.colors.gray300,
                  alignItems: 'center'
                }}
                onPress={handleCancelDelete}
              >
                <Text style={{ fontSize: 16, color: theme.colors.gray700 }}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderRadius: 8,
                  backgroundColor: theme.colors.error,
                  alignItems: 'center'
                }}
                onPress={handleConfirmDelete}
              >
                <Text style={{ fontSize: 16, color: theme.colors.white, fontWeight: '600' }}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </DesktopModal>

        {/* Toast de Feedback */}
        <Toast {...toastState} onDismiss={hideToast} />
      </>
    );
  }

  // Mobile Layout (original)
  if (loading) {
    return <MobileLoading message="Carregando histórico..." />;
  }

  return (
    <>
      {/* Content */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
        {/* Info e Filtros */}
        <MobileCard
          title="Filtros"
          subtitle={`${rotasFiltradas.length} rota(s) encontrada(s)`}
        >
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
        </MobileCard>

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
            <MobileEmptyState
              icon="📋"
              title="Nenhuma rota encontrada"
              subtitle={
                filtroStatus !== 'todas'
                  ? 'Tente alterar os filtros'
                  : 'Crie sua primeira rota de entrega'
              }
              actionLabel={filtroStatus === 'todas' ? 'Criar Nova Rota' : undefined}
              onAction={filtroStatus === 'todas' ? () => router.push('/gestor/nova-entrega') : undefined}
            />
          }
        />
        </View>
      </ScrollView>

      {/* Modal de Confirmação de Exclusão - Mobile */}
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
