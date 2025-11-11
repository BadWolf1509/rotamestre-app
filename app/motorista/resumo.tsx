import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';

import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles } from '@/utils/styles';
import { MobileHeader, MobileCard, MobileLoading, MobileEmptyState, MobileButton } from '@/components/mobile';

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
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const router = useRouter();
  const [rota, setRota] = useState<Rota | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizando, setFinalizando] = useState(false);

  const loadRotaConcluida = useCallback(async () => {
    if (!userData?.id) {
      setRota(null);
      setParadas([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select('id, status, data, distancia_total, tempo_total, iniciada_em, concluida_em, unidades(nome)')
        .eq('motorista_id', userData.id)
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

      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .select('*')
        .eq('rota_id', rotasData.id)
        .order('ordem');

      if (paradasError) throw paradasError;

      setParadas((paradasData as Parada[]) || []);
    } catch (error) {
      console.error('Erro ao carregar resumo:', error);
      Alert.alert('Erro', 'Não foi possível carregar o resumo da rota');
    } finally {
      setLoading(false);
    }
  }, [userData?.id]);

  useEffect(() => {
    loadRotaConcluida();
  }, [loadRotaConcluida]);

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
    return <MobileLoading message="Carregando resumo..." />;
  }

  if (!rota || paradas.length === 0) {
    return (
      <MobileEmptyState
        icon="📊"
        title="Nenhuma rota concluída recentemente"
        subtitle="Complete uma rota para visualizar o resumo"
        actionLabel="Ver Rotas Disponíveis"
        onAction={() => router.push('/motorista')}
      />
    );
  }

  const paradasConcluidas = paradas.filter((p) => p.status === 'concluida').length;
  const paradasPuladas = paradas.filter((p) => p.status === 'pulada').length;
  const taxaConclusao = Math.round((paradasConcluidas / paradas.length) * 100);
  const tempoTotal = calcularTempoTotal();

  return (
    <>
      {/* Header */}
      <MobileHeader
        title="Resumo da Rota"
        subtitle={`${rota.unidades.nome} • ${new Date(rota.data).toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
        })}`}
      />

      <ScrollView style={styles.container}>

      {/* Card de Performance */}
      <MobileCard title="Desempenho" variant="highlight">
        <View style={styles.performanceGrid}>
          <View style={styles.performanceItem}>
            <View style={[styles.performanceIcon, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.performanceIconText}>📍</Text>
            </View>
            <Text style={styles.performanceValue}>{paradas.length}</Text>
            <Text style={styles.performanceLabel}>Total de Paradas</Text>
          </View>

          <View style={styles.performanceItem}>
            <View style={[styles.performanceIcon, { backgroundColor: theme.colors.success }]}>
              <Text style={styles.performanceIconText}>✓</Text>
            </View>
            <Text style={styles.performanceValue}>{paradasConcluidas}</Text>
            <Text style={styles.performanceLabel}>Concluídas</Text>
          </View>

          <View style={styles.performanceItem}>
            <View style={[styles.performanceIcon, { backgroundColor: theme.colors.error }]}>
              <Text style={styles.performanceIconText}>⊘</Text>
            </View>
            <Text style={styles.performanceValue}>{paradasPuladas}</Text>
            <Text style={styles.performanceLabel}>Puladas</Text>
          </View>

          <View style={styles.performanceItem}>
            <View style={[styles.performanceIcon, { backgroundColor: theme.colors.purple600 }]}>
              <Text style={styles.performanceIconText}>%</Text>
            </View>
            <Text style={styles.performanceValue}>{taxaConclusao}%</Text>
            <Text style={styles.performanceLabel}>Taxa de Sucesso</Text>
          </View>
        </View>
      </MobileCard>

      {/* Informações da Rota */}
      <MobileCard title="Informações da Rota">

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
      </MobileCard>

      {/* Lista de Paradas */}
      <MobileCard title="Detalhes das Paradas">

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
      </MobileCard>

      {/* Botão de Finalização */}
      <MobileCard>
        <MobileButton
          title="✓ Confirmar e Finalizar"
          onPress={confirmarFinalizacao}
          loading={finalizando}
          variant="success"
          fullWidth
        />
        <Text style={styles.finalizarButtonSubtext}>
          Enviar resumo completo da rota
        </Text>
      </MobileCard>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
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
    color: theme.colors.gray900,
    marginBottom: 4,
  },
  performanceLabel: {
    fontSize: 12,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.gray500,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: theme.colors.gray900,
    fontWeight: '600',
  },
  paradaItem: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: theme.colors.gray50,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.gray300,
  },
  paradaItemConcluida: {
    borderLeftColor: theme.colors.success,
    backgroundColor: theme.colors.green50,
  },
  paradaItemPulada: {
    borderLeftColor: theme.colors.error,
    backgroundColor: theme.colors.red50,
  },
  paradaHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  paradaOrdemBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paradaOrdemText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  paradaInfo: {
    flex: 1,
  },
  paradaEndereco: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.gray900,
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
    backgroundColor: theme.colors.blue100,
  },
  tipoBadgeRetirada: {
    backgroundColor: theme.colors.indigo100,
  },
  paradaTipoText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  paradaStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: theme.colors.yellow100,
  },
  statusBadgeConcluida: {
    backgroundColor: theme.colors.green100,
  },
  statusBadgePulada: {
    backgroundColor: theme.colors.red100,
  },
  paradaStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  paradaHorario: {
    fontSize: 11,
    color: theme.colors.gray500,
    fontStyle: 'italic',
    marginTop: 4,
  },
  finalizarButtonSubtext: {
    color: theme.colors.gray500,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
}));
