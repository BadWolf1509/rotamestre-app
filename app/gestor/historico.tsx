import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
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
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import { useDebounce } from '@/hooks/useDebounce';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useRealtimeRoutes } from '@/hooks/useRealtimeRoutes';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

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
  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
  });
  const { toast: toastState, hideToast, withToast } = useToast();
  const { isDesktop } = useResponsive();
  const pageMeta = getGestorPageMeta('historico');

  const [rotas, setRotas] = useState<RotaHistorico[]>([]);
  const [rotasFiltradas, setRotasFiltradas] = useState<RotaHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todas');
  const [searchQuery, setSearchQuery] = useState('');

  // ✅ Otimização: Debounce no search para evitar filtragens excessivas
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Estado para modal de confirmação
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [rotaToDelete, setRotaToDelete] = useState<RotaHistorico | null>(null);

  // ✅ Realtime: Atualizar quando rotas/paradas mudarem
  useRealtimeRoutes({
    enabled: !!userData?.unidade_id,
    onRouteUpdate: () => {
      loadHistorico();
    },
  });

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
            motorista: Array.isArray(rota.usuarios) ? rota.usuarios[0] : rota.usuarios,
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

  // ✅ Otimização: Usar debouncedSearchQuery para evitar filtragens excessivas
  useEffect(() => {
    let resultado = [...rotas];

    // Filtrar por status
    if (filtroStatus !== 'todas') {
      resultado = resultado.filter((rota) => rota.status === filtroStatus);
    }

    // Filtrar por busca de texto (motorista ou data) - usando debounced value
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      resultado = resultado.filter((rota) => {
        const motoristaNome = rota.motorista?.nome?.toLowerCase() || '';
        const dataFormatada = formatarData(rota.data).toLowerCase();
        return motoristaNome.includes(query) || dataFormatada.includes(query);
      });
    }

    setRotasFiltradas(resultado);
  }, [rotas, filtroStatus, debouncedSearchQuery]); // ✅ Usar debouncedSearchQuery ao invés de searchQuery

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

  function exportarParaCSV() {
    try {
      // Cabeçalho do CSV
      const headers = [
        'Data',
        'Motorista',
        'Paradas Concluídas',
        'Total Paradas',
        'Distância (km)',
        'Iniciada em',
        'Concluída em',
        'Status'
      ];

      // Dados das rotas
      const rows = rotasFiltradas.map(rota => [
        formatarData(rota.data),
        rota.motorista?.nome || 'Sem motorista',
        rota.paradas_concluidas || 0,
        rota.paradas_count || 0,
        rota.distancia_total ? rota.distancia_total.toFixed(1) : '-',
        rota.iniciada_em
          ? new Date(rota.iniciada_em).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : '-',
        rota.concluida_em
          ? new Date(rota.concluida_em).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : '-',
        getStatusLabel(rota.status)
      ]);

      // Montar CSV
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Criar blob e fazer download
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const nomeArquivo = `historico-rotas-${dataAtual}.csv`;

      link.setAttribute('href', url);
      link.setAttribute('download', nomeArquivo);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Log da ação
      if (userData?.id) {
        supabase.from('logs').insert({
          usuario_id: userData.id,
          evento: 'exportacao_historico',
          detalhes: {
            total_rotas: rotasFiltradas.length,
            filtro_status: filtroStatus,
            formato: 'csv'
          },
        });
      }

      Alert.alert('Sucesso', `${rotasFiltradas.length} rotas exportadas com sucesso!`);
    } catch (error) {
      console.error('Erro ao exportar:', error);
      Alert.alert('Erro', 'Não foi possível exportar os dados');
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
      case 'em_andamento': return theme.colors.info;
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
      render: (rota) => <Text>{formatarData(rota.data)}</Text>,
    },
    {
      key: 'motorista',
      label: 'Motorista',
      width: 220,
      noWrap: true,
      sortable: true,
      render: (rota) => <Text>{rota.motorista?.nome || 'Sem motorista'}</Text>,
    },
    {
      key: 'paradas',
      label: 'Paradas',
      width: 120,
      align: 'center',
      render: (rota) => <Text>{`${rota.paradas_concluidas || 0}/${rota.paradas_count || 0}`}</Text>,
    },
    {
      key: 'distancia',
      label: 'Distância',
      width: 120,
      align: 'right',
      desktopOnly: true,
      render: (rota) => <Text>{rota.distancia_total ? `${rota.distancia_total.toFixed(1)} km` : '-'}</Text>,
    },
    {
      key: 'iniciada_em',
      label: 'Iniciada',
      width: 140,
      desktopOnly: true,
      render: (rota) => (
        <Text>
          {rota.iniciada_em
            ? new Date(rota.iniciada_em).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })
            : '-'}
        </Text>
      ),
    },
    {
      key: 'concluida_em',
      label: 'Concluída',
      width: 140,
      desktopOnly: true,
      render: (rota) => (
        <Text>
          {rota.concluida_em
            ? new Date(rota.concluida_em).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })
            : '-'}
        </Text>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 140,
      sortable: true,
      render: (rota) => {
        console.log('Renderizando status:', rota.data, rota.status);
        if (!rota.status) {
          console.warn('Status vazio para rota:', rota.id, rota.data);
          return <Text style={styles.tableCellText}>-</Text>;
        }
        return (
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
        );
      },
    },
  ];

  const actions: DataTableAction<RotaHistorico>[] = [
    {
      label: 'Ver Detalhes',
      icon: 'eye-outline',
      type: 'primary',
      onPress: verDetalhes,
    },
    {
      label: 'Excluir',
      icon: 'trash-outline',
      type: 'danger',
      onPress: excluirRota,
    },
  ];

  // ============================================
  // RENDER
  // ============================================

  const totalRotas = rotasFiltradas.length;
  const concluidasCount = rotasFiltradas.filter((rota) => rota.status === 'concluida').length;
  const pendentesCount = rotasFiltradas.filter((rota) => rota.status === 'pendente').length;

  const desktopStats = (
    <View style={styles.headerStats}>
      <View style={styles.headerStat}>
        <Text style={styles.headerStatValue}>{totalRotas}</Text>
        <Text style={styles.headerStatLabel}>Rotas registradas</Text>
      </View>
      <View style={styles.headerStat}>
        <Text style={[styles.headerStatValue, styles.headerStatValueSuccess]}>{concluidasCount}</Text>
        <Text style={styles.headerStatLabel}>Concluídas</Text>
      </View>
      <View style={styles.headerStat}>
        <Text style={[styles.headerStatValue, styles.headerStatValueWarning]}>{pendentesCount}</Text>
        <Text style={styles.headerStatLabel}>Pendentes</Text>
      </View>
    </View>
  );

  const tableHeaderActions = isDesktop ? (
    <View style={styles.cardHeader}>
      {desktopStats}
      <View style={styles.cardHeaderButtons}>
        <TouchableOpacity
          style={styles.cardHeaderButtonSecondary}
          onPress={exportarParaCSV}
        >
          <Text style={styles.cardHeaderButtonSecondaryText}>Exportar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cardHeaderButtonPrimary}
          onPress={() => router.push('/gestor/nova-entrega')}
        >
          <Text style={styles.cardHeaderButtonPrimaryText}>Nova Rota</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : undefined;

  // Desktop Layout
  if (isDesktop) {
    return (
      <>
        <DesktopPageLayout
          title={pageMeta.title}
          subtitle={pageMeta.subtitle}
          breadcrumbs={pageMeta.breadcrumbs}
          userMenuTrigger={userMenuTrigger}
          userMenuItems={userMenuItems}
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
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por motorista ou data..."
                placeholderTextColor={theme.colors.gray400}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Status Filters */}
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
          </DesktopCard>

          {/* Tabela de Rotas */}
          <View style={{ marginTop: 24 }}>
            <DesktopCard
              title="Rotas"
              noPadding
              variant="elevated"
              actions={tableHeaderActions}
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
    return (
      <>
        <MobileLoading message="Carregando histórico..." />
        {logoutModal}
      </>
    );
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
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por motorista ou data..."
              placeholderTextColor={theme.colors.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

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
      {logoutModal}
    </>
  );
}

// ============================================
// STYLES
// ============================================

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
  searchContainer: {
    marginBottom: theme.spacing.lg,
  },
  searchInput: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    fontSize: theme.typography.base,
    color: theme.colors.gray900,
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
  headerStats: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.xl,
  },
  headerStat: {
    alignItems: 'flex-end',
  },
  headerStatValue: {
    fontSize: theme.typography['2xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  headerStatValueSuccess: {
    color: theme.colors.success,
  },
  headerStatValueWarning: {
    color: theme.colors.warning,
  },
  headerStatLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.spacing.lg,
  },
  cardHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  cardHeaderButtonPrimary: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
  },
  cardHeaderButtonPrimaryText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  cardHeaderButtonSecondary: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.white,
  },
  cardHeaderButtonSecondaryText: {
    color: theme.colors.gray700,
    fontFamily: theme.typography.fontSansSemiBold,
  },
}));
