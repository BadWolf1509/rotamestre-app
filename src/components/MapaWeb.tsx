/* global google */

import { GoogleMap, useJsApiLoader, DirectionsRenderer } from '@react-google-maps/api';
import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { MotoristaLocation } from '@/types/notifications';
import { StyleSheet, type Theme } from '@/utils/styles';

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
  /** Filtro de status para exibir apenas paradas com determinado status */
  statusFilter?: StatusFilter;
  /** ID da rota para rastreamento em tempo real do motorista */
  rotaId?: string;
  /** Nome do motorista para exibir no marcador */
  motoristaNome?: string;
  /** Se true e rota em andamento, mostra posição do motorista em tempo real */
  showMotorista?: boolean;
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const GOOGLE_MAPS_MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID || '';

const containerStyle = {
  width: '100%',
  height: '100%',
};

function getStatusColor(status?: string) {
  switch (status) {
    case 'concluida':
      return '#10b981';
    case 'em_andamento':
      return '#3b82f6';
    case 'cancelada':
      return '#ef4444';
    default:
      return '#f59e0b';
  }
}

function createMarkerContent(parada: Parada) {
  // Checkpoint (partida/chegada): ícone de pin azul primário (#284093)
  if (parada.is_checkpoint === false) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.innerHTML = `
      <svg width="32" height="40" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C7.03 0 3 3.47 3 7.75C3 13.56 12 24 12 24C12 24 21 13.56 21 7.75C21 3.47 16.97 0 12 0ZM12 10.5C10.62 10.5 9.5 9.38 9.5 8C9.5 6.62 10.62 5.5 12 5.5C13.38 5.5 14.5 6.62 14.5 8C14.5 9.38 13.38 10.5 12 10.5Z" fill="#284093"/>
      </svg>
    `;
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
  wrapper.style.color = '#ffffff';
  wrapper.style.fontWeight = '700';
  wrapper.style.fontSize = '14px';
  wrapper.style.border = '2px solid #ffffff';
  wrapper.style.boxShadow = '0 3px 8px rgba(0,0,0,0.25)';

  const label = document.createElement('span');
  label.textContent = String(parada.ordem);
  wrapper.appendChild(label);

  return wrapper;
}

export default function MapaWeb({
  paradas,
  selectedParadaId,
  onMarkerPress,
  statusFilter = 'all',
  rotaId,
  motoristaNome,
  showMotorista = false,
}: MapaWebProps) {
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

  const buildInfoContent = useCallback((parada: Parada) => {
    const statusLabel =
      parada.status === 'concluida'
        ? 'Concluida'
        : parada.status === 'pendente'
          ? 'Pendente'
          : parada.status === 'em_andamento'
            ? 'Em andamento'
            : parada.status;

    const statusColor = getStatusColor(parada.status);

    return `
      <div style="max-width:240px;font-family:sans-serif;">
        <div style="font-weight:700;margin-bottom:6px;font-size:14px;">Parada ${parada.ordem}</div>
        <div style="font-size:13px;margin-bottom:8px;line-height:18px;">${parada.endereco}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
          <span style="padding:4px 8px;border-radius:12px;background:${statusColor}15;color:${statusColor};font-weight:600;font-size:12px;">${statusLabel}</span>
          ${parada.tipo ? `<span style="padding:4px 8px;border-radius:12px;background:#e0f2fe;color:#0f172a;font-weight:600;font-size:12px;text-transform:capitalize;">${parada.tipo}</span>` : ''}
        </div>
        ${parada.destinatario ? `<div style="font-size:12px;color:#475569;margin-bottom:4px;"><strong>Destinatario:</strong> ${parada.destinatario}</div>` : ''}
        ${parada.telefone ? `<div style="font-size:12px;color:#475569;margin-bottom:6px;"><strong>Telefone:</strong> ${parada.telefone}</div>` : ''}
        <button id="go-to-${parada.id}" style="margin-top:4px;padding:8px 10px;border-radius:10px;border:1px solid #e2e8f0;background:#f8fafc;color:#0f172a;cursor:pointer;font-weight:600;font-size:12px;">Ver na lista</button>
      </div>
    `;
  }, []);

  const openInfoWindow = useCallback(
    (parada: Parada, marker: google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null) => {
      if (!marker || !mapRef.current) return;
      if (!infoWindowRef.current) infoWindowRef.current = new google.maps.InfoWindow();
      infoWindowRef.current.setContent(buildInfoContent(parada));
      infoWindowRef.current.open(mapRef.current, marker);
      google.maps.event.addListenerOnce(infoWindowRef.current, 'domready', () => {
        const btn = document.getElementById(`go-to-${parada.id}`);
        if (btn) btn.addEventListener('click', () => onMarkerPress?.(parada.id));
      });
    },
    [buildInfoContent, onMarkerPress]
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

    if (canUseAdvancedMarkers && AdvancedMarker) {
      try {
        advancedMarkersRef.current = paradasParaExibir.map((parada) => {
          const marker = new AdvancedMarker({
            map: mapRef.current!,
            position: { lat: parada.latitude!, lng: parada.longitude! },
            title: `Parada ${parada.ordem}: ${parada.endereco}`,
            content: createMarkerContent(parada),
          });
          markerMapRef.current.set(parada.id, marker);
          marker.addListener('gmp-click', () => {
            onMarkerPress?.(parada.id);
            openInfoWindow(parada, marker);
          });
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
      // Checkpoint (partida/chegada): marcador azul primário
      if (parada.is_checkpoint === false) {
        const marker = new google.maps.Marker({
          map: mapRef.current!,
          position: { lat: parada.latitude!, lng: parada.longitude! },
          title: parada.ordem === 1 ? 'Ponto de Partida' : 'Ponto de Chegada',
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/blue.png',
          },
        });
        markerMapRef.current.set(parada.id, marker);
        return marker;
      }

      // Parada normal: círculo colorido com número
      const marker = new google.maps.Marker({
        map: mapRef.current!,
        position: { lat: parada.latitude!, lng: parada.longitude! },
        title: `Parada ${parada.ordem}: ${parada.endereco}`,
        label: {
          text: String(parada.ordem),
          color: '#ffffff',
          fontWeight: '700',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: getStatusColor(parada.status),
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 16,
        },
      });
      markerMapRef.current.set(parada.id, marker);
      marker.addListener('click', () => {
        onMarkerPress?.(parada.id);
        openInfoWindow(parada, marker);
      });
      return marker;
    });
    if (boundsRef.current && !boundsRef.current.isEmpty() && mapRef.current) {
      mapRef.current.fitBounds(boundsRef.current);
    }
  }, [isLoaded, mapReady, paradasComCoord, checkpoints, paradasFiltradas, statusFilter, clearMarkers, onMarkerPress, openInfoWindow]);

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
    openInfoWindow(parada, marker);
    // Ajustar centro para o marcador selecionado
    // AdvancedMarkerElement usa .position, google.maps.Marker usa getPosition()
    // @ts-expect-error - AdvancedMarkerElement usa property position
    const pos = marker.position || marker.getPosition?.();
    if (pos && mapRef.current) {
      mapRef.current.panTo(pos);
    }
  }, [selectedParadaId, paradasComCoord, openInfoWindow]);

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
      if (!motoristaLocation.velocidade) return '#3b82f6'; // azul padrão
      if (motoristaLocation.velocidade === 0) return '#6b7280'; // cinza (parado)
      if (motoristaLocation.velocidade > 60) return '#ef4444'; // vermelho (rápido)
      if (motoristaLocation.velocidade > 30) return '#f59e0b'; // laranja (moderado)
      return '#22c55e'; // verde (lento)
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

    // Criar elemento DOM para o marcador do motorista
    const createMotoristaMarkerContent = () => {
      const wrapper = document.createElement('div');
      wrapper.style.width = '48px';
      wrapper.style.height = '48px';
      wrapper.style.cursor = 'pointer';
      wrapper.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <circle cx="24" cy="24" r="20" fill="${markerColor}" stroke="white" stroke-width="3"/>
          <path d="M24 14 L30 20 L30 28 L24 34 L18 28 L18 20 Z" fill="white"/>
          <circle cx="24" cy="24" r="4" fill="${markerColor}"/>
        </svg>
      `;
      return wrapper;
    };

    // InfoWindow content
    const getInfoWindowContent = () => {
      const speed = motoristaLocation.velocidade !== null
        ? `${Math.round(motoristaLocation.velocidade)} km/h`
        : 'N/A';

      return `
        <div style="font-family: sans-serif; padding: 8px; min-width: 150px;">
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px; color: #0f172a;">
            🚗 ${motoristaNome || 'Motorista'}
          </div>
          <div style="font-size: 13px; color: #475569; margin-bottom: 4px;">
            <strong>Velocidade:</strong> ${speed}
          </div>
          <div style="font-size: 12px; color: #64748b;">
            Atualizado ${getTimeSinceUpdate()}
          </div>
        </div>
      `;
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
          motoristaInfoWindowRef.current!.setContent(getInfoWindowContent());
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
      // Fallback para Marker antigo (browsers sem suporte)
      const carIcon = {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="20" fill="${markerColor}" stroke="white" stroke-width="3"/>
            <path d="M24 14 L30 20 L30 28 L24 34 L18 28 L18 20 Z" fill="white"/>
            <circle cx="24" cy="24" r="4" fill="${markerColor}"/>
          </svg>
        `)}`,
        scaledSize: new google.maps.Size(48, 48),
        anchor: new google.maps.Point(24, 24),
      };

      // Fallback: google.maps.Marker é deprecated mas mantido para compatibilidade
      const marker = new google.maps.Marker({
        map: mapRef.current,
        position,
        icon: carIcon,
        title: motoristaNome || 'Motorista',
        zIndex: 9999,
      });

      if (!motoristaInfoWindowRef.current) {
        motoristaInfoWindowRef.current = new google.maps.InfoWindow();
      }

      marker.addListener('click', () => {
        motoristaInfoWindowRef.current!.setContent(getInfoWindowContent());
        motoristaInfoWindowRef.current!.open(mapRef.current, marker);
      });

      motoristaMarkerRef.current = marker;
    }
  }, [mapReady, isLoaded, showMotorista, motoristaLocation, motoristaNome]);

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
    legend.style.background = '#ffffff';
    legend.style.border = '1px solid #e2e8f0';
    legend.style.borderRadius = '10px';
    legend.style.padding = '8px 10px';
    legend.style.margin = '8px';
    legend.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    legend.innerHTML = `
      <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:#0f172a;">Legenda</div>
      <div style="display:flex;gap:10px;font-size:12px;color:#475569;align-items:center;">
        <span style="display:flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;border-radius:50%;background:#f59e0b;display:inline-block;"></span>Pendente</span>
        <span style="display:flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;border-radius:50%;background:#3b82f6;display:inline-block;"></span>Em andamento</span>
        <span style="display:flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;border-radius:50%;background:#10b981;display:inline-block;"></span>Concluida</span>
      </div>
    `;
    legendControlRef.current = legend;
    mapRef.current.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(legend);

    // Recenter
    const recenter = document.createElement('div');
    recenter.style.background = '#ffffff';
    recenter.style.border = '1px solid #e2e8f0';
    recenter.style.borderRadius = '10px';
    recenter.style.padding = '10px';
    recenter.style.margin = '8px';
    recenter.style.cursor = 'pointer';
    recenter.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
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
  }, [center, mapReady, isLoaded, paradasComCoord.length]);

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
        <ActivityIndicator size="large" color="#0D5A9C" />
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
              strokeColor: '#0D5A9C',
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
    marginTop: 10,
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
