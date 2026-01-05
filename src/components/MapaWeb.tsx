/* global google */

import { GoogleMap, useJsApiLoader, DirectionsRenderer } from '@react-google-maps/api';
import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

import {
  buildParadaHeader,
  buildInfoContent,
  buildCheckpointHeader,
  buildCheckpointInfoContent,
  buildMotoristaHeader,
  buildMotoristaInfoContent,
  getStatusColor,
  getStatusLabel,
} from '@/components/map/infoWindowBuilders';
import { supabase } from '@/lib/supabase';
import type { MotoristaLocation } from '@/types/notifications';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';
import { MAP_WEB_SHADOWS } from '@/utils/webTokens';

interface Parada {
  id: string;
  ordem: number;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  destinatario?: string;
  telefone?: string;
  tipo?: string;
  is_checkpoint?: boolean;
}

type StatusFilter = 'all' | 'pendente' | 'em_andamento' | 'concluida';

interface MapaWebProps {
  paradas: Parada[];
  selectedParadaId?: string | null;
  onMarkerPress?: (paradaId: string) => void;
  /** Callback quando clica fora dos marcadores (deselecionar) */
  onMapPress?: () => void;
  /** Filtro de status para exibir apenas paradas com determinado status */
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

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const GOOGLE_MAPS_MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID || '';

const containerStyle = {
  width: '100%',
  height: '100%',
};

/**
 * Adiciona estilos interativos e handlers de teclado ao marcador
 */
function addMarkerInteractivity(
  wrapper: HTMLDivElement,
  onClick: (() => void) | undefined,
  focusColor: string
) {
  // Transição suave para efeitos visuais
  wrapper.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease';

  // Efeito hover - escala maior
  wrapper.addEventListener('mouseenter', () => {
    wrapper.style.transform = 'scale(1.15)';
    wrapper.style.boxShadow = MAP_WEB_SHADOWS.markerHover;
  });

  wrapper.addEventListener('mouseleave', () => {
    wrapper.style.transform = 'scale(1)';
    wrapper.style.boxShadow = MAP_WEB_SHADOWS.markerDefault;
  });

  // Feedback visual ao clicar (press effect)
  wrapper.addEventListener('mousedown', () => {
    wrapper.style.transform = 'scale(0.95)';
  });

  wrapper.addEventListener('mouseup', () => {
    wrapper.style.transform = 'scale(1.15)';
  });

  // Keyboard handlers - Enter/Space ativam o marcador
  wrapper.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Feedback visual
      wrapper.style.transform = 'scale(0.95)';
      setTimeout(() => {
        wrapper.style.transform = 'scale(1)';
      }, 100);
      // Disparar click
      onClick?.();
    }
  });

  // Focus ring para navegação por teclado
  wrapper.addEventListener('focus', () => {
    wrapper.style.outline = `3px solid ${focusColor}`;
    wrapper.style.outlineOffset = '2px';
  });

  wrapper.addEventListener('blur', () => {
    wrapper.style.outline = 'none';
  });
}

function createMarkerContent(
  parada: Parada,
  theme: Theme,
  onClick?: () => void,
  isPartida?: boolean
) {
  const { colors } = theme;
  // Checkpoint (partida/chegada): Pin azul marca com ícones distintos
  if (parada.is_checkpoint === false) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.cursor = 'pointer';
    wrapper.style.transition = 'transform 0.15s ease, filter 0.15s ease';
    wrapper.style.filter = MAP_WEB_SHADOWS.checkpoint;

    // Acessibilidade - distinguir PARTIDA de CHEGADA
    const checkpointLabel = isPartida ? 'Ponto de Partida' : 'Ponto de Chegada';
    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('aria-label', checkpointLabel);
    wrapper.setAttribute('tabindex', '0');

    // Ícone: flag para PARTIDA, home para CHEGADA
    // Cor: Azul marca RotaMestre (tokens)
    const iconSvg = isPartida
      ? // Flag icon (partida)
        `<path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z" fill="white"/>`
      : // Home icon (chegada)
        `<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="white"/>`;

    // Pin azul marca compacto com ícone distinto
    wrapper.innerHTML = `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 6px 6px 6px 2px;
        background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid ${colors.white};
        box-shadow: ${MAP_WEB_SHADOWS.markerDefault};
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          ${iconSvg}
        </svg>
      </div>
    `;

    // Interatividade
    wrapper.addEventListener('mouseenter', () => {
      wrapper.style.transform = 'scale(1.15)';
      wrapper.style.filter = MAP_WEB_SHADOWS.checkpointHover;
    });

    wrapper.addEventListener('mouseleave', () => {
      wrapper.style.transform = 'scale(1)';
      wrapper.style.filter = MAP_WEB_SHADOWS.checkpoint;
    });

    wrapper.addEventListener('mousedown', () => {
      wrapper.style.transform = 'scale(0.9)';
    });

    wrapper.addEventListener('mouseup', () => {
      wrapper.style.transform = 'scale(1.15)';
    });

    // Keyboard handlers
    wrapper.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        wrapper.style.transform = 'scale(0.9)';
        setTimeout(() => {
          wrapper.style.transform = 'scale(1)';
        }, 100);
        onClick?.();
      }
    });

    wrapper.addEventListener('focus', () => {
      wrapper.style.outline = `2px solid ${colors.primary}`;
      wrapper.style.outlineOffset = '2px';
    });

    wrapper.addEventListener('blur', () => {
      wrapper.style.outline = 'none';
    });

    return wrapper;
  }

  // Parada normal: círculo com número
  const wrapper = document.createElement('div');
  wrapper.style.width = '34px';
  wrapper.style.height = '34px';
  wrapper.style.borderRadius = '17px';
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'center';
  wrapper.style.backgroundColor = getStatusColor(parada.status);
  wrapper.style.color = colors.white;
  wrapper.style.fontWeight = '700';
  wrapper.style.fontSize = '14px';
  wrapper.style.border = `2px solid ${colors.white}`;
  wrapper.style.boxShadow = MAP_WEB_SHADOWS.markerDefault;
  wrapper.style.cursor = 'pointer';
  // Acessibilidade
  wrapper.setAttribute('role', 'button');
  wrapper.setAttribute('aria-label', `Parada ${parada.ordem}, ${parada.endereco}, ${getStatusLabel(parada.status)}`);
  wrapper.setAttribute('tabindex', '0');

  const label = document.createElement('span');
  label.textContent = String(parada.ordem);
  label.setAttribute('aria-hidden', 'true');
  wrapper.appendChild(label);

  // Adicionar interatividade (hover, keyboard, click feedback)
  addMarkerInteractivity(wrapper, onClick, colors.primary);

  return wrapper;
}

export default function MapaWeb({
  paradas,
  selectedParadaId,
  onMarkerPress,
  onMapPress,
  statusFilter = 'all',
  rotaId,
  motoristaNome,
  showMotorista = false,
  unidadeNome,
}: MapaWebProps) {
  const { theme } = useUnistyles();
  const [directions, setDirections] = React.useState<google.maps.DirectionsResult | null>(null);
  const mapRef = React.useRef<google.maps.Map | null>(null);
  const advancedMarkersRef = React.useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const fallbackMarkersRef = React.useRef<google.maps.Marker[]>([]);
  const markerMapRef = React.useRef<Map<string, google.maps.marker.AdvancedMarkerElement | google.maps.Marker>>(new Map());
  const infoWindowRef = React.useRef<google.maps.InfoWindow | null>(null);
  const [mapReady, setMapReady] = React.useState(false);
  const boundsRef = React.useRef<google.maps.LatLngBounds | null>(null);
  const legendControlRef = React.useRef<HTMLDivElement | null>(null);
  const recenterControlRef = React.useRef<HTMLDivElement | null>(null);

  // Estado para localização do motorista em tempo real
  const [motoristaLocation, setMotoristaLocation] = useState<MotoristaLocation | null>(null);
  const motoristaMarkerRef = React.useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null);
  const motoristaInfoWindowRef = React.useRef<google.maps.InfoWindow | null>(null);

  // Carrega 'marker' para AdvancedMarkerElement e 'places' para autocomplete/geocoding
  const mapLibraries = React.useMemo(() => ['marker', 'places'] as ('marker' | 'places')[], []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: mapLibraries,
    version: 'beta', // Necessário para usar headerContent no InfoWindow
  });

  // Paradas com coordenadas válidas
  const paradasComCoord = React.useMemo(
    () => paradas.filter((p) => p.latitude != null && p.longitude != null),
    [paradas]
  );

  // Separar paradas reais de checkpoints (pontos da unidade)
  const paradasReais = React.useMemo(
    () => paradasComCoord.filter((p) => p.is_checkpoint !== false),
    [paradasComCoord]
  );

  // Checkpoints (partida/chegada) - sempre visíveis
  const checkpoints = React.useMemo(
    () => paradasComCoord.filter((p) => p.is_checkpoint === false),
    [paradasComCoord]
  );

  // Paradas filtradas por status
  const paradasFiltradas = React.useMemo(() => {
    if (statusFilter === 'all') return paradasReais;
    return paradasReais.filter((p) => p.status === statusFilter);
  }, [paradasReais, statusFilter]);

  // Calcular centro do mapa
  const center = React.useMemo(() => {
    if (paradasComCoord.length === 0) {
      return { lat: -15.7942, lng: -47.8822 }; // Brasília
    }
    return {
      lat: paradasComCoord[0].latitude!,
      lng: paradasComCoord[0].longitude!,
    };
  }, [paradasComCoord]);

  const onLoad = useCallback(
    (mapInstance: google.maps.Map) => {
      mapRef.current = mapInstance;
      setMapReady(true);
    },
    []
  );

  const clearMarkers = useCallback(() => {
    advancedMarkersRef.current.forEach((marker) => {
      marker.map = null;
    });
    advancedMarkersRef.current = [];

    fallbackMarkersRef.current.forEach((marker) => {
      marker.setMap(null);
    });
    fallbackMarkersRef.current = [];
  }, []);

  const openInfoWindow = useCallback(
    (parada: Parada, marker: google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null, isCheckpoint?: boolean, isPartida?: boolean) => {
      if (!marker || !mapRef.current) return;
      if (!infoWindowRef.current) infoWindowRef.current = new google.maps.InfoWindow();

      // Configurar header e content baseado no tipo
      if (isCheckpoint) {
        // Checkpoint: header com ícone+título na mesma linha do X
        infoWindowRef.current.setHeaderContent?.(buildCheckpointHeader(isPartida ?? false));
        infoWindowRef.current.setContent(buildCheckpointInfoContent(parada, unidadeNome));
      } else {
        // Parada normal: header com badge+título na mesma linha do X
        infoWindowRef.current.setHeaderContent?.(buildParadaHeader(parada));
        infoWindowRef.current.setContent(buildInfoContent(parada));
      }

      infoWindowRef.current.open(mapRef.current, marker);

      google.maps.event.addListenerOnce(infoWindowRef.current, 'domready', () => {
        // Botão "Copiar endereço" para checkpoints
        const copyBtn = document.getElementById(`copy-checkpoint-${parada.id}`);
        if (copyBtn) {
          copyBtn.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(parada.endereco);
              copyBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="${theme.colors.success}"/>
                </svg>
                Copiado!
              `;
              copyBtn.style.color = theme.colors.success;
              setTimeout(() => {
                copyBtn.innerHTML = `
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/>
                  </svg>
                  Copiar endereço
                `;
                copyBtn.style.color = theme.colors.gray600;
              }, 2000);
            } catch {
              console.warn('Não foi possível copiar o endereço');
            }
          });
        }
      });
    },
    [theme, unidadeNome]
  );

  React.useEffect(() => {
    if (!isLoaded || !mapReady || !mapRef.current) return;

    clearMarkers();

    if (paradasComCoord.length === 0) return;
    boundsRef.current = new window.google.maps.LatLngBounds();

    // Usar todas as paradas para calcular bounds (para manter a visualização da rota)
    paradasComCoord.forEach((p) => {
      boundsRef.current?.extend({ lat: p.latitude!, lng: p.longitude! });
    });

    // Combinar checkpoints (sempre visíveis) + paradas filtradas por status
    const paradasParaExibir = [...checkpoints, ...paradasFiltradas];

    const AdvancedMarker = google.maps.marker?.AdvancedMarkerElement;
    // Verificar se o mapa tem mapId configurado antes de usar AdvancedMarkerElement
    // O mapId é necessário para AdvancedMarkerElement funcionar corretamente
    // @ts-expect-error - getMapId() existe no Maps API mas não está nos tipos
    const mapHasMapId = mapRef.current && typeof mapRef.current.getMapId === 'function' && mapRef.current.getMapId();
    const canUseAdvancedMarkers = Boolean(GOOGLE_MAPS_MAP_ID && AdvancedMarker && mapHasMapId);

    // Determinar qual checkpoint é PARTIDA (primeiro)
    const checkpointIds = checkpoints.map(c => c.id);
    const partidaId = checkpointIds[0];

    if (canUseAdvancedMarkers && AdvancedMarker) {
      try {
        advancedMarkersRef.current = paradasParaExibir.map((parada) => {
          const isCheckpoint = parada.is_checkpoint === false;
          const isPartida = isCheckpoint && parada.id === partidaId;

          // Handler para click/keyboard do marcador
          const handleMarkerActivation = () => {
            // Checkpoints: fechar BottomSheet (se aberto) e mostrar InfoWindow
            // Paradas reais: abrir BottomSheet e mostrar InfoWindow
            if (isCheckpoint) {
              onMapPress?.(); // Fecha qualquer BottomSheet aberto
            } else {
              onMarkerPress?.(parada.id); // Abre BottomSheet para parada real
            }
            const markerInstance = markerMapRef.current.get(parada.id);
            if (markerInstance) {
              openInfoWindow(parada, markerInstance, isCheckpoint, isPartida);
            }
          };

          const markerTitle = isCheckpoint
            ? (isPartida ? 'Ponto de Partida' : 'Ponto de Chegada')
            : `Parada ${parada.ordem}: ${parada.endereco}`;

          const marker = new AdvancedMarker({
            map: mapRef.current!,
            position: { lat: parada.latitude!, lng: parada.longitude! },
            title: markerTitle,
            content: createMarkerContent(parada, theme, handleMarkerActivation, isPartida),
          });
          markerMapRef.current.set(parada.id, marker);
          marker.addListener('gmp-click', handleMarkerActivation);
          return marker;
        });
        return;
      } catch (error) {
        // Se AdvancedMarkerElement falhar, usar fallback
        console.warn('[MapaWeb] AdvancedMarkerElement failed, using fallback:', error);
        clearMarkers();
      }
    }

    // Fallback para browsers que ainda não suportam AdvancedMarkerElement
    fallbackMarkersRef.current = paradasParaExibir.map((parada) => {
      const isCheckpoint = parada.is_checkpoint === false;
      const isPartida = isCheckpoint && parada.id === partidaId;

      // Checkpoint (partida/chegada): marcador azul marca
      if (isCheckpoint) {
        const marker = new google.maps.Marker({
          map: mapRef.current!,
          position: { lat: parada.latitude!, lng: parada.longitude! },
          title: isPartida ? 'Ponto de Partida' : 'Ponto de Chegada',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: theme.colors.primary, // Azul marca RotaMestre
            fillOpacity: 1,
            strokeColor: theme.colors.white,
            strokeWeight: 2,
            scale: 12,
          },
        });
        markerMapRef.current.set(parada.id, marker);
        marker.addListener('click', () => {
          onMapPress?.(); // Fecha qualquer BottomSheet aberto (não abre para checkpoints)
          openInfoWindow(parada, marker, true, isPartida);
        });
        return marker;
      }

      // Parada normal: círculo colorido com número
      const marker = new google.maps.Marker({
        map: mapRef.current!,
        position: { lat: parada.latitude!, lng: parada.longitude! },
        title: `Parada ${parada.ordem}: ${parada.endereco}`,
        label: {
          text: String(parada.ordem),
          color: theme.colors.white,
          fontWeight: '700',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: getStatusColor(parada.status),
          fillOpacity: 1,
          strokeColor: theme.colors.white,
          strokeWeight: 2,
          scale: 16,
        },
      });
      markerMapRef.current.set(parada.id, marker);
      marker.addListener('click', () => {
        onMarkerPress?.(parada.id);
        openInfoWindow(parada, marker, false, false);
      });
      return marker;
    });
    if (boundsRef.current && !boundsRef.current.isEmpty() && mapRef.current) {
      mapRef.current.fitBounds(boundsRef.current);
    }
  }, [isLoaded, mapReady, paradasComCoord, checkpoints, paradasFiltradas, statusFilter, clearMarkers, onMarkerPress, onMapPress, openInfoWindow, theme]);

  React.useEffect(
    () => () => {
      clearMarkers();
    },
    [clearMarkers]
  );

  React.useEffect(() => {
    if (!selectedParadaId || !mapRef.current) return;
    const marker = markerMapRef.current.get(selectedParadaId);
    const parada = paradasComCoord.find((p) => p.id === selectedParadaId);
    if (!marker || !parada) return;

    // Determinar se é checkpoint (PARTIDA/CHEGADA) e qual tipo
    const isCheckpoint = parada.is_checkpoint === false;
    const checkpointIds = checkpoints.map(c => c.id);
    const partidaId = checkpointIds[0];
    const isPartida = isCheckpoint && parada.id === partidaId;

    openInfoWindow(parada, marker, isCheckpoint, isPartida);
    // Não centraliza automaticamente - usuário usa FAB de recentralizar se necessário
  }, [selectedParadaId, paradasComCoord, checkpoints, openInfoWindow]);

  // Calcular direções
  React.useEffect(() => {
    if (!isLoaded || paradasComCoord.length < 2) return;

    const DirectionsService = new google.maps.DirectionsService();

    const origin = {
      lat: paradasComCoord[0].latitude!,
      lng: paradasComCoord[0].longitude!,
    };

    const destination = {
      lat: paradasComCoord[paradasComCoord.length - 1].latitude!,
      lng: paradasComCoord[paradasComCoord.length - 1].longitude!,
    };

    const waypoints = paradasComCoord.slice(1, -1).map(p => ({
      location: { lat: p.latitude!, lng: p.longitude! },
      stopover: true,
    }));

    DirectionsService.route(
      {
        origin,
        destination,
        waypoints: waypoints.length > 0 ? waypoints : undefined,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
        } else {
          console.error('Erro ao calcular direções:', status);
        }
      }
    );
  }, [isLoaded, paradasComCoord]);

  // ========================================
  // RASTREAMENTO DO MOTORISTA EM TEMPO REAL
  // ========================================

  // Carregar última localização conhecida do motorista
  useEffect(() => {
    if (!showMotorista || !rotaId) {
      setMotoristaLocation(null);
      return;
    }

    const loadLastLocation = async () => {
      try {
        // Usar maybeSingle() para evitar erro quando não há dados
        const { data, error } = await supabase
          .from('motorista_locations')
          .select('*')
          .eq('rota_id', rotaId)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          // PGRST116 = no rows, 406 = RLS blocking - ambos são normais quando não há dados
          if (error.code !== 'PGRST116' && error.message !== 'JSON object requested, multiple (or no) rows returned') {
            console.warn('[MapaWeb] Localização não disponível:', error.code);
          }
          return;
        }

        if (data) {
          setMotoristaLocation(data as MotoristaLocation);
        }
      } catch {
        // Silenciar erros de localização - não é crítico
        console.warn('[MapaWeb] Localização indisponível');
      }
    };

    loadLastLocation();
  }, [showMotorista, rotaId]);

  // Subscrever atualizações em tempo real do motorista
  useEffect(() => {
    if (!showMotorista || !rotaId) return;

    const channel = supabase
      .channel(`motorista-web-${rotaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'motorista_locations',
          filter: `rota_id=eq.${rotaId}`,
        },
        (payload) => {
          setMotoristaLocation(payload.new as MotoristaLocation);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showMotorista, rotaId]);

  // Criar/atualizar marcador do motorista no mapa
  useEffect(() => {
    if (!mapReady || !mapRef.current || !isLoaded) return;

    // Função para remover marcador existente
    const removeMarker = () => {
      if (motoristaMarkerRef.current) {
        // AdvancedMarkerElement usa .map = null, Marker usa setMap(null)
        if ('map' in motoristaMarkerRef.current) {
          motoristaMarkerRef.current.map = null;
        }
        motoristaMarkerRef.current = null;
      }
    };

    // Se não deve mostrar motorista ou não tem localização, remover marcador existente
    if (!showMotorista || !motoristaLocation) {
      removeMarker();
      return;
    }

    // Calcular cor baseado na velocidade
    const getMarkerColor = () => {
      if (!motoristaLocation.velocidade) return theme.colors.info; // azul padrão
      if (motoristaLocation.velocidade === 0) return theme.colors.gray500; // cinza (parado)
      if (motoristaLocation.velocidade > 60) return theme.colors.error; // vermelho (rápido)
      if (motoristaLocation.velocidade > 30) return theme.colors.warning; // laranja (moderado)
      return theme.colors.success; // verde (lento)
    };

    // Calcular tempo desde última atualização
    const getTimeSinceUpdate = () => {
      const now = new Date();
      const locationTime = new Date(motoristaLocation.timestamp);
      const diffMs = now.getTime() - locationTime.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'agora';
      if (diffMins < 60) return `${diffMins}m atrás`;
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h atrás`;
    };

    const position = {
      lat: Number(motoristaLocation.latitude),
      lng: Number(motoristaLocation.longitude),
    };

    const markerColor = getMarkerColor();

    // Criar elemento DOM para o marcador do motorista (ícone de van de entrega)
    const createMotoristaMarkerContent = () => {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = `
        width: 36px;
        height: 36px;
        cursor: pointer;
        transition: transform 0.15s ease, filter 0.15s ease;
        filter: ${MAP_WEB_SHADOWS.motorista};
      `;
      wrapper.setAttribute('role', 'button');
      wrapper.setAttribute('aria-label', motoristaNome || 'Motorista');
      wrapper.setAttribute('tabindex', '0');

      // Ícone de van de entrega em círculo colorido
      wrapper.innerHTML = `
        <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
          <circle cx="18" cy="18" r="16" fill="${markerColor}" stroke="white" stroke-width="2"/>
          <g transform="translate(8, 9) scale(0.83)">
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="white"/>
          </g>
        </svg>
      `;

      // Interatividade - hover
      wrapper.addEventListener('mouseenter', () => {
        wrapper.style.transform = 'scale(1.15)';
        wrapper.style.filter = MAP_WEB_SHADOWS.motoristaHover;
      });

      wrapper.addEventListener('mouseleave', () => {
        wrapper.style.transform = 'scale(1)';
        wrapper.style.filter = MAP_WEB_SHADOWS.motorista;
      });

      // Acessibilidade - foco
      wrapper.addEventListener('focus', () => {
        wrapper.style.outline = `2px solid ${markerColor}`;
        wrapper.style.outlineOffset = '2px';
      });

      wrapper.addEventListener('blur', () => {
        wrapper.style.outline = 'none';
      });

      return wrapper;
    };

    const AdvancedMarker = google.maps.marker?.AdvancedMarkerElement;
    // Verificar se o mapa tem mapId configurado antes de usar AdvancedMarkerElement
    // @ts-expect-error - getMapId() existe no Maps API mas não está nos tipos
    const mapHasMapId = mapRef.current && typeof mapRef.current.getMapId === 'function' && mapRef.current.getMapId();
    const canUseAdvancedMarkers = Boolean(GOOGLE_MAPS_MAP_ID && AdvancedMarker && mapHasMapId);

    // Se já existe marcador, atualizar posição
    if (motoristaMarkerRef.current) {
      if (canUseAdvancedMarkers && 'position' in motoristaMarkerRef.current) {
        // AdvancedMarkerElement
        motoristaMarkerRef.current.position = position;
        motoristaMarkerRef.current.content = createMotoristaMarkerContent();
      } else if ('setPosition' in motoristaMarkerRef.current) {
        // Marker antigo (fallback)
        const marker = motoristaMarkerRef.current as google.maps.Marker;
        marker.setPosition(position);
      }
      return;
    }

    // Criar novo marcador
    if (canUseAdvancedMarkers && AdvancedMarker) {
      try {
        // Usar AdvancedMarkerElement
        const marker = new AdvancedMarker({
          map: mapRef.current,
          position,
          content: createMotoristaMarkerContent(),
          title: motoristaNome || 'Motorista',
          zIndex: 9999,
        });

        // InfoWindow para AdvancedMarkerElement
        if (!motoristaInfoWindowRef.current) {
          motoristaInfoWindowRef.current = new google.maps.InfoWindow();
        }

        marker.addListener('gmp-click', () => {
          motoristaInfoWindowRef.current!.setHeaderContent?.(buildMotoristaHeader(motoristaNome || 'Motorista', markerColor));
          motoristaInfoWindowRef.current!.setContent(buildMotoristaInfoContent(motoristaLocation.velocidade, getTimeSinceUpdate(), markerColor));
          motoristaInfoWindowRef.current!.open(mapRef.current, marker);
        });

        motoristaMarkerRef.current = marker;
        return; // Sucesso, não usar fallback
      } catch (error) {
        console.warn('[MapaWeb] AdvancedMarkerElement for motorista failed, using fallback:', error);
      }
    }

    // Fallback
    {
      // Fallback para Marker antigo (browsers sem suporte) - usa mesmo ícone de van de entrega
      const vanIcon = {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
            <circle cx="18" cy="18" r="16" fill="${markerColor}" stroke="white" stroke-width="2"/>
            <g transform="translate(8, 9) scale(0.83)">
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" fill="white"/>
            </g>
          </svg>
        `)}`,
        scaledSize: new google.maps.Size(36, 36),
        anchor: new google.maps.Point(18, 18),
      };

      // Fallback: google.maps.Marker é deprecated mas mantido para compatibilidade
      const marker = new google.maps.Marker({
        map: mapRef.current,
        position,
        icon: vanIcon,
        title: motoristaNome || 'Motorista',
        zIndex: 9999,
      });

      if (!motoristaInfoWindowRef.current) {
        motoristaInfoWindowRef.current = new google.maps.InfoWindow();
      }

      marker.addListener('click', () => {
        motoristaInfoWindowRef.current!.setHeaderContent?.(buildMotoristaHeader(motoristaNome || 'Motorista', markerColor));
        motoristaInfoWindowRef.current!.setContent(buildMotoristaInfoContent(motoristaLocation.velocidade, getTimeSinceUpdate(), markerColor));
        motoristaInfoWindowRef.current!.open(mapRef.current, marker);
      });

      motoristaMarkerRef.current = marker;
    }
  }, [mapReady, isLoaded, showMotorista, motoristaLocation, motoristaNome, theme]);

  // Limpar marcador do motorista quando componente desmonta
  useEffect(() => {
    return () => {
      if (motoristaMarkerRef.current) {
        if ('map' in motoristaMarkerRef.current) {
          motoristaMarkerRef.current.map = null;
        }
        motoristaMarkerRef.current = null;
      }
      if (motoristaInfoWindowRef.current) {
        motoristaInfoWindowRef.current.close();
        motoristaInfoWindowRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (!mapReady || !mapRef.current || !google?.maps) return;

    // Legend
    const legend = document.createElement('div');
    legend.style.background = theme.colors.white;
    legend.style.border = `1px solid ${theme.colors.gray200}`;
    legend.style.borderRadius = `${theme.borderRadius.md}px`;
    legend.style.padding = `${theme.spacing['2']}px ${theme.spacing['2.5']}px`;
    legend.style.margin = `${theme.spacing['2']}px`;
    legend.style.boxShadow = MAP_WEB_SHADOWS.legend;
    legend.innerHTML = `
      <div style="font-weight:700;font-size:12px;margin-bottom:${theme.spacing['1.5']}px;color:${theme.colors.gray900};">Legenda</div>
      <div style="display:flex;gap:${theme.spacing['2.5']}px;font-size:12px;color:${theme.colors.gray600};align-items:center;flex-wrap:wrap;">
        <span style="display:flex;align-items:center;gap:${theme.spacing['1']}px;"><span style="width:10px;height:10px;border-radius:50%;background:${theme.colors.warning};display:inline-block;"></span>Pendente</span>
        <span style="display:flex;align-items:center;gap:${theme.spacing['1']}px;"><span style="width:10px;height:10px;border-radius:50%;background:${theme.colors.info};display:inline-block;"></span>Em rota</span>
        <span style="display:flex;align-items:center;gap:${theme.spacing['1']}px;"><span style="width:10px;height:10px;border-radius:50%;background:${theme.colors.success};display:inline-block;"></span>Concluída</span>
        <span style="display:flex;align-items:center;gap:${theme.spacing['1']}px;"><span style="width:10px;height:10px;border-radius:50%;background:${theme.colors.gray500};display:inline-block;"></span>Pulada</span>
      </div>
    `;
    legendControlRef.current = legend;
    mapRef.current.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(legend);

    // Recenter
    const recenter = document.createElement('div');
    recenter.style.background = theme.colors.white;
    recenter.style.border = `1px solid ${theme.colors.gray200}`;
    recenter.style.borderRadius = `${theme.borderRadius.md}px`;
    recenter.style.padding = `${theme.spacing['2.5']}px`;
    recenter.style.margin = `${theme.spacing['2']}px`;
    recenter.style.cursor = 'pointer';
    recenter.style.boxShadow = MAP_WEB_SHADOWS.legend;
    recenter.innerText = 'Recentrar rota';
    recenterControlRef.current = recenter;
    recenter.addEventListener('click', () => {
      if (boundsRef.current && !boundsRef.current.isEmpty()) {
        mapRef.current?.fitBounds(boundsRef.current);
      } else if (paradasComCoord.length > 0 && mapRef.current) {
        mapRef.current.panTo(center);
      }
    });
    mapRef.current.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(recenter);

    return () => {
      if (legendControlRef.current) {
        const idx = mapRef.current?.controls[google.maps.ControlPosition.LEFT_BOTTOM].getArray().indexOf(legendControlRef.current);
        if (idx != null && idx >= 0) {
          mapRef.current?.controls[google.maps.ControlPosition.LEFT_BOTTOM].removeAt(idx);
        }
      }
      if (recenterControlRef.current) {
        const idx = mapRef.current?.controls[google.maps.ControlPosition.RIGHT_BOTTOM].getArray().indexOf(recenterControlRef.current);
        if (idx != null && idx >= 0) {
          mapRef.current?.controls[google.maps.ControlPosition.RIGHT_BOTTOM].removeAt(idx);
        }
      }
    };
  }, [center, mapReady, isLoaded, paradasComCoord.length, theme]);

  // Handler para clique no mapa (fecha InfoWindow e chama callback)
  // IMPORTANTE: Deve estar ANTES de TODOS os early returns para respeitar Rules of Hooks
  const handleMapClick = useCallback(() => {
    // Fechar InfoWindow das paradas
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }
    // Fechar InfoWindow do motorista
    if (motoristaInfoWindowRef.current) {
      motoristaInfoWindowRef.current.close();
    }
    // Chamar callback do pai (deselecionar parada)
    onMapPress?.();
  }, [onMapPress]);

  if (loadError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Erro ao carregar o Google Maps</Text>
      </View>
    );
  }

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando mapa...</Text>
      </View>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={13}
      onLoad={onLoad}
      onClick={handleMapClick}
      options={{
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        mapId: GOOGLE_MAPS_MAP_ID || undefined,
      }}
    >
      {/* Direções */}
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: theme.colors.primary,
              strokeWeight: 4,
            },
          }}
        />
      )}
    </GoogleMap>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  loadingContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.disabled,
  },
  loadingText: {
    marginTop: theme.spacing['2.5'],
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.errorLight,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.error,
  },
}));
