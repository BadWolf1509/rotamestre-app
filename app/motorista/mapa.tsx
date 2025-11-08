import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from '@/utils/styles';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { Ionicons } from '@expo/vector-icons';
import { MapaAdapter } from '@/components/MapaAdapter';

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
}

export default function MapaMotorista() {
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const [rota, setRota] = useState<Rota | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [trackingLocation, setTrackingLocation] = useState(false);

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

  function toggleLocationTracking() {
    setTrackingLocation(!trackingLocation);
    // Location tracking logic will be handled by MapaAdapter
  }


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando mapa...</Text>
      </View>
    );
  }

  if (!rota || paradas.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🗺️</Text>
        <Text style={styles.emptyTitle}>Nenhuma rota para visualizar</Text>
        <Text style={styles.emptyText}>
          Quando houver uma rota ativa, você poderá visualizar todas as paradas no mapa
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{rota.unidades.nome}</Text>
        <Text style={styles.headerSubtitle}>
          {paradas.filter(p => p.status === 'concluida').length} de {paradas.length} paradas concluídas
        </Text>
      </View>

      {/* Mapa usando MapaAdapter (funciona em web e mobile) */}
      <View style={styles.mapContainer}>
        <MapaAdapter paradas={paradas} />
      </View>

      {/* Legenda */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.green500 }]} />
          <Text style={styles.legendText}>Concluída</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.yellow500 }]} />
          <Text style={styles.legendText}>Pulada</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.red500 }]} />
          <Text style={styles.legendText}>Pendente</Text>
        </View>
      </View>
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
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: theme.typography.lg,
    fontWeight: 'bold',
    color: theme.colors.gray900,
  },
  headerSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginTop: 4,
  },
  mapContainer: {
    flex: 1,
    margin: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  legend: {
    position: 'absolute',
    bottom: theme.spacing.md,
    left: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray700,
    fontWeight: '500',
  },
}));
