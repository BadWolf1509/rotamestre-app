import React, { useState } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUnistyles } from '@/utils/styles';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Substitua com sua chave de API do Google
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Dimensões baseadas no tamanho
  const dimensions = {
    small: { width: 120, height: 80 },
    medium: { width: 200, height: 120 },
    large: { width: screenWidth - 32, height: 200 },
  };

  const currentSize = dimensions[size];

  // URL da API Street View Static
  const getStreetViewUrl = (width: number, height: number, fov: number = 90) => {
    return `https://maps.googleapis.com/maps/api/streetview/static?` +
      `size=${width}x${height}&` +
      `location=${latitude},${longitude}&` +
      `fov=${fov}&` +
      `pitch=10&` +
      `key=${GOOGLE_MAPS_API_KEY}`;
  };

  const streetViewUrl = getStreetViewUrl(currentSize.width, currentSize.height);
  const modalStreetViewUrl = getStreetViewUrl(screenWidth, 400, 110);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
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

  if (!GOOGLE_MAPS_API_KEY) {
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
            <Ionicons name="eye-off-outline" size={24} color={theme.colors.gray400} />
            <Text style={styles.errorText}>Street View indisponível</Text>
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
            <Image
              source={{ uri: modalStreetViewUrl }}
              style={styles.modalImage}
              resizeMode="cover"
            />

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

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
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
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  errorText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
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
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
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
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalImage: {
    width: '100%',
    height: 400,
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
    color: '#333',
  },
  modalHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    padding: 12,
    fontStyle: 'italic',
  },
});