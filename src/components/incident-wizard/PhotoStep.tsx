/**
 * PhotoStep - Step 2: Photo upload for incident report
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface PhotoStepProps {
  photoUri: string;
  displayPhotoUri: string;
  isPhotoLoading: boolean;
  hasPhotoError: boolean;
  imageWidth: number;
  isDesktop: boolean;
  onTakePhoto: () => void;
  onPickImage: () => void;
  onRemovePhoto: () => void;
  onPhotoLoad: () => void;
  onPhotoError: () => void;
  onPhotoRetry: () => void;
  onSkip: () => void;
}

function PhotoStepComponent({
  photoUri,
  displayPhotoUri,
  isPhotoLoading,
  hasPhotoError,
  imageWidth,
  isDesktop,
  onTakePhoto,
  onPickImage,
  onRemovePhoto,
  onPhotoLoad,
  onPhotoError,
  onPhotoRetry,
  onSkip,
}: PhotoStepProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>
        Adicionar foto do problema
      </Text>
      <Text style={styles.stepSubtitle}>
        Uma foto ajuda a documentar melhor o incidente
      </Text>

      {photoUri ? (
        <View style={styles.photoContainer}>
          {/* Loading indicator */}
          {isPhotoLoading && !hasPhotoError && (
            <View style={styles.photoLoadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.photoLoadingText}>Carregando foto...</Text>
            </View>
          )}

          {/* Error state with retry */}
          {hasPhotoError && (
            <View style={styles.photoErrorContainer}>
              <Ionicons name="image-outline" size={48} color={theme.colors.gray400} />
              <Text style={styles.photoErrorText}>Não foi possível carregar a foto</Text>
              <TouchableOpacity
                style={styles.photoRetryButton}
                onPress={onPhotoRetry}
                accessibilityRole="button"
                accessibilityLabel="Tentar carregar a foto novamente"
              >
                <Ionicons name="refresh" size={16} color={theme.colors.primary} />
                <Text style={styles.photoRetryText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Photo image */}
          {!hasPhotoError && (
            <Image
              source={{ uri: displayPhotoUri }}
              style={[
                styles.photo,
                { width: imageWidth, opacity: isPhotoLoading ? 0 : 1 },
              ]}
              resizeMode="cover"
              accessibilityLabel="Foto do incidente"
              onLoad={onPhotoLoad}
              onError={onPhotoError}
            />
          )}

          <TouchableOpacity
            style={styles.removePhotoButton}
            onPress={onRemovePhoto}
            accessibilityRole="button"
            accessibilityLabel="Remover foto"
          >
            <Ionicons name="close-circle" size={28} color={theme.colors.white} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.photoOptions, isDesktop && styles.photoOptionsDesktop]}>
          <TouchableOpacity
            style={styles.photoOption}
            onPress={onTakePhoto}
            accessibilityRole="button"
            accessibilityLabel="Tirar foto com a câmera"
          >
            <Ionicons name="camera" size={32} color={theme.colors.primary} />
            <Text style={styles.photoOptionText}>Tirar Foto</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.photoOption}
            onPress={onPickImage}
            accessibilityRole="button"
            accessibilityLabel="Escolher foto da galeria"
          >
            <Ionicons name="images" size={32} color={theme.colors.primary} />
            <Text style={styles.photoOptionText}>Escolher da Galeria</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.skipButton}
        onPress={onSkip}
        accessibilityRole="button"
        accessibilityLabel="Pular este passo"
      >
        <Text style={styles.skipButtonText}>Pular este passo</Text>
      </TouchableOpacity>
    </View>
  );
}

export const PhotoStep = memo(PhotoStepComponent);

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
  photoContainer: {
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
    minHeight: 200,
    justifyContent: 'center',
  },
  photo: {
    height: 200,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.gray100,
  },
  photoLoadingContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  photoLoadingText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
  },
  photoErrorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
  },
  photoErrorText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  photoRetryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryBg,
    marginTop: theme.spacing.sm,
  },
  photoRetryText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
  removePhotoButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: theme.colors.overlay,
    borderRadius: 14,
  },
  photoOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  photoOptionsDesktop: {
    justifyContent: 'center',
    gap: theme.spacing.xl,
  },
  photoOption: {
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    minWidth: 120,
  },
  photoOptionText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
  },
  skipButton: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  skipButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    textDecorationLine: 'underline',
  },
}));
