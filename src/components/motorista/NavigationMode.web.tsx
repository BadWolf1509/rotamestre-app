/**
 * NavigationMode.web.tsx - Modo de navegação para motorista (Web)
 *
 * Migrado de Google Maps para MapLibre GL JS + OpenFreeMap (Jan/2025)
 * - Usa tiles gratuitos do OpenFreeMap
 * - Não requer API key
 */

import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import maplibregl from "maplibre-gl";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  useNavigationModeLogic,
  type NavigationModeProps,
} from "@/hooks/navigation";
import { useAlert } from "@/hooks/useAlert";
import { logger } from "@/lib/logger";
import { abrirNavegacao } from "@/lib/navigation";
import {
  getOpenFreeMapStyle,
  installOpenFreeMapMissingImageHandler,
} from "@/lib/openFreeMapStyle";
import { calculateHaversineDistance } from "@/services/turnByTurnNavigation";
import { withOpacity } from "@/utils/color";
import { StyleSheet, useUnistyles, type Theme } from "@/utils/styles";

import { NavigationInfoPanelWeb } from "./NavigationInfoPanelWeb";
import { NavigationSettings } from "./NavigationSettings";

export function NavigationMode({
  currentStop,
  nextStop,
  paradas,
  rotaId,
  onComplete,
  onSkip,
  onExit,
}: NavigationModeProps) {
  const { theme } = useUnistyles();
  const { showWarning, showConfirm, AlertDialog } = useAlert();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Use shared navigation logic hook
  const {
    userLocation,
    speed,
    distance: distanceToStop,
    eta,
    isTracking,
    setIsTracking,
    showSettings,
    setShowSettings,
    routePath,
    preferences,
    realParadas,
    startCheckpoint,
    endCheckpoint,
    currentStopIndex,
    nextStopAfterCurrent,
    pendingStops,
    isEntrega,
    isNearDestination,
    formatDistance,
    getSpeedColor,
    loadPreferences,
    updateLocationFromCoords,
  } = useNavigationModeLogic({
    currentStop,
    nextStop,
    paradas,
    rotaId,
  });

  const { autoAdvance, proximityRadius, showSpeedometer } = {
    autoAdvance: preferences.autoAdvance ?? true,
    proximityRadius: preferences.proximityRadius ?? 50,
    showSpeedometer: preferences.showSpeedometer ?? true,
  };

  // Calculate map center based on user location and destination
  const mapCenter = useMemo(() => {
    if (!userLocation || !currentStop) {
      return currentStop
        ? ([currentStop.longitude, currentStop.latitude] as [number, number])
        : ([-46.6333, -23.5505] as [number, number]); // São Paulo default
    }

    const distance = calculateHaversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      currentStop.latitude,
      currentStop.longitude,
    );

    // If close, center between both points
    if (distance < 1000) {
      return [
        (userLocation.longitude + currentStop.longitude) / 2,
        (userLocation.latitude + currentStop.latitude) / 2,
      ] as [number, number];
    }

    // If far, focus on user
    return [userLocation.longitude, userLocation.latitude] as [number, number];
  }, [userLocation, currentStop]);

  // Initialize MapLibre map (only once on mount)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Capture initial center value
    const initialCenter = mapCenter;
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
          center: initialCenter,
          zoom: 15,
        });
        removeMissingImageHandler =
          installOpenFreeMapMissingImageHandler(mapInstance);

        mapInstance.on("load", () => {
          setMapLoaded(true);
        });

        mapRef.current = mapInstance;
      } catch (error) {
        if (cancelled) return;
        logger.error("[NavigationMode.web] Failed to initialize map:", error);
      }
    };

    initializeMap();

    // Copy refs to local variables for cleanup
    const markers = markersRef.current;
    const userMarker = userMarkerRef.current;

    return () => {
      cancelled = true;
      if (removeMissingImageHandler) {
        removeMissingImageHandler();
      }
      markers.forEach((marker) => marker.remove());
      markers.clear();
      userMarker?.remove();
      if (mapInstance) {
        mapInstance.remove();
      }
      mapRef.current = null;
    };
    // Map initialization runs only once on mount - mapCenter is captured at init time
    // and updated separately via the setCenter effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map center when user location changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !userLocation) return;
    mapRef.current.setCenter([userLocation.longitude, userLocation.latitude]);
  }, [userLocation, mapLoaded]);

  // Create/update user location marker
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !userLocation) return;

    // Remove old marker
    userMarkerRef.current?.remove();

    // Create user marker element
    const el = document.createElement("div");
    const hasHeading = userLocation.heading !== undefined;

    if (hasHeading) {
      el.innerHTML = `
        <div style="
          width: 32px;
          height: 32px;
          border-radius: 16px;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.25);
          transform: rotate(${userLocation.heading}deg);
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="${theme.colors.info}">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/>
          </svg>
        </div>
      `;
    } else {
      el.innerHTML = `
        <div style="
          width: 24px;
          height: 24px;
          border-radius: 12px;
          background: rgba(66, 133, 244, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 12px;
            height: 12px;
            border-radius: 6px;
            background: #4285F4;
            border: 2px solid white;
          "></div>
        </div>
      `;
    }

    userMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([userLocation.longitude, userLocation.latitude])
      .addTo(mapRef.current);
  }, [userLocation, mapLoaded, theme.colors.info]);

  // Create/update destination and stop markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    // Current destination marker
    const destEl = document.createElement("div");
    const destColor = isEntrega ? theme.colors.error : theme.colors.warning;
    destEl.innerHTML = `
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 18px;
        background: ${destColor};
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          ${
            isEntrega
              ? '<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-7-2l4-4-4-4v3H8v2h4v3z"/>'
              : '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>'
          }
        </svg>
      </div>
    `;
    const destMarker = new maplibregl.Marker({ element: destEl })
      .setLngLat([currentStop.longitude, currentStop.latitude])
      .addTo(mapRef.current);
    markersRef.current.set("current", destMarker);

    // Other pending stops
    pendingStops.forEach((parada) => {
      const isNext = nextStopAfterCurrent?.id === parada.id;
      const el = document.createElement("div");
      el.innerHTML = `
        <div style="
          width: ${isNext ? "28px" : "24px"};
          height: ${isNext ? "28px" : "24px"};
          border-radius: ${isNext ? "14px" : "12px"};
          background: ${isNext ? theme.colors.warning : theme.colors.gray400};
          border: 2px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: ${isNext ? "11px" : "10px"};
          font-weight: 600;
          ${isNext ? `box-shadow: 0 1px 3px ${theme.colors.warning}80;` : ""}
        ">
          ${parada.ordem}
        </div>
      `;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([parada.longitude, parada.latitude])
        .addTo(mapRef.current!);
      markersRef.current.set(parada.id, marker);
    });

    // Start checkpoint
    if (startCheckpoint && startCheckpoint.id !== currentStop.id) {
      const el = document.createElement("div");
      el.innerHTML = `
        <div style="
          width: 28px;
          height: 28px;
          border-radius: 14px;
          background: white;
          border: 2px solid ${theme.colors.gray200};
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${theme.colors.success}">
            <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>
          </svg>
        </div>
      `;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([startCheckpoint.longitude, startCheckpoint.latitude])
        .addTo(mapRef.current!);
      markersRef.current.set("start", marker);
    }

    // End checkpoint
    if (endCheckpoint && endCheckpoint.id !== currentStop.id) {
      const el = document.createElement("div");
      el.innerHTML = `
        <div style="
          width: 28px;
          height: 28px;
          border-radius: 14px;
          background: white;
          border: 2px solid ${theme.colors.gray200};
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${theme.colors.info}">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
        </div>
      `;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([endCheckpoint.longitude, endCheckpoint.latitude])
        .addTo(mapRef.current!);
      markersRef.current.set("end", marker);
    }
  }, [
    currentStop,
    pendingStops,
    nextStopAfterCurrent,
    startCheckpoint,
    endCheckpoint,
    isEntrega,
    mapLoaded,
    theme,
  ]);

  // Add/update route polyline
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || routePath.length < 2) return;

    const map = mapRef.current;
    const sourceId = "route-source";
    const layerId = "route-layer";

    // Remove existing route
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    // Add route
    map.addSource(sourceId, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: routePath.map((c) => [c.longitude, c.latitude]),
        },
      },
    });

    map.addLayer({
      id: layerId,
      type: "line",
      source: sourceId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": theme.colors.primary,
        "line-width": 4,
        "line-opacity": 1,
      },
    });

    return () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [routePath, mapLoaded, theme.colors.primary]);

  // Recenter map on user location
  const recenterMap = useCallback(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 16,
      });
    }
  }, [userLocation]);

  const handleArrival = useCallback(async () => {
    const confirmed = await showConfirm({
      title: "Chegou ao Destino!",
      message: `Você chegou em: ${currentStop.endereco}`,
      confirmText: "Concluir",
      cancelText: "Pular",
      onCancel: onSkip,
    });

    if (confirmed) {
      onComplete();
    }
  }, [currentStop, onComplete, onSkip, showConfirm]);

  const checkProximityAndAutoAdvance = useCallback(
    (distance: number) => {
      if (distance < proximityRadius && autoAdvance) {
        handleArrival();
      }
    },
    [autoAdvance, handleArrival, proximityRadius],
  );

  const startLocationTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      showWarning("Erro", "Permissão de localização negada");
      return;
    }

    setIsTracking(true);

    try {
      const location = await Location.getCurrentPositionAsync({});
      updateLocationFromCoords(
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          heading: location.coords.heading,
        },
        location.coords.speed,
      );
    } catch (error) {
      logger.warn(
        "[NavigationMode.web] Error getting initial location:",
        error,
      );
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 5,
      },
      (location) => {
        updateLocationFromCoords(
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading,
          },
          location.coords.speed,
        );
      },
    );

    return () => {
      setIsTracking(false);
      try {
        subscription.remove();
      } catch (error) {
        logger.warn("[NavigationMode.web] Error removing subscription:", error);
      }
    };
  }, [setIsTracking, updateLocationFromCoords, showWarning]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    if (distanceToStop !== null) {
      checkProximityAndAutoAdvance(distanceToStop);
    }
  }, [distanceToStop, checkProximityAndAutoAdvance]);

  // Inject CSS keyframes for pulse animation
  useEffect(() => {
    if (typeof document === "undefined") return;

    const styleId = "nav-mode-pulse-keyframes";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes pip-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.15); }
      }
    `;
    document.head.appendChild(style);

    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) existingStyle.remove();
    };
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const initialize = async () => {
      cleanup = await startLocationTracking();
    };

    initialize();

    return () => {
      cleanup?.();
    };
  }, [startLocationTracking]);

  const openExternalNavigation = () => {
    abrirNavegacao({
      latitude: currentStop.latitude,
      longitude: currentStop.longitude,
      endereco: currentStop.endereco,
    });
  };

  // Loading state
  if (!mapLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando mapa...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* MapLibre Map */}
      <View style={styles.mapContainer}>
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topButton} onPress={onExit}>
            <Ionicons name="close" size={24} color={theme.colors.white} />
          </TouchableOpacity>

          {isTracking && (
            <View style={styles.trackingBadge}>
              <View style={styles.trackingDot} />
              <Text style={styles.trackingText}>Rastreando</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.topButton}
            onPress={() => setShowSettings(true)}
          >
            <Ionicons
              name="settings-outline"
              size={24}
              color={theme.colors.white}
            />
          </TouchableOpacity>
        </View>

        {/* Recenter Button */}
        {userLocation && (
          <TouchableOpacity
            style={styles.recenterButton}
            onPress={recenterMap}
            activeOpacity={0.8}
          >
            <Ionicons name="locate" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Info Panel */}
      <NavigationInfoPanelWeb
        realParadas={realParadas}
        currentStop={currentStop}
        nextStop={nextStop}
        currentStopIndex={currentStopIndex}
        isEntrega={isEntrega}
        isNearDestination={isNearDestination}
        distanceToStop={distanceToStop}
        eta={eta}
        speed={speed}
        showSpeedometer={showSpeedometer}
        formatDistance={formatDistance}
        getSpeedColor={getSpeedColor}
        onSkip={onSkip}
        onComplete={onComplete}
        onOpenExternalNavigation={openExternalNavigation}
      />

      {/* Settings Modal */}
      {showSettings && (
        <View style={styles.settingsOverlay}>
          <NavigationSettings
            visible={showSettings}
            onClose={() => setShowSettings(false)}
          />
        </View>
      )}
      {AlertDialog}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.black,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: theme.spacing["4"],
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray600,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: theme.colors.gray100,
    position: "relative",
  },
  topBar: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  trackingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: withOpacity(theme.colors.success, 0.9),
    paddingHorizontal: theme.spacing["4"],
    paddingVertical: 6,
    borderRadius: theme.borderRadius.xl,
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.white,
  },
  trackingText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: "600",
  },
  recenterButton: {
    position: "absolute",
    right: 16,
    bottom: 280,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  settingsOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
}));
