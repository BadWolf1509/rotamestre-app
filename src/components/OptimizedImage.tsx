import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  View,
  ActivityIndicator,
  StyleSheet as RNStyleSheet,
  ImageProps,
  Animated,
  Platform,
  Text,
} from 'react-native';

import PerformanceOptimizer from '@/services/performanceOptimizer';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// Conditional import for expo-blur (only used on iOS)
let BlurView: React.ComponentType<{ intensity: number; style: any }> | null = null;
try {
   
  BlurView = require('expo-blur').BlurView;
} catch {
  // expo-blur not available
}

// Import file system conditionally for native only
const FileSystem = Platform.OS !== 'web' ? require('expo-file-system') : null;
const Crypto = Platform.OS !== 'web' ? require('expo-crypto') : null;

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
  source: { uri: string } | number;
  placeholder?: { uri: string } | number;
  width?: number;
  height?: number;
  priority?: 'high' | 'normal' | 'low';
  enableCache?: boolean;
  enableLazyLoad?: boolean;
  blurRadius?: number;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: any) => void;
}

const CACHE_DIR = Platform.OS !== 'web' && FileSystem ? `${FileSystem.cacheDirectory}images/` : '';

export function OptimizedImage({
  source,
  placeholder,
  width,
  height,
  priority = 'normal',
  enableCache = true,
  enableLazyLoad = true,
  blurRadius = 10,
  onLoadStart,
  onLoadEnd,
  onError,
  style,
  ...props
}: OptimizedImageProps) {
  const { theme } = useUnistyles();
  const [isLoading, setIsLoading] = useState(true);
  const [imageSource, setImageSource] = useState<{ uri: string } | number>(
    placeholder || source
  );
  const [error, setError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Declare helper functions BEFORE loadImage to avoid "used before declaration" errors
  const animateImageLoad = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const getCachedImage = useCallback(async (uri: string): Promise<string | null> => {
    if (Platform.OS === 'web' || !FileSystem || !Crypto) {
      return null;
    }

    try {
      // Generate cache key
      const cacheKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.MD5,
        uri
      );
      const cacheFilePath = `${CACHE_DIR}${cacheKey}.jpg`;

      // Check if cached file exists
      const fileInfo = await FileSystem.getInfoAsync(cacheFilePath);
      if (fileInfo.exists && !fileInfo.isDirectory) {
        // Check if cache is not too old (7 days)
        const age = Date.now() - (fileInfo.modificationTime || 0) * 1000;
        if (age < 7 * 24 * 60 * 60 * 1000) {
          return cacheFilePath;
        }
      }
    } catch (error) {
      console.error('Error checking cache:', error);
    }
    return null;
  }, []);

  const downloadAndCacheImage = useCallback(
    async (uri: string): Promise<string | null> => {
      if (Platform.OS === 'web' || !FileSystem || !Crypto) {
        return null;
      }

      try {
        // Ensure cache directory exists
        const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
        }

        // Generate cache key
        const cacheKey = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.MD5,
          uri
        );
        const cacheFilePath = `${CACHE_DIR}${cacheKey}.jpg`;

        // Download image
        const downloadResult = await FileSystem.downloadAsync(uri, cacheFilePath);

        if (downloadResult.status === 200) {
          return downloadResult.uri;
        }
      } catch (error) {
        console.error('Error caching image:', error);
      }
      return null;
    },
    []
  );

  const loadImage = useCallback(async () => {
    if (typeof source === 'number') return;

    const { uri } = source;
    if (!uri) return;

    setIsLoading(true);
    onLoadStart?.();

    try {
      let finalUri = uri;

      // Apply image optimization if enabled
      if (Platform.OS === 'web') {
        finalUri = PerformanceOptimizer.getOptimizedImageUrl(uri, width, height);
      }

      // Check cache if enabled
      if (enableCache && Platform.OS !== 'web') {
        const cachedUri = await getCachedImage(uri);
        if (cachedUri && mountedRef.current) {
          setImageSource({ uri: cachedUri });
          setIsLoading(false);
          animateImageLoad();
          onLoadEnd?.();
          return;
        }
      }

      // Load image with priority
      if (enableLazyLoad) {
        await PerformanceOptimizer.deferOperation(async () => {
          if (!mountedRef.current) return;

          // Download and cache if needed
          if (enableCache && Platform.OS !== 'web') {
            const localUri = await downloadAndCacheImage(uri);
            if (localUri && mountedRef.current) {
              setImageSource({ uri: localUri });
            }
          } else {
            setImageSource({ uri: finalUri });
          }

          if (mountedRef.current) {
            setIsLoading(false);
            animateImageLoad();
            onLoadEnd?.();
          }
        }, priority);
      } else {
        // Immediate load
        if (enableCache && Platform.OS !== 'web') {
          const localUri = await downloadAndCacheImage(uri);
          if (localUri && mountedRef.current) {
            setImageSource({ uri: localUri });
          }
        } else {
          setImageSource({ uri: finalUri });
        }

        if (mountedRef.current) {
          setIsLoading(false);
          animateImageLoad();
          onLoadEnd?.();
        }
      }
    } catch (err) {
      console.error('Error loading image:', err);
      if (mountedRef.current) {
        setError(true);
        setIsLoading(false);
        onError?.(err);
        onLoadEnd?.();
      }
    }
  }, [
    animateImageLoad,
    downloadAndCacheImage,
    enableCache,
    enableLazyLoad,
    getCachedImage,
    height,
    onLoadEnd,
    onLoadStart,
    onError,
    priority,
    source,
    width,
  ]);

  useEffect(() => {
    if (typeof source === 'number') {
      // Local image, no optimization needed
      setImageSource(source);
      setIsLoading(false);
      return;
    }

    loadImage();
  }, [loadImage, source]);

  const handleError = (err: any) => {
    setError(true);
    setIsLoading(false);
    onError?.(err);
  };

  // Calculate optimized dimensions
  const getOptimizedStyle = () => {
    const baseStyle = RNStyleSheet.flatten(style);

    if (width && height) {
      return {
        ...baseStyle,
        width,
        height,
      };
    }

    return baseStyle;
  };

  if (error) {
    return (
      <View style={[styles.container, getOptimizedStyle()]}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, getOptimizedStyle()]}>
      {isLoading && placeholder && (
        <View style={RNStyleSheet.absoluteFillObject}>
          <Image
            source={placeholder}
            style={[RNStyleSheet.absoluteFillObject, getOptimizedStyle()]}
            blurRadius={blurRadius}
            {...props}
          />
          {Platform.OS === 'ios' && BlurView && (
            <BlurView intensity={80} style={RNStyleSheet.absoluteFillObject} />
          )}
          <ActivityIndicator
            style={styles.loader}
            size="small"
            color={theme.colors.gray500}
          />
        </View>
      )}

      <Animated.Image
        source={imageSource}
        style={[
          RNStyleSheet.absoluteFillObject,
          getOptimizedStyle(),
          { opacity: fadeAnim },
        ]}
        onError={handleError}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    overflow: 'hidden',
    backgroundColor: theme.colors.gray100,
  },
  loader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -10,
    marginLeft: -10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray100,
  },
  errorIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 40,
    opacity: 0.5,
  },
}));
