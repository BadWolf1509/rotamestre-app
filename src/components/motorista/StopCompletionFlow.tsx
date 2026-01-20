/**
 * StopCompletionFlow - Componente unificado para conclusão de paradas
 *
 * Refatorado para usar DesktopModal do design-system:
 * - Web: HTML5 <dialog> com focus trap e ESC nativo
 * - Mobile: Bottom sheet responsivo
 * - API declarativa de botões
 *
 * Encapsula o fluxo completo:
 * 1. Modal de câmera para foto de comprovante
 * 2. Confirmação da conclusão
 * 3. Chamada ao contexto para concluir parada
 *
 * Usado em: inicio.tsx, checkpoints.tsx, NavigationMode.tsx
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';

import CameraUpload from '@/components/CameraUpload';
import { DesktopModal } from '@/components/desktop/DesktopModal';
import { useRouteStatus, ParadaData } from '@/context/RouteStatusContext';
import { useAlert } from '@/hooks/useAlert';
import { useUser } from '@/hooks/useUser';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface StopCompletionFlowProps {
  /** Parada a ser concluída */
  parada: ParadaData | null;
  /** Visibilidade do modal */
  visible: boolean;
  /** Callback ao fechar (cancelar ou após concluir) */
  onClose: () => void;
  /** Callback após conclusão bem-sucedida */
  onSuccess?: () => void;
  /** Se true, permite concluir sem foto */
  allowSkipPhoto?: boolean;
}

export function StopCompletionFlow({
  parada,
  visible,
  onClose,
  onSuccess,
  allowSkipPhoto = true,
}: StopCompletionFlowProps) {
  const { theme } = useUnistyles();
  const { userData } = useUser();
  const { route, completeStop } = useRouteStatus();
  const { showSuccess, showError, showConfirm, AlertDialog } = useAlert();

  const [step, setStep] = useState<'photo' | 'confirm'>('photo');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Reset state when modal closes or parada changes
  React.useEffect(() => {
    if (!visible) {
      setStep('photo');
      setPhotoUrl(null);
      setIsCompleting(false);
    }
  }, [visible, parada?.id]);

  if (!parada || !route || !userData) return null;

  // Handler para foto enviada com sucesso
  const handlePhotoSuccess = (url: string) => {
    setPhotoUrl(url);
    setStep('confirm');
  };

  // Handler para erro no upload da foto
  const handlePhotoError = async (error: string) => {
    if (allowSkipPhoto) {
      const confirmed = await showConfirm({
        title: 'Erro no Upload',
        message: `Erro ao enviar foto: ${error}\n\nDeseja concluir a parada sem foto de comprovante?`,
        confirmText: 'Continuar sem foto',
        cancelText: 'Tentar novamente',
        type: 'warning',
      });
      if (confirmed) {
        setStep('confirm');
      }
    } else {
      showError({ title: 'Erro', message: `Não foi possível enviar a foto: ${error}` });
    }
  };

  // Handler para pular foto
  const handleSkipPhoto = async () => {
    const confirmed = await showConfirm({
      title: 'Pular foto?',
      message: 'A foto serve como prova de entrega. Deseja continuar sem foto?',
      confirmText: 'Continuar sem foto',
      cancelText: 'Cancelar',
      type: 'warning',
    });
    if (confirmed) {
      setStep('confirm');
    }
  };

  // Handler para confirmar conclusão
  const handleConfirmComplete = async () => {
    setIsCompleting(true);

    try {
      // IMPORTANTE: Não passar photoUrl para completeStop se for apenas um indicador
      // ('success' ou 'pending_sync'). A foto já foi salva por uploadELinkFotoParada.
      // Passar 'success' como foto_url sobrescreveria a URL correta no banco!
      const isActualUrl = photoUrl && photoUrl.startsWith('http');
      await completeStop(parada.id, isActualUrl ? photoUrl : undefined);

      // Feedback de sucesso
      if (Platform.OS === 'web') {
        // Na web, feedback visual do modal é suficiente
        onSuccess?.();
        onClose();
      } else {
        showSuccess(
          'Sucesso!',
          photoUrl ? 'Parada concluída com foto de comprovante!' : 'Parada concluída!',
          () => { onSuccess?.(); onClose(); }
        );
      }
    } catch (error) {
      showError(error);
    } finally {
      setIsCompleting(false);
    }
  };

  // Handler para cancelar confirmação e voltar para foto
  const handleBackToPhoto = () => {
    setPhotoUrl(null);
    setStep('photo');
  };

  // Título dinâmico baseado no step
  const modalTitle = step === 'photo' ? 'Foto de Comprovante' : 'Confirmar Conclusão';

  // Botões declarativos para o step de confirmação
  const primaryButton = step === 'confirm' ? {
    text: 'Concluir',
    onPress: handleConfirmComplete,
    loading: isCompleting,
    color: theme.colors.success,
  } : undefined;

  const secondaryButton = step === 'confirm' ? {
    text: 'Voltar',
    onPress: handleBackToPhoto,
    disabled: isCompleting,
  } : undefined;

  return (
    <>
      <DesktopModal
        visible={visible}
        onClose={onClose}
        title={modalTitle}
        maxWidth={440}
        primaryButton={primaryButton}
        secondaryButton={secondaryButton}
      >
        {step === 'photo' ? (
          // Step 1: Captura de foto
          <View>
            <Text style={styles.address}>{parada.endereco}</Text>

            {parada.destinatario && (
              <Text style={styles.recipient}>{parada.destinatario}</Text>
            )}

            <CameraUpload
              unidadeId={userData.unidade_id!}
              rotaId={route.id}
              paradaId={parada.id}
              onUploadSuccess={handlePhotoSuccess}
              onUploadError={handlePhotoError}
            />

            {allowSkipPhoto && (
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkipPhoto}
                accessibilityRole="button"
                accessibilityLabel="Continuar sem foto"
              >
                <Text style={styles.skipButtonText}>
                  Continuar sem foto
                </Text>
                <Ionicons name="arrow-forward" size={16} color={theme.colors.gray500} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          // Step 2: Confirmação
          <View>
            <View style={styles.confirmCard}>
              <View style={styles.confirmRow}>
                <Ionicons name="location" size={20} color={theme.colors.primary} />
                <Text style={styles.confirmText}>{parada.endereco}</Text>
              </View>

              {parada.destinatario && (
                <View style={styles.confirmRow}>
                  <Ionicons name="person" size={20} color={theme.colors.gray500} />
                  <Text style={styles.confirmText}>{parada.destinatario}</Text>
                </View>
              )}

              <View style={styles.confirmRow}>
                <Ionicons
                  name={photoUrl ? "camera" : "camera-outline"}
                  size={20}
                  color={photoUrl ? theme.colors.success : theme.colors.warning}
                />
                <Text style={[
                  styles.confirmText,
                  { color: photoUrl ? theme.colors.success : theme.colors.warning }
                ]}>
                  {photoUrl ? 'Foto anexada' : 'Sem foto de comprovante'}
                </Text>
              </View>
            </View>

            <Text style={styles.confirmQuestion}>
              Confirma a conclusão desta {parada.tipo}?
            </Text>
          </View>
        )}
      </DesktopModal>

      {AlertDialog}
    </>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  address: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray700,
    marginBottom: theme.spacing.xs,
  },
  recipient: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.md,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  skipButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray500,
  },
  confirmCard: {
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  confirmText: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
    flex: 1,
  },
  confirmQuestion: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray900,
    textAlign: 'center',
  },
}));
