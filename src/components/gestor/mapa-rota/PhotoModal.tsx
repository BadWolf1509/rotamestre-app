/**
 * PhotoModal - Modal unificado para visualização de fotos
 * Funciona em desktop (usando DesktopModal) e mobile (usando Modal nativo)
 */

import React from 'react';
import { View, Text, TouchableOpacity, Image, Modal } from 'react-native';

import { DesktopModal } from '@/components/desktop/DesktopModal';

import { styles } from './styles';

interface PhotoModalProps {
  visible: boolean;
  photoUrl: string | null;
  onClose: () => void;
  isDesktop?: boolean;
  title?: string;
}

export function PhotoModal({
  visible,
  photoUrl,
  onClose,
  isDesktop = false,
  title = 'Foto da Entrega',
}: PhotoModalProps) {
  if (!photoUrl) return null;

  // Desktop version using DesktopModal
  if (isDesktop) {
    return (
      <DesktopModal visible={visible} onClose={onClose} title={title} maxWidth={800}>
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Image
            source={{ uri: photoUrl }}
            style={styles.desktopModalImage}
            resizeMode="contain"
          />
        </View>
      </DesktopModal>
    );
  }

  // Mobile version using native Modal
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalCloseArea} onPress={onClose} activeOpacity={1}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
              <Text style={styles.modalCloseButtonText}>x</Text>
            </TouchableOpacity>
            <Image source={{ uri: photoUrl }} style={styles.fotoGrande} resizeMode="contain" />
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
