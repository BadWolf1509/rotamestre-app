/**
 * DescriptionStep - Step 3: Description input for incident report
 */

import React, { memo } from 'react';
import { View, Text, TextInput } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface DescriptionStepProps {
  description: string;
  onDescriptionChange: (text: string) => void;
  isDesktop: boolean;
}

function DescriptionStepComponent({
  description,
  onDescriptionChange,
  isDesktop,
}: DescriptionStepProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>
        Descreva o problema
      </Text>
      <Text style={styles.stepSubtitle}>
        Forneça detalhes sobre o que aconteceu
      </Text>

      <TextInput
        style={[styles.descriptionInput, isDesktop && styles.descriptionInputDesktop]}
        multiline
        numberOfLines={isDesktop ? 4 : 6}
        placeholder="Ex: Cheguei ao local mas o portão estava fechado e não havia ninguém para receber. Tentei ligar mas ninguém atendeu..."
        placeholderTextColor={theme.colors.gray400}
        value={description}
        onChangeText={onDescriptionChange}
        textAlignVertical="top"
        maxLength={500}
        accessibilityLabel="Descrição do problema"
        accessibilityHint="Digite pelo menos 20 caracteres"
      />

      <Text style={styles.charCount}>
        {description.length}/500 caracteres (mínimo 20)
      </Text>
    </View>
  );
}

export const DescriptionStep = memo(DescriptionStepComponent);

const styles = StyleSheet.create((theme: Theme) => ({
  stepContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  stepTitle: {
    fontSize: theme.typography.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  stepTitleDesktop: {
    fontSize: theme.typography.lg,
  },
  stepSubtitle: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.lg,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray900,
    minHeight: 150,
    backgroundColor: theme.colors.gray50,
  },
  descriptionInputDesktop: {
    minHeight: 120,
  },
  charCount: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
    textAlign: 'right',
  },
}));
