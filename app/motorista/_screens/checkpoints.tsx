import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
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
import { useDriverLocationBroadcast } from '@/hooks/useDriverLocationBroadcast';
import { useUser } from '@/hooks/useUser';
import { abrirNavegacao } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// Tipo para status da rota
type RotaStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';

interface Rota {
  id: string;
  status: RotaStatus;
  unidades: {
    nome: string;
  };
}

export default function CheckpointsMotorista() {
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const [rota, setRota] = useState<Rota | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [concluindoParada, setConcluindoParada] = useState<string | null>(null);
  const [pulandoParada, setPulandoParada] = useState<string | null>(null);
  const [retomandoParada, setRetomandoParada] = useState<string | null>(null);
  const [showIncidentWizard, setShowIncidentWizard] = useState(false);
  const [selectedParadaForIncident, setSelectedParadaForIncident] = useState<Parada | null>(null);
  // Estado para o modal de conclusão de parada (com foto)
  const [showCompletionFlow, setShowCompletionFlow] = useState(false);
  const [selectedParadaForCompletion, setSelectedParadaForCompletion] = useState<ParadaData | null>(null);

  // Usar contexto para refresh centralizado
  const { refreshRoute } = useRouteStatus();

  // Broadcast localização do motorista quando a rota está em andamento
  useDriverLocationBroadcast({
    rotaId: rota?.id,
    rotaStatus: rota?.status,
  });

  const loadRotaEParadas = useCallback(async () => {
    if (!userData?.id) {
      setRota(null);
      setParadas([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);

      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select('id, status, unidades(nome)')
        .eq('motorista_id', userData.id)
        .in('status', ['pendente', 'em_andamento'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (rotasError || !rotasData) {
        setRota(null);
        setParadas([]);
        setLoading(false);
        return;
      }

      setRota(rotasData as unknown as Rota);

      const { data: paradasData, error: paradasError} = await supabase
        .from('paradas')
        .select('*')
        .eq('rota_id', rotasData.id)
        .or('is_checkpoint.is.null,is_checkpoint.eq.true')
        .order('ordem');

      if (paradasError) throw paradasError;

      setParadas((paradasData as Parada[]) || []);
    } catch (error) {
      console.error('Erro ao carregar checkpoints:', error);
      Alert.alert('Erro', 'Não foi possível carregar os checkpoints');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userData?.id]);

  useEffect(() => {
    loadRotaEParadas();
  }, [loadRotaEParadas]);

  // Abre o modal de conclusão com foto
  function concluirParada(parada: Parada) {
    // Validar se a rota foi iniciada
    if (rota?.status !== 'em_andamento') {
      Alert.alert(
        'Rota não iniciada',
        'Você precisa iniciar a rota antes de concluir paradas.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Converter para ParadaData e abrir modal de conclusão
    setSelectedParadaForCompletion(parada as ParadaData);
    setShowCompletionFlow(true);
  }

  // Handler quando conclusão é bem-sucedida
  function handleCompletionSuccess() {
    // Recarregar dados locais e do contexto
    loadRotaEParadas();
    refreshRoute();
  }

  async function pularParada(parada: Parada) {
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
          rota_id: rota!.id,
          parada_id: parada.id,
          evento: 'parada_pulada',
          detalhes: {
            endereco: parada.endereco,
            tipo: parada.tipo,
            ordem: parada.ordem,
          },
        });

        Alert.alert('Parada Pulada', 'Parada marcada como pulada');
        loadRotaEParadas();
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
  }

  async function retomarParada(parada: Parada) {
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
          rota_id: rota!.id,
          parada_id: parada.id,
          evento: 'parada_retomada',
          detalhes: {
            endereco: parada.endereco,
            tipo: parada.tipo,
            ordem: parada.ordem,
          },
        });

        Alert.alert('Parada Retomada', 'Parada voltou para pendente');
        loadRotaEParadas();
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
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRotaEParadas();
  }, [loadRotaEParadas]);

  // IMPORTANTE: Todos os hooks DEVEM estar antes de qualquer early return
  // Filtrar apenas paradas reais (excluindo checkpoints de partida/chegada) - memoizado
  const paradasReais = useMemo(
    () => paradas.filter(p => p.is_checkpoint !== false),
    [paradas]
  );
  const paradasPendentes = useMemo(
    () => paradasReais.filter((p) => p.status === 'pendente').length,
    [paradasReais]
  );
  const paradasConcluidas = useMemo(
    () => paradasReais.filter((p) => p.status === 'concluida').length,
    [paradasReais]
  );
  const paradasPuladas = useMemo(
    () => paradasReais.filter((p) => p.status === 'pulada').length,
    [paradasReais]
  );

  // Memoizar keyExtractor
  const keyExtractor = useCallback((item: Parada) => item.id, []);

  // Calcular ID da próxima parada pendente (primeira na ordem)
  const proximaParadaId = useMemo(() => {
    const pendentes = paradas.filter((p) => p.status === 'pendente');
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
        rotaEmAndamento={rota?.status === 'em_andamento'}
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
      rota?.status,
      proximaParadaId,
      concluirParada,
      pularParada,
      retomarParada,
      handleNavegar,
      handleReportar,
    ]
  );

  if (loading) {
    return (
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
  }

  if (!rota || paradas.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>📋</Text>
        <Text style={styles.emptyText}>Nenhuma rota ativa no momento</Text>
        <Text style={styles.emptySubtext}>
          Aguarde o gestor atribuir uma nova rota
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Header Compacto */}
      <View style={styles.headerCompact}>
        {/* Linha 1: Título e unidade */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Checkpoints</Text>
          <Text style={styles.headerDivider}>·</Text>
          <Text style={styles.headerSubtitleCompact} numberOfLines={1}>
            {rota.unidades.nome}
          </Text>
        </View>

        {/* Linha 2: Stats inline */}
        <View style={styles.statsInline}>
          <Text style={styles.statsInlineText}>
            {paradasReais.length} paradas ·{' '}
            <Text style={{ color: theme.colors.success }}>{paradasConcluidas}✓</Text> ·{' '}
            <Text style={{ color: theme.colors.warning }}>{paradasPendentes}○</Text>
            {paradasPuladas > 0 && (
              <>
                {' '}· <Text style={{ color: theme.colors.error }}>{paradasPuladas}↷</Text>
              </>
            )}
            {' '}· {paradasReais.length > 0 ? Math.round((paradasConcluidas / paradasReais.length) * 100) : 0}%
          </Text>
        </View>

        {/* Barra de Progresso */}
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
              { width: `${paradasReais.length > 0 ? (paradasConcluidas / paradasReais.length) * 100 : 0}%` },
            ]}
          />
        </View>
      </View>

      {/* Lista de Paradas */}
      <FlatList
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
      {showIncidentWizard && selectedParadaForIncident && rota && (
        <IncidentReportWizard
          visible={showIncidentWizard}
          onClose={() => {
            setShowIncidentWizard(false);
            setSelectedParadaForIncident(null);
          }}
          onSubmit={(report) => {
            console.log('Incidente reportado:', report);
            loadRotaEParadas(); // Recarregar dados
          }}
          paradaId={selectedParadaForIncident.id}
          rotaId={rota.id}
          motoristaId={userData?.id || ''}
          endereco={selectedParadaForIncident.endereco}
        />
      )}

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

