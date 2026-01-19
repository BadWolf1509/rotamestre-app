import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';

import { NotificationList } from '@/components/NotificationList';
import { boxShadow } from '@/utils/color';
import { StyleSheet, type Theme } from '@/utils/styles';

interface NotificationModalContextType {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const NotificationModalContext = createContext<NotificationModalContextType | undefined>(undefined);

export function useNotificationModal() {
  const context = useContext(NotificationModalContext);
  if (!context) {
    throw new Error('useNotificationModal must be used within NotificationModalProvider');
  }
  return context;
}

interface NotificationModalProviderProps {
  children: React.ReactNode;
}

export function NotificationModalProvider({ children }: NotificationModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const screenHeight = Dimensions.get('screen').height;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const openModal = useCallback(() => {
    setIsVisible(true);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    // Animate out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 50,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
      setIsOpen(false);
    });
  }, [fadeAnim, slideAnim]);

  // Animate in when modal opens
  useEffect(() => {
    if (isOpen) {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, fadeAnim, slideAnim]);

  // Handle Android back button
  useEffect(() => {
    if (!isOpen) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      closeModal();
      return true;
    });

    return () => backHandler.remove();
  }, [isOpen, closeModal]);

  // Responsividade: mobile < 480px, tablet < 768px
  const isMobileWidth = windowWidth < 480;
  const isTabletWidth = windowWidth < 768;

  // Modal width responsivo
  const getModalWidth = () => {
    if (Platform.OS !== 'web') return windowWidth * 0.92;
    if (isMobileWidth) return windowWidth * 0.95;
    if (isTabletWidth) return windowWidth * 0.85;
    return 480;
  };

  // Modal height - usa screenHeight no Android para compensar navigation bar
  // Cada notificação ocupa ~110px, header ~56px
  // Para exibir 5 notificações: 56 + (5 × 110) = 606px
  const getModalMaxHeight = () => {
    if (Platform.OS === 'android') {
      // Android: 80% do screen height (evita problemas com navigation bar)
      return screenHeight * 0.8;
    }
    if (Platform.OS === 'ios') {
      return windowHeight * 0.8;
    }
    // Web: mobile usa mais altura, desktop limita para não ficar muito grande
    if (isMobileWidth) return windowHeight * 0.85;
    return windowHeight * 0.75;
  };

  // Altura mínima para mostrar pelo menos 4-5 notificações
  const getModalMinHeight = () => {
    const baseHeight = Platform.OS === 'android' ? screenHeight : windowHeight;
    // Mobile: pelo menos 50% da tela, mas entre 400-550px
    if (Platform.OS !== 'web' || isMobileWidth) {
      return Math.max(400, Math.min(baseHeight * 0.55, 550));
    }
    // Desktop: altura fixa mínima
    return 450;
  };

  return (
    <NotificationModalContext.Provider value={{ isOpen, openModal, closeModal }}>
      {children}
      {isVisible && (
        <View style={[styles.absoluteOverlay, { height: screenHeight }]}>
          <Animated.View
            style={[
              styles.modalOverlay,
              { opacity: fadeAnim },
            ]}
          >
            <Pressable
              style={styles.overlayPressable}
              onPress={closeModal}
            >
              <Animated.View
                style={[
                  styles.modalContent,
                  {
                    width: getModalWidth(),
                    minHeight: getModalMinHeight(),
                    maxHeight: getModalMaxHeight(),
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                {/*
                  View wrapper com altura definida para Android.
                  O Pressable captura eventos para evitar fechar ao clicar no conteúdo.
                  No Android, flex:1 requer altura explícita no container pai.
                */}
                <Pressable
                  onPress={(e) => e.stopPropagation()}
                  style={{ flex: 1 }}
                >
                  <NotificationList onClose={closeModal} />
                </Pressable>
              </Animated.View>
            </Pressable>
          </Animated.View>
        </View>
      )}
    </NotificationModalContext.Provider>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  absoluteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
  },
  overlayPressable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    maxWidth: 600,
    // minHeight é definido dinamicamente via getModalMinHeight()
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: boxShadow(0, 4, 20, 0, theme.colors.black, 0.15),
      },
    }),
  },
}));
