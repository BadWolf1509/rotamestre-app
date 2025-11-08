import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { StyleSheet, useUnistyles } from '@/utils/styles';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { abrirNavegacao } from '@/lib/navigation';

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

  useEffect(() => {
    if (userData?.id) {
      loadRotaEParadas();
    }
  }, [userData]);

  async function loadRotaEParadas() {
    try {
      setLoading(true);

      // Buscar rota ativa do motorista
      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select('id, status, unidades(nome)')
        .eq('motorista_id', userData!.id)
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

      setRota(rotasData as Rota);

      // Buscar paradas da rota ordenadas
      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .select('*')
        .eq('rota_id', rotasData.id)
        .order('ordem');

      if (paradasError) throw paradasError;

      setParadas(paradasData as Parada[] || []);
    } catch (error) {
      console.error('Erro ao carregar checkpoints:', error);
      Alert.alert('Erro', 'Não foi possível carregar os checkpoints');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function concluirParada(parada: Parada) {
    Alert.alert(
      'Concluir Parada',
      `Confirma a conclusão desta ${parada.tipo}?\n\n${parada.endereco}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Concluir',
          style: 'default',
          onPress: async () => {
            setConcluindoParada(parada.id);
            try {
              // Atualizar status da parada
              const { error: updateError } = await supabase
                .from('paradas')
                .update({
                  status: 'concluida',
                  concluida_em: new Date().toISOString(),
                })
                .eq('id', parada.id);

              if (updateError) throw updateError;

              // Criar log
              await supabase.from('logs').insert({
                usuario_id: userData!.id,
                rota_id: rota!.id,
                parada_id: parada.id,
                evento: 'parada_concluida',
                detalhes: {
                  endereco: parada.endereco,
                  tipo: parada.tipo,
                  ordem: parada.ordem,
                },
              });

              // Verificar se todas as paradas foram concluidas
              const paradasRestantes = paradas.filter(
                (p) => p.id !== parada.id && p.status !== 'concluida'
              );

              if (paradasRestantes.length === 0) {
                // Todas as paradas concluidas - atualizar status da rota
                await supabase
                  .from('rotas')
                  .update({
                    status: 'concluida',
                    concluida_em: new Date().toISOString(),
                  })
                  .eq('id', rota!.id);

                // Criar log da conclusao da rota
                await supabase.from('logs').insert({
                  usuario_id: userData!.id,
                  rota_id: rota!.id,
                  evento: 'rota_concluida',
                  detalhes: {
                    total_paradas: paradas.length,
                  },
                });

                Alert.alert(
                  'Rota Concluída!',
                  'Parabéns! Você concluiu todas as paradas desta rota.',
                  [
                    {
                      text: 'OK',
                      onPress: () => loadRotaEParadas(),
                    },
                  ]
                );
              } else {
                Alert.alert('Sucesso', 'Parada concluída com sucesso!');
                loadRotaEParadas();
              }
            } catch (error) {
              console.error('Erro ao concluir parada:', error);
              Alert.alert('Erro', 'Não foi possível concluir a parada');
            } finally {
              setConcluindoParada(null);
            }
          },
        },
      ]
    );
  }

  async function pularParada(parada: Parada) {
    Alert.alert(
      'Pular Parada',
      `Deseja pular esta ${parada.tipo}?\n\n${parada.endereco}\n\nEsta parada ficará marcada como "pulada" e poderá ser retomada depois.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pular',
          style: 'destructive',
          onPress: async () => {
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
          },
        },
      ]
    );
  }

  function onRefresh() {
    setRefreshing(true);
    loadRotaEParadas();
  }

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

  const paradasPendentes = paradas.filter((p) => p.status === 'pendente').length;
  const paradasConcluidas = paradas.filter((p) => p.status === 'concluida').length;
  const paradasPuladas = paradas.filter((p) => p.status === 'pulada').length;

  const renderParada = ({ item, index }: { item: Parada; index: number }) => {
    const isConcluida = item.status === 'concluida';
    const isPulada = item.status === 'pulada';
    const isPendente = item.status === 'pendente';
    const isConcluindo = concluindoParada === item.id;
    const isPulando = pulandoParada === item.id;

    return (
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

        {/* Botão de Navegação */}
        {!isConcluida && !isPulada && (
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
        )}

        {/* Botões de Ação */}
        {!isConcluida && (
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
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header com estatísticas */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Checkpoints</Text>
        <Text style={styles.headerSubtitle}>{rota.unidades.nome}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{paradas.length}</Text>
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
            Progresso: {Math.round((paradasConcluidas / paradas.length) * 100)}%
          </Text>
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${(paradasConcluidas / paradas.length) * 100}%` },
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
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
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
    marginTop: 10,
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
  botaoNavegar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.orange,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  botaoNavegarIcone: {
    fontSize: 20,
  },
  botaoNavegarTexto: {
    color: theme.colors.white,
    fontSize: theme.typography.md,
    fontWeight: '600',
  },
}));
