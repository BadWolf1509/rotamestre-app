/**
 * Tela de Gestão de Rotas - Gestor
 *
 * Permite visualizar e gerenciar todas as rotas da unidade:
 * - Listagem paginada no servidor ("Carregar mais", 100 por vez) com aviso de
 *   quantas rotas mostra de quantas; filtro de status e busca no servidor
 * - Visualização de detalhes (motorista, paradas, progresso)
 * - Exclusão de rotas com confirmação
 * - Exportação para CSV ou XLSX de todas as rotas do filtro, com progresso
 *   (desktop dropdown / mobile sheet)
 * - Atualização em tempo real via Supabase Realtime
 *
 * Não há exportação em PDF: o comprovante por rota (pdfmake) nunca foi ligado
 * a uma tela e saiu em 26/10/2026 junto com a dependência; está no git.
 *
 * @layout Desktop: DesktopPageLayout com DataTable
 * @layout Mobile: ScrollView com MobileCards
 */

import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AvisoErroCarga } from '@/components/gestor/AvisoErroCarga';
import { SeletorPeriodo } from '@/components/periodo';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import {
  coresPorStatusDaRota,
  propsDoStatusBadge,
} from '@/constants/statusConfig';
import {
  DataTable,
  type DataTableAction,
  type DataTableColumn,
  DesktopCard,
  DesktopPageLayout,
  FilterChip,
  MobileCard,
  EmptyState,
  MobileLoading,
  Modal,
  Button,
  StatusBadge,
  Toast,
} from '@/design-system';
import { useExclusaoDeRota } from '@/hooks/gestao-rotas/useExclusaoDeRota';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import {
  useGestaoRotas,
  FILTRO_STATUS_OPTIONS,
  type RotaHistorico,
} from '@/hooks/useGestaoRotas';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { formatDateBR, formatDateTimeBR } from '@/lib/dateUtils';
import { formatarDecimal } from '@/lib/formatNumber';
import { textoMostrando } from '@/lib/gestor/consultaRotas';
import { plural } from '@/lib/plural';
import { styles } from '@/styles/gestor/gestao-rotas.styles';
import { useUnistyles } from '@/utils/styles';

// ============================================
// COMPONENT
// ============================================

export default function GestaoRotas() {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pageMeta = getGestorPageMeta('gestao-rotas');

  // Status color map (precisa do theme)
  const statusColorMap = useMemo(
    () => coresPorStatusDaRota((chave) => theme.colors[chave]),
    [theme.colors],
  );

  // A página é dona do toast (useToast é estado por instância) e o injeta
  // no hook.
  const { toast: toastState, showToast, hideToast } = useToast();

  // Hook de gestão de rotas
  const {
    rotasFiltradas,
    total,
    temMais,
    carregandoMais,
    contagens,
    exportacao,
    carregarMais,
    loading,
    erroCarga,
    dadosDe,
    loadRotas,
    filtroStatus,
    searchQuery,
    periodo,
    userData,
    setFiltroStatus,
    definirPeriodo,
    setSearchQuery,
    verDetalhes,
    exportarParaCSV,
    exportarParaXLSX,
    getStatusLabel,
    handleSort,
  } = useGestaoRotas({
    statusColorMap,
    defaultStatusColor: theme.colors.gray500,
    showToast,
  });

  // Exclusão: o mesmo fluxo da Início desktop; a página é dona do toast.
  const { pedirExclusao, dialogo: dialogoExclusao } = useExclusaoDeRota({
    showToast,
    usuarioId: userData?.id,
    aoExcluir: loadRotas,
  });

  // Export dropdown state (desktop). Abaixo de 1024px: Modal com as opções —
  // `Alert.alert` com botões é no-op no react-native-web.
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [mostrarOpcoesExportar, setMostrarOpcoesExportar] = useState(false);

  // Erro de carga: aviso no topo; com dados anteriores, o selo diz de quando.
  const avisoErroCarga = erroCarga ? (
    <AvisoErroCarga
      mensagem={erroCarga}
      dadosDe={dadosDe}
      onTentarNovamente={loadRotas}
    />
  ) : null;
  const exportMenuRef = useRef<ViewInstance>(null);

  // Desktop header menu
  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
    userImageUrl: userData?.foto_url,
  });

  // ============================================
  // DATA TABLE CONFIG
  // ============================================

  // Memoizados: o DataTable desktop é `memo`, e coluna/ação novas a cada render
  // (typing da busca, toast) o redesenhariam inteiro.
  const columns = useMemo<DataTableColumn<RotaHistorico>[]>(
    () => [
      {
        key: 'data',
        label: 'Data',
        width: 100,
        // Mínimos: a tabela cabe em 950 px (janela de 1280) sem rolar.
        minWidth: 95,
        sortable: true,
        // Sem rótulo, a linha (e o botão que abre o detalhe) leria o ISO cru.
        rotulo: (rota) => formatDateBR(rota.data),
        render: (rota) => (
          <Text style={styles.tableCellText}>{formatDateBR(rota.data)}</Text>
        ),
      },
      {
        key: 'motorista',
        label: 'Motorista',
        width: 180,
        minWidth: 130,
        sortable: true,
        rotulo: (rota) => rota.motorista_nome || 'Sem motorista',
        render: (rota) => {
          // Uma linha, com reticências; o nome inteiro fica no rótulo acessível.
          const nome = rota.motorista_nome || 'Sem motorista';
          return (
            <Text
              style={styles.tableCellText}
              numberOfLines={1}
              ellipsizeMode="tail"
              accessibilityLabel={nome}
            >
              {nome}
            </Text>
          );
        },
      },
      {
        key: 'paradas',
        label: 'Paradas',
        width: 80,
        minWidth: 70,
        align: 'center',
        rotulo: (rota) => `${rota.paradas_concluidas}/${rota.paradas_count}`,
        render: (rota) => (
          <Text
            style={styles.tableCellText}
          >{`${rota.paradas_concluidas}/${rota.paradas_count}`}</Text>
        ),
      },
      {
        key: 'distancia',
        label: 'Distância',
        width: 90,
        minWidth: 80,
        align: 'right',
        desktopOnly: true,
        rotulo: (rota) =>
          rota.distancia_total
            ? `${formatarDecimal(rota.distancia_total)} km`
            : '-',
        render: (rota) => (
          <Text style={styles.tableCellText}>
            {rota.distancia_total
              ? `${formatarDecimal(rota.distancia_total)} km`
              : '-'}
          </Text>
        ),
      },
      {
        key: 'iniciada_em',
        label: 'Iniciada',
        width: 120,
        minWidth: 100,
        desktopOnly: true,
        rotulo: (rota) => formatDateTimeBR(rota.iniciada_em),
        render: (rota) => (
          <Text style={styles.tableCellText}>
            {formatDateTimeBR(rota.iniciada_em)}
          </Text>
        ),
      },
      {
        key: 'concluida_em',
        label: 'Concluída',
        width: 120,
        minWidth: 100,
        desktopOnly: true,
        rotulo: (rota) => formatDateTimeBR(rota.concluida_em),
        render: (rota) => (
          <Text style={styles.tableCellText}>
            {formatDateTimeBR(rota.concluida_em)}
          </Text>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        // 150: o rótulo mais longo, "Não executada" (ROUTE_STATUS_CONFIG, o
        // mesmo de getStatusLabel), com ícone, sem reticências e com folga.
        width: 150,
        minWidth: 140,
        sortable: true,
        // O mesmo texto do selo, não o valor do banco ("nao_executada").
        rotulo: (rota) =>
          rota.status
            ? propsDoStatusBadge(rota.status, theme.colors).label
            : '-',
        render: (rota) => {
          if (!rota.status) {
            return <Text style={styles.tableCellText}>-</Text>;
          }
          const selo = propsDoStatusBadge(rota.status, theme.colors);
          return (
            <StatusBadge
              label={selo.label}
              color={selo.color}
              textColor={selo.textColor}
              variant="soft"
              size="sm"
              icon={selo.icon}
            />
          );
        },
      },
    ],
    [theme.colors],
  );

  const actions = useMemo<DataTableAction<RotaHistorico>[]>(
    () => [
      {
        label: 'Ver detalhes',
        icon: 'eye-outline',
        type: 'secondary',
        onPress: verDetalhes,
      },
      {
        // No desktop, `danger` vai para o menu "Mais ações" da linha.
        label: 'Excluir rota',
        icon: 'trash-outline',
        type: 'danger',
        onPress: (rota) =>
          pedirExclusao({
            id: rota.id,
            status: rota.status,
            motorista_nome: rota.motorista_nome ?? null,
            total_paradas: rota.paradas_count,
            statusLabel: getStatusLabel(rota.status),
          }),
      },
    ],
    [verDetalhes, pedirExclusao, getStatusLabel],
  );

  // ============================================
  // RENDER
  // ============================================

  // Números da loja inteira (servidor), não das rotas carregadas na lista.
  const totalRotas = total ?? rotasFiltradas.length;
  const concluidasCount =
    contagens?.concluidas ??
    rotasFiltradas.filter((rota) => rota.status === 'concluida').length;
  const pendentesCount =
    contagens?.pendentes ??
    rotasFiltradas.filter((rota) => rota.status === 'pendente').length;
  // "Todo o período" mantém o texto de antes; com período, o número é o do
  // período (o `count=exact` da consulta já filtrada).
  const subtituloFiltros =
    periodo.tipo === 'todo'
      ? plural(totalRotas, 'rota encontrada', 'rotas encontradas')
      : plural(totalRotas, 'rota no período', 'rotas no período');
  const dicaSemRotas =
    filtroStatus !== 'todas' || periodo.tipo !== 'todo'
      ? 'Tente alterar os filtros ou o período'
      : 'Crie sua primeira rota de entrega';
  const podeCriarRota = filtroStatus === 'todas' && periodo.tipo === 'todo';

  // Abaixo da tabela: quantas a lista mostra de quantas, e a próxima página.
  // Função chamada no JSX (não componente declarado no render).
  const renderRodapeLista = () =>
    temMais && total !== null ? (
      <View style={styles.rodapeLista}>
        <Text style={styles.rodapeListaTexto}>
          {`${textoMostrando(rotasFiltradas.length, total)}. A busca, o filtro e a exportação cobrem todas.`}
        </Text>
        <TouchableOpacity
          testID="gestao-rotas-carregar-mais"
          style={styles.cardHeaderButtonSecondary}
          onPress={carregarMais}
          disabled={carregandoMais}
          accessibilityRole="button"
          accessibilityLabel="Carregar mais rotas"
          accessibilityState={{
            disabled: carregandoMais,
            busy: carregandoMais,
          }}
        >
          <Text style={styles.cardHeaderButtonSecondaryText}>
            {carregandoMais ? 'Carregando...' : 'Carregar mais rotas'}
          </Text>
        </TouchableOpacity>
      </View>
    ) : null;

  const renderProgressoExportacao = () =>
    exportacao ? (
      <Text
        testID="gestao-rotas-exportacao-progresso"
        style={styles.progressoExportacao}
        accessibilityLiveRegion="polite"
      >
        {exportacao.total === null
          ? 'Preparando a exportação...'
          : `Preparando a exportação: ${formatarDecimal(exportacao.carregadas, 0)} de ${formatarDecimal(exportacao.total, 0)} rotas...`}
      </Text>
    ) : null;

  const desktopStats = (
    <View style={styles.headerStats}>
      <View style={styles.headerStat}>
        <Text style={styles.headerStatValue}>
          {formatarDecimal(totalRotas, 0)}
        </Text>
        <Text style={styles.headerStatLabel}>Rotas registradas</Text>
      </View>
      <View style={styles.headerStat}>
        <Text style={[styles.headerStatValue, styles.headerStatValueSuccess]}>
          {formatarDecimal(concluidasCount, 0)}
        </Text>
        <Text style={styles.headerStatLabel}>Concluídas</Text>
      </View>
      <View style={styles.headerStat}>
        <Text style={[styles.headerStatValue, styles.headerStatValueWarning]}>
          {formatarDecimal(pendentesCount, 0)}
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
        <View ref={exportMenuRef} style={{ zIndex: 100 }}>
          <TouchableOpacity
            style={styles.cardHeaderButtonSecondary}
            onPress={() => setShowExportMenu((prev) => !prev)}
            disabled={!!exportacao}
            accessibilityRole="button"
            accessibilityLabel="Abrir menu de exportação"
            accessibilityState={{ disabled: !!exportacao, busy: !!exportacao }}
          >
            <Text style={styles.cardHeaderButtonSecondaryText}>Exportar ▾</Text>
          </TouchableOpacity>
          {showExportMenu && (
            <View
              style={{
                position: 'absolute',
                top: '100%',
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
          onPress={() => router.push('/gestor/nova-entrega')}
          accessibilityRole="button"
          accessibilityLabel="Criar nova rota"
        >
          <Text style={styles.cardHeaderButtonPrimaryText}>Nova rota</Text>
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
          {avisoErroCarga}
          {renderProgressoExportacao()}

          {/* Filtros */}
          <DesktopCard
            title="Filtros"
            subtitle={subtituloFiltros}
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
                placeholder="Buscar por motorista"
                placeholderTextColor={theme.colors.gray400}
                value={searchQuery}
                onChangeText={setSearchQuery}
                accessibilityLabel="Buscar rotas"
                accessibilityHint="Digite o nome do motorista para filtrar"
              />
            </View>

            {/* Status Filters */}
            <Text style={styles.filtrosLabel} accessibilityRole="header">
              Filtrar por Status:
            </Text>
            <View style={styles.filtrosLinha}>
              <View
                style={styles.filtrosButtons}
                accessibilityRole="radiogroup"
              >
                {FILTRO_STATUS_OPTIONS.map((status) => {
                  const label =
                    status === 'todas' ? 'Todas' : getStatusLabel(status);
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
              <SeletorPeriodo
                testID="gestao-rotas-periodo"
                valor={periodo}
                aoMudar={definirPeriodo}
              />
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
                onRowPress={verDetalhes}
                keyExtractor={(rota) => rota.id}
                itemsPerPage={20}
                pagination
                isLoading={loading}
                skeletonRows={10}
                onSort={handleSort}
                emptyState={
                  erroCarga ? null : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>📋</Text>
                      <Text style={styles.emptyStateTitle}>
                        Nenhuma rota encontrada
                      </Text>
                      <Text style={styles.emptyStateSubtitle}>
                        {dicaSemRotas}
                      </Text>
                    </View>
                  )
                }
              />
              {renderRodapeLista()}
            </DesktopCard>
          </View>
        </DesktopPageLayout>

        {/* Confirmação de exclusão - Desktop */}
        {dialogoExclusao}

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
          {avisoErroCarga}

          {/* Info e Filtros */}
          <MobileCard
            title="Filtros"
            subtitle={subtituloFiltros}
            variant="bordered"
          >
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <TextInput
                style={[
                  styles.searchInput,
                  isDesktop && styles.searchInputDesktop,
                ]}
                placeholder="Buscar por motorista"
                placeholderTextColor={theme.colors.gray400}
                value={searchQuery}
                onChangeText={setSearchQuery}
                accessibilityLabel="Buscar rotas"
                accessibilityHint="Digite o nome do motorista para filtrar"
              />
            </View>

            <Text style={styles.filtrosLabel} accessibilityRole="header">
              Filtrar por Status:
            </Text>
            <View style={styles.filtrosLinha}>
              <View
                style={styles.filtrosButtons}
                accessibilityRole="radiogroup"
              >
                {FILTRO_STATUS_OPTIONS.map((status) => {
                  const label =
                    status === 'todas' ? 'Todas' : getStatusLabel(status);
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
              <SeletorPeriodo
                testID="gestao-rotas-periodo"
                valor={periodo}
                aoMudar={definirPeriodo}
              />
            </View>

            {/* Botões de Ação */}
            <View style={styles.mobileActionsRow}>
              <TouchableOpacity
                style={styles.mobileActionButtonSecondary}
                onPress={() => setMostrarOpcoesExportar(true)}
                disabled={!!exportacao}
                accessibilityRole="button"
                accessibilityLabel="Abrir menu de exportação"
                accessibilityState={{
                  disabled: !!exportacao,
                  busy: !!exportacao,
                }}
              >
                <Text style={styles.mobileActionButtonSecondaryText}>
                  Exportar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mobileActionButtonPrimary}
                onPress={() => router.push('/gestor/nova-entrega')}
                accessibilityRole="button"
                accessibilityLabel="Criar nova rota"
              >
                <Text style={styles.mobileActionButtonPrimaryText}>
                  Nova Rota
                </Text>
              </TouchableOpacity>
            </View>
            {renderProgressoExportacao()}
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
              erroCarga ? null : (
                <EmptyState
                  compact
                  emoji="📋"
                  title="Nenhuma rota encontrada"
                  description={dicaSemRotas}
                  actionLabel={podeCriarRota ? 'Criar nova rota' : undefined}
                  onActionPress={
                    podeCriarRota
                      ? () => router.push('/gestor/nova-entrega')
                      : undefined
                  }
                />
              )
            }
          />
          {renderRodapeLista()}
        </View>
      </ScrollView>

      {/* Opções de exportação - Mobile/Tablet */}
      <Modal
        visible={mostrarOpcoesExportar}
        onClose={() => setMostrarOpcoesExportar(false)}
        title="Exportar Rotas"
        size="small"
      >
        <View style={styles.opcoesExportar}>
          <Text style={styles.opcoesExportarTexto}>Escolha o formato:</Text>
          <Button
            title="CSV"
            variant="outline"
            onPress={() => {
              setMostrarOpcoesExportar(false);
              exportarParaCSV();
            }}
          />
          <Button
            title="Excel (XLSX)"
            variant="outline"
            onPress={() => {
              setMostrarOpcoesExportar(false);
              exportarParaXLSX();
            }}
          />
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setMostrarOpcoesExportar(false)}
          />
        </View>
      </Modal>

      {/* Confirmação de exclusão - Mobile */}
      {dialogoExclusao}

      {/* Toast de Feedback */}
      <Toast {...toastState} onDismiss={hideToast} />
      {logoutModal}
    </ErrorBoundary>
  );
}
