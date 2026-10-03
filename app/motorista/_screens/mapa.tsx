import { useCallback, useState, useMemo } from 'react';
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MapaAdapter } from '@/components/MapaAdapter';
import { MobileEmptyState } from '@/components/mobile/MobileEmptyState';
import { ParadaBottomSheet } from '@/components/motorista/ParadaBottomSheet';
import { StopCompletionFlow } from '@/components/motorista/StopCompletionFlow';
import { useRouteStatus, type ParadaData } from '@/context/RouteStatusContext';
import { Text } from '@/design-system';
import { useAlert } from '@/hooks/useAlert';
import { useDriverLocationBroadcast } from '@/hooks/useDriverLocationBroadcast';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

function MapaMotoristaContent() {
  const { theme } = useUnistyles();
  const { showWarning, AlertDialog } = useAlert();

  // Usar contexto como fonte única de dados (com realtime automático)
  const { route, paradas, loading, routeStatus } = useRouteStatus();

  // Estados locais de UI apenas
  const [selectedParadaId, setSelectedParadaId] = useState<string | null>(null);
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [paradaParaConcluir, setParadaParaConcluir] =
    useState<ParadaData | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pendente' | 'em_andamento' | 'concluida'
  >('all');

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
    return paradas.find((p) => p.id === selectedParadaId) || null;
  }, [selectedParadaId, paradas]);

  const storedRouteInfo = useMemo(
    () =>
      route?.distancia_total != null && route?.tempo_total != null
        ? {
            distanceMeters: route.distancia_total * 1000,
            durationSeconds: route.tempo_total * 60,
          }
        : null,
    [route?.distancia_total, route?.tempo_total],
  );

  // Fechar bottom sheet
  const handleCloseBottomSheet = useCallback(() => {
    setBottomSheetVisible(false);
  }, []);

  // Concluir pela aba Mapa abre o MESMO fluxo com foto das outras telas.
  // Até 02/10/2026 isto chamava `completeStop(parada.id)` direto — concluía
  // sem comprovante e sem nem oferecer a câmera, a única porta do app assim.
  // Nota: Aceita tipo genérico para compatibilidade com ParadaBottomSheet
  const handleMarkComplete = useCallback(
    (parada: { id: string }) => {
      // Validar se a rota foi iniciada
      if (route?.status !== 'em_andamento') {
        showWarning(
          'Rota não iniciada',
          'Você precisa iniciar a rota antes de concluir paradas.',
        );
        return;
      }

      // A parada vem do contexto (objeto completo), não do bottom sheet: o
      // fluxo de conclusão precisa do `ParadaData` inteiro.
      const completa = paradas.find((p) => p.id === parada.id) ?? null;
      setParadaParaConcluir(completa);
    },
    [route?.status, paradas, showWarning],
  );

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
      <View
        testID="motorista-mapa-empty"
        style={{ flex: 1, backgroundColor: theme.colors.gray50 }}
      >
        <MobileEmptyState
          icon="🗺️"
          title="Nenhuma rota para visualizar"
          subtitle="Quando houver uma rota ativa, você poderá visualizar todas as paradas no mapa"
          fullScreen
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{route?.unidade_nome}</Text>
        <Text style={styles.headerSubtitle}>
          {
            paradas.filter(
              (p) => p.status === 'concluida' && p.is_checkpoint !== false,
            ).length
          }{' '}
          de {paradas.filter((p) => p.is_checkpoint !== false).length} paradas
          concluídas
        </Text>
      </View>

      {/* Filtros de status */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            statusFilter === 'all' && styles.filterChipActive,
          ]}
          onPress={() => setStatusFilter('all')}
        >
          <Text
            style={[
              styles.filterChipText,
              statusFilter === 'all' && styles.filterChipTextActive,
            ]}
          >
            Todas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterChip,
            statusFilter === 'pendente' && styles.filterChipActivePendente,
          ]}
          onPress={() => setStatusFilter('pendente')}
        >
          <View
            style={[
              styles.filterDot,
              { backgroundColor: theme.colors.warning },
            ]}
          />
          <Text
            style={[
              styles.filterChipText,
              statusFilter === 'pendente' && {
                color: theme.colors.warningDark,
              },
            ]}
          >
            Pendentes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterChip,
            statusFilter === 'em_andamento' && styles.filterChipActiveAndamento,
          ]}
          onPress={() => setStatusFilter('em_andamento')}
        >
          <View
            style={[
              styles.filterDot,
              { backgroundColor: theme.colors.primary },
            ]}
          />
          <Text
            style={[
              styles.filterChipText,
              statusFilter === 'em_andamento' && {
                color: theme.colors.primaryDark,
              },
            ]}
          >
            Andamento
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterChip,
            statusFilter === 'concluida' && styles.filterChipActiveConcluida,
          ]}
          onPress={() => setStatusFilter('concluida')}
        >
          <View
            style={[
              styles.filterDot,
              { backgroundColor: theme.colors.success },
            ]}
          />
          <Text
            style={[
              styles.filterChipText,
              statusFilter === 'concluida' && {
                color: theme.colors.successDark,
              },
            ]}
          >
            Concluídas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mapa usando MapaAdapter (funciona em web e mobile) */}
      <View style={styles.mapContainer} testID="motorista-mapa-view">
        <MapaAdapter
          paradas={paradas}
          selectedParadaId={selectedParadaId}
          onMarkerPress={handleMarkerPress}
          onMapPress={handleMapPress}
          statusFilter={statusFilter}
          unidadeNome={route?.unidade_nome}
          polyline={route?.polyline}
          storedRouteInfo={storedRouteInfo}
        />
      </View>

      {/* Bottom Sheet de detalhes da parada */}
      <ParadaBottomSheet
        parada={selectedParada}
        visible={bottomSheetVisible}
        onClose={handleCloseBottomSheet}
        onMarkComplete={handleMarkComplete}
      />

      <StopCompletionFlow
        parada={paradaParaConcluir}
        visible={paradaParaConcluir !== null}
        onClose={() => setParadaParaConcluir(null)}
        allowSkipPhoto={true}
      />
      {AlertDialog}
    </View>
  );
}

export default function MapaMotorista() {
  return (
    <ErrorBoundary>
      <MapaMotoristaContent />
    </ErrorBoundary>
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
