import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { abrirNavegacao } from '@/lib/navigation';
import CameraUpload from '@/components/CameraUpload';

interface Parada {
  id: string;
  endereco: string;
  ordem: number;
  status: string;
  tipo: string;
  latitude: number;
  longitude: number;
  foto_url?: string | null;
}

interface Rota {
  id: string;
  status: string;
  unidades: {
    nome: string;
  };
  distancia_total?: number;
}

export default function RotaMotoristaWeb() {
  const { userData } = useUser();
  const [rota, setRota] = useState<Rota | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [loading, setLoading] = useState(true);
  const [iniciandoRota, setIniciandoRota] = useState(false);
  const [paradaSelecionadaParaFoto, setParadaSelecionadaParaFoto] = useState<string | null>(null);

  useEffect(() => {
    if (userData?.id) {
      loadRotaAtiva();
    }
  }, [userData]);

  async function loadRotaAtiva() {
    try {
      setLoading(true);

      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select('id, status, distancia_total, unidades(nome)')
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

      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .select('id, endereco, ordem, status, tipo, latitude, longitude, foto_url')
        .eq('rota_id', rotasData.id)
        .order('ordem');

      if (paradasError) throw paradasError;

      setParadas(paradasData || []);
    } catch (error) {
      console.error('Erro ao carregar rota:', error);
      Alert.alert('Erro', 'Não foi possível carregar a rota');
    } finally {
      setLoading(false);
    }
  }

  async function iniciarRota() {
    if (!rota) return;

    setIniciandoRota(true);
    try {
      const { error } = await supabase
        .from('rotas')
        .update({
          status: 'em_andamento',
          iniciada_em: new Date().toISOString(),
        })
        .eq('id', rota.id);

      if (error) throw error;

      Alert.alert('Sucesso!', 'Rota iniciada! Boa viagem! 🚚');
      loadRotaAtiva();
    } catch (error) {
      console.error('Erro ao iniciar rota:', error);
      Alert.alert('Erro', 'Não foi possível iniciar a rota');
    } finally {
      setIniciandoRota(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D5A9C" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  if (!rota) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📭</Text>
        <Text style={styles.emptyTitle}>Nenhuma rota ativa</Text>
        <Text style={styles.emptyText}>
          Aguarde até que o gestor atribua uma rota para você
        </Text>
      </View>
    );
  }

  const paradasConcluidas = paradas.filter((p) => p.status === 'concluida').length;
  const paradasPendentes = paradas.filter((p) => p.status !== 'concluida').length;
  const progresso = paradas.length > 0 ? Math.round((paradasConcluidas / paradas.length) * 100) : 0;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rota Atual</Text>
        <View style={[
          styles.statusBadge,
          rota.status === 'em_andamento' ? styles.statusEmAndamento : styles.statusPendente
        ]}>
          <Text style={styles.statusText}>
            {rota.status === 'em_andamento' ? 'Em Andamento' : 'Pendente'}
          </Text>
        </View>
      </View>

      {/* Info da Rota */}
      <View style={styles.infoCard}>
        <Text style={styles.infoUnidade}>{rota.unidades.nome}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{paradas.length}</Text>
            <Text style={styles.statLabel}>Paradas</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#10b981' }]}>{paradasConcluidas}</Text>
            <Text style={styles.statLabel}>Concluídas</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>{paradasPendentes}</Text>
            <Text style={styles.statLabel}>Pendentes</Text>
          </View>
          {rota.distancia_total && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{rota.distancia_total.toFixed(1)}</Text>
              <Text style={styles.statLabel}>km</Text>
            </View>
          )}
        </View>

        {/* Barra de Progresso */}
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>Progresso: {progresso}%</Text>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${progresso}%` }]} />
          </View>
        </View>
      </View>

      {/* Lista de Paradas */}
      <View style={styles.paradasSection}>
        <Text style={styles.sectionTitle}>Paradas</Text>
        {paradas.map((parada) => (
          <View key={parada.id} style={styles.paradaCard}>
            <View style={styles.paradaHeader}>
              <View style={styles.paradaNumero}>
                <Text style={styles.paradaNumeroText}>{parada.ordem}</Text>
              </View>
              <View style={styles.paradaInfo}>
                <Text style={styles.paradaEndereco}>{parada.endereco}</Text>
                <Text style={styles.paradaTipo}>
                  {parada.tipo === 'entrega' ? '📦 Entrega' : '📥 Retirada'}
                </Text>
              </View>
              <View style={[
                styles.paradaStatus,
                parada.status === 'concluida' ? styles.paradaStatusConcluida : styles.paradaStatusPendente
              ]}>
                <Text style={styles.paradaStatusText}>
                  {parada.status === 'concluida' ? '✓' : '○'}
                </Text>
              </View>
            </View>

            {/* Botão de Navegação */}
            {parada.status !== 'concluida' && (
              <>
                <TouchableOpacity
                  style={styles.botaoNavegar}
                  onPress={() => abrirNavegacao({
                    latitude: parada.latitude,
                    longitude: parada.longitude,
                    endereco: parada.endereco
                  })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.botaoNavegarIcone}>🧭</Text>
                  <Text style={styles.botaoNavegarTexto}>Como Chegar</Text>
                </TouchableOpacity>

                {/* Upload de Foto */}
                {rota && userData && (
                  <CameraUpload
                    unidadeId={userData.unidade_id!}
                    rotaId={rota.id}
                    paradaId={parada.id}
                    onUploadSuccess={() => {
                      Alert.alert('Sucesso!', 'Foto enviada! Você pode concluir a parada agora.');
                      loadRotaAtiva(); // Recarregar para mostrar foto_url
                    }}
                    onUploadError={(error) => {
                      Alert.alert('Erro', `Não foi possível enviar a foto: ${error}`);
                    }}
                  />
                )}
              </>
            )}

            {/* Indicador de Foto Enviada */}
            {parada.foto_url && (
              <View style={styles.fotoIndicador}>
                <Text style={styles.fotoIndicadorTexto}>✅ Foto de comprovante enviada</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Botão Iniciar */}
      {rota.status === 'pendente' && (
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={iniciarRota}
            disabled={iniciandoRota}
          >
            {iniciandoRota ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.startButtonText}>🚚 Iniciar Rota</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {rota.status === 'em_andamento' && (
        <View style={styles.hintSection}>
          <Text style={styles.hintText}>
            Acesse a aba "Paradas" para concluir as entregas
          </Text>
        </View>
      )}
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
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusEmAndamento: {
    backgroundColor: '#dbeafe',
  },
  statusPendente: {
    backgroundColor: '#fef3c7',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  infoCard: {
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
  infoUnidade: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
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
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressSection: {
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#6b7280',
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
    backgroundColor: '#0D5A9C',
    borderRadius: 4,
  },
  paradasSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  paradaCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0D5A9C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  paradaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paradaNumero: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0D5A9C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paradaNumeroText: {
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
    marginBottom: 4,
  },
  paradaTipo: {
    fontSize: 12,
    color: '#6b7280',
  },
  paradaStatus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paradaStatusConcluida: {
    backgroundColor: '#d1fae5',
  },
  paradaStatusPendente: {
    backgroundColor: '#fee2e2',
  },
  paradaStatusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  actionSection: {
    padding: 16,
  },
  startButton: {
    backgroundColor: '#0D5A9C',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  hintSection: {
    padding: 16,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  botaoNavegar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF8C00',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fotoIndicador: {
    backgroundColor: '#d1fae5',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  fotoIndicadorTexto: {
    color: '#065f46',
    fontSize: 14,
    fontWeight: '600',
  },
});
