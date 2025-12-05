import { useCallback, useEffect, useState, useMemo } from 'react';
import { View, Text, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';

import { MapaAdapter } from '@/components/MapaAdapter';
import { ParadaBottomSheet } from '@/components/motorista/ParadaBottomSheet';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface Parada {
  id: string;
  endereco: string;
  ordem: number;
  status: string;
  tipo?: string | null;
  latitude: number | null;
  longitude: number | null;
  foto_url?: string | null;
  is_checkpoint?: boolean;
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
  const [selectedParadaId, setSelectedParadaId] = useState<string | null>(null);
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'em_andamento' | 'concluida'>('all');

  const loadRotaAtiva = useCallback(async () => {
    const motoristaId = userData?.id;
    if (!motoristaId) {
      setLoading(false);
      setRota(null);
      setParadas([]);
      return;
    }

    try {
      setLoading(true);

      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select('id, status, unidades(nome)')
        .eq('motorista_id', motoristaId)
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

      setRota(rotasData as unknown as Rota);

      // Buscar TODAS as paradas (incluindo checkpoints de partida/chegada)
      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .select('id, endereco, ordem, status, tipo, latitude, longitude, foto_url, is_checkpoint')
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
  }, [userData]);

  useEffect(() => {
    loadRotaAtiva();
  }, [loadRotaAtiva]);

  // Realtime subscription para atualizações de paradas
  useEffect(() => {
    if (!rota?.id) return;

    const subscription = supabase
      .channel(`paradas-mapa-${rota.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'paradas',
          filter: `rota_id=eq.${rota.id}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setParadas((prev) =>
              prev.map((p) =>
                p.id === payload.new.id ? { ...p, ...payload.new } : p
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [rota?.id]);


  // Handler para quando um marcador é pressionado
  const handleMarkerPress = useCallback((paradaId: string) => {
    setSelectedParadaId(paradaId);
    setBottomSheetVisible(true);
  }, []);

  // Parada selecionada (objeto completo)
  const selectedParada = useMemo(() => {
    if (!selectedParadaId) return null;
    return paradas.find(p => p.id === selectedParadaId) || null;
  }, [selectedParadaId, paradas]);

  // Fechar bottom sheet
  const handleCloseBottomSheet = useCallback(() => {
    setBottomSheetVisible(false);
  }, []);

  // Marcar parada como concluída
  const handleMarkComplete = useCallback(async (parada: Parada) => {
    try {
      const { error } = await supabase
        .from('paradas')
        .update({ status: 'concluida' })
        .eq('id', parada.id);

      if (error) throw error;

      // Atualiza localmente
      setParadas((prev) =>
        prev.map((p) =>
          p.id === parada.id ? { ...p, status: 'concluida' } : p
        )
      );

      Alert.alert('Sucesso', `Parada ${parada.ordem} marcada como concluída!`);
    } catch (error) {
      console.error('Erro ao marcar parada como concluída:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a parada.');
    }
  }, []);

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
          {paradas.filter(p => p.status === 'concluida' && p.is_checkpoint !== false).length} de {paradas.filter(p => p.is_checkpoint !== false).length} paradas concluídas
        </Text>
      </View>

      {/* Filtros de status */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'all' && styles.filterChipActive]}
          onPress={() => setStatusFilter('all')}
        >
          <Text style={[styles.filterChipText, statusFilter === 'all' && styles.filterChipTextActive]}>
            Todas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'pendente' && styles.filterChipActivePendente]}
          onPress={() => setStatusFilter('pendente')}
        >
          <View style={[styles.filterDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={[styles.filterChipText, statusFilter === 'pendente' && { color: '#b45309' }]}>
            Pendentes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'em_andamento' && styles.filterChipActiveAndamento]}
          onPress={() => setStatusFilter('em_andamento')}
        >
          <View style={[styles.filterDot, { backgroundColor: '#3b82f6' }]} />
          <Text style={[styles.filterChipText, statusFilter === 'em_andamento' && { color: '#1d4ed8' }]}>
            Andamento
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'concluida' && styles.filterChipActiveConcluida]}
          onPress={() => setStatusFilter('concluida')}
        >
          <View style={[styles.filterDot, { backgroundColor: '#10b981' }]} />
          <Text style={[styles.filterChipText, statusFilter === 'concluida' && { color: '#047857' }]}>
            Concluídas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mapa usando MapaAdapter (funciona em web e mobile) */}
      <View style={styles.mapContainer}>
        <MapaAdapter
          paradas={paradas}
          selectedParadaId={selectedParadaId}
          onMarkerPress={handleMarkerPress}
          statusFilter={statusFilter}
        />
      </View>

      {/* Bottom Sheet de detalhes da parada */}
      <ParadaBottomSheet
        parada={selectedParada}
        visible={bottomSheetVisible}
        onClose={handleCloseBottomSheet}
        onMarkComplete={handleMarkComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
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
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 8,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.gray100,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
  },
  filterChipActivePendente: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  filterChipActiveAndamento: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  filterChipActiveConcluida: {
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.gray600,
  },
  filterChipTextActive: {
    color: theme.colors.white,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
}));
