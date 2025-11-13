import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { defaultTheme } from '@/utils/styles';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// PiP dimensions
const PIP_WIDTH = 120;
const PIP_HEIGHT = 180;
const EXPANDED_WIDTH = SCREEN_WIDTH * 0.9;
const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.4;
const EDGE_PADDING = 16;
const colors = defaultTheme.colors;

interface PictureInPictureMapProps {
  visible: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  destination: { latitude: number; longitude: number; address: string } | null;
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
  // Animation values
  const pan = useRef(new Animated.ValueXY({
    x: SCREEN_WIDTH - PIP_WIDTH - EDGE_PADDING,
    y: 100,
  })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Pan responder for dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isExpanded,
      onMoveShouldSetPanResponder: () => !isExpanded,
      onPanResponderGrant: () => {
        setIsDragging(true);
        Animated.spring(scale, {
          toValue: 0.9,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        setIsDragging(false);
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
        }).start();

        // Snap to edges
        const finalX = gestureState.moveX < SCREEN_WIDTH / 2
          ? EDGE_PADDING
          : SCREEN_WIDTH - PIP_WIDTH - EDGE_PADDING;

        // Keep within screen bounds
        const finalY = Math.max(
          50, // Top padding (below status bar)
          Math.min(
            SCREEN_HEIGHT - PIP_HEIGHT - 100, // Bottom padding (above tab bar)
            gestureState.moveY - PIP_HEIGHT / 2
          )
        );

        Animated.spring(pan, {
          toValue: { x: finalX, y: finalY },
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        }).start();
      },
    })
  ).current;

  // Show/hide animation
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [opacity, visible]);

  // Toggle expansion
  const toggleExpand = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    if (newExpanded) {
      // Expand to center
      Animated.parallel([
        Animated.spring(pan, {
          toValue: {
            x: (SCREEN_WIDTH - EXPANDED_WIDTH) / 2,
            y: (SCREEN_HEIGHT - EXPANDED_HEIGHT) / 2,
          },
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        }),
        Animated.spring(scale, {
          toValue: EXPANDED_WIDTH / PIP_WIDTH,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Collapse to corner
      Animated.parallel([
        Animated.spring(pan, {
          toValue: {
            x: SCREEN_WIDTH - PIP_WIDTH - EDGE_PADDING,
            y: 100,
          },
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  // Calculate region
  const getRegion = () => {
    if (userLocation && destination) {
      const minLat = Math.min(userLocation.latitude, destination.latitude);
      const maxLat = Math.max(userLocation.latitude, destination.latitude);
      const minLon = Math.min(userLocation.longitude, destination.longitude);
      const maxLon = Math.max(userLocation.longitude, destination.longitude);

      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLon + maxLon) / 2,
        latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.5),
        longitudeDelta: Math.max(0.01, (maxLon - minLon) * 1.5),
      };
    }

    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    return null;
  };

  const region = getRegion();

  if (!visible || !region) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: isExpanded ? EXPANDED_WIDTH : PIP_WIDTH,
          height: isExpanded ? EXPANDED_HEIGHT : PIP_HEIGHT,
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { scale },
          ],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Map */}
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={false}
        scrollEnabled={isExpanded}
        zoomEnabled={isExpanded}
        toolbarEnabled={false}
        pointerEvents={isExpanded ? 'auto' : 'none'}
      >
        {destination && (
          <Marker
            coordinate={destination}
            title={destination.address}
          >
            <View style={styles.destinationMarker}>
              <Ionicons name="location" size={20} color={colors.error} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Controls overlay */}
      <View style={styles.controls} pointerEvents="box-none">
        {/* Expand/Collapse button */}
        <TouchableOpacity
          style={[
            styles.controlButton,
            isExpanded && styles.collapseButton,
          ]}
          onPress={toggleExpand}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isExpanded ? 'contract' : 'expand'}
            size={16}
            color="#fff"
          />
        </TouchableOpacity>

        {/* Open full navigation button (only when expanded) */}
        {isExpanded && (
          <TouchableOpacity
            style={[styles.controlButton, styles.navigateButton]}
            onPress={onExpand}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={16} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Close button */}
        <TouchableOpacity
          style={[styles.controlButton, styles.closeButton]}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Drag indicator (only when collapsed) */}
      {!isExpanded && !isDragging && (
        <View style={styles.dragIndicator}>
          <View style={styles.dragBar} />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 999,
  },
  map: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapseButton: {
    backgroundColor: 'rgba(30, 90, 168, 0.9)',
  },
  navigateButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
  },
  closeButton: {
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
  },
  dragIndicator: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dragBar: {
    width: 30,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  destinationMarker: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});

