import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  Platform,
  type ViewStyle,
  type TextStyle,
} from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { IncidentReportWizard } from '@/components/IncidentReportWizard';
import { MobileEmptyState } from '@/components/mobile/MobileEmptyState';
import { ModaisDaParada } from '@/components/motorista/ModaisDaParada';
import { ParadaCard, Parada } from '@/components/motorista/ParadaCard';
import { ParadaCardSkeletonList } from '@/components/motorista/ParadaCardSkeleton';
import { type MotivoSkip } from '@/constants/skipReasons';
import { getEstadoDaCarga } from '@/context/route-status/calculations';
import { useRouteStatus, ParadaData } from '@/context/RouteStatusContext';
import { Text } from '@/design-system';
import { useAcoesDaParada } from '@/hooks/motorista/useAcoesDaParada';
import { useRestaurarConclusaoEmVoo } from '@/hooks/motorista/useRestaurarConclusaoEmVoo';
import { useRestaurarRascunhoIncidente } from '@/hooks/motorista/useRestaurarRascunhoIncidente';
import { useAlert } from '@/hooks/useAlert';
import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import {
  ehRecusaPorRotaEncerrada,
  MENSAGEM_RETOMAR_ROTA_ENCERRADA,
} from '@/lib/motorista/recusaRotaEncerrada';
import { abrirNavegacao } from '@/lib/navigation';
import { updateParadaStatus, logParadaAction } from '@/lib/queries/paradas';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';
import { toParada } from '@/utils/typeMappers';

export default function CheckpointsMotorista() {
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const { showWarning, showSuccess, showError, showConfirm, AlertDialog } =
    useAlert();

  // Usar contexto como fonte única de dados (com realtime automático)
  const {
    route,
    paradas: paradasContext,
    loading,
    error,
    atualizadoEm,
    routeStatus,
    refreshRoute,
    skipStop,
    paradasComEnvioPendente,
  } = useRouteStatus();

  // Estados locais de UI apenas
  const [refreshing, setRefreshing] = useState(false);
  const [pulandoParada, setPulandoParada] = useState<string | null>(null);
  const [retomandoParada, setRetomandoParada] = useState<string | null>(null);
  const [showIncidentWizard, setShowIncidentWizard] = useState(false);
  const [selectedParadaForIncident, setSelectedParadaForIncident] =
    useState<Parada | null>(null);
  // Estado para o modal de conclusão de parada (com foto)
  const [showCompletionFlow, setShowCompletionFlow] = useState(false);
  const [selectedParadaForCompletion, setSelectedParadaForCompletion] =
    useState<ParadaData | null>(null);
  // Estado para o modal de motivo de skip
  const [skipModalParada, setSkipModalParada] = useState<Parada | null>(null);

  // Filtrar apenas paradas reais (excluindo checkpoints de partida/chegada).
  // `paradasReais` é o ParadaData do contexto; `paradas` é a versão do card.
  const paradasReais = useMemo(
    () => paradasContext.filter((p) => p.is_checkpoint !== false),
    [paradasContext],
  );
  const paradas = useMemo(() => paradasReais.map(toParada), [paradasReais]);

  // O card devolve `Parada`, que não carrega todos os campos do ParadaData
  // (`foto_url`, `updated_at`...). Concluir e pular buscam pelo id a parada
  // do contexto, em vez de reconstruí-la a partir do card.
  const paradaDoContexto = useCallback(
    (id: string): ParadaData | null =>
      paradasContext.find((p) => p.id === id) ?? null,
    [paradasContext],
  );

  // Entrega e retirada no mesmo local: cada serviço tem o seu comprovante, e
  // o fluxo do próximo abre quando o anterior conclui (como na Início). A
  // visita é calculada sobre o contexto, que tem a rota inteira.
  const abrirConclusao = useCallback((parada: ParadaData) => {
    setSelectedParadaForCompletion(parada);
    setShowCompletionFlow(true);
  }, []);
  const { sequencia, pularVisita, aoConcluirComSucesso } = useAcoesDaParada({
    paradas: paradasContext,
    skipStop,
    refreshRoute,
    showSuccess,
    showError,
    abrirConclusao,
    paradaEmConclusao: selectedParadaForCompletion,
  });

  // Abre o modal de conclusão com foto
  const concluirParada = useCallback(
    (parada: Parada) => {
      // Validar se a rota foi iniciada
      if (route?.status !== 'em_andamento') {
        showWarning(
          'Rota não iniciada',
          'Você precisa iniciar a rota antes de concluir paradas.',
        );
        return;
      }

      const daRota = paradaDoContexto(parada.id);
      if (daRota) sequencia.iniciar(daRota);
    },
    [route?.status, showWarning, sequencia, paradaDoContexto],
  );

  // Reabre o fluxo de conclusão que a recriação da Activity interrompeu.
  // Ver `src/hooks/motorista/useRestaurarConclusaoEmVoo.ts`.
  // Recebe as paradas do contexto: a conferência do marcador
  // (`paradaParaReabrir`) devolve a própria parada da rota, sem conversão.
  useRestaurarConclusaoEmVoo(route, paradasReais, (parada) => {
    sequencia.iniciar(parada);
  });

  // Reabre o wizard de incidente interrompido. Mesma razão do de cima: o
  // wizard só monta com `showIncidentWizard`, que some na remontagem.
  useRestaurarRascunhoIncidente(route, paradas, (parada) => {
    setSelectedParadaForIncident(parada);
    setShowIncidentWizard(true);
  });

  // Abre o modal de motivo de skip
  const pularParada = useCallback((parada: Parada) => {
    setSkipModalParada(parada);
  }, []);

  // A parada a pular vem do contexto; se ela sumiu dele (rota recarregada,
  // parada removida pelo gestor), o modal não monta.
  const paradaParaPular = skipModalParada
    ? paradaDoContexto(skipModalParada.id)
    : null;

  // Confirma o skip com motivo estruturado (usa contexto para promover próxima parada)
  const confirmarSkip = useCallback(
    async (
      motivo: MotivoSkip,
      observacoes?: string,
      incluirOutros?: boolean,
    ) => {
      const parada = paradaParaPular;
      setSkipModalParada(null);
      if (!parada) return;

      setPulandoParada(parada.id);
      try {
        const { falha } = await pularVisita(
          parada,
          motivo,
          observacoes,
          incluirOutros,
        );
        if (falha) logger.error('Erro ao pular parada:', falha.erro);
      } finally {
        setPulandoParada(null);
      }
    },
    [paradaParaPular, pularVisita],
  );

  const retomarParada = useCallback(
    async (parada: Parada) => {
      // Rota encerrada (ainda na tela por um tempo depois do Finalizar):
      // a parada reaberta não teria mais como ser concluída nem pulada.
      if (route?.status !== 'em_andamento') {
        showWarning('Rota encerrada', MENSAGEM_RETOMAR_ROTA_ENCERRADA);
        return;
      }

      const confirmed = await showConfirm({
        title: 'Retomar Parada',
        message: `Deseja retomar esta ${parada.tipo}?\n\n${parada.endereco}\n\nA parada voltará para o status "pendente".`,
        confirmText: 'Retomar',
        cancelText: 'Cancelar',
      });

      if (!confirmed) return;

      setRetomandoParada(parada.id);
      try {
        // O pulo grava sua hora em `concluida_em`; a parada reaberta não tem.
        const result = await updateParadaStatus(parada.id, 'pendente', {
          concluida_em: null,
        });
        if (!result.success) {
          // O banco recusa mudar parada de rota encerrada (encerrada entre o
          // carregamento da tela e o toque): explica e mostra o estado real.
          if (ehRecusaPorRotaEncerrada(result.error)) {
            showWarning('Rota encerrada', MENSAGEM_RETOMAR_ROTA_ENCERRADA);
            refreshRoute();
            return;
          }
          throw result.error;
        }

        // Log é fire-and-forget (não bloqueia a operação)
        logParadaAction(userData!.id, parada.id, route!.id, 'parada_retomada', {
          endereco: parada.endereco,
          tipo: parada.tipo,
          ordem: parada.ordem,
        });

        showSuccess('Parada Retomada', 'Parada voltou para pendente');
        refreshRoute();
      } catch (error: unknown) {
        logger.error('Erro ao retomar parada:', error);
        showError(error);
      } finally {
        setRetomandoParada(null);
      }
    },
    [
      userData,
      route,
      refreshRoute,
      showConfirm,
      showSuccess,
      showError,
      showWarning,
    ],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshRoute();
    setRefreshing(false);
  }, [refreshRoute]);

  // IMPORTANTE: Todos os hooks DEVEM estar antes de qualquer early return
  // Calcular estatísticas das paradas (já filtradas no useMemo acima)
  const paradasPendentes = useMemo(
    () =>
      paradas.filter(
        (p) => p.status === 'pendente' || p.status === 'em_andamento',
      ).length,
    [paradas],
  );
  const paradasConcluidas = useMemo(
    () => paradas.filter((p) => p.status === 'concluida').length,
    [paradas],
  );
  const paradasPuladas = useMemo(
    () => paradas.filter((p) => p.status === 'pulada').length,
    [paradas],
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
        pulando={pulandoParada === item.id}
        retomando={retomandoParada === item.id}
        isProxima={item.id === proximaParadaId}
        envioPendente={paradasComEnvioPendente?.has(item.id) ?? false}
      />
    ),
    [
      pulandoParada,
      retomandoParada,
      route?.status,
      proximaParadaId,
      paradasComEnvioPendente,
      concluirParada,
      pularParada,
      retomarParada,
      handleNavegar,
      handleReportar,
    ],
  );

  const showEmptyState =
    !loading && (routeStatus === 'no-route' || paradas.length === 0);

  // Falha antes da primeira carga: não é "não há rota" (ver getEstadoDaCarga).
  if (
    getEstadoDaCarga({
      route,
      loading,
      error: error ?? null,
      atualizadoEm: atualizadoEm ?? null,
    }) === 'sem-conexao'
  ) {
    return (
      <View
        testID="motorista-checkpoints-sem-conexao"
        style={{ flex: 1, backgroundColor: theme.colors.gray50 }}
      >
        <MobileEmptyState
          icon="📡"
          title="Sem conexão"
          subtitle="Não foi possível carregar a sua rota. Confira o sinal e tente de novo."
          actionLabel="Tentar novamente"
          onAction={refreshRoute}
          fullScreen
        />
      </View>
    );
  }

  // Early return para empty state (evita renderizar dentro do GestureHandlerRootView)
  if (showEmptyState) {
    return (
      <View
        testID="motorista-checkpoints-empty"
        style={{ flex: 1, backgroundColor: theme.colors.gray50 }}
      >
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

  // Skeleton só na primeira carga. Recarga é silenciosa: trocar a lista por
  // skeleton a cada atualização (realtime, polling, ação) piscava a tela e
  // desmontava o que estivesse aberto dentro dela. Mesmo critério da aba Mapa.
  if (loading && paradas.length === 0) {
    content = (
      <View style={styles.container as ViewStyle}>
        {/* Skeleton Header */}
        <View style={styles.header as ViewStyle}>
          <View
            style={{
              width: 200,
              height: 28,
              backgroundColor: theme.colors.gray200,
              borderRadius: theme.borderRadius.sm,
            }}
          />
          <View
            style={{
              width: 150,
              height: 14,
              backgroundColor: theme.colors.gray200,
              borderRadius: theme.borderRadius.sm,
              marginTop: theme.spacing.xs,
            }}
          />
        </View>

        {/* Skeleton Stats */}
        <View style={styles.statsRow as ViewStyle}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.statItem as ViewStyle}>
              <View
                style={{
                  width: 40,
                  height: 28,
                  backgroundColor: theme.colors.gray200,
                  borderRadius: theme.borderRadius.sm,
                }}
              />
              <View
                style={{
                  width: 60,
                  height: 12,
                  backgroundColor: theme.colors.gray200,
                  borderRadius: theme.borderRadius.sm,
                  marginTop: theme.spacing.xs,
                }}
              />
            </View>
          ))}
        </View>

        {/* Skeleton Progress */}
        <View style={styles.progressSection as ViewStyle}>
          <View
            style={{
              width: 120,
              height: 14,
              backgroundColor: theme.colors.gray200,
              borderRadius: theme.borderRadius.sm,
            }}
          />
          <View
            style={[
              styles.progressContainer as ViewStyle,
              { marginTop: theme.spacing.xs },
            ]}
          >
            <View
              style={{
                width: '30%',
                height: '100%',
                backgroundColor: theme.colors.gray300,
                borderRadius: theme.borderRadius.full,
              }}
            />
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
            <Text
              style={styles.headerSubtitleCompact as TextStyle}
              numberOfLines={1}
            >
              {route?.unidade_nome}
            </Text>
          </View>

          {/* Linha 2: Stats inline */}
          <View style={styles.statsInline as ViewStyle}>
            <Text style={styles.statsInlineText as TextStyle}>
              {paradas.length} paradas ·{' '}
              <Text style={{ color: theme.colors.success }}>
                {paradasConcluidas}✓
              </Text>{' '}
              ·{' '}
              <Text style={{ color: theme.colors.warning }}>
                {paradasPendentes}○
              </Text>
              {paradasPuladas > 0 && (
                <>
                  {' '}
                  ·{' '}
                  <Text style={{ color: theme.colors.error }}>
                    {paradasPuladas}↷
                  </Text>
                </>
              )}{' '}
              ·{' '}
              {paradas.length > 0
                ? Math.round((paradasConcluidas / paradas.length) * 100)
                : 0}
              %
            </Text>
          </View>

          {/* Barra de Progresso */}
          <View style={styles.progressContainer as ViewStyle}>
            <View
              style={[
                styles.progressBar as ViewStyle,
                {
                  width: `${paradas.length > 0 ? (paradasConcluidas / paradas.length) * 100 : 0}%`,
                },
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
              <Text style={styles.emptyListText as TextStyle}>
                Nenhuma parada cadastrada
              </Text>
            </View>
          }
        />
      </View>
    );
  }

  // O GestureHandlerRootView do app fica no layout raiz (app/_layout.tsx).
  return (
    <View style={styles.container as ViewStyle}>
      <ErrorBoundary>
        {content}

        {/* Fora do `content`: o wizard não pode ser desmontado pelo skeleton */}
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

        <ModaisDaParada
          paradas={paradasContext}
          contexto={sequencia.contexto}
          conclusao={{
            parada: selectedParadaForCompletion,
            visible: showCompletionFlow,
            onClose: () => {
              setShowCompletionFlow(false);
              setSelectedParadaForCompletion(null);
            },
            onSuccess: aoConcluirComSucesso,
          }}
          pulo={{
            parada: paradaParaPular,
            onConfirm: confirmarSkip,
            onCancel: () => setSkipModalParada(null),
          }}
        />

        {AlertDialog}
      </ErrorBoundary>
    </View>
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
