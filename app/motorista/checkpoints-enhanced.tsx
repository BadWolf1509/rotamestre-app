import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  Linking,
} from 'react-native';

import { useUser } from '@/hooks/useUser';
import { abrirNavegacao } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles } from '@/utils/styles';

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
  foto_url?: string | null;
  observacoes_motorista?: string;
}

interface Rota {
  id: string;
  status: string;
  unidades: {
    nome: string;
  };
}

export default function CheckpointsMotoristaEnhanced() {
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const [rota, setRota] = useState<Rota | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [concluindoParada, setConcluindoParada] = useState<string | null>(null);
  const [pulandoParada, setPulandoParada] = useState<string | null>(null);
  const [reabrindoParada, setReabrindoParada] = useState<string | null>(null);

  // Feature 10: Modal de observações
  const [modalObservacoes, setModalObservacoes] = useState(false);
  const [paradaSelecionada, setParadaSelecionada] = useState<Parada | null>(null);
  const [observacaoTexto, setObservacaoTexto] = useState('');

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

      setRota(rotasData as Rota);

      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .select('*')
        .eq('rota_id', rotasData.id)
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

  // Feature 3: Validar ordem de paradas
  function validarOrdemParada(parada: Parada): { valido: boolean; mensagem?: string } {
    // Encontrar paradas anteriores que ainda estão pendentes
    const paradasAnterioresPendentes = paradas.filter(
      (p) => p.ordem < parada.ordem && p.status === 'pendente'
    );

    if (paradasAnterioresPendentes.length > 0) {
      const numeros = paradasAnterioresPendentes.map((p) => `#${p.ordem}`).join(', ');
      return {
        valido: false,
        mensagem: `Você deve concluir as paradas anteriores primeiro: ${numeros}`,
      };
    }

    return { valido: true };
  }

  // Feature 1: Validar foto obrigatória
  function validarFotoObrigatoria(parada: Parada): { valido: boolean; mensagem?: string } {
    if (!parada.foto_url || parada.foto_url.trim() === '') {
      return {
        valido: false,
        mensagem: 'É obrigatório enviar uma foto de comprovante antes de concluir esta parada.',
      };
    }
    return { valido: true };
  }

  async function concluirParada(parada: Parada) {
    // Feature 1: Validar foto obrigatória
    const validacaoFoto = validarFotoObrigatoria(parada);
    if (!validacaoFoto.valido) {
      Alert.alert('❌ Foto Obrigatória', validacaoFoto.mensagem!);
      return;
    }

    // Feature 3: Validar ordem
    const validacaoOrdem = validarOrdemParada(parada);
    if (!validacaoOrdem.valido) {
      Alert.alert(
        '⚠️ Ordem das Paradas',
        validacaoOrdem.mensagem!,
        [
          { text: 'Entendi', style: 'cancel' },
          {
            text: 'Concluir Mesmo Assim',
            style: 'destructive',
            onPress: () => executarConclusaoParada(parada),
          },
        ]
      );
      return;
    }

    // Se passou todas validações, pedir confirmação
    Alert.alert(
      'Concluir Parada',
      `Confirma a conclusão desta ${parada.tipo}?\n\n📍 ${parada.endereco}\n\n✅ Foto enviada\n${parada.observacoes_motorista ? `📝 Observações: ${parada.observacoes_motorista}` : ''}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Concluir',
          style: 'default',
          onPress: () => executarConclusaoParada(parada),
        },
      ]
    );
  }

  async function executarConclusaoParada(parada: Parada) {
    setConcluindoParada(parada.id);
    try {
      const { error: updateError } = await supabase
        .from('paradas')
        .update({
          status: 'concluida',
          concluida_em: new Date().toISOString(),
        })
        .eq('id', parada.id);

      if (updateError) throw updateError;

      await supabase.from('logs').insert({
        usuario_id: userData!.id,
        rota_id: rota!.id,
        parada_id: parada.id,
        evento: 'parada_concluida',
        detalhes: {
          endereco: parada.endereco,
          tipo: parada.tipo,
          ordem: parada.ordem,
          com_foto: !!parada.foto_url,
          observacoes_motorista: parada.observacoes_motorista,
        },
      });

      const paradasRestantes = paradas.filter(
        (p) => p.id !== parada.id && p.status !== 'concluida'
      );

      // Feature 2: Confirmação antes de finalizar rota
      if (paradasRestantes.length === 0) {
        Alert.alert(
          '🎉 Última Parada Concluída!',
          'Você concluiu todas as paradas desta rota.\n\nDeseja FINALIZAR a rota agora?',
          [
            {
              text: 'Não, revisar depois',
              style: 'cancel',
              onPress: () => {
                Alert.alert('Sucesso', 'Parada concluída! Revise antes de finalizar.');
                loadRotaEParadas();
              },
            },
            {
              text: 'Sim, Finalizar Rota',
              style: 'default',
              onPress: async () => {
                await finalizarRota();
                loadRotaEParadas();
              },
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
  }

  // Feature 2: Função separada para finalizar rota
  async function finalizarRota() {
    try {
      await supabase
        .from('rotas')
        .update({
          status: 'concluida',
          concluida_em: new Date().toISOString(),
        })
        .eq('id', rota!.id);

      await supabase.from('logs').insert({
        usuario_id: userData!.id,
        rota_id: rota!.id,
        evento: 'rota_concluida',
        detalhes: {
          total_paradas: paradas.length,
          paradas_concluidas: paradas.filter((p) => p.status === 'concluida').length,
          paradas_puladas: paradas.filter((p) => p.status === 'pulada').length,
        },
      });

      Alert.alert(
        '✅ Rota Finalizada!',
        'Parabéns! Rota concluída com sucesso.\n\nVocê pode ver os detalhes no histórico.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Erro ao finalizar rota:', error);
      Alert.alert('Erro', 'Não foi possível finalizar a rota');
    }
  }

  async function pularParada(parada: Parada) {
    Alert.alert(
      '⚠️ Pular Parada',
      `Tem certeza que deseja pular esta ${parada.tipo}?\n\n📍 ${parada.endereco}\n\n⚠️ Esta parada ficará marcada como "pulada" e poderá ser retomada depois.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, Pular',
          style: 'destructive',
          onPress: async () => {
            setPulandoParada(parada.id);
            try {
              const { error: updateError } = await supabase
                .from('paradas')
                .update({ status: 'pulada' })
                .eq('id', parada.id);

              if (updateError) throw updateError;

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

  // Feature 7: Permitir reabrir parada concluída
  async function reabrirParada(parada: Parada) {
    Alert.alert(
      'Reabrir Parada',
      `Deseja reabrir esta parada?\n\n📍 ${parada.endereco}\n\n⚠️ Ela voltará ao status "pendente".`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reabrir',
          style: 'default',
          onPress: async () => {
            setReabrindoParada(parada.id);
            try {
              const { error } = await supabase
                .from('paradas')
                .update({
                  status: 'pendente',
                  concluida_em: null,
                })
                .eq('id', parada.id);

              if (error) throw error;

              await supabase.from('logs').insert({
                usuario_id: userData!.id,
                rota_id: rota!.id,
                parada_id: parada.id,
                evento: 'parada_reaberta',
                detalhes: {
                  endereco: parada.endereco,
                  tipo: parada.tipo,
                  ordem: parada.ordem,
                },
              });

              Alert.alert('Sucesso', 'Parada reaberta com sucesso!');
              loadRotaEParadas();
            } catch (error) {
              console.error('Erro ao reabrir parada:', error);
              Alert.alert('Erro', 'Não foi possível reabrir a parada');
            } finally {
              setReabrindoParada(null);
            }
          },
        },
      ]
    );
  }

  // Feature 10: Adicionar observações do motorista
  function abrirModalObservacoes(parada: Parada) {
    setParadaSelecionada(parada);
    setObservacaoTexto(parada.observacoes_motorista || '');
    setModalObservacoes(true);
  }

  async function salvarObservacoes() {
    if (!paradaSelecionada) return;

    try {
      const { error } = await supabase
        .from('paradas')
        .update({ observacoes_motorista: observacaoTexto })
        .eq('id', paradaSelecionada.id);

      if (error) throw error;

      Alert.alert('Sucesso', 'Observações salvas!');
      setModalObservacoes(false);
      loadRotaEParadas();
    } catch (error) {
      console.error('Erro ao salvar observações:', error);
      Alert.alert('Erro', 'Não foi possível salvar as observações');
    }
  }

  // Feature 5: Botão de emergência/SOS
  function abrirSOS() {
    Alert.alert(
      '🚨 EMERGÊNCIA',
      'Selecione uma opção de emergência:',
      [
        {
          text: 'Ligar para Central',
          onPress: () => Linking.openURL('tel:0800123456'), // Substitua pelo número real
        },
        {
          text: 'Enviar Localização',
          onPress: async () => {
            await supabase.from('logs').insert({
              usuario_id: userData!.id,
              rota_id: rota?.id,
              evento: 'sos_acionado',
              detalhes: {
                timestamp: new Date().toISOString(),
                rota_id: rota?.id,
              },
            });
            Alert.alert('Alerta Enviado', 'A central foi notificada da sua localização.');
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
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
        <Text style={styles.emptySubtext}>Aguarde o gestor atribuir uma nova rota</Text>
      </View>
    );
  }

  const paradasPendentes = paradas.filter((p) => p.status === 'pendente').length;
  const paradasConcluidas = paradas.filter((p) => p.status === 'concluida').length;
  const paradasPuladas = paradas.filter((p) => p.status === 'pulada').length;

  const renderParada = ({ item }: { item: Parada }) => {
    const isConcluida = item.status === 'concluida';
    const isPulada = item.status === 'pulada';
    const isPendente = item.status === 'pendente';
    const isConcluindo = concluindoParada === item.id;
    const isPulando = pulandoParada === item.id;
    const isReabrindo = reabrindoParada === item.id;
    const temFoto = !!item.foto_url;

    return (
      <View
        style={[
          styles.paradaCard,
          isConcluida && styles.paradaCardConcluida,
          isPulada && styles.paradaCardPulada,
        ]}
      >
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

        <Text style={styles.paradaEndereco}>{item.endereco}</Text>

        {/* Feature 1: Indicador visual de foto */}
        {!isConcluida && !isPulada && (
          <View style={[styles.fotoStatus, temFoto ? styles.fotoStatusOk : styles.fotoStatusFalta]}>
            <Text style={styles.fotoStatusTexto}>
              {temFoto ? '✅ Foto enviada' : '❌ Foto obrigatória'}
            </Text>
          </View>
        )}

        {(item.destinatario || item.telefone) && (
          <View style={styles.paradaDetalhes}>
            {item.destinatario && <Text style={styles.paradaDetalheTexto}>👤 {item.destinatario}</Text>}
            {item.telefone && <Text style={styles.paradaDetalheTexto}>📞 {item.telefone}</Text>}
          </View>
        )}

        {item.observacoes && (
          <View style={styles.observacoesContainer}>
            <Text style={styles.observacoesLabel}>Observações:</Text>
            <Text style={styles.observacoesTexto}>{item.observacoes}</Text>
          </View>
        )}

        {item.observacoes_motorista && (
          <View style={styles.observacoesMotoristaContainer}>
            <Text style={styles.observacoesLabel}>Minhas Observações:</Text>
            <Text style={styles.observacoesTexto}>{item.observacoes_motorista}</Text>
          </View>
        )}

        {!isConcluida && !isPulada && (
          <>
            <TouchableOpacity
              style={styles.botaoNavegar}
              onPress={() =>
                abrirNavegacao({
                  latitude: item.latitude,
                  longitude: item.longitude,
                  endereco: item.endereco,
                })
              }
              activeOpacity={0.7}
            >
              <Text style={styles.botaoNavegarIcone}>🧭</Text>
              <Text style={styles.botaoNavegarTexto}>Como Chegar</Text>
            </TouchableOpacity>

            {/* Feature 10: Botão adicionar observações */}
            <TouchableOpacity
              style={styles.botaoObservacoes}
              onPress={() => abrirModalObservacoes(item)}
            >
              <Text style={styles.botaoObservacoesTexto}>
                📝 {item.observacoes_motorista ? 'Editar' : 'Adicionar'} Observações
              </Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.acoesContainer}>
          {/* Feature 7: Botão reabrir para paradas concluídas */}
          {isConcluida && (
            <TouchableOpacity
              style={[styles.botaoReabrir, isReabrindo && styles.botaoDisabled]}
              onPress={() => reabrirParada(item)}
              disabled={isReabrindo}
            >
              {isReabrindo ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.botaoReabrirTexto}>↺ Reabrir</Text>
              )}
            </TouchableOpacity>
          )}

          {!isConcluida && (
            <>
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
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Checkpoints</Text>
            <Text style={styles.headerSubtitle}>{rota.unidades.nome}</Text>
          </View>

          {/* Feature 5: Botão SOS */}
          <TouchableOpacity style={styles.botaoSOS} onPress={abrirSOS}>
            <Text style={styles.botaoSOSTexto}>🚨 SOS</Text>
          </TouchableOpacity>
        </View>

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
              <Text style={[styles.statValue, { color: theme.colors.red500 }]}>{paradasPuladas}</Text>
              <Text style={styles.statLabel}>Puladas</Text>
            </View>
          )}
        </View>

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

      <FlatList
        data={paradas}
        keyExtractor={(item) => item.id}
        renderItem={renderParada}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
        }
      />

      {/* Feature 10: Modal de Observações */}
      <Modal visible={modalObservacoes} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitulo}>Adicionar Observações</Text>
            <Text style={styles.modalSubtitulo}>
              Parada #{paradaSelecionada?.ordem} - {paradaSelecionada?.endereco}
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Ex: Cliente ausente, deixei com vizinho..."
              value={observacaoTexto}
              onChangeText={setObservacaoTexto}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalBotoes}>
              <TouchableOpacity
                style={styles.modalBotaoCancelar}
                onPress={() => setModalObservacoes(false)}
              >
                <Text style={styles.modalBotaoCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalBotaoSalvar} onPress={salvarObservacoes}>
                <Text style={styles.modalBotaoSalvarTexto}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.gray50 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: { marginTop: 10, fontSize: theme.typography.sm, color: theme.colors.gray500 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.xl,
  },
  emptyTitle: { fontSize: 64, marginBottom: theme.spacing.lg },
  emptyText: {
    fontSize: theme.typography.lg,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  emptySubtext: { fontSize: theme.typography.sm, color: theme.colors.gray500, textAlign: 'center' },
  header: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.typography['2xl'],
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: 4,
  },
  headerSubtitle: { fontSize: theme.typography.sm, color: theme.colors.gray500 },
  botaoSOS: {
    backgroundColor: theme.colors.red500,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  botaoSOSTexto: { color: theme.colors.white, fontSize: theme.typography.md, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: theme.spacing.md },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: theme.typography['2xl'], fontWeight: 'bold', color: theme.colors.primary },
  statLabel: { fontSize: theme.typography.xs, color: theme.colors.gray500, marginTop: 4 },
  progressSection: { marginTop: theme.spacing.xs },
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
  progressBar: { height: '100%', backgroundColor: theme.colors.green500 },
  listContainer: { padding: theme.spacing.md },
  paradaCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 2,
    borderColor: theme.colors.gray200,
  },
  paradaCardConcluida: { borderColor: theme.colors.green500, backgroundColor: theme.colors.green50 },
  paradaCardPulada: { borderColor: theme.colors.red500, backgroundColor: theme.colors.red50, opacity: 0.7 },
  paradaHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm, gap: theme.spacing.xs },
  ordemBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ordemText: { color: theme.colors.white, fontSize: theme.typography.md, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.borderRadius.xl, flex: 1 },
  statusBadgePendente: { backgroundColor: theme.colors.yellow100 },
  statusBadgeConcluida: { backgroundColor: theme.colors.green100 },
  statusBadgePulada: { backgroundColor: theme.colors.red100 },
  statusBadgeText: { fontSize: theme.typography.xs, fontWeight: '600', color: theme.colors.gray900 },
  tipoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.borderRadius.xl },
  tipoBadgeEntrega: { backgroundColor: theme.colors.blue100 },
  tipoBadgeRetirada: { backgroundColor: theme.colors.indigo100 },
  tipoBadgeText: { fontSize: theme.typography.xs, fontWeight: '600', color: theme.colors.gray900 },
  paradaEndereco: {
    fontSize: theme.typography.md,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  fotoStatus: {
    padding: 8,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
    alignItems: 'center',
  },
  fotoStatusOk: { backgroundColor: theme.colors.green100 },
  fotoStatusFalta: { backgroundColor: theme.colors.red100 },
  fotoStatusTexto: { fontSize: theme.typography.sm, fontWeight: '600', color: theme.colors.gray900 },
  paradaDetalhes: { marginBottom: theme.spacing.xs },
  paradaDetalheTexto: { fontSize: theme.typography.sm, color: theme.colors.gray500, marginBottom: 4 },
  observacoesContainer: {
    backgroundColor: theme.colors.gray50,
    padding: 10,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  observacoesMotoristaContainer: {
    backgroundColor: theme.colors.blue50,
    padding: 10,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.blue300,
  },
  observacoesLabel: { fontSize: theme.typography.xs, fontWeight: '600', color: theme.colors.gray500, marginBottom: 4 },
  observacoesTexto: { fontSize: theme.typography.sm, color: theme.colors.gray900, fontStyle: 'italic' },
  acoesContainer: { flexDirection: 'row', gap: theme.spacing.xs },
  botaoPular: {
    flex: 1,
    backgroundColor: theme.colors.red500,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  botaoPularTexto: { color: theme.colors.white, fontSize: theme.typography.sm, fontWeight: '600' },
  botaoConcluir: {
    flex: 2,
    backgroundColor: theme.colors.green500,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  botaoConcluirTexto: { color: theme.colors.white, fontSize: theme.typography.md, fontWeight: 'bold' },
  botaoReabrir: {
    flex: 1,
    backgroundColor: theme.colors.orange,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  botaoReabrirTexto: { color: theme.colors.white, fontSize: theme.typography.sm, fontWeight: '600' },
  botaoDisabled: { opacity: 0.6 },
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
  botaoNavegarIcone: { fontSize: 20 },
  botaoNavegarTexto: { color: theme.colors.white, fontSize: theme.typography.md, fontWeight: '600' },
  botaoObservacoes: {
    backgroundColor: theme.colors.blue500,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
    alignItems: 'center',
  },
  botaoObservacoesTexto: { color: theme.colors.white, fontSize: theme.typography.sm, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitulo: { fontSize: theme.typography.xl, fontWeight: 'bold', color: theme.colors.gray900, marginBottom: 8 },
  modalSubtitulo: { fontSize: theme.typography.sm, color: theme.colors.gray500, marginBottom: theme.spacing.md },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.md,
    minHeight: 100,
    marginBottom: theme.spacing.md,
  },
  modalBotoes: { flexDirection: 'row', gap: theme.spacing.sm },
  modalBotaoCancelar: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    alignItems: 'center',
  },
  modalBotaoCancelarTexto: { color: theme.colors.gray700, fontSize: theme.typography.md, fontWeight: '600' },
  modalBotaoSalvar: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  modalBotaoSalvarTexto: { color: theme.colors.white, fontSize: theme.typography.md, fontWeight: '600' },
}));
