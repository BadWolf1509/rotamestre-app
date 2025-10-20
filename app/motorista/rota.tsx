import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../hooks/useUser';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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
  const mapRef = useRef<MapView>(null);
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

  return (
    <View style={styles.container}>
      {/* Mapa */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: paradas[0]?.latitude || -23.5505,
          longitude: paradas[0]?.longitude || -46.6333,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {/* Marcadores das paradas */}
        {paradas.map((parada, index) => (
          <Marker
            key={parada.id}
            coordinate={{
              latitude: parada.latitude,
              longitude: parada.longitude,
            }}
            title={`Parada ${index + 1}`}
            description={parada.endereco}
            pinColor={parada.status === 'concluida' ? '#10b981' : '#FF8C00'}
          />
        ))}

        {/* Rota otimizada */}
        {paradas.length > 1 && GOOGLE_MAPS_KEY && (
          <MapViewDirections
            origin={{
              latitude: paradas[0].latitude,
              longitude: paradas[0].longitude,
            }}
            destination={{
              latitude: paradas[paradas.length - 1].latitude,
              longitude: paradas[paradas.length - 1].longitude,
            }}
            waypoints={
              paradas.length > 2
                ? paradas.slice(1, -1).map((p) => ({
                    latitude: p.latitude,
                    longitude: p.longitude,
                  }))
                : undefined
            }
            apikey={GOOGLE_MAPS_KEY}
            strokeWidth={4}
            strokeColor="#0D5A9C"
            optimizeWaypoints={true}
            onReady={(result) => {
              console.log('Rota calculada:', result.distance, 'km');
            }}
          />
        )}
      </MapView>

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
