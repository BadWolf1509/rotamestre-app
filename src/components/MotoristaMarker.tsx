import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';

import { supabase } from '@/lib/supabase';
import type { MotoristaLocation } from '@/types/notifications';

interface MotoristaMarkerProps {
  rotaId: string;
  motoristaNome?: string;
  /** Se true, subscreve a realtime updates */
  realtime?: boolean;
}

export function MotoristaMarker({
  rotaId,
  motoristaNome,
  realtime = true,
}: MotoristaMarkerProps) {
  const [location, setLocation] = useState<MotoristaLocation | null>(null);

  useEffect(() => {
    // Carregar última localização conhecida
    const loadLastLocation = async () => {
      try {
        const { data, error } = await supabase
          .from('motorista_locations')
          .select('*')
          .eq('rota_id', rotaId)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        if (error) {
          if (error.code !== 'PGRST116') {
            // PGRST116 = no rows returned
            console.error('[MotoristaMarker] Erro ao carregar localização:', error);
          }
          return;
        }

        if (data) {
          setLocation(data as MotoristaLocation);
        }
      } catch (err) {
        console.error('[MotoristaMarker] Erro:', err);
      }
    };

    loadLastLocation();
  }, [rotaId]);

  useEffect(() => {
    if (!realtime) return;

    // Subscrever atualizações em tempo real
    const channel = supabase
      .channel(`motorista-location-${rotaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'motorista_locations',
          filter: `rota_id=eq.${rotaId}`,
        },
        (payload) => {
          setLocation(payload.new as MotoristaLocation);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rotaId, realtime]);

  if (!location) return null;

  // Calcular cor baseado na velocidade (se disponível)
  const getMarkerColor = () => {
    if (!location.velocidade) return '#3b82f6'; // azul padrão
    if (location.velocidade === 0) return '#6b7280'; // cinza (parado)
    if (location.velocidade > 60) return '#ef4444'; // vermelho (rápido)
    if (location.velocidade > 30) return '#f59e0b'; // laranja (moderado)
    return '#22c55e'; // verde (lento)
  };

  // Calcular tempo desde última atualização
  const getTimeSinceUpdate = () => {
    const now = new Date();
    const locationTime = new Date(location.timestamp);
    const diffMs = now.getTime() - locationTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `${diffMins}m atrás`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h atrás`;
  };

  return (
    <Marker
      coordinate={{
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
      }}
      anchor={{ x: 0.5, y: 0.5 }}
      title={motoristaNome || 'Motorista'}
      description={`Atualizado ${getTimeSinceUpdate()}`}
    >
      <View style={styles.markerContainer}>
        {/* Círculo de precisão */}
        <View
          style={[
            styles.accuracyCircle,
            {
              width: Math.max(40, Math.min((location.precisao || 10) / 2, 80)),
              height: Math.max(40, Math.min((location.precisao || 10) / 2, 80)),
              backgroundColor: `${getMarkerColor()}20`,
              borderColor: getMarkerColor(),
            },
          ]}
        />

        {/* Ícone do motorista */}
        <View style={[styles.iconContainer, { backgroundColor: getMarkerColor() }]}>
          <Ionicons name="car" size={20} color="#FFFFFF" />
        </View>

        {/* Seta de direção */}
        {location.heading !== null && location.heading !== undefined && (
          <View
            style={[
              styles.directionArrow,
              {
                transform: [{ rotate: `${location.heading}deg` }],
              },
            ]}
          >
            <Ionicons name="arrow-up" size={16} color={getMarkerColor()} />
          </View>
        )}

        {/* Callout com info */}
        <View style={styles.callout}>
          <Text style={styles.calloutName}>{motoristaNome || 'Motorista'}</Text>
          {location.velocidade !== null && (
            <Text style={styles.calloutSpeed}>{Math.round(location.velocidade)} km/h</Text>
          )}
          <Text style={styles.calloutTime}>{getTimeSinceUpdate()}</Text>
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  accuracyCircle: {
    position: 'absolute',
    borderRadius: 100,
    borderWidth: 2,
    opacity: 0.3,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  directionArrow: {
    position: 'absolute',
    top: -8,
  },
  callout: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  calloutName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  calloutSpeed: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3b82f6',
    marginTop: 2,
  },
  calloutTime: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
});
