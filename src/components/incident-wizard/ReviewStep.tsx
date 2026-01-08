/**
 * ReviewStep - Step 4: Review and submit for incident report
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { View, Text, TextInput, Image } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { INCIDENT_CATEGORIES, getIncidentColor } from './types';

interface ReviewStepProps {
  selectedCategory: string;
  description: string;
  photoUri: string;
  endereco?: string;
  manualEndereco: string;
  onManualEnderecoChange: (text: string) => void;
  isSubmitting: boolean;
  uploadProgress: number;
  uploadRetryCount: number;
  isDesktop: boolean;
}

function ReviewStepComponent({
  selectedCategory,
  description,
  photoUri,
  endereco,
  manualEndereco,
  onManualEnderecoChange,
  isSubmitting,
  uploadProgress,
  uploadRetryCount,
  isDesktop,
}: ReviewStepProps) {
  const { theme } = useUnistyles();
  const category = INCIDENT_CATEGORIES.find((c) => c.value === selectedCategory);

  return (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>
        Revisar informações
      </Text>

      {/* Barra de progresso durante upload */}
      {isSubmitting && (
        <View style={styles.uploadProgressContainer}>
          <View style={styles.uploadProgressBar}>
            <View
              style={[
                styles.uploadProgressFill,
                { width: `${uploadProgress}%` },
              ]}
            />
          </View>
          <Text style={styles.uploadProgressText}>
            {uploadRetryCount > 1
              ? `Tentativa ${uploadRetryCount}/3 - Enviando...`
              : `Enviando reporte... ${uploadProgress}%`}
          </Text>
        </View>
      )}

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>LOCAL:</Text>
        {!endereco ? (
          <TextInput
            style={styles.manualAddressInput}
            placeholder="Informe o local do incidente..."
            placeholderTextColor={theme.colors.gray400}
            value={manualEndereco}
            onChangeText={onManualEnderecoChange}
            accessibilityLabel="Local do incidente"
            editable={!isSubmitting}
          />
        ) : (
          <Text style={styles.reviewValue}>{endereco}</Text>
        )}
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>TIPO DE PROBLEMA:</Text>
        <View style={styles.reviewCategory}>
          <Ionicons
            name={category?.icon || 'help-circle-outline'}
            size={20}
            color={category ? getIncidentColor(theme, category.colorKey) : theme.colors.gray500}
          />
          <Text style={styles.reviewValue}>{category?.label}</Text>
        </View>
      </View>

      {photoUri && (
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>FOTO:</Text>
          <Image
            source={{ uri: photoUri }}
            style={styles.reviewPhoto}
            resizeMode="cover"
            accessibilityLabel="Foto do incidente anexada"
          />
        </View>
      )}

      <View style={styles.reviewSection}>
        <Text style={styles.reviewLabel}>DESCRIÇÃO:</Text>
        <Text style={styles.reviewDescription}>{description}</Text>
      </View>
    </View>
  );
}

export const ReviewStep = memo(ReviewStepComponent);

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
  reviewSection: {
    marginBottom: theme.spacing.lg,
  },
  reviewLabel: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reviewValue: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray800,
  },
  reviewCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  reviewPhoto: {
    width: 150,
    height: 100,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.gray100,
  },
  reviewDescription: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
    lineHeight: 20,
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xs,
  },
  manualAddressInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray900,
    backgroundColor: theme.colors.gray50,
    marginTop: theme.spacing.xs,
  },
  uploadProgressContainer: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primaryBg,
    borderRadius: theme.borderRadius.md,
  },
  uploadProgressBar: {
    height: 6,
    backgroundColor: theme.colors.gray200,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  uploadProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  uploadProgressText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.primary,
    textAlign: 'center',
  },
}));
