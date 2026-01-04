import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';

import { styles } from './incidentes.styles';
import { Text } from '@/components/Text';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import {
  DataTable,
  type DataTableAction,
  type DataTableColumn,
  DesktopCard,
  DesktopModal,
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
import { useUnistyles } from '@/utils/styles';

export default function IncidentesScreen() {
  const router = useRouter();
  const { userData } = useUser();
  const { isDesktop } = useResponsive();
  const { theme } = useUnistyles();

  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
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
    fotoRetryCount,
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
          <Text style={styles.tableCellText}>{formatDate(item.created_at)}</Text>
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
              <Ionicons name={cat.icon as any} size={16} color={cat.color} />
              <Text style={[styles.tableCellText, { marginLeft: 6 }]}>{cat.label}</Text>
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
          return <StatusBadge color={st.color} label={st.label} variant="soft" />;
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
          <View style={[styles.resumoCard, { backgroundColor: theme.colors.error + '15' }]}>
            <Text style={[styles.resumoValue, { color: theme.colors.error }]}>
              {resumoGeral.abertos}
            </Text>
            <Text style={styles.resumoLabel}>Abertos</Text>
          </View>
          <View style={[styles.resumoCard, { backgroundColor: theme.colors.warning + '15' }]}>
            <Text style={[styles.resumoValue, { color: theme.colors.warning }]}>
              {resumoGeral.emAnalise}
            </Text>
            <Text style={styles.resumoLabel}>Em Análise</Text>
          </View>
          <View style={[styles.resumoCard, { backgroundColor: theme.colors.success + '15' }]}>
            <Text style={[styles.resumoValue, { color: theme.colors.success }]}>
              {resumoGeral.resolvidos}
            </Text>
            <Text style={styles.resumoLabel}>Resolvidos</Text>
          </View>
          <View style={[styles.resumoCard, { backgroundColor: theme.colors.gray400 + '15' }]}>
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
                  onPress={() => handleVerHistoricoMotorista(stat.id, stat.nome)}
                >
                  <View style={styles.motoristaRank}>
                    <Text style={styles.motoristaRankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.motoristaInfo}>
                    <Text style={styles.motoristaNome}>{stat.nome}</Text>
                    <Text style={styles.motoristaStats}>
                      {stat.total} incidentes ({stat.abertos} abertos, {stat.resolvidos}{' '}
                      resolvidos)
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.gray400} />
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
                  ['todos', 'aberto', 'em_analise', 'resolvido', 'fechado'] as FiltroStatus[]
                ).map((status) => (
                  <FilterChip
                    key={status}
                    label={status === 'todos' ? 'Todos' : statusLabels[status].label}
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
                    label={cat === 'todos' ? 'Todos' : categoriaLabels[cat].label}
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
              <View style={{ padding: theme.spacing['2xl'], alignItems: 'center' }}>
                <Text style={{ fontSize: theme.typography.base, color: theme.colors.gray600 }}>
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
            <MobileCard key={incidente.id} onPress={() => handleVerDetalhes(incidente)}>
              <View style={styles.mobileHeader}>
                <View style={styles.mobileCategoriaRow}>
                  <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                  <Text style={styles.mobileCategoriaText}>{cat.label}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: st.color + '20' }]}>
                  <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>

              <Text style={styles.mobileMotorista}>{incidente.motorista_nome}</Text>
              <View style={styles.mobileEnderecoRow}>
                <Ionicons name="location-outline" size={14} color={theme.colors.gray500} />
                <Text style={styles.mobileEndereco} numberOfLines={2}>
                  {incidente.endereco}
                </Text>
              </View>
              <Text style={styles.mobileData}>{formatDate(incidente.created_at)}</Text>

              <TouchableOpacity
                style={styles.mobileActionButton}
                onPress={() => handleAlterarStatus(incidente)}
              >
                <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.mobileActionText}>Alterar Status</Text>
              </TouchableOpacity>
            </MobileCard>
          );
        })}
      </ScrollView>
    );
  };

  // ============================================
  // Modal: Detalhes
  // ============================================

  const renderDetalhesModal = () => {
    if (!incidenteSelecionado) return null;

    const cat = categoriaLabels[incidenteSelecionado.categoria];
    const st = statusLabels[incidenteSelecionado.status];

    const fotoUri = incidenteSelecionado.foto_url
      ? fotoRetryCount > 0
        ? `${incidenteSelecionado.foto_url}?retry=${fotoRetryCount}`
        : incidenteSelecionado.foto_url
      : null;

    return (
      <DesktopModal
        visible={showDetalhesModal}
        onClose={() => setShowDetalhesModal(false)}
        title="Detalhes do Incidente"
        maxWidth={600}
        primaryButton={{
          text: 'Alterar Status',
          onPress: () => {
            setShowDetalhesModal(false);
            setTimeout(() => handleAlterarStatus(incidenteSelecionado), 300);
          },
        }}
        secondaryButton={{
          text: 'Remarcar Entrega',
          onPress: () => handleRemarcarEntrega(incidenteSelecionado),
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={[styles.detalhesHeader, isDesktop && styles.detalhesHeaderCompact]}>
            <View style={styles.detalhesCategoria}>
              <Ionicons name={cat.icon as any} size={isDesktop ? 20 : 24} color={cat.color} />
              <Text
                style={[
                  styles.detalhesCategoriaText,
                  isDesktop && styles.detalhesCategoriaTextCompact,
                ]}
              >
                {cat.label}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: st.color + '20' }]}>
              <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
            </View>
          </View>

          <View style={[styles.detalhesSection, isDesktop && styles.detalhesSectionCompact]}>
            <Text style={[styles.detalhesLabel, isDesktop && styles.detalhesLabelCompact]}>
              Data/Hora:
            </Text>
            <Text style={[styles.detalhesValue, isDesktop && styles.detalhesValueCompact]}>
              {formatDate(incidenteSelecionado.created_at)}
            </Text>
          </View>

          <View style={[styles.detalhesSection, isDesktop && styles.detalhesSectionCompact]}>
            <Text style={[styles.detalhesLabel, isDesktop && styles.detalhesLabelCompact]}>
              Motorista:
            </Text>
            <Text style={[styles.detalhesValue, isDesktop && styles.detalhesValueCompact]}>
              {incidenteSelecionado.motorista_nome}
            </Text>
          </View>

          <View style={[styles.detalhesSection, isDesktop && styles.detalhesSectionCompact]}>
            <Text style={[styles.detalhesLabel, isDesktop && styles.detalhesLabelCompact]}>
              Local:
            </Text>
            <Text style={[styles.detalhesValue, isDesktop && styles.detalhesValueCompact]}>
              {incidenteSelecionado.endereco}
            </Text>
          </View>

          {incidenteSelecionado.rota_id && (
            <View style={[styles.detalhesSection, isDesktop && styles.detalhesSectionCompact]}>
              <Text style={[styles.detalhesLabel, isDesktop && styles.detalhesLabelCompact]}>
                Rota:
              </Text>
              <Text style={[styles.detalhesValue, isDesktop && styles.detalhesValueCompact]}>
                {incidenteSelecionado.rota_data
                  ? `Rota de ${new Date(incidenteSelecionado.rota_data).toLocaleDateString('pt-BR')}`
                  : 'N/A'}
              </Text>
            </View>
          )}

          <View style={[styles.detalhesSection, isDesktop && styles.detalhesSectionCompact]}>
            <Text style={[styles.detalhesLabel, isDesktop && styles.detalhesLabelCompact]}>
              Descrição:
            </Text>
            <Text
              style={[styles.detalhesDescricao, isDesktop && styles.detalhesDescricaoCompact]}
            >
              {incidenteSelecionado.descricao}
            </Text>
          </View>

          {/* Foto */}
          {fotoUri && (
            <View style={[styles.detalhesSection, isDesktop && styles.detalhesSectionCompact]}>
              <Text style={[styles.detalhesLabel, isDesktop && styles.detalhesLabelCompact]}>
                Foto:
              </Text>
              <View style={[styles.fotoContainer, isDesktop && styles.fotoContainerCompact]}>
                {fotoLoading && !fotoError && (
                  <View style={styles.fotoLoadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={styles.fotoLoadingText}>Carregando foto...</Text>
                  </View>
                )}

                {fotoError && (
                  <View style={styles.fotoErrorContainer}>
                    <Ionicons name="image-outline" size={48} color={theme.colors.gray400} />
                    <Text style={styles.fotoErrorText}>
                      Não foi possível carregar a foto
                    </Text>
                    <TouchableOpacity style={styles.fotoRetryButton} onPress={handleFotoRetry}>
                      <Ionicons name="refresh" size={16} color={theme.colors.primary} />
                      <Text style={styles.fotoRetryText}>Tentar novamente</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!fotoError && (
                  <Image
                    source={{ uri: fotoUri }}
                    style={[
                      styles.incidenteFoto,
                      isDesktop && styles.incidenteFotoCompact,
                      { opacity: fotoLoading ? 0 : 1 },
                    ]}
                    resizeMode="cover"
                    onLoad={handleFotoLoad}
                    onError={handleFotoError}
                    accessibilityLabel={`Foto do incidente: ${cat.label}`}
                  />
                )}
              </View>
            </View>
          )}

          {incidenteSelecionado.observacoes_gestao && (
            <View style={[styles.detalhesSection, isDesktop && styles.detalhesSectionCompact]}>
              <Text style={[styles.detalhesLabel, isDesktop && styles.detalhesLabelCompact]}>
                Observações da Gestão:
              </Text>
              <Text
                style={[styles.detalhesDescricao, isDesktop && styles.detalhesDescricaoCompact]}
              >
                {incidenteSelecionado.observacoes_gestao}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.verHistoricoLink, isDesktop && styles.verHistoricoLinkCompact]}
            onPress={() => {
              setShowDetalhesModal(false);
              setTimeout(
                () =>
                  handleVerHistoricoMotorista(
                    incidenteSelecionado.motorista_id,
                    incidenteSelecionado.motorista_nome
                  ),
                300
              );
            }}
            accessibilityRole="link"
          >
            <Ionicons
              name="time-outline"
              size={isDesktop ? 14 : 16}
              color={theme.colors.primary}
            />
            <Text
              style={[
                styles.verHistoricoLinkText,
                isDesktop && styles.verHistoricoLinkTextCompact,
              ]}
            >
              Ver histórico de incidentes deste motorista
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </DesktopModal>
    );
  };

  // ============================================
  // Modal: Alterar Status
  // ============================================

  const renderAlterarStatusModal = () => {
    if (!incidenteSelecionado) return null;

    return (
      <DesktopModal
        visible={showAlterarStatusModal}
        onClose={() => setShowAlterarStatusModal(false)}
        title="Alterar Status do Incidente"
        maxWidth={500}
        primaryButton={{
          text: 'Salvar',
          onPress: confirmarAlterarStatus,
          loading: atualizando,
        }}
        secondaryButton={{
          text: 'Cancelar',
          onPress: () => setShowAlterarStatusModal(false),
          disabled: atualizando,
        }}
      >
        <View>
          <Text style={styles.modalLabel}>Novo Status:</Text>
          <View style={styles.statusOptions}>
            {Object.entries(statusLabels).map(([key, { label, color }]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.statusOption,
                  novoStatus === key && styles.statusOptionActive,
                  { borderColor: color },
                ]}
                onPress={() => setNovoStatus(key)}
              >
                <Text style={[styles.statusOptionText, novoStatus === key && { color }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.modalLabel, { marginTop: 20 }]}>Observações (opcional):</Text>
          <TextInput
            style={styles.observacoesInput}
            placeholder="Adicione observações sobre a resolução..."
            value={observacoes}
            onChangeText={setObservacoes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </DesktopModal>
    );
  };

  // ============================================
  // Modal: Histórico Motorista
  // ============================================

  const renderHistoricoMotoristaModal = () => {
    if (!motoristaSelecionado) return null;

    return (
      <DesktopModal
        visible={showHistoricoMotoristaModal}
        onClose={() => setShowHistoricoMotoristaModal(false)}
        title={`Histórico de Incidentes - ${motoristaSelecionado.nome}`}
        maxWidth={700}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {incidentesMotorista.length === 0 ? (
            <View style={styles.emptyHistorico}>
              <Text style={styles.emptyHistoricoText}>
                Nenhum incidente encontrado para este motorista
              </Text>
            </View>
          ) : (
            incidentesMotorista.map((inc) => {
              const cat = categoriaLabels[inc.categoria];
              const st = statusLabels[inc.status];

              return (
                <View key={inc.id} style={styles.historicoItem}>
                  <View style={styles.historicoHeader}>
                    <View style={styles.historicoCategoria}>
                      <Ionicons name={cat.icon as any} size={16} color={cat.color} />
                      <Text style={styles.historicoCategoriaText}>{cat.label}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: st.color + '20' }]}>
                      <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.historicoEndereco}>{inc.endereco}</Text>
                  <Text style={styles.historicoData}>{formatDate(inc.created_at)}</Text>
                  {inc.descricao && (
                    <Text style={styles.historicoDescricao} numberOfLines={2}>
                      {inc.descricao}
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </DesktopModal>
    );
  };

  // ============================================
  // Main Render
  // ============================================

  return (
    <ErrorBoundary>
      {isDesktop ? renderDesktop() : renderMobile()}
      {renderDetalhesModal()}
      {renderAlterarStatusModal()}
      {renderHistoricoMotoristaModal()}
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
