/**
 * ParadaMarker component for MapaMobile
 *
 * Só o pino da parada (cor pelo status, destaque quando selecionado). O balão
 * com os detalhes é o ParadaCallout, desenhado sobre o mapa e fora do
 * <Marker> (ver BalaoSobreposto).
 */

import React from 'react';
import { View, Text } from 'react-native';

import { getStatusLabel } from '@/components/map/infoWindowBuilders';
import {
  tituloDoPino,
  type ServicoDoPino,
} from '@/components/map/mobile/markers/ParadaCallout';
import { mapMobileStyles as styles } from '@/components/map/mobile/styles';
import type { ParadaMapItem as Parada } from '@/types/parada-map';
import { getMarkerFillColor } from '@/utils/mapMarkerColors';
import { useUnistyles } from '@/utils/styles';

interface ParadaMarkerProps {
  parada: Parada;
  isSelected: boolean;
  /** Texto do pino quando ele reúne serviços do mesmo local ("3+4"). */
  rotulo?: string;
  /** Serviços do local (para o rótulo de acessibilidade). */
  servicos?: ServicoDoPino[];
}

/**
 * Circular marker for a delivery/pickup stop.
 *
 * O pino não trata toque: quem trata é o onPress do <Marker> em MapaMobile
 * (no Android, um Pressable aqui dentro nunca dispara onPress).
 */
export function ParadaMarker({
  parada,
  isSelected,
  rotulo,
  servicos,
}: ParadaMarkerProps) {
  const { theme } = useUnistyles();
  const markerColor = getMarkerFillColor(parada.status, theme.colors);
  const titulo = tituloDoPino(parada, servicos);

  return (
    <View
      style={[
        styles.markerContainer,
        { backgroundColor: markerColor },
        isSelected && styles.markerSelected,
      ]}
      accessible
      accessibilityLabel={`${titulo}, ${parada.endereco}, ${getStatusLabel(parada.status)}`}
    >
      <Text style={styles.markerText}>{rotulo ?? parada.ordem}</Text>
    </View>
  );
}
