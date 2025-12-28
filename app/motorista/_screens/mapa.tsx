import { useCallback, useState, useMemo } from 'react';
import { View, Text, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';

import { MapaAdapter } from '@/components/MapaAdapter';
import { ParadaBottomSheet } from '@/components/motorista/ParadaBottomSheet';
import { useRouteStatus } from '@/context/RouteStatusContext';
import { useDriverLocationBroadcast } from '@/hooks/useDriverLocationBroadcast';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export default function MapaMotorista() {
  const { theme } = useUnistyles();

  // Usar contexto como fonte única de dados (com realtime automático)
  const {
    route,
    paradas,
    loading,
    routeStatus,
    completeStop,
  } = useRouteStatus();

  // Estados locais de UI apenas
  const [selectedParadaId, setSelectedParadaId] = useState<string | null>(null);
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'em_andamento' | 'concluida'>('all');

  // Broadcast localização do motorista quando a rota está em andamento
  useDriverLocationBroadcast({
    rotaId: route?.id,
    rotaStatus: route?.status,
  });


  // Handler para quando um marcador é pressionado
  const handleMarkerPress = useCallback((paradaId: string) => {
    setSelectedParadaId(paradaId);
    setBottomSheetVisible(true);
  }, []);

  // Handler para tap no mapa (fora dos marcadores) - fecha bottom sheet
  const handleMapPress = useCallback(() => {
    setBottomSheetVisible(false);
    setSelectedParadaId(null);
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

  // Marcar parada como concluída usando o contexto
  // Nota: Aceita tipo genérico para compatibilidade com ParadaBottomSheet
  const handleMarkComplete = useCallback(async (parada: { id: string; ordem: number }) => {
    // Validar se a rota foi iniciada
    if (route?.status !== 'em_andamento') {
      Alert.alert(
        'Rota não iniciada',
        'Você precisa iniciar a rota antes de concluir paradas.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      // Usar completeStop do contexto (já faz update + log + refresh)
      await completeStop(parada.id);
      Alert.alert('Sucesso', `Parada ${parada.ordem} marcada como concluída!`);
    } catch (error) {
      console.error('Erro ao marcar parada como concluída:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a parada.');
    }
  }, [route?.status, completeStop]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando mapa...</Text>
      </View>
    );
  }

  if (routeStatus === 'no-route' || paradas.length === 0) {
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
        <Text style={styles.headerTitle}>{route?.unidade_nome}</Text>
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
          <View style={[styles.filterDot, { backgroundColor: theme.colors.warning }]} />
          <Text style={[styles.filterChipText, statusFilter === 'pendente' && { color: theme.colors.warningDark }]}>
            Pendentes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'em_andamento' && styles.filterChipActiveAndamento]}
          onPress={() => setStatusFilter('em_andamento')}
        >
          <View style={[styles.filterDot, { backgroundColor: theme.colors.primary }]} />
          <Text style={[styles.filterChipText, statusFilter === 'em_andamento' && { color: theme.colors.primaryDark }]}>
            Andamento
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'concluida' && styles.filterChipActiveConcluida]}
          onPress={() => setStatusFilter('concluida')}
        >
          <View style={[styles.filterDot, { backgroundColor: theme.colors.success }]} />
          <Text style={[styles.filterChipText, statusFilter === 'concluida' && { color: theme.colors.successDark }]}>
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
          onMapPress={handleMapPress}
          statusFilter={statusFilter}
          unidadeNome={route?.unidade_nome}
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
    backgroundColor: theme.colors.warningBg,
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  filterChipActiveAndamento: {
    backgroundColor: theme.colors.infoBg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  filterChipActiveConcluida: {
    backgroundColor: theme.colors.successBg,
    borderWidth: 1,
    borderColor: theme.colors.success,
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
