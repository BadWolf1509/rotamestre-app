import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';
import MapaWeb from '@/components/MapaWeb';

const IS_WEB = Platform.OS === 'web';

interface Parada {
  id: string;
  ordem: number;
  endereco: string;
  tipo: 'entrega' | 'retirada';
  status: string;
  latitude: number | null;
  longitude: number | null;
  destinatario?: string;
  telefone?: string;
  observacoes?: string;
}

interface Rota {
  id: string;
  data: string;
  status: string;
  distancia_total?: number;
  motorista?: {
    nome: string;
  };
}

export default function MapaRota() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rota, setRota] = useState<Rota | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);

  const isExpoGo = Constants.appOwnership === 'expo';

  useEffect(() => {
    if (id) {
      loadRotaEParadas();
    }
  }, [id]);

  async function loadRotaEParadas() {
    try {
      setLoading(true);

      // Buscar dados da rota
      const { data: rotaData, error: rotaError } = await supabase
        .from('rotas')
        .select('id, data, status, distancia_total, usuarios!rotas_motorista_id_fkey(nome)')
        .eq('id', id)
        .single();

      if (rotaError) throw rotaError;

      setRota({
        ...rotaData,
        motorista: rotaData.usuarios,
      });

      // Buscar paradas da rota
      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .select('*')
        .eq('rota_id', id)
        .order('ordem');

      if (paradasError) throw paradasError;

      setParadas(paradasData || []);
    } catch (error) {
      console.error('Erro ao carregar rota:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados da rota');
      router.back();
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D5A9C" />
        <Text style={styles.loadingText}>Carregando rota...</Text>
      </View>
    );
  }

  if (!rota) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Rota não encontrada</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header da Rota */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Voltar</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Mapa da Rota</Text>

        <View style={styles.rotaInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Data:</Text>
            <Text style={styles.infoValue}>
              {new Date(rota.data).toLocaleDateString('pt-BR')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Motorista:</Text>
            <Text style={styles.infoValue}>{rota.motorista?.nome || 'Não atribuído'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={[styles.infoValue, styles.statusBadge]}>
              {rota.status}
            </Text>
          </View>
          {rota.distancia_total && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Distância:</Text>
              <Text style={styles.infoValue}>{rota.distancia_total.toFixed(1)} km</Text>
            </View>
          )}
        </View>
      </View>

      {/* Mapa Interativo */}
      {IS_WEB && paradas.length > 0 ? (
        <View style={styles.mapContainer}>
          <MapaWeb paradas={paradas} />
        </View>
      ) : !IS_WEB && isExpoGo ? (
        <View style={styles.expoGoWarning}>
          <Text style={styles.warningTitle}>ℹ️ Limitação do Expo Go</Text>
          <Text style={styles.warningText}>
            O mapa interativo não está disponível no Expo Go.
          </Text>
          <Text style={styles.warningHint}>
            Para ver o mapa completo, use um development build.
          </Text>
        </View>
      ) : null}

      {/* Lista de Paradas */}
      <View style={styles.paradasContainer}>
        <Text style={styles.paradasTitle}>
          Paradas ({paradas.length})
        </Text>

        {paradas.map((parada, index) => (
          <View key={parada.id} style={styles.paradaCard}>
            <View style={styles.paradaHeader}>
              <View style={styles.paradaNumero}>
                <Text style={styles.paradaNumeroText}>{parada.ordem}</Text>
              </View>
              <View style={styles.paradaHeaderInfo}>
                <Text style={styles.paradaEndereco}>{parada.endereco}</Text>
                <View style={styles.paradaTags}>
                  <View style={[
                    styles.tipoTag,
                    parada.tipo === 'entrega' ? styles.tipoTagEntrega : styles.tipoTagRetirada,
                  ]}>
                    <Text style={styles.tipoTagText}>
                      {parada.tipo === 'entrega' ? '📦 Entrega' : '📥 Retirada'}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusTag,
                    parada.status === 'concluida' && styles.statusTagConcluida,
                    parada.status === 'pendente' && styles.statusTagPendente,
                    parada.status === 'em_andamento' && styles.statusTagEmAndamento,
                  ]}>
                    <Text style={styles.statusTagText}>
                      {parada.status === 'concluida' && '✓ Concluída'}
                      {parada.status === 'pendente' && '⏱ Pendente'}
                      {parada.status === 'em_andamento' && '🚚 Em andamento'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {(parada.destinatario || parada.telefone || parada.observacoes) && (
              <View style={styles.paradaDetalhes}>
                {parada.destinatario && (
                  <Text style={styles.paradaDetalhe}>👤 {parada.destinatario}</Text>
                )}
                {parada.telefone && (
                  <Text style={styles.paradaDetalhe}>📞 {parada.telefone}</Text>
                )}
                {parada.observacoes && (
                  <Text style={styles.paradaDetalhe}>📝 {parada.observacoes}</Text>
                )}
              </View>
            )}

            {parada.latitude && parada.longitude && (
              <Text style={styles.coordenadas}>
                📍 {parada.latitude.toFixed(6)}, {parada.longitude.toFixed(6)}
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* Resumo */}
      <View style={styles.resumo}>
        <Text style={styles.resumoTitle}>Resumo da Rota</Text>
        <View style={styles.resumoStats}>
          <View style={styles.resumoStat}>
            <Text style={styles.resumoStatValue}>{paradas.length}</Text>
            <Text style={styles.resumoStatLabel}>Paradas Totais</Text>
          </View>
          <View style={styles.resumoStat}>
            <Text style={[styles.resumoStatValue, { color: '#10b981' }]}>
              {paradas.filter((p) => p.status === 'concluida').length}
            </Text>
            <Text style={styles.resumoStatLabel}>Concluídas</Text>
          </View>
          <View style={styles.resumoStat}>
            <Text style={[styles.resumoStatValue, { color: '#f59e0b' }]}>
              {paradas.filter((p) => p.status === 'pendente').length}
            </Text>
            <Text style={styles.resumoStatLabel}>Pendentes</Text>
          </View>
        </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#0D5A9C',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backLink: {
    marginBottom: 12,
  },
  backLinkText: {
    fontSize: 16,
    color: '#0D5A9C',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  rotaInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  statusBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    color: '#1e40af',
    textTransform: 'capitalize',
  },
  expoGoWarning: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#92400e',
    marginBottom: 4,
  },
  warningHint: {
    fontSize: 12,
    color: '#92400e',
    fontStyle: 'italic',
  },
  paradasContainer: {
    padding: 16,
  },
  paradasTitle: {
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
    marginBottom: 12,
  },
  paradaNumero: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0D5A9C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paradaNumeroText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  paradaHeaderInfo: {
    flex: 1,
  },
  paradaEndereco: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  paradaTags: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tipoTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tipoTagEntrega: {
    backgroundColor: '#dbeafe',
  },
  tipoTagRetirada: {
    backgroundColor: '#fef3c7',
  },
  tipoTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTagConcluida: {
    backgroundColor: '#d1fae5',
  },
  statusTagPendente: {
    backgroundColor: '#fee2e2',
  },
  statusTagEmAndamento: {
    backgroundColor: '#e0e7ff',
  },
  statusTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  paradaDetalhes: {
    gap: 6,
    marginTop: 8,
  },
  paradaDetalhe: {
    fontSize: 13,
    color: '#6b7280',
  },
  coordenadas: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    fontFamily: 'monospace',
  },
  resumo: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  resumoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  resumoStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  resumoStat: {
    alignItems: 'center',
  },
  resumoStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0D5A9C',
    marginBottom: 4,
  },
  resumoStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  mapContainer: {
    height: 400,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f59e0b',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  markerBadgeConcluida: {
    backgroundColor: '#10b981',
  },
  markerBadgeEmAndamento: {
    backgroundColor: '#3b82f6',
  },
  markerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
