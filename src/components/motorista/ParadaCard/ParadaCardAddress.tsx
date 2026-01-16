/**
 * ParadaCardAddress - Address display with different modes
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { useUnistyles } from '@/utils/styles';

import { styles } from './ParadaCard.styles';
import { formatCompletionTime } from './ParadaCard.types';

interface ParadaCardAddressProps {
  endereco: string;
  enderecoSecundario?: string;
  concluidaEm?: string;
  isConcluida: boolean;
  isPulada: boolean;
  isProcessada: boolean;
  isSummary: boolean;
  cardExpandido: boolean;
  onToggleExpand: () => void;
}

export const ParadaCardAddress = memo(function ParadaCardAddress({
  endereco,
  enderecoSecundario,
  concluidaEm,
  isConcluida,
  isPulada,
  isProcessada,
  isSummary,
  cardExpandido,
  onToggleExpand,
}: ParadaCardAddressProps) {
  const { theme } = useUnistyles();

  // Summary variant - compact display with completion time
  if (isSummary) {
    const resumoConclusaoHora = (isConcluida || isPulada) ? formatCompletionTime(concluidaEm) : null;

    return (
      <>
        <View style={styles.enderecoResumo}>
          <Text style={[styles.paradaEndereco, styles.paradaEnderecoResumo]} numberOfLines={2}>
            {endereco}
          </Text>
          {enderecoSecundario ? (
            <Text style={styles.paradaEnderecoSecundario} numberOfLines={1}>
              {enderecoSecundario}
            </Text>
          ) : null}
        </View>
        {resumoConclusaoHora ? (
          <Text style={styles.paradaHorarioResumo}>
            {isConcluida ? 'Concluída às' : 'Pulada às'} {resumoConclusaoHora}
          </Text>
        ) : null}
      </>
    );
  }

  // Processed (completed/skipped) - expandable
  if (isProcessada) {
    return (
      <TouchableOpacity
        onPress={onToggleExpand}
        activeOpacity={0.7}
        style={styles.enderecoExpandivel}
      >
        <Text
          style={[styles.paradaEndereco, styles.paradaEnderecoCompacto]}
          numberOfLines={cardExpandido ? undefined : 1}
        >
          {endereco}
        </Text>
        <Ionicons
          name={cardExpandido ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.colors.gray400}
        />
      </TouchableOpacity>
    );
  }

  // Default - full address display
  return (
    <Text style={styles.paradaEndereco}>
      {endereco}
    </Text>
  );
});
