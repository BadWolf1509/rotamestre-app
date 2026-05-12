import { Ionicons } from "@expo/vector-icons";
import MapLibreGL from "@maplibre/maplibre-react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useMemo, useCallback, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Pressable,
  Linking,
} from "react-native";

import { useLocationTracking } from "@/components/map/hooks/useLocationTracking";
import { useMobileMapCamera } from "@/components/map/hooks/useMobileMapCamera";
import { useNavigationActions } from "@/components/map/hooks/useNavigationActions";
import { getStatusLabel } from "@/components/map/infoWindowBuilders";
import { MotoristaMarker } from "@/components/MotoristaMarker";
import { useAlert } from "@/hooks/useAlert";
import { useRouteDirections } from "@/hooks/useRouteDirections";
import { MAPLIBRE_RASTER_STYLE, toLineString, toLngLat } from "@/lib/maplibre";
import type { ParadaMapItem as Parada, StatusFilter } from "@/types/parada-map";
import { withOpacity } from "@/utils/color";
import { getMarkerFillColor } from "@/utils/mapMarkerColors";
import { StyleSheet, useUnistyles, type Theme } from "@/utils/styles";
import { toast } from "@/utils/toast";

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

  // Filtrar paradas com coordenadas válidas
  const paradasComCoord = useMemo(
    () => paradas.filter((p) => p.latitude !== null && p.longitude !== null),
    [paradas],
  );
  const hasParadasComCoordenadas = paradasComCoord.length > 0;

  // Separar paradas reais de checkpoints (pontos da unidade)
  const paradasReais = useMemo(
    () => paradasComCoord.filter((p) => p.is_checkpoint !== false),
    [paradasComCoord],
  );

  // Paradas filtradas por status
  const paradasFiltradas = useMemo(() => {
    if (statusFilter === "all") return paradasReais;
    return paradasReais.filter((p) => p.status === statusFilter);
  }, [paradasReais, statusFilter]);

  const checkpoints = useMemo(
    () => paradasComCoord.filter((p) => p.is_checkpoint === false),
    [paradasComCoord],
  );

  // Buscar rota real usando Google Directions API
  const {
    routeCoordinates,
    routeInfo,
    isLoading: isLoadingRoute,
  } = useRouteDirections(paradasComCoord as Parada[]);

  // Camera ref + initial camera position
  const { cameraRef, initialCamera } = useMobileMapCamera(
    paradasComCoord as Parada[],
  );

  // Location centering
  const { isLocating, handleCenterOnUser } = useLocationTracking(cameraRef);

  // Marker color from centralized statusConfig (WCAG-compliant dark variants)
  const getMarkerColor = useCallback(
    (status: string): string => {
      return getMarkerFillColor(status, theme.colors);
    },
    [theme.colors],
  );

  // Handler para tap no marcador com haptic feedback
  const handleMarkerPress = useCallback(
    (paradaId: string) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setSelectedCheckpointId(null);
      onMarkerPress?.(paradaId);
    },
    [onMarkerPress],
  );

  // Handler para long-press no marcador
  const handleMarkerLongPress = useCallback(
    (paradaId: string) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      onMarkerLongPress?.(paradaId);
    },
    [onMarkerLongPress],
  );

  // Handler para tap no mapa (deselecionar)
  const handleMapPress = useCallback(() => {
    setSelectedCheckpointId(null);
    onMapPress?.();
  }, [onMapPress]);

  // Navigation: next stop + fit-all + open external nav app
  const { proximaParadaPendente, handleNavigate, handleFitAll } =
    useNavigationActions(paradasReais, paradasComCoord as Parada[], cameraRef);

  // Handler para copiar endereço - memoizado para performance
  const handleCopyAddress = useCallback(async (endereco: string) => {
    try {
      await Clipboard.setStringAsync(endereco);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(
        "Endereço copiado para a área de transferência.",
        "Copiado!",
      );
    } catch {
      // Clipboard pode não estar disponível em todas as plataformas
      toast.error("Não foi possível copiar o endereço.");
    }
  }, []);

  const routeShape = useMemo(
    () => (routeCoordinates.length > 1 ? toLineString(routeCoordinates) : null),
    [routeCoordinates],
  );

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
        {checkpoints.map((parada, index) => {
          const isPartida = index === 0;
          const checkpointLabel = isPartida ? "PARTIDA" : "CHEGADA";
          const iconName = isPartida ? "flag" : "home";
          const isSelected = selectedCheckpointId === parada.id;

          return (
            <MapLibreGL.MarkerView
              key={parada.id}
              coordinate={toLngLat({
                latitude: parada.latitude!,
                longitude: parada.longitude!,
              })}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.markerWrapper}>
                {isSelected && (
                  <View style={styles.calloutWrapper}>
                    <View style={styles.checkpointCalloutContainer}>
                      <View style={styles.checkpointCalloutHeader}>
                        <View style={styles.checkpointIconBadge}>
                          <Ionicons
                            name={iconName}
                            size={12}
                            color={theme.colors.white}
                          />
                        </View>
                        <Text style={styles.checkpointCalloutTitle}>
                          {checkpointLabel}
                        </Text>
                      </View>
                      {unidadeNome && (
                        <Text style={styles.checkpointCalloutUnidade}>
                          {unidadeNome}
                        </Text>
                      )}
                      <Text
                        style={styles.checkpointCalloutAddress}
                        numberOfLines={2}
                      >
                        {parada.endereco}
                      </Text>
                      {/* Botão copiar endereço */}
                      <TouchableOpacity
                        style={styles.copyButton}
                        onPress={() => handleCopyAddress(parada.endereco)}
                        accessibilityLabel="Copiar endereço"
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name="copy-outline"
                          size={14}
                          color={theme.colors.textSecondary}
                        />
                        <Text style={styles.copyButtonText}>
                          Copiar endereço
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <Pressable
                  onPress={() =>
                    setSelectedCheckpointId((prev) =>
                      prev === parada.id ? null : parada.id,
                    )
                  }
                  style={styles.checkpointMarkerCompact}
                  accessibilityLabel={`${checkpointLabel}, ${parada.endereco}`}
                  accessibilityHint="Toque para ver informações"
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={iconName}
                    size={16}
                    color={theme.colors.white}
                  />
                </Pressable>
              </View>
            </MapLibreGL.MarkerView>
          );
        })}

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
            <View style={styles.markerWrapper}>
              {selectedParadaId === parada.id && (
                <View style={styles.calloutWrapper}>
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>
                      Parada {parada.ordem}
                    </Text>
                    <Text style={styles.calloutAddress} numberOfLines={2}>
                      {parada.endereco}
                    </Text>

                    {/* Destinatário */}
                    {parada.destinatario && (
                      <View style={styles.calloutDetailRow}>
                        <Ionicons
                          name="person-outline"
                          size={14}
                          color={theme.colors.textSecondary}
                        />
                        <Text
                          style={styles.calloutDetailText}
                          numberOfLines={1}
                        >
                          {parada.destinatario}
                        </Text>
                      </View>
                    )}

                    {/* Telefone clicável */}
                    {parada.telefone && (
                      <TouchableOpacity
                        style={styles.calloutDetailRow}
                        onPress={() =>
                          Linking.openURL(`tel:${parada.telefone}`)
                        }
                        accessibilityLabel={`Ligar para ${parada.telefone}`}
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name="call-outline"
                          size={14}
                          color={theme.colors.primary}
                        />
                        <Text style={styles.calloutPhoneText}>
                          {parada.telefone}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Badges: Status e Tipo */}
                    <View style={styles.calloutBadges}>
                      <View
                        style={[
                          styles.calloutStatus,
                          {
                            backgroundColor: withOpacity(
                              getMarkerColor(parada.status),
                              0.12,
                            ),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.calloutStatusText,
                            { color: getMarkerColor(parada.status) },
                          ]}
                        >
                          {getStatusLabel(parada.status)}
                        </Text>
                      </View>
                      {parada.tipo && (
                        <View style={styles.calloutTypeBadge}>
                          <Ionicons
                            name={
                              parada.tipo === "entrega"
                                ? "cube-outline"
                                : "arrow-up-circle-outline"
                            }
                            size={12}
                            color={theme.colors.textSecondary}
                          />
                          <Text style={styles.calloutTypeText}>
                            {parada.tipo === "entrega" ? "Entrega" : "Retirada"}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              )}

              <Pressable
                onPress={() => handleMarkerPress(parada.id)}
                onLongPress={() => handleMarkerLongPress(parada.id)}
                delayLongPress={400}
                style={({ pressed }) => [
                  styles.markerContainer,
                  { backgroundColor: getMarkerColor(parada.status) },
                  selectedParadaId === parada.id && styles.markerSelected,
                  pressed && styles.markerPressed,
                ]}
                accessibilityLabel={`Parada ${parada.ordem}, ${parada.endereco}, ${getStatusLabel(parada.status)}`}
                accessibilityHint="Toque para ver detalhes. Mantenha pressionado para ações rápidas"
                accessibilityRole="button"
              >
                <Text style={styles.markerText}>{parada.ordem}</Text>
              </Pressable>
            </View>
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

      {/* Botões flutuantes (FABs) */}
      <View
        style={styles.fabContainer}
        accessibilityRole="toolbar"
        accessibilityLabel="Controles do mapa"
      >
        {/* Botão de ajustar para mostrar todas as paradas */}
        <TouchableOpacity
          style={styles.fabSecondary}
          onPress={handleFitAll}
          activeOpacity={0.8}
          accessible={true}
          accessibilityLabel="Ajustar mapa para mostrar todas as paradas"
          accessibilityRole="button"
        >
          <Ionicons
            name="scan-outline"
            size={22}
            color={theme.colors.primary}
          />
        </TouchableOpacity>

        {/* Botão de centralizar no usuário */}
        <TouchableOpacity
          style={styles.fabSecondary}
          onPress={handleCenterOnUser}
          activeOpacity={0.8}
          disabled={isLocating}
          accessible={true}
          accessibilityLabel={
            isLocating
              ? "Obtendo localização"
              : "Centralizar mapa na minha localização"
          }
          accessibilityRole="button"
          accessibilityState={{ busy: isLocating }}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Ionicons name="locate" size={22} color={theme.colors.primary} />
          )}
        </TouchableOpacity>

        {/* Botão principal de navegação */}
        {proximaParadaPendente && (
          <TouchableOpacity
            style={styles.fabPrimary}
            onPress={handleNavigate}
            activeOpacity={0.8}
            accessible={true}
            accessibilityLabel={`Navegar para parada ${proximaParadaPendente.ordem}`}
            accessibilityRole="button"
            accessibilityHint="Abre aplicativo de navegação"
          >
            <Ionicons name="navigate" size={24} color={theme.colors.white} />
          </TouchableOpacity>
        )}
      </View>
      {AlertDialog}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    minHeight: 300,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.disabled,
  },
  map: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 300,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.disabled,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing["5"],
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  markerContainer: {
    width: theme.components.minTouchTarget,
    height: theme.components.minTouchTarget,
    borderRadius: theme.components.minTouchTarget / 2,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: theme.colors.surface,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerWrapper: {
    alignItems: "center",
  },
  calloutWrapper: {
    marginBottom: theme.spacing["2"],
  },
  // Checkpoint compacto azul marca - ícones distintos para PARTIDA/CHEGADA
  checkpointMarkerCompact: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    borderBottomLeftRadius: theme.spacing["0.5"],
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: theme.spacing["0.5"],
    borderColor: theme.colors.white,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  // Callout para checkpoint
  checkpointCalloutContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing["3"],
    minWidth: 180,
    maxWidth: 240,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  checkpointCalloutHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing["2"],
    marginBottom: theme.spacing["2"],
  },
  checkpointIconBadge: {
    width: theme.spacing["6"],
    height: theme.spacing["6"],
    borderRadius: theme.borderRadius.xs + 2,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  checkpointCalloutTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: "700",
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  checkpointCalloutUnidade: {
    fontSize: theme.typography.sm, // 14px
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing["1"],
  },
  checkpointCalloutAddress: {
    fontSize: theme.typography.sm, // 14px
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing["1.5"],
    paddingVertical: theme.spacing["2"],
    paddingHorizontal: theme.spacing["3"],
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    marginTop: theme.spacing["2.5"],
  },
  copyButtonText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: "500",
    color: theme.colors.textSecondary,
  },
  markerText: {
    color: theme.colors.surface,
    fontSize: theme.typography.fontSize.base,
    fontWeight: "bold",
  },
  markerSelected: {
    borderWidth: theme.spacing["1"],
    borderColor: theme.colors.primary,
    transform: [{ scale: 1.1 }],
  },
  markerPressed: {
    transform: [{ scale: 0.9 }],
    opacity: 0.8,
  },
  calloutContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing["3"],
    minWidth: 200,
    maxWidth: 280,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  calloutTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: theme.spacing["1"],
  },
  calloutAddress: {
    fontSize: theme.typography.sm, // 14px
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing["2"],
    lineHeight: 18,
  },
  calloutDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing["1.5"],
    marginBottom: theme.spacing["1.5"],
  },
  calloutDetailText: {
    fontSize: theme.typography.sm, // 14px
    color: theme.colors.textSecondary,
    flex: 1,
  },
  calloutPhoneText: {
    fontSize: theme.typography.sm, // 14px
    color: theme.colors.primary,
    fontWeight: "500",
  },
  calloutBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing["2"],
    marginTop: theme.spacing["1"],
    flexWrap: "wrap",
  },
  calloutStatus: {
    paddingHorizontal: theme.spacing["2.5"],
    paddingVertical: theme.spacing["1"],
    borderRadius: theme.borderRadius.lg,
  },
  calloutStatusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: "600",
  },
  calloutTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing["1"],
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: theme.spacing["2"],
    paddingVertical: theme.spacing["1"],
    borderRadius: theme.borderRadius.lg,
  },
  calloutTypeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: "500",
    color: theme.colors.textSecondary,
  },
  infoBadge: {
    position: "absolute",
    top: theme.spacing["2.5"],
    right: theme.spacing["2.5"],
    backgroundColor: withOpacity(theme.colors.white, 0.95),
    paddingHorizontal: theme.spacing["3"],
    paddingVertical: theme.spacing["1.5"],
    borderRadius: theme.spacing["5"],
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoBadgeLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing["1.5"],
  },
  infoBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.text,
  },
  fabContainer: {
    position: "absolute",
    bottom: theme.spacing["5"],
    right: theme.spacing["4"],
    gap: theme.spacing["3"],
  },
  fabPrimary: {
    width: theme.spacing["14"],
    height: theme.spacing["14"],
    borderRadius: theme.spacing["7"],
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabSecondary: {
    width: theme.components.minTouchTarget,
    height: theme.components.minTouchTarget,
    borderRadius: theme.components.minTouchTarget / 2,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
}));
