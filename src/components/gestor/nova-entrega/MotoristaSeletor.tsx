/**
 * Componente para seleção de motorista
 * Suporta densidade compacta para desktop
 */

import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type { MotoristaResumo } from './types';

export interface MotoristaSeletorProps {
  motoristas: MotoristaResumo[];
  motoristaSelecionado: string;
  onSelectMotorista: (id: string) => void;
}

export const MotoristaSeletor = memo(function MotoristaSeletor({
  motoristas,
  motoristaSelecionado,
  onSelectMotorista,
}: MotoristaSeletorProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const styles = createStyles(theme, isDesktop);

  return (
    <View style={styles.motoristaSection}>
      <Text style={styles.sectionTitle}>Selecionar Motorista</Text>
      {motoristas.length === 0 ? (
        <Text style={styles.noMotoristas}>
          Nenhum motorista disponível nesta unidade
        </Text>
      ) : (
        motoristas.map((motorista) => {
          const isSelecionado = motoristaSelecionado === motorista.id;

          return (
            <TouchableOpacity
              key={motorista.id}
              style={[
                styles.motoristaCard,
                isSelecionado && styles.motoristaCardActive,
              ]}
              onPress={() => onSelectMotorista(motorista.id)}
              activeOpacity={0.85}
              accessibilityLabel={`Selecionar motorista ${motorista.nome}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelecionado }}
            >
              <Text
                style={[
                  styles.motoristaNome,
                  isSelecionado && styles.motoristaNomeActive,
                ]}
              >
                {motorista.nome}
              </Text>
              <Text
                style={[
                  styles.motoristaEmail,
                  isSelecionado && styles.motoristaEmailActive,
                ]}
              >
                {motorista.email}
              </Text>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
});

const createStyles = (theme: Theme, isDesktop: boolean) => StyleSheet.create({
  motoristaSection: {
    marginBottom: isDesktop ? theme.spacing.lg : theme.spacing['2xl'],
  },
  sectionTitle: {
    fontSize: isDesktop ? theme.typography.base : theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: isDesktop ? theme.spacing.md : theme.spacing['2xl'],
  },
  noMotoristas: {
    color: theme.colors.gray500,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: isDesktop ? theme.spacing.lg : theme.spacing['2xl'],
    fontSize: isDesktop ? theme.desktop.input.fontSize : theme.typography.sm,
  },
  motoristaCard: {
    backgroundColor: theme.colors.white,
    padding: isDesktop ? theme.desktop.section.padding : theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: isDesktop ? theme.spacing.sm : theme.spacing.md,
    borderWidth: isDesktop ? 1 : 2,
    borderColor: theme.colors.gray200,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: isDesktop ? 1 : 2 },
    shadowOpacity: isDesktop ? 0.03 : 0.05,
    shadowRadius: isDesktop ? 2 : 4,
    elevation: isDesktop ? 1 : 2,
    // Desktop: limitar largura para não ocupar toda a coluna
    maxWidth: isDesktop ? 320 : undefined,
  },
  motoristaCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryBg,
    shadowColor: theme.colors.primaryDark,
    shadowOpacity: isDesktop ? 0.1 : 0.15,
    elevation: isDesktop ? 2 : 4,
  },
  motoristaNome: {
    fontSize: isDesktop ? theme.desktop.input.fontSize : theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  motoristaNomeActive: {
    color: theme.colors.primaryDark,
  },
  motoristaEmail: {
    fontSize: isDesktop ? 12 : theme.typography.sm,
    color: theme.colors.gray500,
    marginTop: isDesktop ? 4 : theme.spacing.sm,
  },
  motoristaEmailActive: {
    color: theme.colors.primary,
  },
});
