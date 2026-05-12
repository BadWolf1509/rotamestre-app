import MapLibreGL from "@maplibre/maplibre-react-native";
import React, { useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";

import { useLocationTracking } from "@/components/map/hooks/useLocationTracking";
import { useMarkerGestures } from "@/components/map/hooks/useMarkerGestures";
import { useMobileMapCamera } from "@/components/map/hooks/useMobileMapCamera";
import { useNavigationActions } from "@/components/map/hooks/useNavigationActions";
import { useParadaFiltering } from "@/components/map/hooks/useParadaFiltering";
import { useRouteShape } from "@/components/map/hooks/useRouteShape";
import { FloatingActionButtons } from "@/components/map/mobile/FloatingActionButtons";
import { CheckpointMarker } from "@/components/map/mobile/markers/CheckpointMarker";
import { ParadaMarker } from "@/components/map/mobile/markers/ParadaMarker";
import { mapMobileStyles as styles } from "@/components/map/mobile/styles";
import { MotoristaMarker } from "@/components/MotoristaMarker";
import { useAlert } from "@/hooks/useAlert";
import { MAPLIBRE_RASTER_STYLE, toLngLat } from "@/lib/maplibre";
import type { ParadaMapItem as Parada, StatusFilter } from "@/types/parada-map";
import { useUnistyles } from "@/utils/styles";

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
}

export function MapaMobile({
  paradas,
  selectedParadaId,
  onMarkerPress,
  onMapPress,
  onMarkerLongPress,
  statusFilter = "all",
  rotaId,
  motoristaNome,
  showMotorista = false,
  unidadeNome,
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
  const { routeShape, routeInfo, isLoadingRoute } = useRouteShape(
    paradasComCoord as Parada[],
  );

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
      <MapLibreGL.MapView
        style={styles.map}
        mapStyle={MAPLIBRE_RASTER_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={true}
        onPress={handleMapPress}
      >
        <MapLibreGL.Camera ref={cameraRef} defaultSettings={initialCamera} />

        {/* Rota real (via Google Directions API) ou fallback para linhas retas */}
        {routeShape && (
          <MapLibreGL.ShapeSource id="rota" shape={routeShape}>
            <MapLibreGL.LineLayer
              id="rota-line"
              style={{ lineColor: theme.colors.primary, lineWidth: 4 }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Marcadores dos checkpoints (PARTIDA/CHEGADA) */}
        {checkpoints.map((parada, index) => (
          <MapLibreGL.MarkerView
            key={parada.id}
            coordinate={toLngLat({
              latitude: parada.latitude!,
              longitude: parada.longitude!,
            })}
            anchor={{ x: 0.5, y: 1 }}
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
          </MapLibreGL.MarkerView>
        ))}

        {/* Marcadores das paradas reais (entregas/retiradas) - filtradas por status */}
        {paradasFiltradas.map((parada) => (
          <MapLibreGL.MarkerView
            key={parada.id}
            coordinate={toLngLat({
              latitude: parada.latitude!,
              longitude: parada.longitude!,
            })}
            anchor={{ x: 0.5, y: 1 }}
          >
            <ParadaMarker
              parada={parada}
              isSelected={selectedParadaId === parada.id}
              onPress={handleMarkerPress}
              onLongPress={handleMarkerLongPress}
            />
          </MapLibreGL.MarkerView>
        ))}

        {/* Marcador do motorista em tempo real */}
        {showMotorista && rotaId && (
          <MotoristaMarker
            rotaId={rotaId}
            motoristaNome={motoristaNome}
            realtime={true}
          />
        )}
      </MapLibreGL.MapView>

      {/* Info Badge - mostra paradas e info da rota */}
      <View
        style={styles.infoBadge}
        accessible={true}
        accessibilityRole="summary"
        accessibilityLabel={
          isLoadingRoute
            ? "Calculando rota"
            : `${paradasFiltradas.length} parada${paradasFiltradas.length !== 1 ? "s" : ""}${routeInfo ? `, ${(routeInfo.distanceMeters / 1000).toFixed(1)} quilômetros, ${Math.round(routeInfo.durationSeconds / 60)} minutos` : ""}`
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
            {statusFilter !== "all" ? `/${paradasReais.length}` : ""} parada
            {paradasFiltradas.length !== 1 ? "s" : ""}
            {routeInfo &&
              ` • ${(routeInfo.distanceMeters / 1000).toFixed(1)} km • ${Math.round(routeInfo.durationSeconds / 60)} min`}
          </Text>
        )}
      </View>

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
