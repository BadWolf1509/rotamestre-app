/**
 * CheckpointMarker component for MapaMobile
 *
 * Renders a PARTIDA/CHEGADA marker pin with an expandable callout.
 * The callout shows address, unit name, and a copy-address button.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';

import { mapMobileStyles as styles } from '@/components/map/mobile/styles';
import { useUnistyles } from '@/utils/styles';

interface CheckpointMarkerProps {
  /** 0 = PARTIDA, 1+ = CHEGADA */
  index: number;
  endereco: string;
  isSelected: boolean;
  unidadeNome?: string;
  onPress: () => void;
  onCopyAddress: (endereco: string) => void;
}

/**
 * Compact blue checkpoint marker with expandable callout popup.
 * Uses PARTIDA label for index 0 and CHEGADA for subsequent checkpoints.
 */
export function CheckpointMarker({
  index,
  endereco,
  isSelected,
  unidadeNome,
  onPress,
  onCopyAddress,
}: CheckpointMarkerProps) {
  const { theme } = useUnistyles();
  const isPartida = index === 0;
  const checkpointLabel = isPartida ? 'PARTIDA' : 'CHEGADA';
  const iconName = isPartida ? 'flag' : 'home';

  return (
    <View style={styles.markerWrapper}>
      {isSelected && (
        <View style={styles.calloutWrapper}>
          <View style={styles.checkpointCalloutContainer}>
            <View style={styles.checkpointCalloutHeader}>
              <View style={styles.checkpointIconBadge}>
                <Ionicons
                  name={iconName}
                  size={12}
                  color={theme.colors.white}
                />
              </View>
              <Text style={styles.checkpointCalloutTitle}>
                {checkpointLabel}
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
        </View>
      )}

      <Pressable
        onPress={onPress}
        style={styles.checkpointMarkerCompact}
        accessibilityLabel={`${checkpointLabel}, ${endereco}`}
        accessibilityHint="Toque para ver informações"
        accessibilityRole="button"
      >
        <Ionicons name={iconName} size={16} color={theme.colors.white} />
      </Pressable>
    </View>
  );
}
