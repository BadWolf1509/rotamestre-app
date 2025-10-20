import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';

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
        <ActivityIndicator size="large" color="#0D5A9C" />
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
            <Text style={[styles.statValue, { color: '#10b981' }]}>
              {paradasConcluidas}
            </Text>
            <Text style={styles.statLabel}>Concluídas</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>
              {paradasPendentes}
            </Text>
            <Text style={styles.statLabel}>Pendentes</Text>
          </View>
          {paradasPuladas > 0 && (
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#ef4444' }]}>
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
            colors={['#0D5A9C']}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0D5A9C',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  progressSection: {
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10b981',
  },
  listContainer: {
    padding: 16,
  },
  emptyListContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 14,
    color: '#6b7280',
  },
  paradaCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  paradaCardConcluida: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  paradaCardPulada: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
    opacity: 0.7,
  },
  paradaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  ordemBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0D5A9C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ordemText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flex: 1,
  },
  statusBadgePendente: {
    backgroundColor: '#fef3c7',
  },
  statusBadgeConcluida: {
    backgroundColor: '#d1fae5',
  },
  statusBadgePulada: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  tipoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tipoBadgeEntrega: {
    backgroundColor: '#dbeafe',
  },
  tipoBadgeRetirada: {
    backgroundColor: '#e0e7ff',
  },
  tipoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  paradaEndereco: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  paradaDetalhes: {
    marginBottom: 8,
  },
  paradaDetalheTexto: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  observacoesContainer: {
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  observacoesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  observacoesTexto: {
    fontSize: 14,
    color: '#111827',
    fontStyle: 'italic',
  },
  acoesContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  botaoPular: {
    flex: 1,
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  botaoPularTexto: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  botaoConcluir: {
    flex: 2,
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  botaoConcluirTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  botaoDisabled: {
    opacity: 0.6,
  },
});
