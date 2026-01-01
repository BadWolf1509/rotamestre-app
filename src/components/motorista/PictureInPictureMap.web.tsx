import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';

import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface PictureInPictureMapProps {
  visible: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  } | null;
  onClose: () => void;
  onExpand: () => void;
}

export function PictureInPictureMap({
  visible,
  userLocation,
  destination,
  onClose,
  onExpand,
}: PictureInPictureMapProps) {
  const { theme } = useUnistyles();

  if (!visible || !destination) return null;

  const openGoogleMaps = () => {
    if (!destination) return;

    const origin = userLocation
      ? `${userLocation.latitude},${userLocation.longitude}`
      : '';

    const dest = `${destination.latitude},${destination.longitude}`;

    const url = `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${origin}` : ''}&destination=${dest}&travelmode=driving`;

    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  return (
    <Animated.View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onExpand} style={styles.expandButton}>
          <Ionicons name="expand" size={18} color={theme.colors.white} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={18} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.mapPlaceholder} onPress={openGoogleMaps}>
        <Ionicons name="map" size={40} color={theme.colors.gray500} />
        <Text style={styles.placeholderText}>Mini Mapa</Text>
        <Text style={styles.addressText} numberOfLines={2}>
          {destination.address}
        </Text>
        <View style={styles.openButton}>
          <Ionicons name="open-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.openButtonText}>Abrir Maps</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 200,
    height: 250,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    elevation: 10,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 1,
    gap: 8,
  },
  expandButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: withOpacity(theme.colors.primary, 0.9),
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: withOpacity(theme.colors.black, 0.6),
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
    padding: 16,
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.gray700,
  },
  addressText: {
    marginTop: 8,
    fontSize: 11,
    color: theme.colors.gray500,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.infoBg,
    borderRadius: 6,
  },
  openButtonText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
}));
