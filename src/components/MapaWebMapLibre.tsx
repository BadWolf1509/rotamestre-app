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

import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';

import { useMotoristaLocationMapLibre } from '@/components/map/hooks/useMotoristaLocationMapLibre';
import { acaoDoToqueNoPino } from '@/components/map/toqueNoPino';
import { useRouteDirections, type RouteInfo } from '@/hooks/useRouteDirections';
import { logger } from '@/lib/logger';
import { configureMaplibreWorker } from '@/lib/maplibreWorker';
import {
  montarPinosPorLocal,
  type PinoPorLocal,
} from '@/lib/motorista/pinosPorLocal';
import { rotuloTipoParada } from '@/lib/motorista/rotuloTipoParada';
import {
  getOpenFreeMapStyle,
  installOpenFreeMapMissingImageHandler,
} from '@/lib/openFreeMapStyle';
import { escapeHtml } from '@/lib/utils';
import type { ParadaMapItem as Parada, StatusFilter } from '@/types/parada-map';
import { withOpacity } from '@/utils/color';
import { getMarkerColorExpression } from '@/utils/mapMarkerColors';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// maplibre-gl v6 precisa do web worker servido de public/ (ver maplibreWorker.ts).
configureMaplibreWorker();

interface MapaWebMapLibreProps {
  paradas: Parada[];
  selectedParadaId?: string | null;
  onMarkerPress?: (paradaId: string) => void;
  /** Clique no pino já selecionado, ou no "Ver ações" do popup. */
  onSelectedMarkerPress?: (paradaId: string) => void;
  onMapPress?: () => void;
  statusFilter?: StatusFilter;
  rotaId?: string;
  motoristaNome?: string;
  showMotorista?: boolean;
  unidadeNome?: string;
  polyline?: string | null;
  storedRouteInfo?: RouteInfo | null;
}

// Default center (Brasília)
const DEFAULT_CENTER: [number, number] = [-47.8822, -15.7942];
const DEFAULT_ZOOM = 13;

function toNumber(value: number | null): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Botão do popup que abre as ações da parada (paridade com a dica "Toque
 * para ver ações" do balão nativo). O clique é ligado em `openPopup` pelo
 * `data-acao`.
 */
export function htmlBotaoVerAcoes(cor: string): string {
  return `<button type="button" data-acao="ver-acoes" style="margin-top: 6px; padding: 0; border: none; background: none; cursor: pointer; font-size: 13px; font-weight: 600; color: ${cor};">Ver ações ›</button>`;
}

/**
 * Create popup HTML content
 */
function createPopupContent(
  parada: Parada,
  isCheckpoint: boolean,
  isPartida: boolean,
  unidadeNome: string | undefined,
  theme: Theme,
  comAcoes: boolean,
): string {
  if (isCheckpoint) {
    const title = isPartida ? '🚀 Ponto de Partida' : '🏁 Ponto de Chegada';
    const subtitle = isPartida ? 'Início da rota' : 'Fim da rota';
    return `
      <div style="padding: 8px; max-width: 250px; font-family: system-ui, -apple-system, sans-serif;">
        <strong style="font-size: 14px;">${title}</strong>
        <p style="margin: 4px 0; font-size: 12px; color: ${theme.colors.textSecondary};">${subtitle}</p>
        ${unidadeNome ? `<p style="margin: 4px 0; font-size: 12px;"><strong>Unidade:</strong> ${escapeHtml(unidadeNome)}</p>` : ''}
        <p style="margin: 4px 0; font-size: 12px;">${escapeHtml(parada.endereco)}</p>
      </div>
    `;
  }

  const tipoLabel = parada.tipo === 'entrega' ? '📦 Entrega' : '📤 Retirada';

  return `
    <div style="padding: 8px; max-width: 280px; font-family: system-ui, -apple-system, sans-serif;">
      <strong style="font-size: 14px;">Parada ${escapeHtml(String(parada.ordem))}</strong>
      <span style="margin-left: 8px; font-size: 12px; color: ${theme.colors.textSecondary};">${tipoLabel}</span>
      <p style="margin: 4px 0; font-size: 12px; color: ${theme.colors.textSecondary};">${STATUS_LABEL[parada.status] || escapeHtml(parada.status)}</p>
      <p style="margin: 4px 0; font-size: 12px;">${escapeHtml(parada.endereco)}</p>
      ${parada.destinatario ? `<p style="margin: 4px 0; font-size: 12px;"><strong>Destinatário:</strong> ${escapeHtml(parada.destinatario)}</p>` : ''}
      ${parada.telefone ? `<p style="margin: 4px 0; font-size: 12px;"><strong>Telefone:</strong> ${escapeHtml(parada.telefone)}</p>` : ''}
      ${comAcoes ? htmlBotaoVerAcoes(theme.colors.primary) : ''}
    </div>
  `;
}

const STATUS_LABEL: Record<string, string> = {
  pendente: '🟡 Pendente',
  em_andamento: '🔵 Em andamento',
  concluida: '✅ Concluída',
  pulada: '⏭️ Pulada',
};

/**
 * Popup do pino que reúne vários serviços do mesmo local: um endereço,
 * uma linha por serviço.
 */
export function createGrupoPopupContent(
  membros: Parada[],
  textSecondary: string,
  /** Cor do "Ver ações"; sem ela, o popup não oferece as ações. */
  corAcoes?: string,
): string {
  const ordens = membros.map((m) => m.ordem);
  const titulo = `Paradas ${ordens.slice(0, -1).join(', ')} e ${ordens[ordens.length - 1]}`;
  const linhas = membros
    .map((m) => {
      const tipo = rotuloTipoParada(m.tipo ?? '').titulo;
      const status = STATUS_LABEL[m.status] || escapeHtml(m.status);
      return `<p style="margin: 4px 0; font-size: 12px;"><strong>${escapeHtml(String(m.ordem))} · ${escapeHtml(tipo)}</strong> <span style="color: ${textSecondary};">${status}</span></p>`;
    })
    .join('');
  const destinatarios = [
    ...new Set(membros.map((m) => m.destinatario).filter(Boolean)),
  ] as string[];

  return `
    <div style="padding: 8px; max-width: 280px; font-family: system-ui, -apple-system, sans-serif;">
      <strong style="font-size: 14px;">${escapeHtml(titulo)}</strong>
      <p style="margin: 4px 0; font-size: 12px;">${escapeHtml(membros[0].endereco)}</p>
      ${linhas}
      ${destinatarios.length ? `<p style="margin: 4px 0; font-size: 12px;"><strong>Destinatário:</strong> ${destinatarios.map((d) => escapeHtml(d)).join(', ')}</p>` : ''}
      ${corAcoes ? htmlBotaoVerAcoes(corAcoes) : ''}
    </div>
  `;
}

/** Features do GeoJSON: checkpoints à parte, um pino por local nas paradas. */
export function montarFeaturesDosMarcadores(
  checkpoints: Parada[],
  pinos: Array<PinoPorLocal<Parada>>,
  selectedParadaId: string | null | undefined,
) {
  const partidaId = checkpoints[0]?.id;

  const doCheckpoint = checkpoints.map((parada) => {
    const isPartida = parada.id === partidaId;
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [parada.longitude as number, parada.latitude as number],
      },
      properties: {
        id: parada.id,
        status: parada.status,
        ordem: parada.ordem,
        // Emoji para casar com os ícones dos checkpoints no mobile.
        // Se o servidor de fontes do GL não tiver o glifo, volte para 'I'/'F'.
        label: isPartida ? '\u{1F6A9}' : '\u{1F3E0}',
        is_checkpoint: true,
        is_partida: isPartida,
        is_selected: parada.id === selectedParadaId,
      },
    };
  });

  const dasParadas = pinos.map(({ principal, membros, rotulo }) => ({
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [
        principal.longitude as number,
        principal.latitude as number,
      ],
    },
    properties: {
      id: principal.id,
      status: principal.status,
      ordem: principal.ordem,
      label: rotulo,
      is_checkpoint: false,
      is_partida: false,
      is_selected: membros.some((m) => m.id === selectedParadaId),
    },
  }));

  return [...doCheckpoint, ...dasParadas];
}

export default function MapaWebMapLibre({
  paradas,
  selectedParadaId,
  onMarkerPress,
  onSelectedMarkerPress,
  onMapPress,
  statusFilter = 'all',
  rotaId,
  motoristaNome,
  showMotorista = false,
  unidadeNome,
  polyline,
  storedRouteInfo,
}: MapaWebMapLibreProps) {
  const { theme } = useUnistyles();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const motoristaMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Lidos dentro de handlers do maplibre registrados em efeitos: por ref,
  // para o efeito dos marcadores (que faz o fitBounds) não re-rodar a cada
  // seleção. No clique, a ref ainda tem a seleção de ANTES do onMapPress
  // que o mesmo clique dispara — é o que a decisão do toque precisa.
  const selectedParadaIdRef = useRef(selectedParadaId);
  const onSelectedMarkerPressRef = useRef(onSelectedMarkerPress);
  useEffect(() => {
    selectedParadaIdRef.current = selectedParadaId;
    onSelectedMarkerPressRef.current = onSelectedMarkerPress;
  }, [selectedParadaId, onSelectedMarkerPress]);
  const temAcoes = onSelectedMarkerPress != null;

  // Live driver location — hook called unconditionally (rules of hooks).
  // Pass rotaId only when showMotorista=true to gate Supabase subscription.
  const { location: motoristaLocation } = useMotoristaLocationMapLibre(
    showMotorista ? rotaId : undefined,
  );

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
    if (statusFilter === 'all') return paradasReais;
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

  const {
    routeCoordinates,
    error: routeError,
    refetch: refetchRoute,
  } = useRouteDirections(paradasComCoord, {
    encodedPolyline: polyline,
    storedRouteInfo,
  });

  const polylineCoordinates = useMemo(() => {
    return routeCoordinates
      .map((coord) => [coord.longitude, coord.latitude] as [number, number])
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  }, [routeCoordinates]);

  const pinos = useMemo(
    () => montarPinosPorLocal(paradasFiltradas),
    [paradasFiltradas],
  );

  const paradaLookup = useMemo(() => {
    const map = new Map<string, Parada>();
    paradasComCoord.forEach((parada) => {
      map.set(parada.id, parada);
    });
    return map;
  }, [paradasComCoord]);

  // Qualquer serviço do local (não só a principal) leva ao mesmo pino.
  const pinoPorParadaId = useMemo(() => {
    const map = new Map<string, PinoPorLocal<Parada>>();
    pinos.forEach((pino) => {
      pino.membros.forEach((m) => map.set(m.id, pino));
    });
    return map;
  }, [pinos]);

  const markerFeatures = useMemo(
    () => montarFeaturesDosMarcadores(checkpoints, pinos, selectedParadaId),
    [checkpoints, pinos, selectedParadaId],
  );

  // Open popup for a parada
  const openPopup = useCallback(
    (
      parada: Parada,
      isCheckpoint: boolean,
      isPartida: boolean,
      membros: Parada[] = [parada],
    ) => {
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
        maxWidth: '300px',
      })
        .setLngLat([parada.longitude, parada.latitude])
        .setHTML(
          membros.length > 1
            ? createGrupoPopupContent(
                membros,
                theme.colors.textSecondary,
                temAcoes ? theme.colors.primary : undefined,
              )
            : createPopupContent(
                parada,
                isCheckpoint,
                isPartida,
                unidadeNome,
                theme,
                temAcoes && !isCheckpoint,
              ),
        )
        .addTo(mapRef.current);

      popupRef.current
        .getElement()
        ?.querySelector('[data-acao="ver-acoes"]')
        ?.addEventListener('click', () =>
          onSelectedMarkerPressRef.current?.(parada.id),
        );
    },
    [unidadeNome, theme, temAcoes],
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

        mapInstance.on('load', () => {
          setMapLoaded(true);
          logger.info('[MapaWebMapLibre] Map loaded successfully');
        });

        mapInstance.on('error', (e) => {
          logger.error('[MapaWebMapLibre] Map error:', e);
          setLoadError('Erro ao carregar o mapa');
        });

        mapInstance.on('click', () => {
          if (popupRef.current) {
            popupRef.current.remove();
            popupRef.current = null;
          }
          onMapPress?.();
        });

        // Add navigation controls
        mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');

        mapRef.current = mapInstance;
      } catch (error) {
        if (cancelled) return;
        logger.error('[MapaWebMapLibre] Failed to initialize map:', error);
        setLoadError('Erro ao inicializar o mapa');
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
    if (!mapRef.current || !mapLoaded) return;

    const map = mapRef.current;
    if (!(map as unknown as { style?: unknown }).style) return;
    const sourceId = 'route-source';
    const layerId = 'route-layer';

    // Remove existing route if any
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }

    if (polylineCoordinates.length < 2) return;

    // Add route source
    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: polylineCoordinates,
        },
      },
    });

    // Add route layer
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': theme.colors.primary,
        'line-width': 4,
        'line-opacity': 0.8,
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

    const sourceId = 'paradas-source';
    const circleLayerId = 'paradas-circle';
    const labelLayerId = 'paradas-label';

    const data = {
      type: 'FeatureCollection' as const,
      features: markerFeatures,
    };

    // Centralized marker colors from statusConfig (WCAG-compliant dark variants)
    const circleColorExpression = getMarkerColorExpression(
      theme.colors,
    ) as maplibregl.ExpressionSpecification;

    // Radius: checkpoints 18, regular 16, selected +4
    const circleRadiusExpression: maplibregl.ExpressionSpecification = [
      'case',
      [
        'all',
        ['==', ['get', 'is_selected'], true],
        ['==', ['get', 'is_checkpoint'], true],
      ],
      22,
      ['==', ['get', 'is_selected'], true],
      20,
      ['==', ['get', 'is_checkpoint'], true],
      18,
      16,
    ];

    // Stroke width: selected 4px, default 3px for depth
    const circleStrokeWidthExpression: maplibregl.ExpressionSpecification = [
      'case',
      ['==', ['get', 'is_selected'], true],
      4,
      3,
    ];

    // Subtle blur for selected markers (shadow effect)
    const circleBlurExpression: maplibregl.ExpressionSpecification = [
      'case',
      ['==', ['get', 'is_selected'], true],
      0.4,
      0,
    ];

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(data);
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data,
      });
    }

    if (!map.getLayer(circleLayerId)) {
      map.addLayer({
        id: circleLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-color': circleColorExpression,
          'circle-radius': circleRadiusExpression,
          'circle-stroke-color': theme.colors.white,
          'circle-stroke-width': circleStrokeWidthExpression,
          'circle-blur': circleBlurExpression,
        },
      });
    } else {
      map.setPaintProperty(
        circleLayerId,
        'circle-color',
        circleColorExpression,
      );
      map.setPaintProperty(
        circleLayerId,
        'circle-radius',
        circleRadiusExpression,
      );
      map.setPaintProperty(
        circleLayerId,
        'circle-stroke-width',
        circleStrokeWidthExpression,
      );
      map.setPaintProperty(circleLayerId, 'circle-blur', circleBlurExpression);
    }

    if (!map.getLayer(labelLayerId)) {
      map.addLayer({
        id: labelLayerId,
        type: 'symbol',
        source: sourceId,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': ['case', ['==', ['get', 'is_checkpoint'], true], 16, 13],
          // Use a single font stack available in the OpenFreeMap sprites
          // to avoid 404s for combined font stacks.
          'text-font': ['Noto Sans Bold'],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': theme.colors.white,
          'text-halo-color': withOpacity(theme.colors.black, 0.3),
          'text-halo-width': 0.8,
        },
      });
    }

    const handleMarkerClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      const id = feature?.properties?.id as string | undefined;
      if (!id) return;

      const pino = pinoPorParadaId.get(id);
      const parada = pino?.principal ?? paradaLookup.get(id);
      if (!parada) return;

      const rawCheckpoint = feature?.properties?.is_checkpoint;
      const rawPartida = feature?.properties?.is_partida;
      const isCheckpoint = rawCheckpoint === true || rawCheckpoint === 'true';
      const isPartida = rawPartida === true || rawPartida === 'true';

      if (!isCheckpoint) {
        const acao = acaoDoToqueNoPino(
          pino?.membros ?? [parada],
          selectedParadaIdRef.current,
          onSelectedMarkerPressRef.current != null,
        );
        if (acao === 'abrir-acoes') {
          onSelectedMarkerPressRef.current?.(parada.id);
        } else {
          onMarkerPress?.(parada.id);
        }
      }
      openPopup(parada, isCheckpoint, isPartida, pino?.membros);
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', circleLayerId, handleMarkerClick);
    map.on('click', labelLayerId, handleMarkerClick);
    map.on('mouseenter', circleLayerId, handleMouseEnter);
    map.on('mouseleave', circleLayerId, handleMouseLeave);
    map.on('mouseenter', labelLayerId, handleMouseEnter);
    map.on('mouseleave', labelLayerId, handleMouseLeave);

    // Fit bounds
    if (bounds && mapRef.current) {
      mapRef.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15,
        duration: 500,
      });
    }

    return () => {
      map.off('click', circleLayerId, handleMarkerClick);
      map.off('click', labelLayerId, handleMarkerClick);
      map.off('mouseenter', circleLayerId, handleMouseEnter);
      map.off('mouseleave', circleLayerId, handleMouseLeave);
      map.off('mouseenter', labelLayerId, handleMouseEnter);
      map.off('mouseleave', labelLayerId, handleMouseLeave);
    };
  }, [
    mapLoaded,
    markerFeatures,
    bounds,
    theme,
    onMarkerPress,
    openPopup,
    paradaLookup,
    pinoPorParadaId,
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

    const pino = pinoPorParadaId.get(parada.id);
    const alvo = pino?.principal ?? parada;
    openPopup(alvo, isCheckpoint, isPartida, pino?.membros);

    // Pan to marker
    if (alvo.latitude != null && alvo.longitude != null) {
      mapRef.current.flyTo({
        center: [alvo.longitude, alvo.latitude],
        zoom: 15,
        duration: 500,
      });
    }
  }, [
    selectedParadaId,
    paradasComCoord,
    checkpoints,
    pinoPorParadaId,
    mapLoaded,
    openPopup,
  ]);

  // Render live motorista marker as a DOM Marker.
  // On first render: creates the element and marker, stores it in motoristaMarkerRef.
  // On subsequent location changes: reuses the existing marker via setLngLat (no re-create).
  // When location becomes null: removes the marker and clears the ref.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (!motoristaLocation) {
      motoristaMarkerRef.current?.remove();
      motoristaMarkerRef.current = null;
      return;
    }

    const lngLat: [number, number] = [
      motoristaLocation.longitude,
      motoristaLocation.latitude,
    ];

    if (motoristaMarkerRef.current) {
      // Existing marker — just move it, no DOM re-create
      motoristaMarkerRef.current.setLngLat(lngLat);
      return;
    }

    // First render — create element + marker
    const el = document.createElement('div');
    el.className = 'motorista-marker';
    el.setAttribute('role', 'img');
    el.setAttribute(
      'aria-label',
      motoristaNome ? `Motorista: ${motoristaNome}` : 'Motorista',
    );
    // Use the theme primary color from design tokens — no hardcoded colors
    el.style.cssText = `width:20px;height:20px;border-radius:50%;background:${theme.colors.primary};border:3px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,0.2);cursor:pointer;`;

    motoristaMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat(lngLat)
      .addTo(map);
  }, [mapLoaded, motoristaLocation, motoristaNome, theme.colors.primary]);

  // Unmount cleanup: remove the motorista marker if it exists
  useEffect(() => {
    return () => {
      motoristaMarkerRef.current?.remove();
      motoristaMarkerRef.current = null;
    };
  }, []);

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
          width: '100%',
          height: '100%',
          minHeight: 400,
        }}
      />
      {!mapLoaded && (
        // O testID é o gancho dos testes: `mapLoaded` só vira true no evento
        // `load` do maplibre, então a ausência deste nó significa que o mapa
        // terminou de carregar de verdade. Sem ele, o único sinal seria o texto
        // do rótulo — e screenshot não serve, porque os testes mascaram o mapa.
        <View style={styles.loadingOverlay} testID="mapa-web-carregando">
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Carregando mapa...</Text>
        </View>
      )}
      {routeError && polylineCoordinates.length < 2 && (
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
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: 400,
    position: 'relative',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.disabled,
  },
  loadingText: {
    marginTop: theme.spacing['2.5'],
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.errorLight,
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error,
  },
  routeErrorBadge: {
    position: 'absolute',
    top: theme.spacing['3'],
    left: theme.spacing['3'],
    maxWidth: 260,
    backgroundColor: withOpacity(theme.colors.error, 0.94),
    paddingHorizontal: theme.spacing['3'],
    paddingVertical: theme.spacing['2'],
    borderRadius: theme.borderRadius.md,
  },
  routeErrorText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.white,
    textAlign: 'center',
  },
}));
