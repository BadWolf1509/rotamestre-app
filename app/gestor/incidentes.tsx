import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View, TouchableOpacity, ScrollView } from 'react-native';

import {
  AlterarStatusModal,
  HistoricoMotoristaModal,
  IncidenteDetalhesModal,
} from '@/components/gestor/incidentes';
import { Text } from '@/components/Text';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import {
  DataTable,
  type DataTableAction,
  type DataTableColumn,
  DesktopCard,
  DesktopPageLayout,
  ErrorBoundary,
  FilterChip,
  MobileCard,
  MobileEmptyState,
  MobileLoading,
  StatusBadge,
  Toast,
} from '@/design-system';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import {
  useIncidentesGestor,
  type Incidente,
  type FiltroStatus,
  type FiltroCategoria,
} from '@/hooks/useIncidentesGestor';
import { useResponsive } from '@/hooks/useResponsive';
import { useUser } from '@/hooks/useUser';
import { styles } from '@/styles/gestor/incidentes.styles';
import { withOpacity } from '@/utils/color';
import { useUnistyles } from '@/utils/styles';

export default function IncidentesScreen() {
  const router = useRouter();
  const { userData } = useUser();
  const { isDesktop } = useResponsive();
  const { theme } = useUnistyles();

  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
    userImageUrl: userData?.foto_url,
  });

  const {
    // Data
    incidentes,
    loading,
    categoriaLabels,
    statusLabels,
    estatisticasMotorista,
    resumoGeral,
    // Filters
    filtroStatus,
    filtroCategoria,
    setFiltroStatus,
    setFiltroCategoria,
    // Detalhes modal
    incidenteSelecionado,
    showDetalhesModal,
    fotoLoading,
    fotoError,
    handleVerDetalhes,
    handleFotoLoad,
    handleFotoError,
    handleFotoRetry,
    setShowDetalhesModal,
    // Status modal
    showAlterarStatusModal,
    novoStatus,
    observacoes,
    atualizando,
    handleAlterarStatus,
    confirmarAlterarStatus,
    setNovoStatus,
    setObservacoes,
    setShowAlterarStatusModal,
    // Histórico motorista modal
    showHistoricoMotoristaModal,
    motoristaSelecionado,
    incidentesMotorista,
    historicoLoading,
    handleVerHistoricoMotorista,
    setShowHistoricoMotoristaModal,
    // Toast
    toastState,
    hideToast,
    // Helpers
    formatDate,
  } = useIncidentesGestor(theme);

  // Remarcar entrega
  const handleRemarcarEntrega = (incidente: Incidente) => {
    setShowDetalhesModal(false);
    const enderecoEncoded = encodeURIComponent(incidente.endereco);
    router.push(`/gestor/nova-entrega?endereco=${enderecoEncoded}`);
  };

  // ============================================
  // Desktop Render
  // ============================================

  const renderDesktop = () => {
    const columns: DataTableColumn<Incidente>[] = [
      {
        key: 'created_at',
        label: 'Data/Hora',
        width: 140,
        render: (item) => (
          <Text style={styles.tableCellText}>
            {formatDate(item.created_at)}
          </Text>
        ),
      },
      {
        key: 'motorista_nome',
        label: 'Motorista',
        width: 220,
        render: (item) => (
          <Text style={styles.tableCellText}>{item.motorista_nome}</Text>
        ),
      },
      {
        key: 'categoria',
        label: 'Categoria',
        width: 180,
        render: (item) => {
          const cat = categoriaLabels[item.categoria];
          return (
            <View style={styles.categoriaContainer}>
              <Ionicons name={cat.icon} size={16} color={cat.color} />
              <Text style={[styles.tableCellText, { marginLeft: 6 }]}>
                {cat.label}
              </Text>
            </View>
          );
        },
      },
      {
        key: 'endereco',
        label: 'Local',
        width: 280,
        render: (item) => (
          <Text style={styles.tableCellText} numberOfLines={2}>
            {item.endereco}
          </Text>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: 120,
        render: (item) => {
          const st = statusLabels[item.status];
          return (
            <StatusBadge
              color={st.color}
              label={st.label}
              variant="soft"
              size="sm"
            />
          );
        },
      },
    ];

    const actions: DataTableAction<Incidente>[] = [
      {
        icon: 'eye-outline',
        label: 'Ver Detalhes',
        type: 'secondary',
        onPress: handleVerDetalhes,
      },
      {
        icon: 'create-outline',
        label: 'Alterar Status',
        type: 'primary',
        onPress: handleAlterarStatus,
      },
    ];

    return (
      <DesktopPageLayout
        title={getGestorPageMeta('incidentes').title}
        subtitle={getGestorPageMeta('incidentes').subtitle}
        icon={getGestorPageMeta('incidentes').icon}
        breadcrumbs={getGestorPageMeta('incidentes').breadcrumbs}
        userMenuTrigger={userMenuTrigger}
        userMenuItems={userMenuItems}
        loading={loading}
        loadingText="Carregando incidentes..."
      >
        {/* Cards de Resumo */}
        <View style={styles.resumoRow}>
          <View
            style={[
              styles.resumoCard,
              { backgroundColor: withOpacity(theme.colors.error, 0.15) },
            ]}
          >
            <Text style={[styles.resumoValue, { color: theme.colors.error }]}>
              {resumoGeral.abertos}
            </Text>
            <Text style={styles.resumoLabel}>Abertos</Text>
          </View>
          <View
            style={[
              styles.resumoCard,
              { backgroundColor: withOpacity(theme.colors.warning, 0.15) },
            ]}
          >
            <Text style={[styles.resumoValue, { color: theme.colors.warning }]}>
              {resumoGeral.emAnalise}
            </Text>
            <Text style={styles.resumoLabel}>Em Análise</Text>
          </View>
          <View
            style={[
              styles.resumoCard,
              { backgroundColor: withOpacity(theme.colors.success, 0.15) },
            ]}
          >
            <Text style={[styles.resumoValue, { color: theme.colors.success }]}>
              {resumoGeral.resolvidos}
            </Text>
            <Text style={styles.resumoLabel}>Resolvidos</Text>
          </View>
          <View
            style={[
              styles.resumoCard,
              { backgroundColor: withOpacity(theme.colors.gray400, 0.15) },
            ]}
          >
            <Text style={[styles.resumoValue, { color: theme.colors.gray600 }]}>
              {resumoGeral.total}
            </Text>
            <Text style={styles.resumoLabel}>Total</Text>
          </View>
        </View>

        {/* Incidentes por Motorista */}
        {estatisticasMotorista.length > 0 && (
          <DesktopCard
            title="Incidentes por Motorista"
            subtitle="Top 5 motoristas com mais incidentes"
          >
            <View style={styles.motoristaStatsContainer}>
              {estatisticasMotorista.map((stat, index) => (
                <TouchableOpacity
                  key={stat.id}
                  style={styles.motoristaStat}
                  onPress={() =>
                    handleVerHistoricoMotorista(stat.id, stat.nome)
                  }
                >
                  <View style={styles.motoristaRank}>
                    <Text style={styles.motoristaRankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.motoristaInfo}>
                    <Text style={styles.motoristaNome}>{stat.nome}</Text>
                    <Text style={styles.motoristaStats}>
                      {stat.total} incidentes ({stat.abertos} abertos,{' '}
                      {stat.resolvidos} resolvidos)
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.gray400}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </DesktopCard>
        )}

        <DesktopCard title="Incidentes Reportados">
          {/* Filtros */}
          <View style={styles.filtrosContainer}>
            <View style={styles.filtroGroup}>
              <Text style={styles.filtroLabel}>Status:</Text>
              <View style={styles.filtroChips}>
                {(
                  [
                    'todos',
                    'aberto',
                    'em_analise',
                    'resolvido',
                    'fechado',
                  ] as FiltroStatus[]
                ).map((status) => (
                  <FilterChip
                    key={status}
                    label={
                      status === 'todos' ? 'Todos' : statusLabels[status].label
                    }
                    selected={filtroStatus === status}
                    onPress={() => setFiltroStatus(status)}
                    size="compact"
                  />
                ))}
              </View>
            </View>

            <View style={styles.filtroGroup}>
              <Text style={styles.filtroLabel}>Categoria:</Text>
              <View style={styles.filtroChips}>
                {(
                  [
                    'todos',
                    'accident',
                    'absent',
                    'wrong_address',
                    'blocked',
                    'vehicle',
                    'other',
                  ] as FiltroCategoria[]
                ).map((cat) => (
                  <FilterChip
                    key={cat}
                    label={
                      cat === 'todos' ? 'Todos' : categoriaLabels[cat].label
                    }
                    selected={filtroCategoria === cat}
                    onPress={() => setFiltroCategoria(cat)}
                    size="compact"
                  />
                ))}
              </View>
            </View>
          </View>

          <DataTable
            data={incidentes}
            columns={columns}
            actions={actions}
            keyExtractor={(item) => item.id}
            emptyState={
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateText}>
                  Nenhum incidente encontrado
                </Text>
              </View>
            }
          />
        </DesktopCard>
      </DesktopPageLayout>
    );
  };

  // ============================================
  // Mobile Render
  // ============================================

  const renderMobile = () => {
    if (loading) {
      return <MobileLoading />;
    }

    if (incidentes.length === 0) {
      return (
        <MobileEmptyState
          icon="⚠️"
          title="Nenhum incidente"
          subtitle="Não há incidentes reportados no momento."
        />
      );
    }

    return (
      <ScrollView style={styles.mobileContainer}>
        {incidentes.map((incidente) => {
          const cat = categoriaLabels[incidente.categoria];
          const st = statusLabels[incidente.status];

          return (
            <MobileCard
              key={incidente.id}
              onPress={() => handleVerDetalhes(incidente)}
            >
              <View style={styles.mobileHeader}>
                <View style={styles.mobileCategoriaRow}>
                  <Ionicons name={cat.icon} size={20} color={cat.color} />
                  <Text style={styles.mobileCategoriaText}>{cat.label}</Text>
                </View>
                <StatusBadge
                  color={st.color}
                  label={st.label}
                  variant="soft"
                  size="sm"
                />
              </View>

              <Text style={styles.mobileMotorista}>
                {incidente.motorista_nome}
              </Text>
              <View style={styles.mobileEnderecoRow}>
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={theme.colors.gray500}
                />
                <Text style={styles.mobileEndereco} numberOfLines={2}>
                  {incidente.endereco}
                </Text>
              </View>
              <Text style={styles.mobileData}>
                {formatDate(incidente.created_at)}
              </Text>

              <TouchableOpacity
                style={styles.mobileActionButton}
                onPress={() => handleAlterarStatus(incidente)}
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={styles.mobileActionText}>Alterar Status</Text>
              </TouchableOpacity>
            </MobileCard>
          );
        })}
      </ScrollView>
    );
  };

  // ============================================
  // Main Render
  // ============================================

  return (
    <ErrorBoundary>
      {isDesktop ? renderDesktop() : renderMobile()}

      <IncidenteDetalhesModal
        incidente={incidenteSelecionado}
        visible={showDetalhesModal}
        onClose={() => setShowDetalhesModal(false)}
        isDesktop={isDesktop}
        categoriaLabels={categoriaLabels}
        statusLabels={statusLabels}
        fotoLoading={fotoLoading}
        fotoError={fotoError}
        onFotoLoad={handleFotoLoad}
        onFotoError={handleFotoError}
        onFotoRetry={handleFotoRetry}
        onAlterarStatus={handleAlterarStatus}
        onRemarcarEntrega={handleRemarcarEntrega}
        onVerHistoricoMotorista={handleVerHistoricoMotorista}
        formatDate={formatDate}
      />

      <AlterarStatusModal
        incidente={incidenteSelecionado}
        visible={showAlterarStatusModal}
        onClose={() => setShowAlterarStatusModal(false)}
        statusLabels={statusLabels}
        novoStatus={novoStatus}
        observacoes={observacoes}
        atualizando={atualizando}
        onConfirmar={confirmarAlterarStatus}
        setNovoStatus={setNovoStatus}
        setObservacoes={setObservacoes}
      />

      <HistoricoMotoristaModal
        visible={showHistoricoMotoristaModal}
        onClose={() => setShowHistoricoMotoristaModal(false)}
        motoristaSelecionado={motoristaSelecionado}
        incidentesMotorista={incidentesMotorista}
        historicoLoading={historicoLoading}
        categoriaLabels={categoriaLabels}
        statusLabels={statusLabels}
        formatDate={formatDate}
        onVerDetalhes={handleVerDetalhes}
      />
      <Toast
        visible={toastState.visible}
        message={toastState.message}
        type={toastState.type}
        onDismiss={hideToast}
      />
      {logoutModal}
    </ErrorBoundary>
  );
}
