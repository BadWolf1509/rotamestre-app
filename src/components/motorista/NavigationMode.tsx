import { Ionicons } from '@expo/vector-icons';
import * as MapLibreGL from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useNavigationModeLogic,
  useNavigationFeedback,
  useNavigationActions,
  type NavigationModeProps,
} from '@/hooks/navigation';
import { useAlert } from '@/hooks/useAlert';
import {
  useLocationWatcher,
  type OpcoesDoWatcher,
} from '@/hooks/useLocationWatcher';
import { useRevalidarPermissaoDeLocalizacao } from '@/hooks/useRevalidarPermissaoDeLocalizacao';
import {
  OPENFREEMAP_STYLE_URL,
  toLineString,
  toLngLat,
  zoomFromLongitudeDelta,
} from '@/lib/maplibre';
import { COPY_LOCALIZACAO } from '@/lib/motorista/copyDePermissao';
import {
  oferecerSaidaParaConfiguracoes,
  pedirPermissao,
} from '@/lib/permissoes';
import { calculateHaversineDistance } from '@/services/turnByTurnNavigation';
import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { NavigationInfoPanel } from './NavigationInfoPanel';
import { NavigationSettings } from './NavigationSettings';
import { TurnByTurnNavigation } from './TurnByTurnNavigation';

import type { CameraRef } from '@maplibre/maplibre-react-native';

const OPCOES_NAVEGACAO: OpcoesDoWatcher = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 5,
};

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
  const insets = useSafeAreaInsets();
  const { showConfirm, AlertDialog } = useAlert();

  // Use shared navigation logic hook
  const {
    userLocation,
    speed,
    distance,
    eta,
    isTracking,
    showSettings,
    setShowSettings,
    routePath,
    preferences,
    navigationMode,
    setNavigationMode,
    isInitializing,
    setIsInitializing,
    realParadas,
    startCheckpoint,
    endCheckpoint,
    currentStopIndex,
    nextStopAfterCurrent,
    isEntrega,
    formatDistance,
    getSpeedColor,
    loadPreferences,
    startNavigation,
    stopNavigation,
    updateLocationFromCoords,
  } = useNavigationModeLogic({
    currentStop,
    nextStop,
    paradas,
    rotaId,
  });

  const routeShape = useMemo(
    () => (routePath.length >= 2 ? toLineString(routePath) : null),
    [routePath],
  );

  const cameraRef = useRef<CameraRef>(null);

  // Altura (dp) do que cobre o mapa: barra superior e painel de baixo.
  // A câmera desconta isso para centralizar na parte VISÍVEL do mapa.
  const [alturaBarraSuperior, setAlturaBarraSuperior] = useState(0);
  const [alturaPainel, setAlturaPainel] = useState(0);
  const MARGEM_ENQUADRAMENTO = 48;

  // Feedback hooks (haptics + sound)
  const { triggerHaptic, playNotificationSound, cleanupSound } =
    useNavigationFeedback({
      vibrationAlerts: preferences.vibrationAlerts,
      soundAlerts: preferences.soundAlerts,
    });

  // Animation refs for UI improvements
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const buttonScaleAnims = useRef({
    skip: new Animated.Value(1),
    maps: new Animated.Value(1),
    complete: new Animated.Value(1),
  }).current;
  const isPulsingRef = useRef(false);

  useEffect(() => {
    const initialize = async () => {
      await startNavigation();
      await loadPreferences();
      setIsInitializing(false);
    };
    initialize();
    return () => {
      stopNavigation();
      cleanupSound();
    };
  }, [
    loadPreferences,
    setIsInitializing,
    startNavigation,
    stopNavigation,
    cleanupSound,
  ]);

  const [temPermissaoDeLocalizacao, setTemPermissaoDeLocalizacao] =
    useState(false);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      const resultado = await pedirPermissao(() =>
        Location.requestForegroundPermissionsAsync(),
      );
      if (cancelado) return;

      setTemPermissaoDeLocalizacao(resultado.concedida);
      await oferecerSaidaParaConfiguracoes(
        resultado,
        COPY_LOCALIZACAO,
        showConfirm,
      );
    })();

    return () => {
      cancelado = true;
    };
  }, [showConfirm]);

  useRevalidarPermissaoDeLocalizacao(setTemPermissaoDeLocalizacao);

  useLocationWatcher({
    enabled: temPermissaoDeLocalizacao,
    options: OPCOES_NAVEGACAO,
    onLocation: (location) =>
      updateLocationFromCoords(
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          heading: location.coords.heading,
        },
        location.coords.speed,
      ),
  });

  // OSRM route fetching is now handled by useNavigationModeLogic hook

  // Action handlers (complete, skip, exit, open in maps)
  const {
    handleOpenInMaps,
    handleCompleteStop,
    handleSkipStop,
    handleExitNavigation,
  } = useNavigationActions({
    currentStop,
    preferences,
    triggerHaptic,
    playNotificationSound,
    showConfirm,
    setNavigationMode,
    stopNavigation,
    onComplete,
    onSkip,
    onExit,
  });

  // Chegada no Turn-by-Turn: vai direto ao fluxo de conclusão da Início
  // (StopCompletionFlow, que pede a foto e já é a confirmação). Passar por
  // `handleCompleteStop` exigiria o `{AlertDialog}`, que este ramo não monta.
  // Se o motorista cancelar o fluxo, o Turn-by-Turn segue em "chegou" (sem
  // botão Concluir): a saída é o botão Sair → modo mapa → Concluir.
  const concluirNaChegada = useCallback(async () => {
    await playNotificationSound();
    onComplete();
  }, [playNotificationSound, onComplete]);

  // formatDistance is now provided by useNavigationModeLogic hook

  // Enquadramento da navegação. Perto (< 1 km): motorista e parada juntos,
  // por `bounds`. Longe: centrado no motorista, zoom pela distância. Em
  // ambos, o padding desconta barra superior e painel — sem ele o centro
  // caía atrás do painel e nada da rota aparecia.
  const cameraSettings = useMemo<MapLibreGL.CameraStop | null>(() => {
    if (!currentStop) return null;
    const paddingVisivel = {
      top: alturaBarraSuperior,
      bottom: alturaPainel,
      left: 0,
      right: 0,
    };

    if (!userLocation) {
      return {
        center: toLngLat(currentStop),
        zoom: zoomFromLongitudeDelta(0.01),
        padding: paddingVisivel,
        duration: 500,
      };
    }

    const distanciaAteParada = calculateHaversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      currentStop.latitude,
      currentStop.longitude,
    );

    if (distanciaAteParada < 1000 && distanciaAteParada >= 30) {
      return {
        bounds: [
          Math.min(userLocation.longitude, currentStop.longitude),
          Math.min(userLocation.latitude, currentStop.latitude),
          Math.max(userLocation.longitude, currentStop.longitude),
          Math.max(userLocation.latitude, currentStop.latitude),
        ],
        padding: {
          top: alturaBarraSuperior + MARGEM_ENQUADRAMENTO,
          bottom: alturaPainel + MARGEM_ENQUADRAMENTO,
          left: MARGEM_ENQUADRAMENTO,
          right: MARGEM_ENQUADRAMENTO,
        },
        duration: 500,
      };
    }

    let delta = 0.005; // < 30 m: chegando, zoom de rua
    if (distanciaAteParada > 10000) delta = 0.05;
    else if (distanciaAteParada > 5000) delta = 0.03;
    else if (distanciaAteParada > 2000) delta = 0.02;
    else if (distanciaAteParada >= 1000) delta = 0.01;

    return {
      center: toLngLat(userLocation),
      zoom: zoomFromLongitudeDelta(delta),
      padding: paddingVisivel,
      duration: 500,
    };
  }, [userLocation, currentStop, alturaBarraSuperior, alturaPainel]);

  // Proximity alert animation (pulse when < 100m)
  useEffect(() => {
    if (distance !== null && distance < 100 && !isPulsingRef.current) {
      isPulsingRef.current = true;
      triggerHaptic('success');
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else if (distance !== null && distance >= 100 && isPulsingRef.current) {
      isPulsingRef.current = false;
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [distance, pulseAnim, triggerHaptic]);

  // Button press animation helpers
  const animateButtonPress = (
    button: 'skip' | 'maps' | 'complete',
    pressed: boolean,
  ) => {
    Animated.spring(buttonScaleAnims[button], {
      toValue: pressed ? 0.95 : 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  // getSpeedColor is now provided by useNavigationModeLogic hook

  // Recenter map on user location
  const recenterMap = useCallback(() => {
    if (cameraRef.current && userLocation) {
      triggerHaptic('impact');
      cameraRef.current.setStop({
        center: toLngLat(userLocation),
        zoom: zoomFromLongitudeDelta(0.005),
        padding: {
          top: alturaBarraSuperior,
          bottom: alturaPainel,
          left: 0,
          right: 0,
        },
        duration: 500,
      });
    }
  }, [userLocation, triggerHaptic, alturaBarraSuperior, alturaPainel]);

  // isEntrega, realParadas, checkpoints, startCheckpoint, endCheckpoint,
  // currentStopIndex, nextStopAfterCurrent are now
  // provided by useNavigationModeLogic hook

  // Dependências primitivas, não o objeto `currentStop`: ele também muda de
  // identidade a cada render, e o memo não valeria nada. Mesmo padrão de
  // `src/hooks/navigation/pip/usePiPRouteInfo.ts:158`.
  const destinoDaNavegacao = useMemo(
    () => ({
      latitude: currentStop?.latitude,
      longitude: currentStop?.longitude,
      address: currentStop?.endereco,
    }),
    [currentStop?.latitude, currentStop?.longitude, currentStop?.endereco],
  );

  const sairDaNavegacao = useCallback(
    () => setNavigationMode('map'),
    [setNavigationMode],
  );

  // As preferências são lidas ao abrir a navegação; o que o motorista muda na
  // engrenagem só valia depois de sair e entrar de novo. Recarregar ao fechar
  // aplica na hora — inclusive ligar o Turn-by-Turn, que troca o modo.
  const fecharConfiguracoes = useCallback(() => {
    setShowSettings(false);
    loadPreferences();
  }, [setShowSettings, loadPreferences]);

  // Loading state
  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Preparando navegação...</Text>
      </View>
    );
  }

  if (!currentStop) return null;

  // Show turn-by-turn navigation if selected
  if (navigationMode === 'turn-by-turn' && userLocation) {
    return (
      <TurnByTurnNavigation
        origin={userLocation}
        destination={destinoDaNavegacao}
        onArrive={concluirNaChegada}
        onExit={sairDaNavegacao}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapLibreGL.Map
        testID="map-view"
        style={styles.map}
        mapStyle={OPENFREEMAP_STYLE_URL}
        touchRotate={false}
        touchPitch={false}
        compass={false}
        logo={false}
        attribution={true}
      >
        {cameraSettings && (
          <MapLibreGL.Camera ref={cameraRef} {...cameraSettings} />
        )}

        {userLocation && (
          <MapLibreGL.Marker lngLat={toLngLat(userLocation)} anchor="center">
            <View style={styles.userLocationMarker}>
              <View style={styles.userLocationDot} />
            </View>
          </MapLibreGL.Marker>
        )}

        {/* Current Destination Marker (parada atual) */}
        <MapLibreGL.Marker
          lngLat={toLngLat({
            latitude: currentStop.latitude,
            longitude: currentStop.longitude,
          })}
          anchor="center"
        >
          <View
            style={[
              styles.currentDestinationMarker,
              isEntrega
                ? styles.currentDestinationEntrega
                : styles.currentDestinationRetirada,
            ]}
          >
            <Ionicons
              name={isEntrega ? 'cube' : 'arrow-up-circle'}
              size={18}
              color={theme.colors.white}
            />
          </View>
        </MapLibreGL.Marker>

        {/* Other pending stops (excluding current and checkpoints) */}
        {realParadas
          .filter((p) => p.id !== currentStop.id && p.status === 'pendente')
          .map((parada) => {
            const isNextStop = nextStopAfterCurrent?.id === parada.id;
            return (
              <MapLibreGL.Marker
                key={parada.id}
                lngLat={toLngLat({
                  latitude: parada.latitude,
                  longitude: parada.longitude,
                })}
                anchor="center"
              >
                <View
                  style={[
                    styles.otherMarker,
                    isNextStop && styles.nextStopMarker,
                    !isNextStop && { opacity: 0.6 },
                  ]}
                >
                  <Text
                    style={[
                      styles.markerText,
                      isNextStop && styles.nextStopMarkerText,
                    ]}
                  >
                    {parada.ordem}
                  </Text>
                </View>
              </MapLibreGL.Marker>
            );
          })}

        {/* Route Polyline */}
        {routeShape && (
          <MapLibreGL.GeoJSONSource id="rota-navigation" data={routeShape}>
            <MapLibreGL.Layer
              id="rota-navigation-line"
              type="line"
              paint={{ 'line-color': theme.colors.primary, 'line-width': 4 }}
            />
          </MapLibreGL.GeoJSONSource>
        )}

        {/* Start Checkpoint Marker (ponto de partida) */}
        {startCheckpoint && startCheckpoint.id !== currentStop.id && (
          <MapLibreGL.Marker
            lngLat={toLngLat({
              latitude: startCheckpoint.latitude,
              longitude: startCheckpoint.longitude,
            })}
            anchor="center"
          >
            <View style={styles.checkpointMarker}>
              <Ionicons name="flag" size={14} color={theme.colors.success} />
            </View>
          </MapLibreGL.Marker>
        )}

        {/* End Checkpoint Marker (ponto de chegada/retorno) */}
        {endCheckpoint && endCheckpoint.id !== currentStop.id && (
          <MapLibreGL.Marker
            lngLat={toLngLat({
              latitude: endCheckpoint.latitude,
              longitude: endCheckpoint.longitude,
            })}
            anchor="center"
          >
            <View style={styles.checkpointMarker}>
              <Ionicons name="home" size={14} color={theme.colors.info} />
            </View>
          </MapLibreGL.Marker>
        )}
      </MapLibreGL.Map>

      {/* Top Bar */}
      <View
        testID="nav-barra-superior"
        onLayout={(e) => setAlturaBarraSuperior(e.nativeEvent.layout.height)}
        style={[styles.topBar, { paddingTop: insets.top + theme.spacing.sm }]}
      >
        <TouchableOpacity
          style={styles.exitButton}
          onPress={handleExitNavigation}
        >
          <Ionicons name="close" size={24} color={theme.colors.white} />
        </TouchableOpacity>

        {isTracking && (
          <View style={styles.trackingBadge}>
            <View style={styles.trackingDot} />
            <Text style={styles.trackingText}>Rastreando</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
          accessibilityRole="button"
          accessibilityLabel="Configurações da navegação"
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
          testID="nav-recentralizar"
          style={[
            styles.recenterButton,
            { bottom: alturaPainel + theme.spacing.md },
          ]}
          onPress={recenterMap}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      )}

      {/* Navigation Info Panel */}
      {/* Usa Math.max para garantir mínimo de 34px (Android 15 pode retornar insets.bottom = 0) */}
      <View
        testID="nav-painel"
        onLayout={(e) => setAlturaPainel(e.nativeEvent.layout.height)}
        style={[
          styles.infoPanel,
          { paddingBottom: theme.spacing.xl + Math.max(insets.bottom, 34) },
        ]}
      >
        <NavigationInfoPanel
          currentStop={currentStop}
          nextStop={nextStop}
          realParadas={realParadas}
          currentStopIndex={currentStopIndex}
          distance={distance}
          eta={eta}
          speed={speed}
          isEntrega={isEntrega}
          preferences={preferences}
          pulseAnim={pulseAnim}
          buttonScaleAnims={buttonScaleAnims}
          formatDistance={formatDistance}
          getSpeedColor={getSpeedColor}
          onAnimateButtonPress={animateButtonPress}
          onComplete={handleCompleteStop}
          onSkip={handleSkipStop}
          onOpenInMaps={handleOpenInMaps}
        />
      </View>

      {/* Settings Modal */}
      {showSettings && (
        <View style={styles.settingsOverlay}>
          <NavigationSettings
            visible={showSettings}
            onClose={fecharConfiguracoes}
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray600,
    fontFamily: theme.typography.fontSans,
  },
  map: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    backgroundColor: withOpacity(theme.colors.black, 0.5),
  },
  exitButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: withOpacity(theme.colors.black, 0.3),
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: withOpacity(theme.colors.black, 0.3),
    justifyContent: 'center',
    alignItems: 'center',
  },
  recenterButton: {
    position: 'absolute',
    right: theme.spacing.lg,
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  trackingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
    backgroundColor: withOpacity(theme.colors.success, 0.9),
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.borderRadius.xl,
  },
  trackingDot: {
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    borderRadius: theme.spacing.xs,
    backgroundColor: theme.colors.white,
  },
  trackingText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    // paddingBottom é definido dinamicamente com Math.max(insets.bottom, 34)
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  // Current destination (parada atual em navegação) marker
  currentDestinationMarker: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    borderWidth: 3,
    borderColor: theme.colors.white,
  },
  userLocationMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: withOpacity(theme.colors.info, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  userLocationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.info,
  },
  currentDestinationEntrega: {
    backgroundColor: theme.colors.error,
  },
  currentDestinationRetirada: {
    backgroundColor: theme.colors.warning,
  },
  // Checkpoint markers (start/end)
  checkpointMarker: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    borderWidth: 2,
    borderColor: theme.colors.gray200,
  },
  // Other pending stops marker
  otherMarker: {
    backgroundColor: theme.colors.gray400,
    width: 24,
    height: 24,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  // Next stop marker (highlighted)
  nextStopMarker: {
    backgroundColor: theme.colors.warning,
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.full,
    borderWidth: 2,
    borderColor: theme.colors.white,
    shadowColor: theme.colors.warning,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },
  markerText: {
    color: theme.colors.white,
    fontSize: 10,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  nextStopMarkerText: {
    fontSize: 11,
    fontFamily: theme.typography.fontSansBold,
  },
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
}));
