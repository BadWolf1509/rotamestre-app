import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { IncidentReportWizard } from '@/components/IncidentReportWizard';
import { StopCompletionFlow } from '@/components/motorista/StopCompletionFlow';
import { StreetViewPreview } from '@/components/StreetViewPreview';
import { SwipeableRow } from '@/components/SwipeableRow';
import { useRouteStatus, ParadaData } from '@/context/RouteStatusContext';
import { useDriverLocationBroadcast } from '@/hooks/useDriverLocationBroadcast';
import { useUser } from '@/hooks/useUser';
import { abrirNavegacao } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface Parada {
  id: string;
  endereco: string;
  latitude: number;
  longitude: number;
  ordem: number;
  status: string;
  tipo: string;
  destinatario?: string;
  telefone?: string;
  observacoes?: string;
  is_checkpoint?: boolean;
  vinculo_parada_id?: string | null;
}

interface Rota {
  id: string;
  status: string;
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando checkpoints...</Text>
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

  // Filtrar apenas paradas reais (excluindo checkpoints de partida/chegada)
  const paradasReais = paradas.filter(p => p.is_checkpoint !== false);
  const paradasPendentes = paradasReais.filter((p) => p.status === 'pendente').length;
  const paradasConcluidas = paradasReais.filter((p) => p.status === 'concluida').length;
  const paradasPuladas = paradasReais.filter((p) => p.status === 'pulada').length;

  const renderParada = ({ item }: { item: Parada }) => {
    const isConcluida = item.status === 'concluida';
    const isPulada = item.status === 'pulada';
    const isPendente = item.status === 'pendente';
    const isConcluindo = concluindoParada === item.id;
    const isPulando = pulandoParada === item.id;
    const isRetomando = retomandoParada === item.id;

    // Swipe actions para paradas pendentes
    const leftActions = isPendente ? [
      {
        icon: 'checkmark-circle',
        label: 'Concluir',
        color: theme.colors.success,
        onPress: () => concluirParada(item),
      }
    ] : [];

    const rightActions = isPendente ? [
      {
        icon: 'arrow-forward-circle',
        label: 'Pular',
        color: theme.colors.warning,
        onPress: () => pularParada(item),
      }
    ] : [];

    return (
      <SwipeableRow
        leftActions={leftActions}
        rightActions={rightActions}
        enabled={isPendente && !isConcluindo && !isPulando}
      >
        <View
          style={[
            styles.paradaCard,
            isConcluida && styles.paradaCardConcluida,
            isPulada && styles.paradaCardPulada,
          ]}
        >
        {/* Ordem e Status */}
        <View style={styles.paradaHeader}>
          <View style={styles.ordemBadge}>
            <Text style={styles.ordemText}>{item.ordem}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              isConcluida && styles.statusBadgeConcluida,
              isPulada && styles.statusBadgePulada,
              isPendente && styles.statusBadgePendente,
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {isConcluida ? '✓ Concluída' : isPulada ? '⊘ Pulada' : '○ Pendente'}
            </Text>
          </View>
          <View
            style={[
              styles.tipoBadge,
              item.tipo === 'entrega' ? styles.tipoBadgeEntrega : styles.tipoBadgeRetirada,
            ]}
          >
            <Text style={styles.tipoBadgeText}>
              {item.tipo === 'entrega' ? '📦 Entrega' : '📥 Retirada'}
            </Text>
          </View>
        </View>

        {/* Endereco */}
        <Text style={styles.paradaEndereco}>{item.endereco}</Text>

        {/* Street View Preview */}
        {isPendente && (
          <View style={styles.streetViewContainer}>
            <StreetViewPreview
              latitude={item.latitude}
              longitude={item.longitude}
              address={item.endereco}
              size="medium"
            />
          </View>
        )}

        {/* Destinatario e Telefone */}
        {(item.destinatario || item.telefone) && (
          <View style={styles.paradaDetalhes}>
            {item.destinatario && (
              <Text style={styles.paradaDetalheTexto}>
                👤 {item.destinatario}
              </Text>
            )}
            {item.telefone && (
              <Text style={styles.paradaDetalheTexto}>
                📞 {item.telefone}
              </Text>
            )}
          </View>
        )}

        {/* Observacoes */}
        {item.observacoes && (
          <View style={styles.observacoesContainer}>
            <Text style={styles.observacoesLabel}>Observações:</Text>
            <Text style={styles.observacoesTexto}>{item.observacoes}</Text>
          </View>
        )}

        {/* Botões de Ação Primários */}
        {!isConcluida && !isPulada && (
          <View style={styles.primaryActionsContainer}>
            <TouchableOpacity
              style={styles.botaoNavegar}
              onPress={() => abrirNavegacao({
                latitude: item.latitude,
                longitude: item.longitude,
                endereco: item.endereco
              })}
              activeOpacity={0.7}
            >
              <Text style={styles.botaoNavegarIcone}>🧭</Text>
              <Text style={styles.botaoNavegarTexto}>Como Chegar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.botaoReportar}
              onPress={() => {
                setSelectedParadaForIncident(item);
                setShowIncidentWizard(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="warning-outline" size={20} color="#fff" />
              <Text style={styles.botaoReportarTexto}>Reportar Problema</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Botões de Ação para paradas PENDENTES (fallback quando swipe não disponível) */}
        {isPendente && (
          <View style={styles.acoesContainer}>
            <TouchableOpacity
              style={[styles.botaoPular, isPulando && styles.botaoDisabled]}
              onPress={() => pularParada(item)}
              disabled={isPulando || isConcluindo}
            >
              {isPulando ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.botaoPularTexto}>Pular</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.botaoConcluir, isConcluindo && styles.botaoDisabled]}
              onPress={() => concluirParada(item)}
              disabled={isConcluindo || isPulando}
            >
              {isConcluindo ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.botaoConcluirTexto}>✓ Concluir Parada</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Botão Retomar para paradas PULADAS */}
        {isPulada && (
          <View style={styles.retornarContainer}>
            <TouchableOpacity
              style={[styles.botaoRetomar, isRetomando && styles.botaoDisabled]}
              onPress={() => retomarParada(item)}
              disabled={isRetomando}
              activeOpacity={0.7}
            >
              {isRetomando ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="refresh" size={18} color="#fff" />
                  <Text style={styles.botaoRetomarTexto}>Retomar Parada</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Indicador visual de swipe para paradas pendentes */}
        {isPendente && (
          <View style={styles.swipeHint}>
            <Ionicons name="swap-horizontal" size={16} color={theme.colors.gray400} />
            <Text style={styles.swipeHintText}>Deslize para ações</Text>
          </View>
        )}
      </View>
    </SwipeableRow>
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Header com estatísticas */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Checkpoints</Text>
        <Text style={styles.headerSubtitle}>{rota.unidades.nome}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{paradasReais.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.green500 }]}>
              {paradasConcluidas}
            </Text>
            <Text style={styles.statLabel}>Concluídas</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.yellow500 }]}>
              {paradasPendentes}
            </Text>
            <Text style={styles.statLabel}>Pendentes</Text>
          </View>
          {paradasPuladas > 0 && (
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.red500 }]}>
                {paradasPuladas}
              </Text>
              <Text style={styles.statLabel}>Puladas</Text>
            </View>
          )}
        </View>

        {/* Barra de Progresso */}
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>
            Progresso: {paradasReais.length > 0 ? Math.round((paradasConcluidas / paradasReais.length) * 100) : 0}%
          </Text>
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${paradasReais.length > 0 ? (paradasConcluidas / paradasReais.length) * 100 : 0}%` },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Lista de Paradas */}
      <FlatList
        data={paradas}
        keyExtractor={(item) => item.id}
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
  headerTitle: {
    fontSize: theme.typography['2xl'],
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.md,
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
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginTop: 4,
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
    height: 8,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.green500,
  },
  listContainer: {
    padding: theme.spacing.md,
    paddingBottom: 100, // Account for tab bar (60) + safe area
  },
  emptyListContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
  paradaCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 2,
    borderColor: theme.colors.gray200,
  },
  paradaCardConcluida: {
    borderColor: theme.colors.green500,
    backgroundColor: theme.colors.green50,
  },
  paradaCardPulada: {
    borderColor: theme.colors.red500,
    backgroundColor: theme.colors.red50,
    opacity: 0.7,
  },
  paradaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  ordemBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ordemText: {
    color: theme.colors.white,
    fontSize: theme.typography.md,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.xl,
    flex: 1,
  },
  statusBadgePendente: {
    backgroundColor: theme.colors.yellow100,
  },
  statusBadgeConcluida: {
    backgroundColor: theme.colors.green100,
  },
  statusBadgePulada: {
    backgroundColor: theme.colors.red100,
  },
  statusBadgeText: {
    fontSize: theme.typography.xs,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  tipoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.xl,
  },
  tipoBadgeEntrega: {
    backgroundColor: theme.colors.blue100,
  },
  tipoBadgeRetirada: {
    backgroundColor: theme.colors.indigo100,
  },
  tipoBadgeText: {
    fontSize: theme.typography.xs,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  paradaEndereco: {
    fontSize: theme.typography.md,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  paradaDetalhes: {
    marginBottom: theme.spacing.xs,
  },
  paradaDetalheTexto: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginBottom: 4,
  },
  observacoesContainer: {
    backgroundColor: theme.colors.gray50,
    padding: 10,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  observacoesLabel: {
    fontSize: theme.typography.xs,
    fontWeight: '600',
    color: theme.colors.gray500,
    marginBottom: 4,
  },
  observacoesTexto: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
    fontStyle: 'italic',
  },
  acoesContainer: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  botaoPular: {
    flex: 1,
    backgroundColor: theme.colors.red500,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  botaoPularTexto: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontWeight: '600',
  },
  botaoConcluir: {
    flex: 2,
    backgroundColor: theme.colors.green500,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  botaoConcluirTexto: {
    color: theme.colors.white,
    fontSize: theme.typography.md,
    fontWeight: 'bold',
  },
  botaoDisabled: {
    opacity: 0.6,
  },
  retornarContainer: {
    marginTop: theme.spacing.sm,
  },
  botaoRetomar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.blue500,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  botaoRetomarTexto: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontWeight: '600',
  },
  botaoNavegar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  botaoNavegarIcone: {
    fontSize: 20,
  },
  botaoNavegarTexto: {
    color: theme.colors.white,
    fontSize: theme.typography.md,
    fontWeight: '600',
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    opacity: 0.6,
  },
  swipeHintText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray400,
    fontStyle: 'italic',
  },
  streetViewContainer: {
    marginTop: theme.spacing.sm,
    alignItems: 'center',
  },
  primaryActionsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  botaoReportar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.warning,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  botaoReportarTexto: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontWeight: '600',
  },
}));

