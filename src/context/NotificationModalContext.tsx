import React, { createContext, useContext, useState, useCallback } from 'react';
import {
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const screenHeight = Dimensions.get('screen').height;

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Handle Android back button
  React.useEffect(() => {
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
    if (Platform.OS !== 'web') return windowWidth * 0.9;
    if (isMobileWidth) return windowWidth * 0.95;
    if (isTabletWidth) return windowWidth * 0.85;
    return 480;
  };

  return (
    <NotificationModalContext.Provider value={{ isOpen, openModal, closeModal }}>
      {children}
      {isOpen && (
        <View style={[styles.absoluteOverlay, { height: screenHeight }]}>
          <Pressable
            style={styles.modalOverlay}
            onPress={closeModal}
          >
            <Pressable
              style={[styles.modalContent, { width: getModalWidth(), maxHeight: windowHeight * 0.8 }]}
              onPress={(e) => e.stopPropagation()}
            >
              <NotificationList onClose={closeModal} />
            </Pressable>
          </Pressable>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    maxWidth: 600,
    minHeight: 300,
    backgroundColor: theme.colors.white,
    borderRadius: 16,
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
