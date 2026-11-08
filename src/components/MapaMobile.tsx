import * as MapLibreGL from '@maplibre/maplibre-react-native';
import React, { useRef, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';

import { CORES_SOBRE_O_MAPA } from '@/components/map/coresSobreOMapa';
import { useLocationTracking } from '@/components/map/hooks/useLocationTracking';
import { useMarkerGestures } from '@/components/map/hooks/useMarkerGestures';
import { useMobileMapCamera } from '@/components/map/hooks/useMobileMapCamera';
import { useNavigationActions } from '@/components/map/hooks/useNavigationActions';
import { useParadaFiltering } from '@/components/map/hooks/useParadaFiltering';
import { useRouteShape } from '@/components/map/hooks/useRouteShape';
import { BalaoSobreposto } from '@/components/map/mobile/BalaoSobreposto';
import { FloatingActionButtons } from '@/components/map/mobile/FloatingActionButtons';
import { CheckpointCallout } from '@/components/map/mobile/markers/CheckpointCallout';
import { ParadaCallout } from '@/components/map/mobile/markers/ParadaCallout';
import { ParadaMarker } from '@/components/map/mobile/markers/ParadaMarker';
import { mapMobileStyles as styles } from '@/components/map/mobile/styles';
import { useBalaoSobreposto } from '@/components/map/mobile/useBalaoSobreposto';
import { PinoDaUnidade } from '@/components/map/PinoDaUnidade';
import {
  pontoQueContem,
  pontosDaUnidade,
} from '@/components/map/pontosDaUnidade';
import { acaoDoToqueNoPino } from '@/components/map/toqueNoPino';
import { MotoristaMarker } from '@/components/MotoristaMarker';
import { useAlert } from '@/hooks/useAlert';
import { formatarDecimal } from '@/lib/formatNumber';
import { OPENFREEMAP_STYLE_URL, toLngLat } from '@/lib/maplibre';
import { montarPinosPorLocal } from '@/lib/motorista/pinosPorLocal';
import type {
  MapaAdapterProps,
  ParadaMapItem as Parada,
} from '@/types/parada-map';
import { useUnistyles } from '@/utils/styles';

import type { MapRef } from '@maplibre/maplibre-react-native';

interface MapaMobileProps extends MapaAdapterProps {
  /**
   * Long-press no marcador. Não dispara no nativo: o Marker do Android não
   * expõe long press (maplibre-react-native#1729) e nenhuma tela o usa.
   */
  onMarkerLongPress?: (paradaId: string) => void;
}

/**
 * Lado do pino da unidade (sede, ou partida/chegada) — `PinoDaUnidade`. O pino
 * é quadrado e ancorado no centro: sobre a coordenada só fica metade dele.
 */
const ALTURA_PINO_CHECKPOINT = 28;

/**
 * Toque no pino. No Android o filho do <Marker> é reposicionado fora do
 * Fabric, e um Pressable dentro dele nunca dispara onPress (o measure() vê a
 * posição errada): quem recebe o toque é o mapa nativo, que o entrega ao
 * onPress do próprio Marker. O evento sobe por bubbling até o onPress do Map,
 * que desfaria a seleção na mesma renderização (maplibre-react-native#1618).
 */
function aoTocarPino(acao: () => void) {
  return (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    acao();
  };
}

export function MapaMobile({
  paradas,
  selectedParadaId,
  onMarkerPress,
  onSelectedMarkerPress,
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
  const { handleMarkerPress, handleMapPress, handleCopyAddress } =
    useMarkerGestures({
      onMarkerPress,
      onMarkerLongPress,
      onMapPress,
      setSelectedCheckpointId,
    });

  // Navigation: next stop + fit-all + open external nav app
  const { proximaParadaPendente, handleNavigate, handleFitAll } =
    useNavigationActions(paradasReais, paradasComCoord as Parada[], cameraRef);

  // Toque no pino já selecionado: abre as ações e fecha o balão do
  // checkpoint, como o 1º toque (handleMarkerPress) já faz.
  const abrirAcoes = (paradaId: string) => {
    setSelectedCheckpointId(null);
    onSelectedMarkerPress?.(paradaId);
  };

  // Um pino por local: serviços no mesmo ponto saem juntos ("3+4").
  const pinos = montarPinosPorLocal(paradasFiltradas);

  // Partida e chegada: um pino de sede quando coincidem (100% das rotas em
  // 08/11/2026), um de cada quando não.
  const pontosUnidade = pontosDaUnidade(checkpoints);

  // Um balão por vez, sobre o mapa: o do pino da unidade, se houver; senão o
  // da parada selecionada.
  // O id vem do toque no pino (selectedCheckpointId) ou de fora
  // (selectedParadaId: o gestor seleciona a partida/chegada pela lista).
  const checkpointSelecionado =
    pontoQueContem(pontosUnidade, selectedCheckpointId) ??
    pontoQueContem(pontosUnidade, selectedParadaId) ??
    null;
  const pinoSelecionado = checkpointSelecionado
    ? null
    : (pinos.find((p) => p.membros.some((m) => m.id === selectedParadaId)) ??
      null);
  const selecionado =
    checkpointSelecionado?.ponto ?? pinoSelecionado?.principal;

  const mapRef = useRef<MapRef>(null);
  const [areaDoMapa, setAreaDoMapa] = useState<{
    largura: number;
    altura: number;
  } | null>(null);
  const { ponto, onRegionWillChange, onRegionDidChange } = useBalaoSobreposto({
    mapRef,
    cameraRef,
    alturaDoMapa: areaDoMapa?.altura ?? null,
    alvo: selecionado
      ? toLngLat({
          latitude: selecionado.latitude!,
          longitude: selecionado.longitude!,
        })
      : null,
  });

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
        ref={mapRef}
        style={styles.map}
        mapStyle={OPENFREEMAP_STYLE_URL}
        logo={false}
        attribution={true}
        compass={true}
        onPress={handleMapPress}
        onRegionWillChange={onRegionWillChange}
        onRegionDidChange={onRegionDidChange}
      >
        <MapLibreGL.Camera ref={cameraRef} initialViewState={initialCamera} />

        {/* Somente geometria viária real (persistida, cache ou OSRM). */}
        {routeShape && (
          <MapLibreGL.GeoJSONSource id="rota" data={routeShape}>
            <MapLibreGL.Layer
              id="rota-line"
              type="line"
              paint={{
                'line-color': CORES_SOBRE_O_MAPA.marca,
                'line-width': 4,
              }}
            />
          </MapLibreGL.GeoJSONSource>
        )}

        {/* Pinos da unidade: sede, ou partida e chegada (pontosDaUnidade) */}
        {pontosUnidade.map(({ ponto, membros, tipo }) => (
          <MapLibreGL.Marker
            key={ponto.id}
            lngLat={toLngLat({
              latitude: ponto.latitude!,
              longitude: ponto.longitude!,
            })}
            anchor="center"
            onPress={aoTocarPino(() => {
              // O pino barra a propagação, então o onPress do mapa (que limpa
              // a parada selecionada) não chega: avisa aqui, como o web.
              onMapPress?.();
              setSelectedCheckpointId((prev) =>
                prev === ponto.id ? null : ponto.id,
              );
            })}
          >
            <PinoDaUnidade ponto={{ ponto, membros, tipo }} tamanho={28} />
          </MapLibreGL.Marker>
        ))}

        {/* Marcadores das paradas reais (entregas/retiradas) - filtradas por status */}
        {pinos.map(({ principal, membros, rotulo }) => (
          <MapLibreGL.Marker
            key={membros[0].id}
            lngLat={toLngLat({
              latitude: principal.latitude!,
              longitude: principal.longitude!,
            })}
            anchor="bottom"
            onPress={aoTocarPino(() =>
              acaoDoToqueNoPino(
                membros,
                selectedParadaId,
                onSelectedMarkerPress != null,
              ) === 'abrir-acoes'
                ? abrirAcoes(principal.id)
                : handleMarkerPress(principal.id),
            )}
          >
            <ParadaMarker
              parada={principal}
              rotulo={rotulo}
              servicos={membros}
              isSelected={membros.some((m) => m.id === selectedParadaId)}
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

      {/* Balão do pino selecionado, por cima de todos os pinos (ver
          BalaoSobreposto). box-none: só o balão captura toque. */}
      <View
        testID="mapa-camada-balao"
        style={styles.balaoCamada}
        pointerEvents="box-none"
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setAreaDoMapa({ largura: width, altura: height });
        }}
      >
        {checkpointSelecionado && (
          <BalaoSobreposto
            key={checkpointSelecionado.ponto.id}
            ponto={ponto}
            area={areaDoMapa}
            alturaDoPino={ALTURA_PINO_CHECKPOINT / 2}
          >
            <CheckpointCallout
              ponto={checkpointSelecionado}
              unidadeNome={unidadeNome}
              onCopyAddress={handleCopyAddress}
            />
          </BalaoSobreposto>
        )}
        {pinoSelecionado && (
          <BalaoSobreposto
            key={pinoSelecionado.principal.id}
            ponto={ponto}
            area={areaDoMapa}
            alturaDoPino={theme.components.minTouchTarget * 1.1}
          >
            <ParadaCallout
              parada={pinoSelecionado.principal}
              servicos={pinoSelecionado.membros}
              onAbrirAcoes={
                onSelectedMarkerPress
                  ? () => onSelectedMarkerPress(pinoSelecionado.principal.id)
                  : undefined
              }
            />
          </BalaoSobreposto>
        )}
      </View>

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
