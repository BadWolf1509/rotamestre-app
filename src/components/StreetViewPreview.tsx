import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';

import { useUnistyles } from '@/utils/styles';

const { width: screenWidth } = Dimensions.get('window');

// Função para obter API key (permite testes mockarem process.env)
const getGoogleMapsApiKey = () => process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

interface StreetViewPreviewProps {
  latitude: number;
  longitude: number;
  address?: string;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
}

export function StreetViewPreview({
  latitude,
  longitude,
  address,
  size = 'medium',
  onPress,
}: StreetViewPreviewProps) {
  const { theme } = useUnistyles();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(true);
  const [modalError, setModalError] = useState(false);

  // Dimensões baseadas no tamanho
  const dimensions = {
    small: { width: 120, height: 80 },
    medium: { width: 200, height: 120 },
    large: { width: screenWidth - 64, height: 200 },
  };

  const currentSize = dimensions[size];

  // Obter API key dinamicamente (permite testes)
  const apiKey = getGoogleMapsApiKey();

  // URL da API Street View Static
  const getStreetViewUrl = (width: number, height: number, fov: number = 90) => {
    // Arredondar dimensões para inteiros (API requer valores inteiros)
    const w = Math.round(Math.min(width, 640));
    const h = Math.round(Math.min(height, 640));
    return `https://maps.googleapis.com/maps/api/streetview?` +
      `size=${w}x${h}&` +
      `location=${latitude},${longitude}&` +
      `fov=${fov}&` +
      `pitch=10&` +
      `key=${apiKey}`;
  };

  const streetViewUrl = getStreetViewUrl(currentSize.width, currentSize.height);
  // Modal usa tamanho fixo de 600x400 para garantir compatibilidade
  const modalStreetViewUrl = getStreetViewUrl(600, 400, 110);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Reset modal state ao abrir
      setModalLoading(true);
      setModalError(false);
      setModalVisible(true);
    }
  };

  const handleImageError = () => {
    setError(true);
    setLoading(false);
  };

  const handleImageLoad = () => {
    setLoading(false);
  };

  if (!apiKey) {
    return (
      <View style={[styles.container, currentSize, styles.errorContainer]}>
        <Ionicons name="image-outline" size={24} color={theme.colors.gray400} />
        <Text style={styles.errorText}>API Key não configurada</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.container, currentSize]}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {loading && !error && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        )}

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="image-outline" size={28} color={theme.colors.gray400} />
            <Text style={styles.errorText}>Imagem não disponível</Text>
            <Text style={styles.errorSubtext}>para este local</Text>
          </View>
        ) : (
          <>
            <Image
              source={{ uri: streetViewUrl }}
              style={[styles.image, currentSize]}
              onLoad={handleImageLoad}
              onError={handleImageError}
              resizeMode="cover"
            />

            {/* Overlay com ícone */}
            <View style={styles.overlay}>
              <View style={styles.iconContainer}>
                <Ionicons name="eye-outline" size={20} color="#fff" />
              </View>
              {size !== 'small' && address && (
                <View style={styles.addressContainer}>
                  <Text style={styles.addressText} numberOfLines={1}>
                    {address}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </TouchableOpacity>

      {/* Modal de visualização expandida */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            {/* Header do modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Street View</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Imagem expandida */}
            <View style={styles.modalImageContainer}>
              {modalLoading && (
                <View style={styles.modalLoadingOverlay}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
              )}
              {modalError ? (
                <View style={styles.modalErrorContainer}>
                  <Ionicons name="eye-off-outline" size={48} color={theme.colors.gray400} />
                  <Text style={styles.modalErrorText}>Street View indisponível</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: modalStreetViewUrl }}
                  style={styles.modalImage}
                  resizeMode="cover"
                  onLoad={() => setModalLoading(false)}
                  onError={() => {
                    setModalLoading(false);
                    setModalError(true);
                  }}
                />
              )}
            </View>

            {/* Endereço */}
            {address && (
              <View style={styles.modalAddress}>
                <Ionicons name="location" size={16} color={theme.colors.text} />
                <Text style={styles.modalAddressText}>{address}</Text>
              </View>
            )}

            {/* Instruções */}
            <Text style={styles.modalHint}>
              Use esta imagem para identificar o local de entrega
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const createStyles = (theme: ReturnType<typeof useUnistyles>['theme']) =>
  StyleSheet.create({
    container: {
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: theme.colors.gray100,
    },
    image: {
      borderRadius: 8,
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      zIndex: 1,
    },
    errorContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.gray100,
      borderWidth: 1,
      borderColor: theme.colors.gray200,
      borderStyle: 'dashed',
    },
    errorText: {
      fontSize: 12,
      color: theme.colors.gray600,
      marginTop: 4,
      fontWeight: '500',
    },
    errorSubtext: {
      fontSize: 11,
      color: theme.colors.gray500,
      marginTop: 2,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'space-between',
    },
    iconContainer: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: 4,
      padding: 4,
    },
    addressContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: 4,
    },
    addressText: {
      color: theme.colors.white,
      fontSize: 11,
      fontWeight: '500',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      width: screenWidth - 32,
      maxWidth: 400,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray200,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.gray800,
    },
    modalImageContainer: {
      width: '100%',
      height: 300,
      position: 'relative',
      backgroundColor: theme.colors.gray100,
    },
    modalImage: {
      width: '100%',
      height: 300,
    },
    modalLoadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.gray100,
      zIndex: 1,
    },
    modalErrorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.gray100,
    },
    modalErrorText: {
      fontSize: 14,
      color: theme.colors.gray600,
      marginTop: 8,
    },
    modalAddress: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 8,
    },
    modalAddressText: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.gray800,
    },
    modalHint: {
      fontSize: 12,
      color: theme.colors.gray600,
      textAlign: 'center',
      padding: 12,
      fontStyle: 'italic',
    },
  });
