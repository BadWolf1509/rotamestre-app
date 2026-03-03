/**
 * Componente CameraUpload - Capturar/Selecionar foto para comprovante de entrega
 * Sprint 1.3 - Upload de Fotos
 * Atualizado: Suporte offline para fotos
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Platform
} from 'react-native';

import { Progress } from '@/components/Progress';
import { useAlert } from '@/hooks/useAlert';
import { logger } from '@/lib/logger';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { isOnline, queuePhotoUpload, hasOfflinePhoto, getOfflinePhotoPath } from '../lib/offline';
import { uploadELinkFotoParada } from '../lib/storage';

interface CameraUploadProps {
  unidadeId: string;
  rotaId: string;
  paradaId: string;
  onUploadSuccess?: (fotoUrl: string) => void;
  onUploadError?: (error: string) => void;
}

export default function CameraUpload({
  unidadeId,
  rotaId,
  paradaId,
  onUploadSuccess,
  onUploadError
}: CameraUploadProps) {
  const { theme } = useUnistyles();
  const { showWarning, showSuccess, showError, AlertDialog } = useAlert();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingSync, setPendingSync] = useState(false);
  const [offlinePhotoPath, setOfflinePhotoPath] = useState<string | null>(null);

  // Verificar se já existe foto offline para esta parada
  useEffect(() => {
    const checkOfflinePhoto = async () => {
      if (Platform.OS === 'web') return;

      const hasPending = await hasOfflinePhoto(paradaId);
      if (hasPending) {
        setPendingSync(true);
        const path = await getOfflinePhotoPath(paradaId);
        setOfflinePhotoPath(path);
      }
    };
    checkOfflinePhoto();
  }, [paradaId]);

  /**
   * Solicitar permissões de câmera
   */
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  };

  /**
   * Solicitar permissões de galeria
   */
  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };

  /**
   * Comprimir imagem para <500KB
   */
  const compressImage = async (uri: string): Promise<string> => {
    try {
      // Primeiro resize para max 1200px (mantém qualidade razoável)
      const resized = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            resize: {
              width: 1200, // Max width
            },
          },
        ],
        {
          compress: 0.7, // 70% de qualidade
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      return resized.uri;
    } catch (error) {
      logger.error('[CameraUpload] Erro ao comprimir:', error);
      return uri; // Retorna original se falhar
    }
  };

  /**
   * Abrir câmera
   */
  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();

    if (!hasPermission) {
      showWarning('Permissão negada', 'Precisamos de acesso à câmera para tirar fotos do comprovante de entrega.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const compressedUri = await compressImage(result.assets[0].uri);
      setSelectedImage(compressedUri);
    }
  };

  /**
   * Abrir galeria
   */
  const openGallery = async () => {
    const hasPermission = await requestGalleryPermission();

    if (!hasPermission) {
      showWarning('Permissão negada', 'Precisamos de acesso à galeria para selecionar fotos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const compressedUri = await compressImage(result.assets[0].uri);
      setSelectedImage(compressedUri);
    }
  };

  /**
   * Fazer upload da foto (online) ou salvar para sync (offline)
   */
  const handleUpload = async () => {
    if (!selectedImage) {
      showWarning('Atenção', 'Tire uma foto ou selecione da galeria primeiro.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Verificar se está online
      const online = await isOnline();

      if (online) {
        // Upload direto with progress tracking
        const success = await uploadELinkFotoParada(
          unidadeId,
          rotaId,
          paradaId,
          selectedImage,
          (percent) => setUploadProgress(percent)
        );

        if (success) {
          // No web, não usar alert para evitar conflitos com o modal do StopCompletionFlow
          // O step 'confirm' já dá feedback visual suficiente
          if (Platform.OS !== 'web') {
            showSuccess('Sucesso!', 'Foto enviada com sucesso!');
          }

          if (onUploadSuccess) {
            onUploadSuccess('success');
          }

          setSelectedImage(null);
        } else {
          throw new Error('Falha no upload');
        }
      } else {
        // Modo offline - salvar localmente para sync posterior
        if (Platform.OS === 'web') {
          showWarning('Sem conexão', 'Você está offline. Conecte-se à internet para enviar a foto.');
          return;
        }

        await queuePhotoUpload(unidadeId, rotaId, paradaId, selectedImage);

        showSuccess('Foto salva', 'Você está offline. A foto será enviada automaticamente quando a conexão for restaurada.');

        setPendingSync(true);
        setOfflinePhotoPath(selectedImage);

        if (onUploadSuccess) {
          onUploadSuccess('pending_sync');
        }

        setSelectedImage(null);
      }
    } catch (error) {
      logger.error('[CameraUpload] Erro no upload:', error);

      // Se falhou online, tentar salvar offline (apenas native)
      if (Platform.OS !== 'web') {
        try {
          await queuePhotoUpload(unidadeId, rotaId, paradaId, selectedImage);

          showWarning('Erro de conexão', 'Não foi possível enviar a foto agora. Ela será enviada automaticamente quando a conexão for restaurada.');

          setPendingSync(true);
          setOfflinePhotoPath(selectedImage);

          if (onUploadSuccess) {
            onUploadSuccess('pending_sync');
          }

          setSelectedImage(null);
          return;
        } catch {
          // Se falhou até salvar offline, mostrar erro
        }
      }

      showError({ title: 'Erro', message: 'Não foi possível enviar a foto. Tente novamente.' });

      if (onUploadError) {
        onUploadError(error instanceof Error ? error.message : 'Erro desconhecido');
      }
    } finally {
      setUploading(false);
    }
  };

  /**
   * Mostrar opções (câmera ou galeria)
   */
  const showOptions = () => {
    if (Platform.OS === 'web') {
      // No web, apenas galeria funciona
      openGallery();
    } else {
      Alert.alert(
        'Adicionar Foto',
        'Escolha uma opção:',
        [
          {
            text: '📷 Tirar Foto',
            onPress: openCamera,
          },
          {
            text: '🖼️ Escolher da Galeria',
            onPress: openGallery,
          },
          {
            text: 'Cancelar',
            style: 'cancel',
          },
        ]
      );
    }
  };

  // Mostrar indicador de foto pendente de sync
  if (pendingSync && offlinePhotoPath) {
    return (
      <View style={styles.container}>
        <View style={styles.pendingSyncContainer}>
          <Image source={{ uri: offlinePhotoPath }} style={styles.previewImage} />
          <View style={styles.pendingSyncBadge}>
            <Text style={styles.pendingSyncText}>
              📷 Foto aguardando sincronização
            </Text>
            <Text style={styles.pendingSyncSubtext}>
              Será enviada automaticamente quando conectar
            </Text>
          </View>
        </View>
        {AlertDialog}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {selectedImage ? (
        // Preview da foto selecionada
        <View style={styles.previewContainer}>
          <Image source={{ uri: selectedImage }} style={styles.previewImage} />

          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={() => setSelectedImage(null)}
              disabled={uploading}
            >
              <Text style={styles.buttonTextSecondary}>❌ Remover</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.buttonPrimary,
                uploading && styles.buttonUploading,
              ]}
              onPress={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <View style={styles.uploadingContainer}>
                  <Progress
                    progress={uploadProgress / 100}
                    label="Enviando foto..."
                    size="small"
                    color="primary"
                  />
                </View>
              ) : (
                <Text style={styles.buttonText}>📤 Enviar Foto</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Botão para adicionar foto
        <TouchableOpacity
          style={styles.addButton}
          onPress={showOptions}
          disabled={uploading}
        >
          <Text style={styles.addButtonText}>📸 Adicionar Foto do Comprovante</Text>
        </TouchableOpacity>
      )}
      {AlertDialog}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    marginVertical: theme.spacing.lg,
  },
  previewContainer: {
    gap: theme.spacing.md,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.disabled,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: theme.colors.secondary,
  },
  buttonUploading: {
    minHeight: 56,
    paddingVertical: theme.spacing.sm,
  },
  uploadingContainer: {
    width: '100%',
    paddingHorizontal: theme.spacing.md,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonText: {
    color: theme.colors.surface,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  buttonTextSecondary: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  addButton: {
    height: 56,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 2,
    borderColor: theme.colors.secondary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: theme.colors.secondary,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  pendingSyncContainer: {
    gap: theme.spacing.sm,
  },
  pendingSyncBadge: {
    backgroundColor: theme.colors.warning + '20',
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  pendingSyncText: {
    color: theme.colors.warning,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    textAlign: 'center',
  },
  pendingSyncSubtext: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.xs,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
}));

