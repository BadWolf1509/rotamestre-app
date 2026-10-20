/**
 * CheckpointMarker component for MapaMobile
 *
 * Só o pino de PARTIDA/CHEGADA. O balão (endereço, unidade, "Copiar
 * endereço") é o CheckpointCallout, sobre o mapa e fora do <Marker>.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { mapMobileStyles as styles } from '@/components/map/mobile/styles';
import { useUnistyles } from '@/utils/styles';

interface CheckpointMarkerProps {
  /** 0 = PARTIDA, 1+ = CHEGADA */
  index: number;
  endereco: string;
}

/**
 * Compact blue checkpoint marker.
 * Sem toque aqui: quem trata é o onPress do <Marker> (ver ParadaMarker).
 */
export function CheckpointMarker({ index, endereco }: CheckpointMarkerProps) {
  const { theme } = useUnistyles();
  const isPartida = index === 0;

  return (
    <View
      style={styles.checkpointMarkerCompact}
      accessible
      accessibilityLabel={`${isPartida ? 'PARTIDA' : 'CHEGADA'}, ${endereco}`}
    >
      <Ionicons
        name={isPartida ? 'flag' : 'home'}
        size={16}
        color={theme.colors.white}
      />
    </View>
  );
}
