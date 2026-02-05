import { Ionicons } from '@expo/vector-icons';
import MapLibreGL from '@maplibre/maplibre-react-native';
import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { View, Text } from 'react-native';

import { logger } from '@/lib/logger';
import { toLngLat } from '@/lib/maplibre';
import { supabase } from '@/lib/supabase';
import type { MotoristaLocation } from '@/types/notifications';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface MotoristaMarkerProps {
  rotaId: string;
  motoristaNome?: string;
  /** Se true, subscreve a realtime updates */
  realtime?: boolean;
}

function MotoristaMarkerComponent({
  rotaId,
  motoristaNome,
  realtime = true,
}: MotoristaMarkerProps) {
  const { theme } = useUnistyles();
  const [location, setLocation] = useState<MotoristaLocation | null>(null);

  // Carregar última localização conhecida
  const loadLastLocation = useCallback(async () => {
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
          logger.error('[MotoristaMarker] Erro ao carregar localização:', error);
        }
        return;
      }

      if (data) {
        setLocation(data as MotoristaLocation);
      }
    } catch (err) {
      logger.error('[MotoristaMarker] Erro:', err);
    }
  }, [rotaId]);

  useEffect(() => {
    loadLastLocation();
  }, [loadLastLocation]);

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

  // Calcular cor baseado na velocidade (memoizado)
  const markerColor = useMemo(() => {
    if (!location?.velocidade) return theme.colors.info; // azul padrão
    if (location.velocidade === 0) return theme.colors.textSecondary; // cinza (parado)
    if (location.velocidade > 60) return theme.colors.error; // vermelho (rápido)
    if (location.velocidade > 30) return theme.colors.warning; // laranja (moderado)
    return theme.colors.success; // verde (lento)
  }, [location?.velocidade, theme.colors]);

  // Calcular tempo desde última atualização (memoizado)
  const timeSinceUpdate = useMemo(() => {
    if (!location) return '';
    const now = new Date();
    const locationTime = new Date(location.timestamp);
    const diffMs = now.getTime() - locationTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `${diffMins}m atrás`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h atrás`;
  }, [location]);

  // Accuracy circle size memoizado
  const accuracySize = useMemo(() => {
    if (!location) return 40;
    return Math.max(40, Math.min((location.precisao || 10) / 2, 80));
  }, [location]);

  if (!location) return null;

  return (
    <MapLibreGL.MarkerView
      coordinate={toLngLat({
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
      })}
      anchor={{ x: 0.5, y: 0.5 }}
      accessible={true}
      accessibilityLabel={`Localização do motorista ${motoristaNome || ''}, ${location.velocidade ? `${Math.round(location.velocidade)} quilômetros por hora` : 'velocidade desconhecida'}, atualizado ${timeSinceUpdate}`}
      accessibilityHint="Mostra a posição atual do motorista em tempo real"
    >
      <View style={styles.markerContainer}>
        {/* Círculo de precisão */}
        <View
          style={[
            styles.accuracyCircle,
            {
              width: accuracySize,
              height: accuracySize,
              backgroundColor: `${markerColor}20`,
              borderColor: markerColor,
            },
          ]}
        />

        {/* Ícone do motorista */}
        <View style={[styles.iconContainer, { backgroundColor: markerColor }]}>
          <Ionicons name="car" size={20} color={theme.colors.surface} />
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
            <Ionicons name="arrow-up" size={16} color={markerColor} />
          </View>
        )}

        {/* Callout com info - acessibilidade melhorada */}
        <View
          style={styles.callout}
          accessible={true}
          accessibilityRole="summary"
          accessibilityLabel={`${motoristaNome || 'Motorista'}${location.velocidade !== null ? `, ${Math.round(location.velocidade)} quilômetros por hora` : ''}, ${timeSinceUpdate}`}
        >
          <Text style={styles.calloutName}>{motoristaNome || 'Motorista'}</Text>
          {location.velocidade !== null && (
            <Text style={[styles.calloutSpeed, { color: markerColor }]}>
              {Math.round(location.velocidade)} km/h
            </Text>
          )}
          <Text style={styles.calloutTime}>{timeSinceUpdate}</Text>
        </View>
      </View>
    </MapLibreGL.MarkerView>
  );
}

// Export com React.memo para evitar re-renders desnecessários
export const MotoristaMarker = memo(MotoristaMarkerComponent);

const styles = StyleSheet.create((theme: Theme) => ({
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
    borderColor: theme.colors.surface,
    shadowColor: theme.colors.black,
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
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  calloutName: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  calloutSpeed: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  calloutTime: {
    fontSize: theme.typography.fontSize.xs, // Min readable (WCAG AA)
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
}));
