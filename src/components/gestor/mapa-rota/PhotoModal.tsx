/**
 * PhotoModal - Modal unificado para visualização de fotos
 * Usa DesktopModal para consistência em todas as plataformas
 *
 * Desktop: Modal centralizado com imagem grande
 * Mobile: Bottom sheet com imagem adaptativa
 *
 * Features:
 * - Loading indicator enquanto carrega
 * - Empty state para falha de carregamento (informativo, não erro de validação)
 * - Dimensões reativas (rotação de tela)
 * - Botão "Tentar novamente" em caso de falha
 * - Memoizado para evitar re-renders desnecessários
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Image,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';

import { DesktopModal } from '@/design-system';
import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface PhotoModalProps {
  visible: boolean;
  photoUrl: string | null;
  onClose: () => void;
  title?: string;
}

function PhotoModalComponent({
  visible,
  photoUrl,
  onClose,
  title = 'Foto da Entrega',
}: PhotoModalProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Reset estado quando modal abre ou URL muda
  useEffect(() => {
    if (visible && photoUrl) {
      setIsLoading(true);
      setHasError(false);
    }
  }, [visible, photoUrl]);

  // Calcular dimensões da imagem baseado no tamanho da tela
  const imageHeight = isDesktop ? 500 : Math.min(screenHeight * 0.6, 400);
  const imageWidth = isDesktop ? '100%' : screenWidth - 48;

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // Retry recarrega por remount: o <Image> desmonta enquanto hasError=true.
  // Não anexar query param à URI para forçar reload — a signed URL já tem ?token=... e corromperia.
  const handleRetry = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
  }, []);

  if (!photoUrl) return null;

  return (
    <DesktopModal
      visible={visible}
      onClose={onClose}
      title={title}
      maxWidth={800}
    >
      <View
        style={[styles.container, { minHeight: imageHeight }]}
        accessibilityLiveRegion="polite"
      >
        {/* Loading indicator */}
        {isLoading && !hasError && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Carregando foto...</Text>
          </View>
        )}

        {/* Empty state - falha ao carregar (informativo, não erro de validação) */}
        {hasError && (
          <View style={styles.emptyStateContainer}>
            <Ionicons
              name="image-outline"
              size={48}
              color={theme.colors.gray400}
            />
            <Text style={styles.emptyStateText}>
              Não foi possível carregar a foto
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
              accessibilityRole="button"
              accessibilityLabel="Tentar carregar a foto novamente"
            >
              <Ionicons name="refresh" size={16} color={theme.colors.primary} />
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Image */}
        {!hasError && (
          <Image
            source={{ uri: photoUrl }}
            style={[
              styles.image,
              {
                height: imageHeight,
                width: imageWidth,
                opacity: isLoading ? 0 : 1,
              },
            ]}
            resizeMode="contain"
            accessibilityLabel="Foto da entrega"
            onLoad={handleLoad}
            onError={handleError}
          />
        )}
      </View>
    </DesktopModal>
  );
}

// Memoizar componente para evitar re-renders desnecessários
export const PhotoModal = memo(PhotoModalComponent);

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray100,
  },
  loadingContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
  },
  emptyStateText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryBg,
    marginTop: theme.spacing.sm,
  },
  retryButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
}));
