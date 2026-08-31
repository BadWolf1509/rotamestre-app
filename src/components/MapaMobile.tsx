import * as MapLibreGL from '@maplibre/maplibre-react-native';
import React, { useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';

import { useLocationTracking } from '@/components/map/hooks/useLocationTracking';
import { useMarkerGestures } from '@/components/map/hooks/useMarkerGestures';
import { useMobileMapCamera } from '@/components/map/hooks/useMobileMapCamera';
import { useNavigationActions } from '@/components/map/hooks/useNavigationActions';
import { useParadaFiltering } from '@/components/map/hooks/useParadaFiltering';
import { useRouteShape } from '@/components/map/hooks/useRouteShape';
import { FloatingActionButtons } from '@/components/map/mobile/FloatingActionButtons';
import { CheckpointMarker } from '@/components/map/mobile/markers/CheckpointMarker';
import { ParadaMarker } from '@/components/map/mobile/markers/ParadaMarker';
import { mapMobileStyles as styles } from '@/components/map/mobile/styles';
import { MotoristaMarker } from '@/components/MotoristaMarker';
import { useAlert } from '@/hooks/useAlert';
import type { RouteInfo } from '@/hooks/useRouteDirections';
import { formatarDecimal } from '@/lib/formatNumber';
import { OPENFREEMAP_STYLE_URL, toLngLat } from '@/lib/maplibre';
import type { ParadaMapItem as Parada, StatusFilter } from '@/types/parada-map';
import { useUnistyles } from '@/utils/styles';

interface MapaMobileProps {
  paradas: Parada[];
  selectedParadaId?: string | null;
  onMarkerPress?: (paradaId: string) => void;
  /** Callback quando toca fora dos marcadores (deselecionar) */
  onMapPress?: () => void;
  /** Callback para long-press no marcador (ações rápidas) */
  onMarkerLongPress?: (paradaId: string) => void;
  statusFilter?: StatusFilter;
  /** ID da rota para rastreamento em tempo real do motorista */
  rotaId?: string;
  /** Nome do motorista para exibir no marcador */
  motoristaNome?: string;
  /** Se true e rota em andamento, mostra posição do motorista em tempo real */
  showMotorista?: boolean;
  /** Nome da unidade para exibir nos checkpoints (PARTIDA/CHEGADA) */
  unidadeNome?: string;
  /** Geometria viária persistida em rotas.polyline. */
  polyline?: string | null;
  /** Totais persistidos da rota, em metros e segundos. */
  storedRouteInfo?: RouteInfo | null;
}

export function MapaMobile({
  paradas,
  selectedParadaId,
  onMarkerPress,
  onMapPress,
  onMarkerLongPress,
  statusFilter = 'all',
  rotaId,
  motoristaNome,
  showMotorista = false,
  unidadeNome,
  polyline,
  storedRouteInfo,
}: MapaMobileProps) {
  const { theme } = useUnistyles();
  const { AlertDialog } = useAlert();
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<
    string | null
  >(null);

  // Filter + categorize paradas
  const {
    paradasComCoord,
    paradasReais,
    paradasFiltradas,
    checkpoints,
    hasParadasComCoordenadas,
  } = useParadaFiltering(paradas, statusFilter);

  // Route shape (GeoJSON LineString) + route info
  const { routeShape, routeInfo, isLoadingRoute, routeError, refetchRoute } =
    useRouteShape(paradasComCoord as Parada[], {
      encodedPolyline: polyline,
      storedRouteInfo,
    });

  // Camera ref + initial camera position
  const { cameraRef, initialCamera } = useMobileMapCamera(
    paradasComCoord as Parada[],
  );

  // Location centering
  const { isLocating, handleCenterOnUser } = useLocationTracking(cameraRef);

  // Marker/map gestures + clipboard
  const {
    handleMarkerPress,
    handleMarkerLongPress,
    handleMapPress,
    handleCopyAddress,
  } = useMarkerGestures({
    onMarkerPress,
    onMarkerLongPress,
    onMapPress,
    setSelectedCheckpointId,
  });

  // Navigation: next stop + fit-all + open external nav app
  const { proximaParadaPendente, handleNavigate, handleFitAll } =
    useNavigationActions(paradasReais, paradasComCoord as Parada[], cameraRef);

  if (!hasParadasComCoordenadas) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          📍 Nenhuma parada com localização disponível
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapLibreGL.Map
        style={styles.map}
        mapStyle={OPENFREEMAP_STYLE_URL}
        logo={false}
        attribution={false}
        compass={true}
        onPress={handleMapPress}
      >
        <MapLibreGL.Camera ref={cameraRef} initialViewState={initialCamera} />

        {/* Somente geometria viária real (persistida, cache ou OSRM). */}
        {routeShape && (
          <MapLibreGL.GeoJSONSource id="rota" data={routeShape}>
            <MapLibreGL.Layer
              id="rota-line"
              type="line"
              paint={{ 'line-color': theme.colors.primary, 'line-width': 4 }}
            />
          </MapLibreGL.GeoJSONSource>
        )}

        {/* Marcadores dos checkpoints (PARTIDA/CHEGADA) */}
        {checkpoints.map((parada, index) => (
          <MapLibreGL.Marker
            key={parada.id}
            lngLat={toLngLat({
              latitude: parada.latitude!,
              longitude: parada.longitude!,
            })}
            anchor="bottom"
          >
            <CheckpointMarker
              index={index}
              endereco={parada.endereco}
              isSelected={selectedCheckpointId === parada.id}
              unidadeNome={unidadeNome}
              onPress={() =>
                setSelectedCheckpointId((prev) =>
                  prev === parada.id ? null : parada.id,
                )
              }
              onCopyAddress={handleCopyAddress}
            />
          </MapLibreGL.Marker>
        ))}

        {/* Marcadores das paradas reais (entregas/retiradas) - filtradas por status */}
        {paradasFiltradas.map((parada) => (
          <MapLibreGL.Marker
            key={parada.id}
            lngLat={toLngLat({
              latitude: parada.latitude!,
              longitude: parada.longitude!,
            })}
            anchor="bottom"
          >
            <ParadaMarker
              parada={parada}
              isSelected={selectedParadaId === parada.id}
              onPress={handleMarkerPress}
              onLongPress={handleMarkerLongPress}
            />
          </MapLibreGL.Marker>
        ))}

        {/* Marcador do motorista em tempo real */}
        {showMotorista && rotaId && (
          <MotoristaMarker
            rotaId={rotaId}
            motoristaNome={motoristaNome}
            realtime={true}
          />
        )}
      </MapLibreGL.Map>

      {/* Info Badge - mostra paradas e info da rota */}
      <View
        style={styles.infoBadge}
        accessible={true}
        accessibilityRole="summary"
        accessibilityLabel={
          isLoadingRoute
            ? 'Calculando rota'
            : `${paradasFiltradas.length} parada${paradasFiltradas.length !== 1 ? 's' : ''}${routeInfo ? `, ${formatarDecimal(routeInfo.distanceMeters / 1000)} quilômetros, ${Math.round(routeInfo.durationSeconds / 60)} minutos` : ''}`
        }
        accessibilityLiveRegion="polite"
      >
        {isLoadingRoute ? (
          <View style={styles.infoBadgeLoading}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.infoBadgeText}>Calculando rota...</Text>
          </View>
        ) : (
          <Text style={styles.infoBadgeText}>
            📍 {paradasFiltradas.length}
            {statusFilter !== 'all' ? `/${paradasReais.length}` : ''} parada
            {paradasFiltradas.length !== 1 ? 's' : ''}
            {routeInfo &&
              ` • ${formatarDecimal(routeInfo.distanceMeters / 1000)} km • ${Math.round(routeInfo.durationSeconds / 60)} min`}
          </Text>
        )}
      </View>

      {routeError && !routeShape && (
        <TouchableOpacity
          style={styles.routeErrorBadge}
          onPress={() => void refetchRoute()}
          accessibilityRole="button"
          accessibilityLabel={`${routeError} Tentar novamente`}
        >
          <Text style={styles.routeErrorText}>
            Trajeto indisponível · Tentar novamente
          </Text>
        </TouchableOpacity>
      )}

      <FloatingActionButtons
        onFitAll={handleFitAll}
        onCenterOnUser={handleCenterOnUser}
        isLocating={isLocating}
        proximaParadaPendente={proximaParadaPendente}
        onNavigate={handleNavigate}
      />
      {AlertDialog}
    </View>
  );
}
