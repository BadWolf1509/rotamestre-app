/**
 * Tela de Gestão de Rotas - Gestor
 *
 * Permite visualizar e gerenciar todas as rotas da unidade:
 * - Listagem de rotas com filtros por status e busca textual
 * - Visualização de detalhes (motorista, paradas, progresso)
 * - Exclusão de rotas com confirmação
 * - Exportação para CSV ou XLSX (desktop dropdown / mobile sheet)
 * - Atualização em tempo real via Supabase Realtime
 *
 * NOTE: PDF export is intentionally NOT offered at the list level.
 * exportRotaToPDF() produces a per-route delivery-proof document (with real
 * stop addresses). A bulk list-to-PDF would misuse that function. Wire it
 * from a route-detail screen or per-row action in a future PR.
 *
 * @layout Desktop: DesktopPageLayout com DataTable
 * @layout Mobile: ScrollView com MobileCards
 */

import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getGestorPageMeta } from "@/constants/gestorPageMeta";
import {
  DataTable,
  type DataTableAction,
  type DataTableColumn,
  DesktopCard,
  DesktopPageLayout,
  Dialog,
  FilterChip,
  MobileCard,
  MobileEmptyState,
  MobileLoading,
  StatusBadge,
  Toast,
} from "@/design-system";
import { useDesktopHeaderMenu } from "@/hooks/useDesktopHeaderMenu";
import {
  useGestaoRotas,
  FILTRO_STATUS_OPTIONS,
  type RotaHistorico,
} from "@/hooks/useGestaoRotas";
import { useResponsive } from "@/hooks/useResponsive";
import { formatDateBR, formatDateTimeBR } from "@/lib/dateUtils";
import { styles } from "@/styles/gestor/gestao-rotas.styles";
import { useUnistyles } from "@/utils/styles";

// ============================================
// COMPONENT
// ============================================

export default function GestaoRotas() {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pageMeta = getGestorPageMeta("gestao-rotas");

  // Status color map (precisa do theme)
  const statusColorMap = useMemo(
    () => ({
      pendente: theme.colors.warning,
      em_andamento: theme.colors.info,
      concluida: theme.colors.success,
      cancelada: theme.colors.error,
      nao_executada: theme.colors.warning,
    }),
    [theme.colors],
  );

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
    exportarParaXLSX,
    getStatusLabel,
    getStatusColor,
    toastState,
    hideToast,
    handleSort,
  } = useGestaoRotas({
    statusColorMap,
    defaultStatusColor: theme.colors.gray500,
  });

  // Export dropdown state (desktop only — mobile uses Alert)
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<View>(null);

  // Desktop header menu
  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
    userImageUrl: userData?.foto_url,
  });

  // ============================================
  // DATA TABLE CONFIG
  // ============================================

  const columns: DataTableColumn<RotaHistorico>[] = [
    {
      key: "data",
      label: "Data",
      width: 100,
      sortable: true,
      render: (rota) => (
        <Text style={styles.tableCellText}>{formatDateBR(rota.data)}</Text>
      ),
    },
    {
      key: "motorista",
      label: "Motorista",
      width: 180,
      noWrap: true,
      sortable: true,
      render: (rota) => (
        <Text style={styles.tableCellText}>
          {rota.motorista_nome || "Sem motorista"}
        </Text>
      ),
    },
    {
      key: "paradas",
      label: "Paradas",
      width: 80,
      align: "center",
      render: (rota) => (
        <Text
          style={styles.tableCellText}
        >{`${rota.paradas_concluidas}/${rota.paradas_count}`}</Text>
      ),
    },
    {
      key: "distancia",
      label: "Distância",
      width: 90,
      align: "right",
      desktopOnly: true,
      render: (rota) => (
        <Text style={styles.tableCellText}>
          {rota.distancia_total ? `${rota.distancia_total.toFixed(1)} km` : "-"}
        </Text>
      ),
    },
    {
      key: "iniciada_em",
      label: "Iniciada",
      width: 120,
      desktopOnly: true,
      render: (rota) => (
        <Text style={styles.tableCellText}>
          {formatDateTimeBR(rota.iniciada_em)}
        </Text>
      ),
    },
    {
      key: "concluida_em",
      label: "Concluída",
      width: 120,
      desktopOnly: true,
      render: (rota) => (
        <Text style={styles.tableCellText}>
          {formatDateTimeBR(rota.concluida_em)}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: 110,
      sortable: true,
      render: (rota) => {
        if (!rota.status) {
          return <Text style={styles.tableCellText}>-</Text>;
        }
        return (
          <StatusBadge
            label={getStatusLabel(rota.status)}
            color={getStatusColor(rota.status)}
            variant="solid"
            size="sm"
          />
        );
      },
    },
  ];

  const actions: DataTableAction<RotaHistorico>[] = [
    {
      label: "Ver Detalhes",
      icon: "eye-outline",
      type: "secondary",
      onPress: verDetalhes,
    },
    {
      label: "Excluir",
      icon: "trash-outline",
      type: "danger",
      onPress: excluirRota,
    },
  ];

  // ============================================
  // RENDER
  // ============================================

  const totalRotas = rotasFiltradas.length;
  const concluidasCount = rotasFiltradas.filter(
    (rota) => rota.status === "concluida",
  ).length;
  const pendentesCount = rotasFiltradas.filter(
    (rota) => rota.status === "pendente",
  ).length;

  const desktopStats = (
    <View style={styles.headerStats}>
      <View style={styles.headerStat}>
        <Text style={styles.headerStatValue}>{totalRotas}</Text>
        <Text style={styles.headerStatLabel}>Rotas registradas</Text>
      </View>
      <View style={styles.headerStat}>
        <Text style={[styles.headerStatValue, styles.headerStatValueSuccess]}>
          {concluidasCount}
        </Text>
        <Text style={styles.headerStatLabel}>Concluídas</Text>
      </View>
      <View style={styles.headerStat}>
        <Text style={[styles.headerStatValue, styles.headerStatValueWarning]}>
          {pendentesCount}
        </Text>
        <Text style={styles.headerStatLabel}>Pendentes</Text>
      </View>
    </View>
  );

  const tableHeaderActions = isDesktop ? (
    <View style={styles.cardHeader}>
      {desktopStats}
      <View style={styles.cardHeaderButtons}>
        {/* Export dropdown — desktop */}
        <View ref={exportMenuRef}>
          <TouchableOpacity
            style={styles.cardHeaderButtonSecondary}
            onPress={() => setShowExportMenu((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel="Abrir menu de exportação"
          >
            <Text style={styles.cardHeaderButtonSecondaryText}>Exportar ▾</Text>
          </TouchableOpacity>
          {showExportMenu && (
            <View
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                backgroundColor: theme.colors.white,
                borderRadius: theme.borderRadius.md,
                borderWidth: 1,
                borderColor: theme.colors.gray200,
                ...theme.shadows.md,
                zIndex: 100,
                minWidth: 160,
              }}
            >
              <TouchableOpacity
                style={{ padding: theme.spacing.sm }}
                onPress={() => {
                  setShowExportMenu(false);
                  exportarParaCSV();
                }}
                accessibilityRole="button"
                accessibilityLabel="Exportar rotas para CSV"
              >
                <Text
                  style={{
                    color: theme.colors.gray800,
                    fontSize: theme.typography.sm,
                  }}
                >
                  Exportar CSV
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ padding: theme.spacing.sm }}
                onPress={() => {
                  setShowExportMenu(false);
                  exportarParaXLSX();
                }}
                accessibilityRole="button"
                accessibilityLabel="Exportar rotas para Excel XLSX"
              >
                <Text
                  style={{
                    color: theme.colors.gray800,
                    fontSize: theme.typography.sm,
                  }}
                >
                  Exportar Excel (XLSX)
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.cardHeaderButtonPrimary}
          onPress={() => router.push("/gestor/nova-entrega")}
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
                style={[
                  styles.searchInput,
                  isDesktop && styles.searchInputDesktop,
                ]}
                placeholder="Buscar por motorista ou data..."
                placeholderTextColor={theme.colors.gray400}
                value={searchQuery}
                onChangeText={setSearchQuery}
                accessibilityLabel="Buscar rotas"
                accessibilityHint="Digite o nome do motorista ou data para filtrar"
              />
            </View>

            {/* Status Filters */}
            <Text style={styles.filtrosLabel} accessibilityRole="header">
              Filtrar por Status:
            </Text>
            <View style={styles.filtrosButtons} accessibilityRole="radiogroup">
              {FILTRO_STATUS_OPTIONS.map((status) => {
                const label =
                  status === "todas" ? "Todas" : getStatusLabel(status);
                const isSelected = filtroStatus === status;
                return (
                  <FilterChip
                    key={status}
                    label={label}
                    selected={isSelected}
                    size="compact"
                    onPress={() => setFiltroStatus(status)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Filtrar por ${label}`}
                  />
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
                onSort={handleSort}
                emptyState={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>📋</Text>
                    <Text style={styles.emptyStateTitle}>
                      Nenhuma rota encontrada
                    </Text>
                    <Text style={styles.emptyStateSubtitle}>
                      {filtroStatus !== "todas"
                        ? "Tente alterar os filtros"
                        : "Crie sua primeira rota de entrega"}
                    </Text>
                  </View>
                }
              />
            </DesktopCard>
          </View>
        </DesktopPageLayout>

        {/* Modal de Confirmação - Desktop */}
        <Dialog
          visible={showConfirmModal}
          variant="confirm"
          title="Excluir Rota"
          message={`Tem certeza que deseja excluir esta rota?\n\nMotorista: ${rotaToDelete?.motorista_nome || "Sem motorista"}\nParadas: ${rotaToDelete?.paradas_count || 0}\nStatus: ${rotaToDelete?.status ? getStatusLabel(rotaToDelete.status) : "-"}\n\nEsta ação não pode ser desfeita.`}
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingBottom: Math.max(20, insets.bottom + 20),
        }}
      >
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
                style={[
                  styles.searchInput,
                  isDesktop && styles.searchInputDesktop,
                ]}
                placeholder="Buscar por motorista ou data..."
                placeholderTextColor={theme.colors.gray400}
                value={searchQuery}
                onChangeText={setSearchQuery}
                accessibilityLabel="Buscar rotas"
                accessibilityHint="Digite o nome do motorista ou data para filtrar"
              />
            </View>

            <Text style={styles.filtrosLabel} accessibilityRole="header">
              Filtrar por Status:
            </Text>
            <View style={styles.filtrosButtons} accessibilityRole="radiogroup">
              {FILTRO_STATUS_OPTIONS.map((status) => {
                const label =
                  status === "todas" ? "Todas" : getStatusLabel(status);
                const isSelected = filtroStatus === status;
                return (
                  <FilterChip
                    key={status}
                    label={label}
                    selected={isSelected}
                    size="regular"
                    onPress={() => setFiltroStatus(status)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Filtrar por ${label}`}
                  />
                );
              })}
            </View>

            {/* Botões de Ação */}
            <View style={styles.mobileActionsRow}>
              <TouchableOpacity
                style={styles.mobileActionButtonSecondary}
                onPress={() =>
                  Alert.alert("Exportar Rotas", "Escolha o formato:", [
                    {
                      text: "CSV",
                      onPress: exportarParaCSV,
                    },
                    {
                      text: "Excel (XLSX)",
                      onPress: exportarParaXLSX,
                    },
                    { text: "Cancelar", style: "cancel" },
                  ])
                }
                accessibilityRole="button"
                accessibilityLabel="Abrir menu de exportação"
              >
                <Text style={styles.mobileActionButtonSecondaryText}>
                  Exportar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mobileActionButtonPrimary}
                onPress={() => router.push("/gestor/nova-entrega")}
                accessibilityRole="button"
                accessibilityLabel="Criar nova rota"
              >
                <Text style={styles.mobileActionButtonPrimaryText}>
                  Nova Rota
                </Text>
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
            onSort={handleSort}
            emptyState={
              <MobileEmptyState
                icon="📋"
                title="Nenhuma rota encontrada"
                subtitle={
                  filtroStatus !== "todas"
                    ? "Tente alterar os filtros"
                    : "Crie sua primeira rota de entrega"
                }
                actionLabel={
                  filtroStatus === "todas" ? "Criar Nova Rota" : undefined
                }
                onAction={
                  filtroStatus === "todas"
                    ? () => router.push("/gestor/nova-entrega")
                    : undefined
                }
              />
            }
          />
        </View>
      </ScrollView>

      {/* Modal de Confirmação de Exclusão - Mobile */}
      <Dialog
        visible={showConfirmModal}
        variant="confirm"
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir esta rota?\n\nMotorista: ${rotaToDelete?.motorista_nome || "Sem motorista"}\nParadas: ${rotaToDelete?.paradas_count || 0}\nStatus: ${rotaToDelete?.status ? getStatusLabel(rotaToDelete.status) : "-"}\n\nEsta ação não pode ser desfeita.`}
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
