import { Ionicons } from '@expo/vector-icons';
import * as MapLibreGL from '@maplibre/maplibre-react-native';
import React, { useMemo, memo } from 'react';
import { View, Text } from 'react-native';

import { useIdadeDaPosicao } from '@/components/map/hooks/useIdadeDaPosicao';
import { useMotoristaLocationMapLibre } from '@/components/map/hooks/useMotoristaLocationMapLibre';
import { CORES_SOBRE_O_MAPA } from '@/components/motorista/home/miniMapCompartilhado';
import { toLngLat } from '@/lib/maplibre';
import { withOpacity } from '@/utils/color';
import { StyleSheet, type Theme } from '@/utils/styles';

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
  // Mesmo hook do mapa web: vale a posição de `timestamp` mais novo, não a
  // última que chegou (a fila offline reenvia posições antigas).
  const { location } = useMotoristaLocationMapLibre(rotaId, { realtime });
  // "há 12 min", recalculado por um relógio de 30 s.
  const timeSinceUpdate = useIdadeDaPosicao(location?.timestamp);

  // Cor pela velocidade, da paleta clara (o mapa é sempre claro).
  const markerColor = useMemo(() => {
    const velocidade = location?.velocidade;
    if (velocidade === null || velocidade === undefined) {
      return CORES_SOBRE_O_MAPA.usuario; // sem dado
    }
    if (velocidade === 0) return CORES_SOBRE_O_MAPA.pendente; // parado
    if (velocidade > 60) return CORES_SOBRE_O_MAPA.erro; // rápido
    if (velocidade > 30) return CORES_SOBRE_O_MAPA.proxima; // moderado
    return CORES_SOBRE_O_MAPA.concluida; // lento
  }, [location?.velocidade]);

  // Accuracy circle size memoizado
  const accuracySize = useMemo(() => {
    if (!location) return 40;
    return Math.max(40, Math.min((location.precisao || 10) / 2, 80));
  }, [location]);

  if (!location) return null;

  return (
    <MapLibreGL.Marker
      lngLat={toLngLat({
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
      })}
      anchor="center"
    >
      <View style={styles.markerContainer}>
        {/* Círculo de precisão */}
        <View
          style={[
            styles.accuracyCircle,
            {
              width: accuracySize,
              height: accuracySize,
              backgroundColor: withOpacity(markerColor, 0.12),
              borderColor: markerColor,
            },
          ]}
        />

        {/* Ícone do motorista */}
        <View style={[styles.iconContainer, { backgroundColor: markerColor }]}>
          <Ionicons name="car" size={20} color={CORES_SOBRE_O_MAPA.branco} />
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
    </MapLibreGL.Marker>
  );
}

// Export com React.memo para evitar re-renders desnecessários
export const MotoristaMarker = memo(MotoristaMarkerComponent);

// Cores do balão e das bordas: o estilo do mapa é sempre claro, e os tokens
// do tema (surface, text) se invertem no tema escuro — texto claro em fundo
// claro. Vêm de `CORES_SOBRE_O_MAPA`, como no mini-mapa da Início.
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
    width: theme.spacing['10'],
    height: theme.spacing['10'],
    borderRadius: theme.spacing['5'],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: CORES_SOBRE_O_MAPA.branco,
    shadowColor: CORES_SOBRE_O_MAPA.sombra,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  directionArrow: {
    position: 'absolute',
    top: -theme.spacing['2'],
  },
  callout: {
    marginTop: theme.spacing['2'],
    backgroundColor: CORES_SOBRE_O_MAPA.branco,
    paddingHorizontal: theme.spacing['3'],
    paddingVertical: theme.spacing['1.5'],
    borderRadius: theme.borderRadius.sm,
    minWidth: 100,
    alignItems: 'center',
    shadowColor: CORES_SOBRE_O_MAPA.sombra,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  calloutName: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: CORES_SOBRE_O_MAPA.sombra,
  },
  calloutSpeed: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '700',
    marginTop: theme.spacing['0.5'],
  },
  calloutTime: {
    fontSize: theme.typography.fontSize.xs,
    color: CORES_SOBRE_O_MAPA.pendente,
    marginTop: theme.spacing['0.5'],
  },
}));
