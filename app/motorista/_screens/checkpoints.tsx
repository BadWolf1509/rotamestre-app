import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  Platform,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { IncidentReportWizard } from '@/components/IncidentReportWizard';
import { MobileEmptyState } from '@/components/mobile/MobileEmptyState';
import { ParadaCard, Parada } from '@/components/motorista/ParadaCard';
import { ParadaCardSkeletonList } from '@/components/motorista/ParadaCardSkeleton';
import { SkipReasonModal } from '@/components/motorista/SkipReasonModal';
import { StopCompletionFlow } from '@/components/motorista/StopCompletionFlow';
import { SKIP_REASON_LABELS, type MotivoSkip } from '@/constants/skipReasons';
import { useRouteStatus, ParadaData } from '@/context/RouteStatusContext';
import { Text } from '@/design-system';
import { useAlert } from '@/hooks/useAlert';
import { useDriverLocationBroadcast } from '@/hooks/useDriverLocationBroadcast';
import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import { abrirNavegacao } from '@/lib/navigation';
import { skipParada, updateParadaStatus, logParadaAction } from '@/lib/queries/paradas';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export default function CheckpointsMotorista() {
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const { showWarning, showSuccess, showError, showConfirm, AlertDialog } = useAlert();

  // Usar contexto como fonte única de dados (com realtime automático)
  const {
    route,
    paradas: paradasContext,
    loading,
    routeStatus,
    refreshRoute,
  } = useRouteStatus();

  // Estados locais de UI apenas
  const [refreshing, setRefreshing] = useState(false);
  const [concluindoParada, _setConcluindoParada] = useState<string | null>(null);
  const [pulandoParada, setPulandoParada] = useState<string | null>(null);
  const [retomandoParada, setRetomandoParada] = useState<string | null>(null);
  const [showIncidentWizard, setShowIncidentWizard] = useState(false);
  const [selectedParadaForIncident, setSelectedParadaForIncident] = useState<Parada | null>(null);
  // Estado para o modal de conclusão de parada (com foto)
  const [showCompletionFlow, setShowCompletionFlow] = useState(false);
  const [selectedParadaForCompletion, setSelectedParadaForCompletion] = useState<ParadaData | null>(null);
  // Estado para o modal de motivo de skip
  const [skipModalParada, setSkipModalParada] = useState<Parada | null>(null);

  // Filtrar apenas paradas reais (excluindo checkpoints de partida/chegada)
  // e fazer cast para tipo Parada do ParadaCard
  const paradas = useMemo(
    // Safe cast: ParadaData structurally compatible with Parada
    () => paradasContext.filter(p => p.is_checkpoint !== false) as unknown as Parada[],
    [paradasContext]
  );

  // Broadcast localização do motorista quando a rota está em andamento
  useDriverLocationBroadcast({
    rotaId: route?.id,
    rotaStatus: route?.status,
  });

  // Abre o modal de conclusão com foto
  const concluirParada = useCallback(
    (parada: Parada) => {
      // Validar se a rota foi iniciada
      if (route?.status !== 'em_andamento') {
        showWarning('Rota não iniciada', 'Você precisa iniciar a rota antes de concluir paradas.');
        return;
      }

      // Safe cast: Parada structurally compatible with ParadaData
      setSelectedParadaForCompletion(parada as unknown as ParadaData);
      setShowCompletionFlow(true);
    },
    [route?.status, showWarning]
  );

  // Handler quando conclusão é bem-sucedida
  function handleCompletionSuccess() {
    // Contexto atualiza automaticamente via realtime
    refreshRoute();
  }

  // Abre o modal de motivo de skip
  const pularParada = useCallback(
    (parada: Parada) => {
      setSkipModalParada(parada);
    },
    []
  );

  // Confirma o skip com motivo estruturado
  const confirmarSkip = useCallback(
    async (motivo: MotivoSkip, observacoes?: string) => {
      const parada = skipModalParada;
      if (!parada) return;
      setSkipModalParada(null);

      setPulandoParada(parada.id);
      try {
        const result = await skipParada(parada.id, motivo, observacoes);
        if (!result.success) throw result.error;

        // Log é fire-and-forget (não bloqueia a operação)
        logParadaAction(userData!.id, parada.id, route!.id, 'parada_pulada', {
          endereco: parada.endereco,
          tipo: parada.tipo,
          ordem: parada.ordem,
          motivo,
          ...(observacoes && { observacoes }),
        });

        showSuccess('Parada Pulada', SKIP_REASON_LABELS[motivo]);
        refreshRoute();
      } catch (error) {
        logger.error('Erro ao pular parada:', error);
        showError(error);
      } finally {
        setPulandoParada(null);
      }
    },
    [skipModalParada, userData, route, refreshRoute, showSuccess, showError]
  );

  const retomarParada = useCallback(
    async (parada: Parada) => {
      const confirmed = await showConfirm({
        title: 'Retomar Parada',
        message: `Deseja retomar esta ${parada.tipo}?\n\n${parada.endereco}\n\nA parada voltará para o status "pendente".`,
        confirmText: 'Retomar',
        cancelText: 'Cancelar',
      });

      if (!confirmed) return;

      setRetomandoParada(parada.id);
      try {
        const result = await updateParadaStatus(parada.id, 'pendente');
        if (!result.success) throw result.error;

        // Log é fire-and-forget (não bloqueia a operação)
        logParadaAction(userData!.id, parada.id, route!.id, 'parada_retomada', {
          endereco: parada.endereco,
          tipo: parada.tipo,
          ordem: parada.ordem,
        });

        showSuccess('Parada Retomada', 'Parada voltou para pendente');
        refreshRoute();
      } catch (error) {
        logger.error('Erro ao retomar parada:', error);
        showError(error);
      } finally {
        setRetomandoParada(null);
      }
    },
    [userData, route, refreshRoute, showConfirm, showSuccess, showError]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshRoute();
    setRefreshing(false);
  }, [refreshRoute]);

  // IMPORTANTE: Todos os hooks DEVEM estar antes de qualquer early return
  // Calcular estatísticas das paradas (já filtradas no useMemo acima)
  const paradasPendentes = useMemo(
    () => paradas.filter((p) => p.status === 'pendente' || p.status === 'em_andamento').length,
    [paradas]
  );
  const paradasConcluidas = useMemo(
    () => paradas.filter((p) => p.status === 'concluida').length,
    [paradas]
  );
  const paradasPuladas = useMemo(
    () => paradas.filter((p) => p.status === 'pulada').length,
    [paradas]
  );

  // Memoizar keyExtractor
  const keyExtractor = useCallback((item: Parada) => item.id, []);

  // Calcular ID da próxima parada (prioriza em_andamento)
  const proximaParadaId = useMemo(() => {
    const ordered = [...paradas].sort((a, b) => a.ordem - b.ordem);
    const emAndamento = ordered.find((p) => p.status === 'em_andamento');
    if (emAndamento) return emAndamento.id;
    const pendentes = ordered.filter((p) => p.status === 'pendente');
    return pendentes.length > 0 ? pendentes[0].id : null;
  }, [paradas]);

  // Handlers para o ParadaCard
  const handleNavegar = useCallback((parada: Parada) => {
    abrirNavegacao({
      latitude: parada.latitude,
      longitude: parada.longitude,
      endereco: parada.endereco,
    });
  }, []);

  const handleReportar = useCallback((parada: Parada) => {
    setSelectedParadaForIncident(parada);
    setShowIncidentWizard(true);
  }, []);

  // Memoizar renderItem usando o novo ParadaCard
  const renderParada = useCallback(
    ({ item }: { item: Parada }) => (
      <ParadaCard
        parada={item}
        rotaEmAndamento={route?.status === 'em_andamento'}
        onConcluir={concluirParada}
        onPular={pularParada}
        onRetomar={retomarParada}
        onNavegar={handleNavegar}
        onReportar={handleReportar}
        concluindo={concluindoParada === item.id}
        pulando={pulandoParada === item.id}
        retomando={retomandoParada === item.id}
        isProxima={item.id === proximaParadaId}
      />
    ),
    [
      concluindoParada,
      pulandoParada,
      retomandoParada,
      route?.status,
      proximaParadaId,
      concluirParada,
      pularParada,
      retomarParada,
      handleNavegar,
      handleReportar,
    ]
  );

  const showEmptyState = !loading && (routeStatus === 'no-route' || paradas.length === 0);

  // Early return para empty state (evita renderizar dentro do GestureHandlerRootView)
  if (showEmptyState) {
    return (
      <View testID="motorista-checkpoints-empty" style={{ flex: 1, backgroundColor: theme.colors.gray50 }}>
        <MobileEmptyState
          icon="📋"
          title="Nenhuma rota ativa no momento"
          subtitle="Aguarde o gestor atribuir uma nova rota"
          fullScreen
        />
      </View>
    );
  }

  let content: ReactNode;

  if (loading) {
    content = (
      <View style={styles.container as ViewStyle}>
          {/* Skeleton Header */}
          <View style={styles.header as ViewStyle}>
            <View style={{ width: 200, height: 28, backgroundColor: theme.colors.gray200, borderRadius: theme.borderRadius.sm }} />
            <View style={{ width: 150, height: 14, backgroundColor: theme.colors.gray200, borderRadius: theme.borderRadius.sm, marginTop: theme.spacing.xs }} />
          </View>

          {/* Skeleton Stats */}
          <View style={styles.statsRow as ViewStyle}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.statItem as ViewStyle}>
                <View style={{ width: 40, height: 28, backgroundColor: theme.colors.gray200, borderRadius: theme.borderRadius.sm }} />
                <View style={{ width: 60, height: 12, backgroundColor: theme.colors.gray200, borderRadius: theme.borderRadius.sm, marginTop: theme.spacing.xs }} />
              </View>
            ))}
          </View>

          {/* Skeleton Progress */}
          <View style={styles.progressSection as ViewStyle}>
            <View style={{ width: 120, height: 14, backgroundColor: theme.colors.gray200, borderRadius: theme.borderRadius.sm }} />
            <View style={[styles.progressContainer as ViewStyle, { marginTop: theme.spacing.xs }]}>
              <View style={{ width: '30%', height: '100%', backgroundColor: theme.colors.gray300, borderRadius: theme.borderRadius.full }} />
            </View>
          </View>

          {/* Skeleton Cards */}
          <View style={styles.listContainer as ViewStyle}>
            <ParadaCardSkeletonList count={3} />
          </View>
        </View>
    );
  } else {
    // Estilo com overflow para web (scroll habilita rolagem)
    const contentStyle: ViewStyle = {
      ...(styles.contentContainer as ViewStyle),
      ...(Platform.OS === 'web' && { overflow: 'scroll' }),
    };

    content = (
      <View style={contentStyle}>
      {/* Header Compacto */}
      <View style={styles.headerCompact as ViewStyle}>
        {/* Linha 1: Título e unidade */}
        <View style={styles.headerRow as ViewStyle}>
          <Text style={styles.headerTitle as TextStyle}>Checkpoints</Text>
          <Text style={styles.headerDivider as TextStyle}>·</Text>
          <Text style={styles.headerSubtitleCompact as TextStyle} numberOfLines={1}>
            {route?.unidade_nome}
          </Text>
        </View>

        {/* Linha 2: Stats inline */}
        <View style={styles.statsInline as ViewStyle}>
          <Text style={styles.statsInlineText as TextStyle}>
            {paradas.length} paradas ·{' '}
            <Text style={{ color: theme.colors.success }}>{paradasConcluidas}✓</Text> ·{' '}
            <Text style={{ color: theme.colors.warning }}>{paradasPendentes}○</Text>
            {paradasPuladas > 0 && (
              <>
                {' '}· <Text style={{ color: theme.colors.error }}>{paradasPuladas}↷</Text>
              </>
            )}
            {' '}· {paradas.length > 0 ? Math.round((paradasConcluidas / paradas.length) * 100) : 0}%
          </Text>
        </View>

        {/* Barra de Progresso */}
        <View style={styles.progressContainer as ViewStyle}>
          <View
            style={[
              styles.progressBar as ViewStyle,
              { width: `${paradas.length > 0 ? (paradasConcluidas / paradas.length) * 100 : 0}%` },
            ]}
          />
        </View>
      </View>

      {/* Lista de Paradas */}
      <FlatList
        testID="motorista-checkpoints-list"
        data={paradas}
        keyExtractor={keyExtractor}
        renderItem={renderParada}
        style={styles.flatList as ViewStyle}
        contentContainerStyle={styles.listContainer as ViewStyle}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={3}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyListContainer as ViewStyle}>
            <Text style={styles.emptyListText as TextStyle}>Nenhuma parada cadastrada</Text>
          </View>
        }
      />

      {/* Incident Report Wizard */}
      {showIncidentWizard && selectedParadaForIncident && route && (
        <IncidentReportWizard
          visible={showIncidentWizard}
          onClose={() => {
            setShowIncidentWizard(false);
            setSelectedParadaForIncident(null);
          }}
          onSubmit={(report) => {
            logger.debug('Incidente reportado:', report);
            refreshRoute(); // Contexto atualiza automaticamente
          }}
          paradaId={selectedParadaForIncident.id}
          rotaId={route.id}
          motoristaId={userData?.id || ''}
          endereco={selectedParadaForIncident.endereco}
        />
      )}

      </View>
    );
  }

  // Na web, GestureHandlerRootView pode bloquear scroll - usar View simples
  const Container = Platform.OS === 'web' ? View : GestureHandlerRootView;

  return (
    <Container style={styles.container as ViewStyle}>
      <ErrorBoundary>
      {content}

      {/* Modal de Conclusão de Parada (com foto) */}
      <StopCompletionFlow
        parada={selectedParadaForCompletion}
        visible={showCompletionFlow}
        onClose={() => {
          setShowCompletionFlow(false);
          setSelectedParadaForCompletion(null);
        }}
        onSuccess={handleCompletionSuccess}
        allowSkipPhoto={true}
      />

      {/* Modal de Motivo de Skip */}
      {skipModalParada && (
        <SkipReasonModal
          visible={!!skipModalParada}
          // Safe cast: Parada structurally compatible with ParadaData
          parada={skipModalParada as unknown as ParadaData}
          onConfirm={confirmarSkip}
          onCancel={() => setSkipModalParada(null)}
        />
      )}

      {AlertDialog}
      </ErrorBoundary>
    </Container>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  contentContainer: {
    flex: 1,
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
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  headerCompact: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  headerTitle: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.xl,
    color: theme.colors.gray900,
  },
  headerDivider: {
    fontSize: theme.typography.lg,
    color: theme.colors.gray400,
    marginHorizontal: theme.spacing.sm,
  },
  headerSubtitleCompact: {
    flex: 1,
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
  headerSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.md,
  },
  statsInline: {
    marginBottom: theme.spacing.sm,
  },
  statsInlineText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray600,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: theme.typography['2xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
  },
  progressSection: {
    marginTop: theme.spacing.xs,
  },
  progressLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  progressContainer: {
    height: theme.spacing.sm,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.success,
  },
  flatList: {
    flex: 1,
  },
  listContainer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.md, // Margem de respiro (tab bar não sobrepõe)
  },
  emptyListContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
}));

