import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  View,
  FlatList,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { IncidentReportWizard } from '@/components/IncidentReportWizard';
import { ParadaCard, Parada } from '@/components/motorista/ParadaCard';
import { ParadaCardSkeletonList } from '@/components/motorista/ParadaCardSkeleton';
import { StopCompletionFlow } from '@/components/motorista/StopCompletionFlow';
import { useRouteStatus, ParadaData } from '@/context/RouteStatusContext';
import { Text } from '@/design-system';
import { useDriverLocationBroadcast } from '@/hooks/useDriverLocationBroadcast';
import { useUser } from '@/hooks/useUser';
import { abrirNavegacao } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export default function CheckpointsMotorista() {
  const { theme } = useUnistyles();
  const { userData } = useUser();

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

  // Filtrar apenas paradas reais (excluindo checkpoints de partida/chegada)
  // e fazer cast para tipo Parada do ParadaCard
  const paradas = useMemo(
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
        Alert.alert(
          'Rota não iniciada',
          'Você precisa iniciar a rota antes de concluir paradas.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Converter para ParadaData e abrir modal de conclusão
      setSelectedParadaForCompletion(parada as unknown as ParadaData);
      setShowCompletionFlow(true);
    },
    [route?.status]
  );

  // Handler quando conclusão é bem-sucedida
  function handleCompletionSuccess() {
    // Contexto atualiza automaticamente via realtime
    refreshRoute();
  }

  const pularParada = useCallback(
    async (parada: Parada) => {
      // Função que executa a ação de pular
      const executePular = async () => {
        setPulandoParada(parada.id);
        try {
          // Atualizar status da parada
          const { error: updateError } = await supabase
            .from('paradas')
            .update({ status: 'pulada' })
            .eq('id', parada.id);

          if (updateError) throw updateError;

          // Criar log
          await supabase.from('logs').insert({
            usuario_id: userData!.id,
            rota_id: route!.id,
            parada_id: parada.id,
            evento: 'parada_pulada',
            detalhes: {
              endereco: parada.endereco,
              tipo: parada.tipo,
              ordem: parada.ordem,
            },
          });

          Alert.alert('Parada Pulada', 'Parada marcada como pulada');
          refreshRoute(); // Contexto atualiza automaticamente
        } catch (error) {
          console.error('Erro ao pular parada:', error);
          Alert.alert('Erro', 'Não foi possível pular a parada');
        } finally {
          setPulandoParada(null);
        }
      };

      // Na web, usa window.confirm
      if (Platform.OS === 'web') {
        const confirmed = window.confirm(
          `Deseja pular esta ${parada.tipo}?\n\n${parada.endereco}\n\nEsta parada ficará marcada como "pulada" e poderá ser retomada depois.`
        );
        if (confirmed) {
          executePular();
        }
      } else {
        // No mobile, usa Alert.alert
        Alert.alert(
          'Pular Parada',
          `Deseja pular esta ${parada.tipo}?\n\n${parada.endereco}\n\nEsta parada ficará marcada como "pulada" e poderá ser retomada depois.`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Pular',
              style: 'destructive',
              onPress: executePular,
            },
          ]
        );
      }
    },
    [userData, route, refreshRoute]
  );

  const retomarParada = useCallback(
    async (parada: Parada) => {
      // Função que executa a ação de retomar
      const executeRetomar = async () => {
        setRetomandoParada(parada.id);
        try {
          // Atualizar status da parada para pendente
          const { error: updateError } = await supabase
            .from('paradas')
            .update({ status: 'pendente' })
            .eq('id', parada.id);

          if (updateError) throw updateError;

          // Criar log
          await supabase.from('logs').insert({
            usuario_id: userData!.id,
            rota_id: route!.id,
            parada_id: parada.id,
            evento: 'parada_retomada',
            detalhes: {
              endereco: parada.endereco,
              tipo: parada.tipo,
              ordem: parada.ordem,
            },
          });

          Alert.alert('Parada Retomada', 'Parada voltou para pendente');
          refreshRoute(); // Contexto atualiza automaticamente
        } catch (error) {
          console.error('Erro ao retomar parada:', error);
          Alert.alert('Erro', 'Não foi possível retomar a parada');
        } finally {
          setRetomandoParada(null);
        }
      };

      // Na web, usa window.confirm
      if (Platform.OS === 'web') {
        const confirmed = window.confirm(
          `Deseja retomar esta ${parada.tipo}?\n\n${parada.endereco}\n\nA parada voltará para o status "pendente".`
        );
        if (confirmed) {
          executeRetomar();
        }
      } else {
        // No mobile, usa Alert.alert
        Alert.alert(
          'Retomar Parada',
          `Deseja retomar esta ${parada.tipo}?\n\n${parada.endereco}\n\nA parada voltará para o status "pendente".`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Retomar',
              style: 'default',
              onPress: executeRetomar,
            },
          ]
        );
      }
    },
    [userData, route, refreshRoute]
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
  let content: ReactNode = null;

  if (loading) {
    content = (
      <View style={styles.container}>
          {/* Skeleton Header */}
          <View style={styles.header}>
            <View style={{ width: 200, height: 28, backgroundColor: theme.colors.gray200, borderRadius: theme.borderRadius.sm }} />
            <View style={{ width: 150, height: 14, backgroundColor: theme.colors.gray200, borderRadius: theme.borderRadius.sm, marginTop: theme.spacing.xs }} />
          </View>

          {/* Skeleton Stats */}
          <View style={styles.statsRow}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.statItem}>
                <View style={{ width: 40, height: 28, backgroundColor: theme.colors.gray200, borderRadius: theme.borderRadius.sm }} />
                <View style={{ width: 60, height: 12, backgroundColor: theme.colors.gray200, borderRadius: theme.borderRadius.sm, marginTop: theme.spacing.xs }} />
              </View>
            ))}
          </View>

          {/* Skeleton Progress */}
          <View style={styles.progressSection}>
            <View style={{ width: 120, height: 14, backgroundColor: theme.colors.gray200, borderRadius: theme.borderRadius.sm }} />
            <View style={[styles.progressContainer, { marginTop: theme.spacing.xs }]}>
              <View style={{ width: '30%', height: '100%', backgroundColor: theme.colors.gray300, borderRadius: theme.borderRadius.full }} />
            </View>
          </View>

          {/* Skeleton Cards */}
          <View style={styles.listContainer}>
            <ParadaCardSkeletonList count={3} />
          </View>
        </View>
    );
  } else if (showEmptyState) {
    content = (
      <View style={styles.emptyContainer} testID="motorista-checkpoints-empty">
          <Text style={styles.emptyTitle}>📋</Text>
          <Text style={styles.emptyText}>Nenhuma rota ativa no momento</Text>
          <Text style={styles.emptySubtext}>
            Aguarde o gestor atribuir uma nova rota
          </Text>
        </View>
    );
  } else {
    content = (
      <>
      {/* Header Compacto */}
      <View style={styles.headerCompact}>
        {/* Linha 1: Título e unidade */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Checkpoints</Text>
          <Text style={styles.headerDivider}>·</Text>
          <Text style={styles.headerSubtitleCompact} numberOfLines={1}>
            {route?.unidade_nome}
          </Text>
        </View>

        {/* Linha 2: Stats inline */}
        <View style={styles.statsInline}>
          <Text style={styles.statsInlineText}>
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
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
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
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyListContainer}>
            <Text style={styles.emptyListText}>Nenhuma parada cadastrada</Text>
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
            console.log('Incidente reportado:', report);
            refreshRoute(); // Contexto atualiza automaticamente
          }}
          paradaId={selectedParadaForIncident.id}
          rotaId={route.id}
          motoristaId={userData?.id || ''}
          endereco={selectedParadaForIncident.endereco}
        />
      )}

      </>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
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
    </GestureHandlerRootView>
  );
}

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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: 64,
    marginBottom: theme.spacing.lg,
  },
  emptyText: {
    fontSize: theme.typography.lg,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
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
    fontWeight: '400',
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
    fontWeight: '800',
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
    fontWeight: '600',
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

