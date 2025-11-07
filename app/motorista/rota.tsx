import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { abrirNavegacao } from '@/lib/navigation';
import CameraUpload from '@/components/CameraUpload';
import * as Location from 'expo-location';
import {
  calcularTempoEstimado,
  formatarTempo,
  formatarHorario,
  calcularProximaParada,
  calcularDistancia,
} from '@/utils/timeEstimation';

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
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const [rota, setRota] = useState<Rota | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [loading, setLoading] = useState(true);
  const [iniciandoRota, setIniciandoRota] = useState(false);
  const [paradaSelecionadaParaFoto, setParadaSelecionadaParaFoto] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (userData?.id) {
      loadRotaAtiva();
      requestLocationPermission();
    }
  }, [userData]);

  async function requestLocationPermission() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Erro ao obter localização:', error);
    }
  }

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
        <ActivityIndicator size="large" color={theme.colors.primary} />
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

  // Feature 9: Calcula tempo estimado de conclusão
  const tempoEstimado = calcularTempoEstimado(paradas, userLocation || undefined);

  // Feature 6: Calcula distância até próxima parada
  const proximaParada = userLocation ? calcularProximaParada(paradas, userLocation) : null;

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
            <Text style={[styles.statValue, { color: theme.colors.green500 }]}>{paradasConcluidas}</Text>
            <Text style={styles.statLabel}>Concluídas</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.yellow500 }]}>{paradasPendentes}</Text>
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

        {/* Feature 9: Tempo Estimado */}
        {paradasPendentes > 0 && (
          <View style={styles.estimativaSection}>
            <Text style={styles.estimativaTitle}>⏱️ Tempo Estimado</Text>
            <View style={styles.estimativaRow}>
              <View style={styles.estimativaItem}>
                <Text style={styles.estimativaValue}>{formatarTempo(tempoEstimado.tempoTotalMinutos)}</Text>
                <Text style={styles.estimativaLabel}>Total restante</Text>
              </View>
              <View style={styles.estimativaItem}>
                <Text style={styles.estimativaValue}>{formatarHorario(tempoEstimado.horarioEstimadoConclusao)}</Text>
                <Text style={styles.estimativaLabel}>Previsão conclusão</Text>
              </View>
              <View style={styles.estimativaItem}>
                <Text style={styles.estimativaValue}>{tempoEstimado.distanciaTotalKm} km</Text>
                <Text style={styles.estimativaLabel}>Distância</Text>
              </View>
            </View>
          </View>
        )}

        {/* Feature 6: Próxima Parada */}
        {proximaParada && (
          <View style={styles.proximaParadaSection}>
            <Text style={styles.proximaParadaTitle}>📍 Próxima Parada</Text>
            <View style={styles.proximaParadaRow}>
              <Text style={styles.proximaParadaTexto}>
                Parada #{proximaParada.paradaIndex + 1} está a{' '}
                <Text style={styles.proximaParadaDestaque}>{proximaParada.distanciaKm} km</Text>
                {' '}de você
              </Text>
              <Text style={styles.proximaParadaTempo}>
                ~{formatarTempo(proximaParada.tempoEstimadoMinutos)} de viagem
              </Text>
            </View>
          </View>
        )}
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
    padding: theme.spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: theme.typography.xl,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  emptyText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  header: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  headerTitle: {
    fontSize: theme.typography['2xl'],
    fontWeight: 'bold',
    color: theme.colors.gray900,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.xl,
  },
  statusEmAndamento: {
    backgroundColor: theme.colors.blue100,
  },
  statusPendente: {
    backgroundColor: theme.colors.yellow100,
  },
  statusText: {
    fontSize: theme.typography.xs,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  infoCard: {
    backgroundColor: theme.colors.white,
    margin: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoUnidade: {
    fontSize: theme.typography.lg,
    fontWeight: '600',
    color: theme.colors.gray900,
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
    marginBottom: 4,
  },
  statLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
  },
  progressSection: {
    marginTop: theme.spacing.xs,
  },
  progressLabel: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
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
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
  },
  paradasSection: {
    padding: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.lg,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  paradaCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
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
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  paradaNumeroText: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontWeight: 'bold',
  },
  paradaInfo: {
    flex: 1,
  },
  paradaEndereco: {
    fontSize: theme.typography.sm,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: 4,
  },
  paradaTipo: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
  },
  paradaStatus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paradaStatusConcluida: {
    backgroundColor: theme.colors.green100,
  },
  paradaStatusPendente: {
    backgroundColor: theme.colors.red100,
  },
  paradaStatusText: {
    fontSize: theme.typography.md,
    fontWeight: 'bold',
    color: theme.colors.gray900,
  },
  actionSection: {
    padding: theme.spacing.md,
  },
  startButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  startButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.lg,
    fontWeight: 'bold',
  },
  hintSection: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  hintText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  botaoNavegar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.orange,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
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
  fotoIndicador: {
    backgroundColor: theme.colors.green100,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
    alignItems: 'center',
  },
  fotoIndicadorTexto: {
    color: theme.colors.green800,
    fontSize: theme.typography.sm,
    fontWeight: '600',
  },
  estimativaSection: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  estimativaTitle: {
    fontSize: theme.typography.md,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  estimativaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  estimativaItem: {
    alignItems: 'center',
  },
  estimativaValue: {
    fontSize: theme.typography.lg,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  estimativaLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  proximaParadaSection: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.blue50,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  proximaParadaTitle: {
    fontSize: theme.typography.sm,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: 6,
  },
  proximaParadaRow: {
    gap: 4,
  },
  proximaParadaTexto: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray700,
  },
  proximaParadaDestaque: {
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  proximaParadaTempo: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    fontStyle: 'italic',
  },
}));
