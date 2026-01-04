/**
 * StopCompletionFlow - Componente unificado para conclusão de paradas
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
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';

import CameraUpload from '@/components/CameraUpload';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useRouteStatus, ParadaData } from '@/context/RouteStatusContext';
import { useUser } from '@/hooks/useUser';
import { withOpacity } from '@/utils/color';
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

  const [step, setStep] = useState<'photo' | 'confirm'>('photo');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [skipPhotoDialog, setSkipPhotoDialog] = useState<{
    visible: boolean;
    errorMessage?: string;
  }>({ visible: false });

  // Reset state when modal closes or parada changes
  React.useEffect(() => {
    if (!visible) {
      setStep('photo');
      setPhotoUrl(null);
      setIsCompleting(false);
      setSkipPhotoDialog({ visible: false });
    }
  }, [visible, parada?.id]);

  if (!parada || !route || !userData) return null;

  // Handler para foto enviada com sucesso
  const handlePhotoSuccess = (url: string) => {
    setPhotoUrl(url);
    setStep('confirm');
  };

  // Handler para erro no upload da foto
  const handlePhotoError = (error: string) => {
    if (allowSkipPhoto) {
      if (Platform.OS === 'web') {
        setSkipPhotoDialog({ visible: true, errorMessage: error });
      } else {
        Alert.alert(
          'Erro no Upload',
          error,
          [
            { text: 'Tentar novamente', style: 'cancel' },
            {
              text: 'Continuar sem foto',
              style: 'destructive',
              onPress: () => setStep('confirm'),
            },
          ]
        );
      }
    } else {
      Alert.alert('Erro', `Não foi possível enviar a foto: ${error}`);
    }
  };

  // Handler para pular foto
  const handleSkipPhoto = () => {
    if (Platform.OS === 'web') {
      setSkipPhotoDialog({ visible: true });
    } else {
      Alert.alert(
        'Pular foto?',
        'A foto serve como prova de entrega. Deseja continuar sem foto?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Continuar sem foto',
            style: 'destructive',
            onPress: () => setStep('confirm'),
          },
        ]
      );
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
        // Na web, não usar Alert.alert para mensagens informativas
        onSuccess?.();
        onClose();
      } else {
        Alert.alert(
          'Sucesso!',
          photoUrl
            ? 'Parada concluída com foto de comprovante!'
            : 'Parada concluída!',
          [{ text: 'OK', onPress: () => { onSuccess?.(); onClose(); } }]
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível concluir a parada';
      Alert.alert('Erro', message);
    } finally {
      setIsCompleting(false);
    }
  };

  // Handler para cancelar confirmação e voltar para foto
  const handleBackToPhoto = () => {
    setPhotoUrl(null);
    setStep('photo');
  };

  // Renderiza step de foto
  const renderPhotoStep = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>📸 Foto de Comprovante</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={theme.colors.gray500} />
        </TouchableOpacity>
      </View>

      <Text style={styles.address}>{parada.endereco}</Text>

      {parada.destinatario && (
        <Text style={styles.recipient}>👤 {parada.destinatario}</Text>
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
        >
          <Text style={styles.skipButtonText}>
            Continuar sem foto →
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Renderiza step de confirmação
  const renderConfirmStep = () => (
    <View style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>✓ Confirmar Conclusão</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={theme.colors.gray500} />
        </TouchableOpacity>
      </View>

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

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={handleBackToPhoto}
          disabled={isCompleting}
        >
          <Text style={styles.buttonSecondaryText}>
            ← Voltar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={handleConfirmComplete}
          disabled={isCompleting}
        >
          {isCompleting ? (
            <ActivityIndicator color={theme.colors.white} size="small" />
          ) : (
            <Text style={styles.buttonPrimaryText}>
              ✓ Concluir
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.container}>
            {step === 'photo' ? renderPhotoStep() : renderConfirmStep()}
          </View>
        </View>
      </Modal>
      <ConfirmDialog
        visible={skipPhotoDialog.visible}
        title={skipPhotoDialog.errorMessage ? 'Erro no Upload' : 'Pular foto?'}
        message={
          skipPhotoDialog.errorMessage
            ? `Erro ao enviar foto: ${skipPhotoDialog.errorMessage}\n\nDeseja concluir a parada sem foto de comprovante?`
            : 'A foto serve como prova de entrega. Deseja continuar sem foto?'
        }
        confirmText="Continuar sem foto"
        cancelText={skipPhotoDialog.errorMessage ? 'Tentar novamente' : 'Cancelar'}
        onConfirm={() => {
          setSkipPhotoDialog({ visible: false });
          setStep('confirm');
        }}
        onCancel={() => setSkipPhotoDialog({ visible: false })}
        type="destructive"
      />
    </>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  overlay: {
    flex: 1,
    backgroundColor: withOpacity(theme.colors.black, 0.5),
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  container: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  content: {
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
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
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
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
    marginBottom: theme.spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: theme.colors.success,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.gray100,
  },
  buttonPrimaryText: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.white,
  },
  buttonSecondaryText: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray600,
  },
}));
