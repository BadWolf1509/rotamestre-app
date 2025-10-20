import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { useRouter } from 'expo-router';

interface Parada {
  id: string;
  endereco: string;
  ordem: number;
  status: string;
  tipo: string;
  concluida_em?: string;
}

interface Rota {
  id: string;
  status: string;
  data: string;
  distancia_total?: number;
  tempo_total?: number;
  iniciada_em?: string;
  concluida_em?: string;
  unidades: {
    nome: string;
  };
}

export default function ResumoMotorista() {
  const { userData } = useUser();
  const router = useRouter();
  const [rota, setRota] = useState<Rota | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizando, setFinalizando] = useState(false);

  useEffect(() => {
    if (userData?.id) {
      loadRotaConcluida();
    }
  }, [userData]);

  async function loadRotaConcluida() {
    try {
      setLoading(true);

      // Buscar última rota concluída do motorista
      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select('id, status, data, distancia_total, tempo_total, iniciada_em, concluida_em, unidades(nome)')
        .eq('motorista_id', userData!.id)
        .eq('status', 'concluida')
        .order('concluida_em', { ascending: false })
        .limit(1)
        .single();

      if (rotasError || !rotasData) {
        setRota(null);
        setParadas([]);
        setLoading(false);
        return;
      }

      setRota(rotasData as Rota);

      // Buscar paradas da rota
      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .select('*')
        .eq('rota_id', rotasData.id)
        .order('ordem');

      if (paradasError) throw paradasError;

      setParadas(paradasData as Parada[] || []);
    } catch (error) {
      console.error('Erro ao carregar resumo:', error);
      Alert.alert('Erro', 'Não foi possível carregar o resumo da rota');
    } finally {
      setLoading(false);
    }
  }

  async function confirmarFinalizacao() {
    Alert.alert(
      'Finalizar Rota',
      'Confirma que todas as informações estão corretas e deseja finalizar esta rota?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'default',
          onPress: finalizarRota,
        },
      ]
    );
  }

  async function finalizarRota() {
    setFinalizando(true);
    try {
      // Criar log de finalização
      await supabase.from('logs').insert({
        usuario_id: userData!.id,
        rota_id: rota!.id,
        evento: 'rota_finalizada',
        detalhes: {
          total_paradas: paradas.length,
          paradas_concluidas: paradas.filter((p) => p.status === 'concluida').length,
          paradas_puladas: paradas.filter((p) => p.status === 'pulada').length,
          tempo_total: rota!.tempo_total,
          distancia_total: rota!.distancia_total,
        },
      });

      Alert.alert(
        'Rota Finalizada!',
        'Resumo enviado com sucesso. Obrigado pelo seu trabalho!',
        [
          {
            text: 'OK',
            onPress: () => router.push('/motorista/historico'),
          },
        ]
      );
    } catch (error) {
      console.error('Erro ao finalizar rota:', error);
      Alert.alert('Erro', 'Não foi possível finalizar a rota');
    } finally {
      setFinalizando(false);
    }
  }

  function calcularTempoTotal() {
    if (!rota?.iniciada_em || !rota?.concluida_em) return null;
    const inicio = new Date(rota.iniciada_em);
    const fim = new Date(rota.concluida_em);
    const diffMs = fim.getTime() - inicio.getTime();
    const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHoras}h ${diffMinutos}min`;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D5A9C" />
        <Text style={styles.loadingText}>Carregando resumo...</Text>
      </View>
    );
  }

  if (!rota || paradas.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>📊</Text>
        <Text style={styles.emptyText}>Nenhuma rota concluída recentemente</Text>
        <Text style={styles.emptySubtext}>
          Complete uma rota para visualizar o resumo
        </Text>
      </View>
    );
  }

  const paradasConcluidas = paradas.filter((p) => p.status === 'concluida').length;
  const paradasPuladas = paradas.filter((p) => p.status === 'pulada').length;
  const taxaConclusao = Math.round((paradasConcluidas / paradas.length) * 100);
  const tempoTotal = calcularTempoTotal();

  return (
    <ScrollView style={styles.container}>
      {/* Header com Título */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Resumo da Rota</Text>
        <Text style={styles.headerSubtitle}>{rota.unidades.nome}</Text>
        <Text style={styles.headerData}>
          {new Date(rota.data).toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      {/* Card de Performance */}
      <View style={styles.performanceCard}>
        <Text style={styles.sectionTitle}>Desempenho</Text>
        <View style={styles.performanceGrid}>
          <View style={styles.performanceItem}>
            <View style={[styles.performanceIcon, { backgroundColor: '#0D5A9C' }]}>
              <Text style={styles.performanceIconText}>📍</Text>
            </View>
            <Text style={styles.performanceValue}>{paradas.length}</Text>
            <Text style={styles.performanceLabel}>Total de Paradas</Text>
          </View>

          <View style={styles.performanceItem}>
            <View style={[styles.performanceIcon, { backgroundColor: '#10b981' }]}>
              <Text style={styles.performanceIconText}>✓</Text>
            </View>
            <Text style={styles.performanceValue}>{paradasConcluidas}</Text>
            <Text style={styles.performanceLabel}>Concluídas</Text>
          </View>

          <View style={styles.performanceItem}>
            <View style={[styles.performanceIcon, { backgroundColor: '#ef4444' }]}>
              <Text style={styles.performanceIconText}>⊘</Text>
            </View>
            <Text style={styles.performanceValue}>{paradasPuladas}</Text>
            <Text style={styles.performanceLabel}>Puladas</Text>
          </View>

          <View style={styles.performanceItem}>
            <View style={[styles.performanceIcon, { backgroundColor: '#8b5cf6' }]}>
              <Text style={styles.performanceIconText}>%</Text>
            </View>
            <Text style={styles.performanceValue}>{taxaConclusao}%</Text>
            <Text style={styles.performanceLabel}>Taxa de Sucesso</Text>
          </View>
        </View>
      </View>

      {/* Informações da Rota */}
      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Informações da Rota</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Horário de Início:</Text>
          <Text style={styles.infoValue}>
            {rota.iniciada_em
              ? new Date(rota.iniciada_em).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'N/A'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Horário de Conclusão:</Text>
          <Text style={styles.infoValue}>
            {rota.concluida_em
              ? new Date(rota.concluida_em).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'N/A'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tempo Total:</Text>
          <Text style={styles.infoValue}>{tempoTotal || 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Distância Percorrida:</Text>
          <Text style={styles.infoValue}>
            {rota.distancia_total ? `${rota.distancia_total.toFixed(1)} km` : 'N/A'}
          </Text>
        </View>
      </View>

      {/* Lista de Paradas */}
      <View style={styles.paradasCard}>
        <Text style={styles.sectionTitle}>Detalhes das Paradas</Text>

        {paradas.map((parada) => {
          const isConcluida = parada.status === 'concluida';
          const isPulada = parada.status === 'pulada';

          return (
            <View
              key={parada.id}
              style={[
                styles.paradaItem,
                isConcluida && styles.paradaItemConcluida,
                isPulada && styles.paradaItemPulada,
              ]}
            >
              <View style={styles.paradaHeader}>
                <View style={styles.paradaOrdemBadge}>
                  <Text style={styles.paradaOrdemText}>{parada.ordem}</Text>
                </View>
                <View style={styles.paradaInfo}>
                  <Text style={styles.paradaEndereco} numberOfLines={2}>
                    {parada.endereco}
                  </Text>
                  <View style={styles.paradaBadges}>
                    <View
                      style={[
                        styles.paradaTipoBadge,
                        parada.tipo === 'entrega'
                          ? styles.tipoBadgeEntrega
                          : styles.tipoBadgeRetirada,
                      ]}
                    >
                      <Text style={styles.paradaTipoText}>
                        {parada.tipo === 'entrega' ? '📦 Entrega' : '📥 Retirada'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.paradaStatusBadge,
                        isConcluida && styles.statusBadgeConcluida,
                        isPulada && styles.statusBadgePulada,
                      ]}
                    >
                      <Text style={styles.paradaStatusText}>
                        {isConcluida ? '✓ Concluída' : isPulada ? '⊘ Pulada' : 'Pendente'}
                      </Text>
                    </View>
                  </View>
                  {isConcluida && parada.concluida_em && (
                    <Text style={styles.paradaHorario}>
                      Concluída às{' '}
                      {new Date(parada.concluida_em).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Botão de Finalização */}
      <View style={styles.actionsCard}>
        <TouchableOpacity
          style={[styles.finalizarButton, finalizando && styles.buttonDisabled]}
          onPress={confirmarFinalizacao}
          disabled={finalizando}
        >
          {finalizando ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.finalizarButtonText}>✓ Confirmar e Finalizar</Text>
              <Text style={styles.finalizarButtonSubtext}>
                Enviar resumo completo da rota
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
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
    backgroundColor: '#0D5A9C',
    padding: 24,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e0e7ff',
    marginBottom: 8,
  },
  headerData: {
    fontSize: 14,
    color: '#bfdbfe',
    textTransform: 'capitalize',
  },
  performanceCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  performanceItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
  },
  performanceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  performanceIconText: {
    fontSize: 24,
  },
  performanceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  performanceLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  paradasCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paradaItem: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#e5e7eb',
  },
  paradaItemConcluida: {
    borderLeftColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  paradaItemPulada: {
    borderLeftColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  paradaHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  paradaOrdemBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0D5A9C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paradaOrdemText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  paradaInfo: {
    flex: 1,
  },
  paradaEndereco: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  paradaBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  paradaTipoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tipoBadgeEntrega: {
    backgroundColor: '#dbeafe',
  },
  tipoBadgeRetirada: {
    backgroundColor: '#e0e7ff',
  },
  paradaTipoText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
  },
  paradaStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
  },
  statusBadgeConcluida: {
    backgroundColor: '#d1fae5',
  },
  statusBadgePulada: {
    backgroundColor: '#fee2e2',
  },
  paradaStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
  },
  paradaHorario: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  actionsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 32,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  finalizarButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  finalizarButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  finalizarButtonSubtext: {
    color: '#d1fae5',
    fontSize: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
