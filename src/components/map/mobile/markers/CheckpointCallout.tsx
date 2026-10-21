/**
 * Balão do checkpoint (PARTIDA/CHEGADA) selecionado no mapa nativo.
 *
 * Fora do <Marker>, como o ParadaCallout: dentro dele o "Copiar endereço"
 * não recebia toque no Android.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { mapMobileStyles as styles } from '@/components/map/mobile/styles';
import { useUnistyles } from '@/utils/styles';

interface CheckpointCalloutProps {
  /** 0 = PARTIDA, 1+ = CHEGADA */
  index: number;
  endereco: string;
  unidadeNome?: string;
  onCopyAddress: (endereco: string) => void;
}

export function CheckpointCallout({
  index,
  endereco,
  unidadeNome,
  onCopyAddress,
}: CheckpointCalloutProps) {
  const { theme } = useUnistyles();
  const isPartida = index === 0;

  return (
    <View style={styles.checkpointCalloutContainer}>
      <View style={styles.checkpointCalloutHeader}>
        <View style={styles.checkpointIconBadge}>
          <Ionicons
            name={isPartida ? 'flag' : 'home'}
            size={12}
            color={theme.colors.white}
          />
        </View>
        <Text style={styles.checkpointCalloutTitle}>
          {isPartida ? 'PARTIDA' : 'CHEGADA'}
        </Text>
      </View>
      {unidadeNome && (
        <Text style={styles.checkpointCalloutUnidade}>{unidadeNome}</Text>
      )}
      <Text style={styles.checkpointCalloutAddress} numberOfLines={2}>
        {endereco}
      </Text>
      <TouchableOpacity
        style={styles.copyButton}
        onPress={() => onCopyAddress(endereco)}
        accessibilityLabel="Copiar endereço"
        accessibilityRole="button"
      >
        <Ionicons
          name="copy-outline"
          size={14}
          color={theme.colors.textSecondary}
        />
        <Text style={styles.copyButtonText}>Copiar endereço</Text>
      </TouchableOpacity>
    </View>
  );
}
