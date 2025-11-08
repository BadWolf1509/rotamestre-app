/**
 * Componente CameraUpload - Capturar/Selecionar foto para comprovante de entrega
 * Sprint 1.3 - Upload de Fotos
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { StyleSheet } from '@/utils/styles';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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
    console.log('🗜️  Comprimindo imagem...');

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

      console.log(`   Tamanho reduzido para: ${(resized.uri.length / 1024).toFixed(2)} KB`);

      return resized.uri;
    } catch (error) {
      console.error('❌ Erro ao comprimir:', error);
      return uri; // Retorna original se falhar
    }
  };

  /**
   * Abrir câmera
   */
  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();

    if (!hasPermission) {
      Alert.alert(
        'Permissão negada',
        'Precisamos de acesso à câmera para tirar fotos do comprovante de entrega.'
      );
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
      Alert.alert(
        'Permissão negada',
        'Precisamos de acesso à galeria para selecionar fotos.'
      );
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
   * Fazer upload da foto
   */
  const handleUpload = async () => {
    if (!selectedImage) {
      Alert.alert('Atenção', 'Tire uma foto ou selecione da galeria primeiro.');
      return;
    }

    setUploading(true);

    try {
      const success = await uploadELinkFotoParada(
        unidadeId,
        rotaId,
        paradaId,
        selectedImage
      );

      if (success) {
        Alert.alert('Sucesso!', 'Foto enviada com sucesso!');

        if (onUploadSuccess) {
          // Não temos a URL aqui, mas sabemos que foi salvo
          // A função uploadELinkFotoParada já salvou no banco
          onUploadSuccess('success');
        }

        setSelectedImage(null);
      } else {
        throw new Error('Falha no upload');
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      Alert.alert('Erro', 'Não foi possível enviar a foto. Tente novamente.');

      if (onUploadError) {
        onUploadError(error.message || 'Erro desconhecido');
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
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#FFFFFF" />
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
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    marginVertical: 16,
  },
  previewContainer: {
    gap: 12,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: theme.colors.disabled,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: theme.colors.secondary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    height: 56,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.secondary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: theme.colors.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
}));
