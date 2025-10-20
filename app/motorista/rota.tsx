import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
// import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
// import MapViewDirections from 'react-native-maps-directions';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../hooks/useUser';

// const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

interface Parada {
  id: string;
  endereco: string;
  latitude: number;
  longitude: number;
  ordem: number;
  status: string;
  tipo: string;
}

interface Rota {
  id: string;
  status: string;
  unidades: {
    nome: string;
  };
  distancia_total?: number;
  tempo_total?: number;
}

export default function RotaMotorista() {
  const { userData } = useUser();
  // const mapRef = useRef<MapView>(null);
  const [rota, setRota] = useState<Rota | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [loading, setLoading] = useState(true);
  const [iniciandoRota, setIniciandoRota] = useState(false);

  useEffect(() => {
    if (userData?.id) {
      loadRotaAtiva();
    }
  }, [userData]);

  async function loadRotaAtiva() {
    try {
      setLoading(true);

      // Buscar rota ativa do motorista
      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select('id, status, distancia_total, tempo_total, unidades(nome)')
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

      // Buscar paradas da rota
      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .select('id, endereco, latitude, longitude, ordem, status, tipo')
        .eq('rota_id', rotasData.id)
        .order('ordem');

      if (paradasError) throw paradasError;

      setParadas(paradasData as Parada[] || []);

      // Centralizar mapa nas paradas
      if (paradasData && paradasData.length > 0 && mapRef.current) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(
            paradasData.map((p: Parada) => ({
              latitude: p.latitude,
              longitude: p.longitude,
            })),
            {
              edgePadding: { top: 50, right: 50, bottom: 300, left: 50 },
              animated: true,
            }
          );
        }, 1000);
      }
    } catch (error) {
      console.error('Erro ao carregar rota:', error);
      Alert.alert('Erro', 'Não foi possível carregar a rota');
    } finally {
      setLoading(false);
    }
  }

  async function iniciarRota() {
    if (!rota) return;

    Alert.alert(
      'Iniciar Rota',
      'Deseja iniciar esta rota agora?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Iniciar',
          onPress: async () => {
            setIniciandoRota(true);
            try {
              // Atualizar status da rota
              await supabase
                .from('rotas')
                .update({
                  status: 'em_andamento',
                  iniciada_em: new Date().toISOString(),
                })
                .eq('id', rota.id);

              // Criar log
              await supabase.from('logs').insert({
                usuario_id: userData!.id,
                rota_id: rota.id,
                evento: 'rota_iniciada',
                detalhes: {
                  total_paradas: paradas.length,
                },
              });

              setRota({ ...rota, status: 'em_andamento' });
              Alert.alert('Sucesso', 'Rota iniciada! Boa viagem!');
            } catch (error) {
              console.error('Erro ao iniciar rota:', error);
              Alert.alert('Erro', 'Não foi possível iniciar a rota');
            } finally {
              setIniciandoRota(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D5A9C" />
        <Text style={styles.loadingText}>Carregando rota...</Text>
      </View>
    );
  }

  if (!rota || paradas.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>📍</Text>
        <Text style={styles.emptyText}>Nenhuma rota ativa no momento</Text>
        <Text style={styles.emptySubtext}>
          Aguarde o gestor atribuir uma nova rota
        </Text>
      </View>
    );
  }

  const paradasPendentes = paradas.filter((p) => p.status === 'pendente').length;
  const paradasConcluidas = paradas.filter((p) => p.status === 'concluida').length;
  const progresso = Math.round((paradasConcluidas / paradas.length) * 100);

  // Função para abrir no Google Maps
  const abrirNoGoogleMaps = () => {
    if (paradas.length === 0) return;

    const origem = `${paradas[0].latitude},${paradas[0].longitude}`;
    const destino = `${paradas[paradas.length - 1].latitude},${paradas[paradas.length - 1].longitude}`;
    const waypoints = paradas.slice(1, -1).map(p => `${p.latitude},${p.longitude}`).join('|');

    const url = `https://www.google.com/maps/dir/?api=1&origin=${origem}&destination=${destino}&waypoints=${waypoints}&travelmode=driving`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      {/* Placeholder do Mapa - Requer build nativo para react-native-maps */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapPlaceholderTitle}>📍 Mapa da Rota</Text>
        <Text style={styles.mapPlaceholderText}>
          {paradas.length} paradas na rota
        </Text>
        <TouchableOpacity
          style={styles.mapsButton}
          onPress={abrirNoGoogleMaps}
        >
          <Text style={styles.mapsButtonText}>🗺️ Abrir no Google Maps</Text>
        </TouchableOpacity>
        <Text style={styles.mapPlaceholderHint}>
          Para ver o mapa integrado, compile o app com:
{'\n'}npx expo run:ios ou npx expo run:android
        </Text>
      </View>

      {/* Painel de Informações */}
      <View style={styles.infoPanel}>
        <View style={styles.infoPanelHeader}>
          <Text style={styles.infoPanelTitle}>Rota Ativa</Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  rota.status === 'em_andamento' ? '#3b82f6' : '#f59e0b',
              },
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {rota.status === 'em_andamento' ? 'Em Andamento' : 'Pendente'}
            </Text>
          </View>
        </View>

        <Text style={styles.infoUnidade}>{rota.unidades.nome}</Text>

        {/* Estatísticas */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{paradas.length}</Text>
            <Text style={styles.statLabel}>Paradas</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{paradasConcluidas}</Text>
            <Text style={styles.statLabel}>Concluídas</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{paradasPendentes}</Text>
            <Text style={styles.statLabel}>Pendentes</Text>
          </View>

          {rota.distancia_total && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {rota.distancia_total.toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>km</Text>
            </View>
          )}
        </View>

        {/* Barra de Progresso */}
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>Progresso: {progresso}%</Text>
          <View style={styles.progressContainer}>
            <View
              style={[styles.progressBar, { width: `${progresso}%` }]}
            />
          </View>
        </View>

        {/* Botão Iniciar Rota */}
        {rota.status === 'pendente' && (
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
        )}

        {/* Link para Checkpoints */}
        {rota.status === 'em_andamento' && (
          <Text style={styles.hint}>
            Acesse a aba "Checkpoints" para concluir as paradas
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapPlaceholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10,
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 20,
  },
  mapsButton: {
    backgroundColor: '#0D5A9C',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  mapsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  mapPlaceholderHint: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
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
  map: {
    flex: 1,
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  infoPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoPanelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  infoUnidade: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
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
    marginBottom: 15,
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
  startButton: {
    backgroundColor: '#0D5A9C',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
});
