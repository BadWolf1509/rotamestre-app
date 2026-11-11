import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View, TouchableOpacity, ScrollView } from 'react-native';

import {
  AlterarStatusModal,
  EstatisticaMotoristaCard,
  HistoricoMotoristaModal,
  IncidenteDetalhesModal,
} from '@/components/gestor/incidentes';
import { SeletorPeriodo } from '@/components/periodo';
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
  EmptyState,
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
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/hooks/useUser';
import { formatarDecimal } from '@/lib/formatNumber';
import { textoPeriodo } from '@/lib/periodo';
import { styles } from '@/styles/gestor/incidentes.styles';
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

  // A página é dona do toast (useToast é estado por instância) e o injeta
  // no hook.
  const { toast: toastState, showToast, hideToast } = useToast();

  const {
    // Data
    incidentes,
    total,
    temMais,
    carregandoMais,
    carregarMais,
    loading,
    categoriaLabels,
    statusLabels,
    estatisticasMotorista,
    resumoGeral,
    // Período
    periodo,
    definirPeriodo,
    pendentesAntesDoPeriodo,
    verPendentesAnteriores,
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
    // Helpers
    formatDate,
  } = useIncidentesGestor(theme, { showToast });

  // Abaixo da lista: quantos mostra de quantos, e a próxima página. Função
  // chamada no JSX (não componente declarado no render).
  const renderCarregarMais = () =>
    temMais && total !== null ? (
      <View style={styles.rodapeLista}>
        <Text style={styles.rodapeListaTexto}>
          {`Mostrando ${formatarDecimal(incidentes.length, 0)} de ${formatarDecimal(total, 0)} incidentes.`}
        </Text>
        <TouchableOpacity
          testID="incidentes-carregar-mais"
          style={styles.botaoCarregarMais}
          onPress={carregarMais}
          disabled={carregandoMais}
          accessibilityRole="button"
          accessibilityLabel="Carregar mais incidentes"
          accessibilityState={{
            disabled: carregandoMais,
            busy: carregandoMais,
          }}
        >
          <Text style={styles.mobileActionText}>
            {carregandoMais ? 'Carregando...' : 'Carregar mais incidentes'}
          </Text>
        </TouchableOpacity>
      </View>
    ) : null;

  // Texto do período no meio de uma frase: "este mês (01/11 a 30/11)".
  const periodoEmFrase = (() => {
    const t = textoPeriodo(periodo);
    return t.charAt(0).toLowerCase() + t.slice(1);
  })();

  // Seletor de período e, acima da lista, o aviso dos pendentes de antes
  // dele (só com início de período; "Todo o período" não tem aviso).
  const renderPeriodo = () => (
    <View style={styles.periodoContainer}>
      <SeletorPeriodo
        valor={periodo}
        aoMudar={definirPeriodo}
        testID="incidentes-periodo"
      />
      {/* Celular não tem os chips de status: mostra o filtro ativo (o "Ver"
          liga "Pendentes") e deixa limpar. */}
      {!isDesktop && filtroStatus !== 'todos' ? (
        <View style={styles.avisoPendentes} testID="incidentes-filtro-status">
          <Text style={styles.avisoPendentesTexto}>
            {`Mostrando: ${
              filtroStatus === 'pendentes'
                ? 'Pendentes'
                : statusLabels[filtroStatus].label
            }`}
          </Text>
          <TouchableOpacity
            testID="incidentes-filtro-status-limpar"
            onPress={() => setFiltroStatus('todos')}
            accessibilityRole="button"
            accessibilityLabel="Limpar filtro de status"
          >
            <Text style={styles.mobileActionText}>Limpar</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {pendentesAntesDoPeriodo > 0 ? (
        <View style={styles.avisoPendentes} testID="incidentes-aviso-pendentes">
          <Text style={styles.avisoPendentesTexto}>
            {pendentesAntesDoPeriodo === 1
              ? '1 incidente pendente de antes do período'
              : `${formatarDecimal(pendentesAntesDoPeriodo, 0)} incidentes pendentes de antes do período`}
          </Text>
          <TouchableOpacity
            testID="incidentes-aviso-pendentes-ver"
            onPress={verPendentesAnteriores}
            accessibilityRole="button"
            accessibilityLabel="Ver incidentes pendentes de antes do período"
          >
            <Text style={styles.mobileActionText}>Ver</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

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
        // Mínimos: a soma com as ações e o recuo fica em 875 px (a janela de
        // 1280 dá ~910 ao cartão); data, categoria e local quebram em duas
        // linhas antes de cortar, e o motorista fica em uma, com reticências.
        minWidth: 110,
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
        minWidth: 120,
        render: (item) => (
          <Text style={styles.tableCellText} numberOfLines={1}>
            {item.motorista_nome}
          </Text>
        ),
      },
      {
        key: 'categoria',
        label: 'Categoria',
        width: 180,
        minWidth: 100,
        render: (item) => {
          const cat = categoriaLabels[item.categoria];
          return (
            <View style={styles.categoriaContainer}>
              <Ionicons name={cat.icon} size={16} color={cat.color} />
              <Text
                style={[styles.tableCellText, { marginLeft: 6, flexShrink: 1 }]}
              >
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
        minWidth: 110,
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
        minWidth: 110,
        render: (item) => {
          const st = statusLabels[item.status];
          return (
            <StatusBadge
              color={st.color}
              textColor={st.textColor}
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
        label: 'Ver detalhes',
        type: 'secondary',
        onPress: handleVerDetalhes,
      },
      {
        icon: 'create-outline',
        label: 'Alterar status',
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
        {renderPeriodo()}

        {/* Cards de Resumo */}
        <View style={styles.resumoRow}>
          <View style={styles.resumoCard}>
            <Text
              style={[styles.resumoValue, { color: theme.colors.errorText }]}
            >
              {resumoGeral.abertos}
            </Text>
            <Text style={styles.resumoLabel}>Abertos</Text>
          </View>
          <View style={styles.resumoCard}>
            <Text
              style={[styles.resumoValue, { color: theme.colors.warningText }]}
            >
              {resumoGeral.emAnalise}
            </Text>
            <Text style={styles.resumoLabel}>Em análise</Text>
          </View>
          <View style={styles.resumoCard}>
            <Text
              style={[styles.resumoValue, { color: theme.colors.successDark }]}
            >
              {resumoGeral.resolvidos}
            </Text>
            <Text style={styles.resumoLabel}>Resolvidos</Text>
          </View>
          <View style={styles.resumoCard}>
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
            subtitle={
              temMais
                ? `Top 5 entre os ${formatarDecimal(incidentes.length, 0)} incidentes carregados`
                : 'Top 5 motoristas com mais incidentes'
            }
          >
            <View style={styles.motoristaStatsContainer}>
              {estatisticasMotorista.map((stat, index) => (
                <EstatisticaMotoristaCard
                  key={stat.id ?? 'removido'}
                  stat={stat}
                  index={index}
                  onVerHistorico={handleVerHistoricoMotorista}
                />
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
                    'pendentes',
                    'aberto',
                    'em_analise',
                    'resolvido',
                    'fechado',
                  ] as FiltroStatus[]
                ).map((status) => (
                  <FilterChip
                    key={status}
                    label={
                      status === 'todos'
                        ? 'Todos'
                        : status === 'pendentes'
                          ? 'Pendentes'
                          : statusLabels[status].label
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
                  {`Nenhum incidente encontrado em ${periodoEmFrase}`}
                </Text>
              </View>
            }
          />
          {renderCarregarMais()}
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
        <View style={styles.mobileContainer}>
          {renderPeriodo()}
          <EmptyState
            compact
            emoji="⚠️"
            title="Nenhum incidente"
            description={`Não há incidentes em ${periodoEmFrase}.`}
          />
        </View>
      );
    }

    return (
      <ScrollView style={styles.mobileContainer}>
        {renderPeriodo()}
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
                  textColor={st.textColor}
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
                <Text style={styles.mobileActionText}>Alterar status</Text>
              </TouchableOpacity>
            </MobileCard>
          );
        })}
        {renderCarregarMais()}
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
