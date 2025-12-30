/**
 * Tela de Gestão de Rotas - Gestor
 *
 * Permite visualizar e gerenciar todas as rotas da unidade:
 * - Listagem de rotas com filtros por status e busca textual
 * - Visualização de detalhes (motorista, paradas, progresso)
 * - Exclusão de rotas com confirmação
 * - Exportação para CSV (desktop e mobile via compartilhamento)
 * - Atualização em tempo real via Supabase Realtime
 *
 * @layout Desktop: DesktopPageLayout com DataTable
 * @layout Mobile: ScrollView com MobileCards
 */

import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import {
  ConfirmModal,
  DataTable,
  type DataTableAction,
  type DataTableColumn,
  DesktopCard,
  DesktopModal,
  DesktopPageLayout,
  MobileCard,
  MobileEmptyState,
  MobileLoading,
  Toast,
} from '@/design-system';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import {
  useGestaoRotas,
  FILTRO_STATUS_OPTIONS,
  type RotaHistorico,
} from '@/hooks/useGestaoRotas';
import { useResponsive } from '@/hooks/useResponsive';
import { formatDateBR, formatDateTimeBR } from '@/lib/dateUtils';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// ============================================
// COMPONENT
// ============================================

export default function GestaoRotas() {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const pageMeta = getGestorPageMeta('gestao-rotas');

  // Status color map (precisa do theme)
  const statusColorMap = useMemo(() => ({
    pendente: theme.colors.warning,
    em_andamento: theme.colors.info,
    concluida: theme.colors.success,
    cancelada: theme.colors.error,
    nao_executada: theme.colors.warning,
  }), [theme.colors]);

  // Hook de gestão de rotas
  const {
    rotasFiltradas,
    loading,
    filtroStatus,
    searchQuery,
    showConfirmModal,
    rotaToDelete,
    userData,
    setFiltroStatus,
    setSearchQuery,
    verDetalhes,
    excluirRota,
    handleConfirmDelete,
    handleCancelDelete,
    exportarParaCSV,
    getStatusLabel,
    getStatusColor,
    toastState,
    hideToast,
  } = useGestaoRotas({
    statusColorMap,
    defaultStatusColor: theme.colors.gray500,
  });

  // Desktop header menu
  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
  });

  // ============================================
  // DATA TABLE CONFIG
  // ============================================

  const columns: DataTableColumn<RotaHistorico>[] = [
    {
      key: 'data',
      label: 'Data',
      width: 120,
      sortable: true,
      render: (rota) => <Text>{formatDateBR(rota.data)}</Text>,
    },
    {
      key: 'motorista',
      label: 'Motorista',
      width: 220,
      noWrap: true,
      sortable: true,
      render: (rota) => <Text>{rota.motorista_nome || 'Sem motorista'}</Text>,
    },
    {
      key: 'paradas',
      label: 'Paradas',
      width: 120,
      align: 'center',
      render: (rota) => <Text>{`${rota.paradas_concluidas}/${rota.paradas_count}`}</Text>,
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
      render: (rota) => <Text>{formatDateTimeBR(rota.iniciada_em)}</Text>,
    },
    {
      key: 'concluida_em',
      label: 'Concluída',
      width: 140,
      desktopOnly: true,
      render: (rota) => <Text>{formatDateTimeBR(rota.concluida_em)}</Text>,
    },
    {
      key: 'status',
      label: 'Status',
      width: 140,
      sortable: true,
      render: (rota) => {
        if (!rota.status) {
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
          accessibilityRole="button"
          accessibilityLabel="Exportar rotas para CSV"
        >
          <Text style={styles.cardHeaderButtonSecondaryText}>Exportar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cardHeaderButtonPrimary}
          onPress={() => router.push('/gestor/nova-entrega')}
          accessibilityRole="button"
          accessibilityLabel="Criar nova rota"
        >
          <Text style={styles.cardHeaderButtonPrimaryText}>Nova Rota</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : undefined;

  // Desktop Layout
  if (isDesktop) {
    return (
      <ErrorBoundary>
        <DesktopPageLayout
          title={pageMeta.title}
          subtitle={pageMeta.subtitle}
          breadcrumbs={pageMeta.breadcrumbs}
          userMenuTrigger={userMenuTrigger}
          userMenuItems={userMenuItems}
          loading={loading}
          loadingText="Carregando rotas..."
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
                style={[styles.searchInput, isDesktop && styles.searchInputDesktop]}
                placeholder="Buscar por motorista ou data..."
                placeholderTextColor={theme.colors.gray400}
                value={searchQuery}
                onChangeText={setSearchQuery}
                accessibilityLabel="Buscar rotas"
                accessibilityHint="Digite o nome do motorista ou data para filtrar"
              />
            </View>

            {/* Status Filters */}
            <Text style={styles.filtrosLabel} accessibilityRole="header">Filtrar por Status:</Text>
            <View style={styles.filtrosButtons} accessibilityRole="radiogroup">
              {FILTRO_STATUS_OPTIONS.map((status) => {
                const label = status === 'todas' ? 'Todas' : getStatusLabel(status);
                const isSelected = filtroStatus === status;
                return (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.filtroButton,
                      isDesktop && styles.filtroButtonDesktop,
                      isSelected && styles.filtroButtonActive,
                    ]}
                    onPress={() => setFiltroStatus(status)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Filtrar por ${label}`}
                  >
                    <Text
                      style={[
                        styles.filtroButtonText,
                        isDesktop && styles.filtroButtonTextDesktop,
                        isSelected && styles.filtroButtonTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </DesktopCard>

          {/* Tabela de Rotas */}
          <View style={styles.tableSection}>
            <DesktopCard
              title="Rotas"
              noPadding
              variant="elevated"
              actions={tableHeaderActions}
            >
              <DataTable
                testID="gestao-rotas-table"
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
          <View style={styles.modalContent}>
            <Text style={styles.modalMessage}>
              Tem certeza que deseja excluir esta rota?
            </Text>

            <View style={styles.modalInfoBox}>
              <Text style={styles.modalInfoText}>
                <Text style={styles.modalInfoLabel}>Motorista:</Text> {rotaToDelete?.motorista_nome || 'Sem motorista'}
              </Text>
              <Text style={styles.modalInfoText}>
                <Text style={styles.modalInfoLabel}>Paradas:</Text> {rotaToDelete?.paradas_count || 0}
              </Text>
              <Text style={styles.modalInfoTextLast}>
                <Text style={styles.modalInfoLabel}>Status:</Text> {rotaToDelete?.status ? getStatusLabel(rotaToDelete.status) : '-'}
              </Text>
            </View>

            <Text style={styles.modalWarning}>
              ⚠️ Esta ação não pode ser desfeita.
            </Text>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={handleCancelDelete}
                accessibilityRole="button"
                accessibilityLabel="Cancelar exclusão"
              >
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalButtonDanger}
                onPress={handleConfirmDelete}
                accessibilityRole="button"
                accessibilityLabel="Confirmar exclusão da rota"
              >
                <Text style={styles.modalButtonDangerText}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </DesktopModal>

        {/* Toast de Feedback */}
        <Toast {...toastState} onDismiss={hideToast} />
      </ErrorBoundary>
    );
  }

  // Mobile Layout (original)
  if (loading) {
    return (
      <ErrorBoundary>
        <MobileLoading message="Carregando rotas..." />
        {logoutModal}
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      {/* Content */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
        {/* Info e Filtros */}
        <MobileCard
          title="Filtros"
          subtitle={`${rotasFiltradas.length} rota(s) encontrada(s)`}
          variant="bordered"
        >
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <TextInput
              style={[styles.searchInput, isDesktop && styles.searchInputDesktop]}
              placeholder="Buscar por motorista ou data..."
              placeholderTextColor={theme.colors.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              accessibilityLabel="Buscar rotas"
              accessibilityHint="Digite o nome do motorista ou data para filtrar"
            />
          </View>

          <Text style={styles.filtrosLabel} accessibilityRole="header">Filtrar por Status:</Text>
          <View style={styles.filtrosButtons} accessibilityRole="radiogroup">
            {FILTRO_STATUS_OPTIONS.map((status) => {
              const label = status === 'todas' ? 'Todas' : getStatusLabel(status);
              const isSelected = filtroStatus === status;
              return (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filtroButton,
                    isDesktop && styles.filtroButtonDesktop,
                    isSelected && styles.filtroButtonActive,
                  ]}
                  onPress={() => setFiltroStatus(status)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Filtrar por ${label}`}
                >
                  <Text
                    style={[
                      styles.filtroButtonText,
                      isDesktop && styles.filtroButtonTextDesktop,
                      isSelected && styles.filtroButtonTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Botões de Ação */}
          <View style={styles.mobileActionsRow}>
            <TouchableOpacity
              style={styles.mobileActionButtonSecondary}
              onPress={exportarParaCSV}
              accessibilityRole="button"
              accessibilityLabel="Exportar rotas para CSV"
            >
              <Text style={styles.mobileActionButtonSecondaryText}>Exportar CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mobileActionButtonPrimary}
              onPress={() => router.push('/gestor/nova-entrega')}
              accessibilityRole="button"
              accessibilityLabel="Criar nova rota"
            >
              <Text style={styles.mobileActionButtonPrimaryText}>Nova Rota</Text>
            </TouchableOpacity>
          </View>
        </MobileCard>

        {/* DataTable */}
        <DataTable
          testID="gestao-rotas-table"
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
        message={`Tem certeza que deseja excluir esta rota?\n\nMotorista: ${rotaToDelete?.motorista_nome || 'Sem motorista'}\nParadas: ${rotaToDelete?.paradas_count || 0}\nStatus: ${rotaToDelete?.status ? getStatusLabel(rotaToDelete.status) : '-'}\n\nEsta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Toast de Feedback */}
      <Toast {...toastState} onDismiss={hideToast} />
      {logoutModal}
    </ErrorBoundary>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create((theme: Theme) => ({
  tableSection: {
    marginTop: theme.spacing['2xl'],
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    maxWidth: theme.layout.containerMaxWidth,
    marginHorizontal: 'auto',
    width: '100%',
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
    minHeight: 48,
  },
  searchInputDesktop: {
    paddingVertical: 0,
    paddingHorizontal: theme.desktop.input.paddingHorizontal,
    fontSize: theme.desktop.input.fontSize,
    minHeight: theme.desktop.input.height,
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
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtroButtonDesktop: {
    paddingVertical: 6,
    paddingHorizontal: theme.desktop.button.paddingHorizontal,
    minHeight: theme.desktop.button.height,
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
  filtroButtonTextDesktop: {
    fontSize: theme.desktop.button.fontSize,
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
  tableCellText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
  mobileActionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  mobileActionButtonPrimary: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  mobileActionButtonPrimaryText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
  },
  mobileActionButtonSecondary: {
    flex: 1,
    backgroundColor: theme.colors.white,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    alignItems: 'center',
  },
  mobileActionButtonSecondaryText: {
    color: theme.colors.gray700,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
  },
  // Modal Desktop Styles
  modalContent: {
    padding: theme.spacing.xl,
  },
  modalMessage: {
    fontSize: theme.typography.base,
    marginBottom: theme.spacing.xl,
    lineHeight: 24,
    color: theme.colors.gray900,
  },
  modalInfoBox: {
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.xl,
  },
  modalInfoText: {
    fontSize: theme.typography.sm,
    marginBottom: theme.spacing.sm,
    color: theme.colors.gray700,
  },
  modalInfoTextLast: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray700,
  },
  modalInfoLabel: {
    fontFamily: theme.typography.fontSansSemiBold,
  },
  modalWarning: {
    fontSize: theme.typography.sm,
    color: theme.colors.error,
    marginBottom: theme.spacing['2xl'],
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: theme.typography.base,
    color: theme.colors.gray700,
  },
  modalButtonDanger: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
  },
  modalButtonDangerText: {
    fontSize: theme.typography.base,
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
  },
}));
