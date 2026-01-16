/**
 * ParadaCardDetails - Expanded details (destinatario, telefone, observacoes)
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';

import { useUnistyles } from '@/utils/styles';

import { styles } from './ParadaCard.styles';

const LIMITE_OBS = 80;

interface ParadaCardDetailsProps {
  destinatario?: string;
  telefone?: string;
  observacoes?: string;
  isProcessada: boolean;
}

export const ParadaCardDetails = memo(function ParadaCardDetails({
  destinatario,
  telefone,
  observacoes,
  isProcessada,
}: ParadaCardDetailsProps) {
  const { theme } = useUnistyles();
  const [obsExpandida, setObsExpandida] = useState(false);

  const temObsLonga = observacoes && observacoes.length > LIMITE_OBS;

  const handleLigar = useCallback(() => {
    if (telefone) {
      const numeroLimpo = telefone.replace(/\D/g, '');
      Linking.openURL(`tel:${numeroLimpo}`);
    }
  }, [telefone]);

  const hasContactInfo = destinatario || telefone;

  return (
    <>
      {/* Contact details */}
      {hasContactInfo && (
        <View style={styles.paradaDetalhes}>
          {destinatario && (
            <Text style={styles.paradaDetalheTexto}>👤 {destinatario}</Text>
          )}
          {telefone && (
            <TouchableOpacity
              onPress={handleLigar}
              style={styles.telefoneContainer}
              accessibilityLabel={`Ligar para ${telefone}`}
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <Text style={styles.telefoneLinkTexto}>📞 {telefone}</Text>
              <Ionicons name="call-outline" size={14} color={theme.colors.info} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Observacoes - diferentes comportamentos para processada vs pendente */}
      {observacoes && (
        isProcessada ? (
          // Processada: observacoes simples
          <View style={styles.observacoesContainer}>
            <Text style={styles.observacoesLabel}>📝 Observações:</Text>
            <Text style={styles.observacoesTexto}>{observacoes}</Text>
          </View>
        ) : (
          // Pendente: observacoes expansiveis
          <TouchableOpacity
            style={styles.observacoesContainer}
            onPress={() => temObsLonga && setObsExpandida(!obsExpandida)}
            disabled={!temObsLonga}
            activeOpacity={temObsLonga ? 0.7 : 1}
          >
            <View style={styles.observacoesHeader}>
              <Text style={styles.observacoesLabel}>📝 Observações:</Text>
              {temObsLonga && (
                <Ionicons
                  name={obsExpandida ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={theme.colors.gray500}
                />
              )}
            </View>
            <Text style={styles.observacoesTexto}>
              {!obsExpandida && temObsLonga
                ? observacoes.slice(0, LIMITE_OBS) + '...'
                : observacoes}
            </Text>
          </TouchableOpacity>
        )
      )}
    </>
  );
});
