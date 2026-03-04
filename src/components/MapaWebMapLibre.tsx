/**
 * MapaWebMapLibre - Mapa web usando MapLibre GL JS + OpenFreeMap
 *
 * Alternativa gratuita ao Google Maps para web.
 * Usa tiles do OpenFreeMap (gratuitos, sem API key).
 *
 * Features:
 * - Markers customizados para paradas e checkpoints
 * - Polyline para rota (via OSRM)
 * - InfoWindow com detalhes da parada
 * - Tracking de motorista em tempo real
 * - Fit bounds automático
 *
 * @see https://maplibre.org/maplibre-gl-js/docs/
 * @see https://openfreemap.org/
 */

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { View, ActivityIndicator, Text } from "react-native";

import { useRouteDirections } from "@/hooks/useRouteDirections";
import { logger } from "@/lib/logger";
import {
  getOpenFreeMapStyle,
  installOpenFreeMapMissingImageHandler,
} from "@/lib/openFreeMapStyle";
import { escapeHtml } from "@/lib/utils";
import type { ParadaMapItem as Parada, StatusFilter } from "@/types/parada-map";
import { StyleSheet, useUnistyles, type Theme } from "@/utils/styles";

interface MapaWebMapLibreProps {
  paradas: Parada[];
  selectedParadaId?: string | null;
  onMarkerPress?: (paradaId: string) => void;
  onMapPress?: () => void;
  statusFilter?: StatusFilter;
  rotaId?: string;
  motoristaNome?: string;
  showMotorista?: boolean;
  unidadeNome?: string;
  polyline?: string | null;
}

// Default center (Brasília)
const DEFAULT_CENTER: [number, number] = [-47.8822, -15.7942];
const DEFAULT_ZOOM = 13;

/**
 * Decode polyline from OSRM (Google polyline algorithm)
 */
function decodePolyline(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    // MapLibre uses [lng, lat] order
    coordinates.push([lng / 1e5, lat / 1e5]);
  }

  return coordinates;
}

function toNumber(value: number | null): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Create popup HTML content
 */
function createPopupContent(
  parada: Parada,
  isCheckpoint: boolean,
  isPartida: boolean,
  unidadeNome?: string,
): string {
  if (isCheckpoint) {
    const title = isPartida ? "🚀 Ponto de Partida" : "🏁 Ponto de Chegada";
    const subtitle = isPartida ? "Início da rota" : "Fim da rota";
    return `
      <div style="padding: 8px; max-width: 250px; font-family: system-ui, -apple-system, sans-serif;">
        <strong style="font-size: 14px;">${title}</strong>
        <p style="margin: 4px 0; font-size: 12px; color: #4b5563;">${subtitle}</p>
        ${unidadeNome ? `<p style="margin: 4px 0; font-size: 12px;"><strong>Unidade:</strong> ${escapeHtml(unidadeNome)}</p>` : ""}
        <p style="margin: 4px 0; font-size: 12px;">${escapeHtml(parada.endereco)}</p>
      </div>
    `;
  }

  const statusLabel: Record<string, string> = {
    pendente: "🟡 Pendente",
    em_andamento: "🔵 Em andamento",
    concluida: "✅ Concluída",
    pulada: "⏭️ Pulada",
  };

  const tipoLabel = parada.tipo === "entrega" ? "📦 Entrega" : "📤 Retirada";

  return `
    <div style="padding: 8px; max-width: 280px; font-family: system-ui, -apple-system, sans-serif;">
      <strong style="font-size: 14px;">Parada ${escapeHtml(String(parada.ordem))}</strong>
      <span style="margin-left: 8px; font-size: 12px; color: #4b5563;">${tipoLabel}</span>
      <p style="margin: 4px 0; font-size: 12px; color: #4b5563;">${statusLabel[parada.status] || escapeHtml(parada.status)}</p>
      <p style="margin: 4px 0; font-size: 12px;">${escapeHtml(parada.endereco)}</p>
      ${parada.destinatario ? `<p style="margin: 4px 0; font-size: 12px;"><strong>Destinatário:</strong> ${escapeHtml(parada.destinatario)}</p>` : ""}
      ${parada.telefone ? `<p style="margin: 4px 0; font-size: 12px;"><strong>Telefone:</strong> ${escapeHtml(parada.telefone)}</p>` : ""}
    </div>
  `;
}

export default function MapaWebMapLibre({
  paradas,
  selectedParadaId,
  onMarkerPress,
  onMapPress,
  statusFilter = "all",
  rotaId: _rotaId,
  motoristaNome: _motoristaNome,
  showMotorista: _showMotorista = false,
  unidadeNome,
  polyline,
}: MapaWebMapLibreProps) {
  const { theme } = useUnistyles();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Paradas with valid coordinates
  const paradasComCoord = useMemo(() => {
    return paradas
      .map((p) => {
        const latitude = toNumber(p.latitude);
        const longitude = toNumber(p.longitude);
        if (latitude == null || longitude == null) return null;
        return { ...p, latitude, longitude };
      })
      .filter(Boolean) as Parada[];
  }, [paradas]);

  // Separate real paradas from checkpoints
  const paradasReais = useMemo(
    () => paradasComCoord.filter((p) => p.is_checkpoint !== false),
    [paradasComCoord],
  );

  const checkpoints = useMemo(
    () => paradasComCoord.filter((p) => p.is_checkpoint === false),
    [paradasComCoord],
  );

  // Filtered paradas by status
  const paradasFiltradas = useMemo(() => {
    if (statusFilter === "all") return paradasReais;
    return paradasReais.filter((p) => p.status === statusFilter);
  }, [paradasReais, statusFilter]);

  // Calculate bounds
  const bounds = useMemo(() => {
    if (paradasComCoord.length === 0) return null;

    const lngs = paradasComCoord
      .map((p) => p.longitude!)
      .filter(Number.isFinite);
    const lats = paradasComCoord
      .map((p) => p.latitude!)
      .filter(Number.isFinite);
    if (lngs.length === 0 || lats.length === 0) return null;

    const minLng = Math.min(...lngs);
    const minLat = Math.min(...lats);
    const maxLng = Math.max(...lngs);
    const maxLat = Math.max(...lats);

    if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return null;

    return new maplibregl.LngLatBounds([minLng, minLat], [maxLng, maxLat]);
  }, [paradasComCoord]);

  const { routeCoordinates } = useRouteDirections(paradasComCoord);

  const polylineCoordinates = useMemo(() => {
    if (polyline) {
      return decodePolyline(polyline).filter(
        ([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat),
      );
    }
    return routeCoordinates
      .map((coord) => [coord.longitude, coord.latitude] as [number, number])
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  }, [polyline, routeCoordinates]);

  const paradasParaExibir = useMemo(
    () => [...checkpoints, ...paradasFiltradas],
    [checkpoints, paradasFiltradas],
  );

  const paradaLookup = useMemo(() => {
    const map = new Map<string, Parada>();
    paradasComCoord.forEach((parada) => {
      map.set(parada.id, parada);
    });
    return map;
  }, [paradasComCoord]);

  const markerFeatures = useMemo(() => {
    const checkpointIds = checkpoints.map((c) => c.id);
    const partidaId = checkpointIds[0];

    return paradasParaExibir
      .filter((parada) => parada.latitude != null && parada.longitude != null)
      .map((parada) => {
        const isCheckpoint = parada.is_checkpoint === false;
        const isPartida = isCheckpoint && parada.id === partidaId;
        // Use simple letters to avoid missing glyph ranges in OpenFreeMap fonts.
        const label = isCheckpoint
          ? isPartida
            ? "I"
            : "F"
          : String(parada.ordem);

        return {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [
              parada.longitude as number,
              parada.latitude as number,
            ],
          },
          properties: {
            id: parada.id,
            status: parada.status,
            ordem: parada.ordem,
            label,
            is_checkpoint: isCheckpoint,
            is_partida: isPartida,
            is_selected: parada.id === selectedParadaId,
          },
        };
      });
  }, [paradasParaExibir, checkpoints, selectedParadaId]);

  // Open popup for a parada
  const openPopup = useCallback(
    (parada: Parada, isCheckpoint: boolean, isPartida: boolean) => {
      if (
        !mapRef.current ||
        parada.latitude == null ||
        parada.longitude == null
      )
        return;

      // Close existing popup
      if (popupRef.current) {
        popupRef.current.remove();
      }

      popupRef.current = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: "300px",
      })
        .setLngLat([parada.longitude, parada.latitude])
        .setHTML(
          createPopupContent(parada, isCheckpoint, isPartida, unidadeNome),
        )
        .addTo(mapRef.current);
    },
    [unidadeNome],
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;
    let mapInstance: maplibregl.Map | null = null;
    let removeMissingImageHandler: (() => void) | null = null;

    const initializeMap = async () => {
      try {
        const style = await getOpenFreeMapStyle();
        if (cancelled || !mapContainerRef.current) return;

        mapInstance = new maplibregl.Map({
          container: mapContainerRef.current,
          style,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          // OpenFreeMap style JSON triggers non-blocking style validation warnings.
          // Disable validation to keep console clean in dev.
          validateStyle: false,
        });
        removeMissingImageHandler =
          installOpenFreeMapMissingImageHandler(mapInstance);

        mapInstance.on("load", () => {
          setMapLoaded(true);
          logger.info("[MapaWebMapLibre] Map loaded successfully");
        });

        mapInstance.on("error", (e) => {
          logger.error("[MapaWebMapLibre] Map error:", e);
          setLoadError("Erro ao carregar o mapa");
        });

        mapInstance.on("click", () => {
          if (popupRef.current) {
            popupRef.current.remove();
            popupRef.current = null;
          }
          onMapPress?.();
        });

        // Add navigation controls
        mapInstance.addControl(new maplibregl.NavigationControl(), "top-right");

        mapRef.current = mapInstance;
      } catch (error) {
        if (cancelled) return;
        logger.error("[MapaWebMapLibre] Failed to initialize map:", error);
        setLoadError("Erro ao inicializar o mapa");
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
      if (removeMissingImageHandler) {
        removeMissingImageHandler();
      }
      if (mapInstance) {
        mapInstance.remove();
      }
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, [onMapPress]);

  // Add/update route polyline
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || polylineCoordinates.length === 0)
      return;

    const map = mapRef.current;
    if (!(map as unknown as { style?: unknown }).style) return;
    const sourceId = "route-source";
    const layerId = "route-layer";

    // Remove existing route if any
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }

    // Add route source
    map.addSource(sourceId, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: polylineCoordinates,
        },
      },
    });

    // Add route layer
    map.addLayer({
      id: layerId,
      type: "line",
      source: sourceId,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": theme.colors.primary,
        "line-width": 4,
        "line-opacity": 0.8,
      },
    });

    return () => {
      if (!(map as unknown as { style?: unknown }).style) return;
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    };
  }, [mapLoaded, polylineCoordinates, theme.colors.primary]);

  // Create markers as layers to avoid drift with zoom/scaling
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const map = mapRef.current;
    if (!(map as unknown as { style?: unknown }).style) return;

    const sourceId = "paradas-source";
    const circleLayerId = "paradas-circle";
    const labelLayerId = "paradas-label";

    const data = {
      type: "FeatureCollection" as const,
      features: markerFeatures,
    };

    // MapLibre data-driven style expressions (case/match syntax)
    // Type as ExpressionSpecification for proper MapLibre API compatibility
    const circleColorExpression: maplibregl.ExpressionSpecification = [
      "case",
      ["==", ["get", "is_checkpoint"], true],
      [
        "case",
        ["==", ["get", "is_partida"], true],
        theme.colors.success,
        theme.colors.error,
      ],
      ["==", ["get", "status"], "concluida"],
      theme.colors.success,
      ["==", ["get", "status"], "em_andamento"],
      theme.colors.primary,
      ["==", ["get", "status"], "pendente"],
      theme.colors.warning,
      ["==", ["get", "status"], "pulada"],
      theme.colors.gray400,
      theme.colors.gray500,
    ];

    // Radius: checkpoints 18, regular 16, selected +4
    const circleRadiusExpression: maplibregl.ExpressionSpecification = [
      "case",
      [
        "all",
        ["==", ["get", "is_selected"], true],
        ["==", ["get", "is_checkpoint"], true],
      ],
      22,
      ["==", ["get", "is_selected"], true],
      20,
      ["==", ["get", "is_checkpoint"], true],
      18,
      16,
    ];

    // Stroke width: selected 4px, default 3px for depth
    const circleStrokeWidthExpression: maplibregl.ExpressionSpecification = [
      "case",
      ["==", ["get", "is_selected"], true],
      4,
      3,
    ];

    // Subtle blur for selected markers (shadow effect)
    const circleBlurExpression: maplibregl.ExpressionSpecification = [
      "case",
      ["==", ["get", "is_selected"], true],
      0.4,
      0,
    ];

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(data);
    } else {
      map.addSource(sourceId, {
        type: "geojson",
        data,
      });
    }

    if (!map.getLayer(circleLayerId)) {
      map.addLayer({
        id: circleLayerId,
        type: "circle",
        source: sourceId,
        paint: {
          "circle-color": circleColorExpression,
          "circle-radius": circleRadiusExpression,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": circleStrokeWidthExpression,
          "circle-blur": circleBlurExpression,
        },
      });
    } else {
      map.setPaintProperty(
        circleLayerId,
        "circle-color",
        circleColorExpression,
      );
      map.setPaintProperty(
        circleLayerId,
        "circle-radius",
        circleRadiusExpression,
      );
      map.setPaintProperty(
        circleLayerId,
        "circle-stroke-width",
        circleStrokeWidthExpression,
      );
      map.setPaintProperty(circleLayerId, "circle-blur", circleBlurExpression);
    }

    if (!map.getLayer(labelLayerId)) {
      map.addLayer({
        id: labelLayerId,
        type: "symbol",
        source: sourceId,
        layout: {
          "text-field": ["get", "label"],
          "text-size": ["case", ["==", ["get", "is_checkpoint"], true], 15, 13],
          // Use a single font stack available in the OpenFreeMap sprites
          // to avoid 404s for combined font stacks.
          "text-font": ["Noto Sans Bold"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.3)",
          "text-halo-width": 0.8,
        },
      });
    }

    const handleMarkerClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      const id = feature?.properties?.id as string | undefined;
      if (!id) return;

      const parada = paradaLookup.get(id);
      if (!parada) return;

      const rawCheckpoint = feature?.properties?.is_checkpoint;
      const rawPartida = feature?.properties?.is_partida;
      const isCheckpoint = rawCheckpoint === true || rawCheckpoint === "true";
      const isPartida = rawPartida === true || rawPartida === "true";

      if (!isCheckpoint) {
        onMarkerPress?.(parada.id);
      }
      openPopup(parada, isCheckpoint, isPartida);
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", circleLayerId, handleMarkerClick);
    map.on("click", labelLayerId, handleMarkerClick);
    map.on("mouseenter", circleLayerId, handleMouseEnter);
    map.on("mouseleave", circleLayerId, handleMouseLeave);
    map.on("mouseenter", labelLayerId, handleMouseEnter);
    map.on("mouseleave", labelLayerId, handleMouseLeave);

    // Fit bounds
    if (bounds && mapRef.current) {
      mapRef.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15,
        duration: 500,
      });
    }

    return () => {
      map.off("click", circleLayerId, handleMarkerClick);
      map.off("click", labelLayerId, handleMarkerClick);
      map.off("mouseenter", circleLayerId, handleMouseEnter);
      map.off("mouseleave", circleLayerId, handleMouseLeave);
      map.off("mouseenter", labelLayerId, handleMouseEnter);
      map.off("mouseleave", labelLayerId, handleMouseLeave);
    };
  }, [
    mapLoaded,
    markerFeatures,
    bounds,
    theme,
    onMarkerPress,
    openPopup,
    paradaLookup,
  ]);

  // Handle selected parada
  useEffect(() => {
    if (!selectedParadaId || !mapRef.current || !mapLoaded) return;

    const parada = paradasComCoord.find((p) => p.id === selectedParadaId);
    if (!parada) return;

    const isCheckpoint = parada.is_checkpoint === false;
    const checkpointIds = checkpoints.map((c) => c.id);
    const partidaId = checkpointIds[0];
    const isPartida = isCheckpoint && parada.id === partidaId;

    openPopup(parada, isCheckpoint, isPartida);

    // Pan to marker
    if (parada.latitude != null && parada.longitude != null) {
      mapRef.current.flyTo({
        center: [parada.longitude, parada.latitude],
        zoom: 15,
        duration: 500,
      });
    }
  }, [selectedParadaId, paradasComCoord, checkpoints, mapLoaded, openPopup]);

  if (loadError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "100%",
          minHeight: 400,
        }}
      />
      {!mapLoaded && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Carregando mapa...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    minHeight: 400,
    position: "relative",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.disabled,
  },
  loadingText: {
    marginTop: theme.spacing["2.5"],
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    height: 400,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.errorLight,
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error,
  },
}));
