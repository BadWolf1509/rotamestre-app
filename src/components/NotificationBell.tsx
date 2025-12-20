import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useNotifications } from '@/hooks/useNotifications';

import { NotificationList } from './NotificationList';

interface NotificationBellProps {
  variant?: 'desktop' | 'mobile';
}

export function NotificationBell({ variant = 'desktop' }: NotificationBellProps) {
  const { naoLidas } = useNotifications();
  const [modalVisible, setModalVisible] = useState(false);
  const { width: windowWidth } = useWindowDimensions();

  const iconSize = variant === 'desktop' ? 24 : 26;
  const badgeSize = variant === 'desktop' ? 18 : 20;

  // Responsividade: mobile < 480px, tablet < 768px
  const isMobileWidth = windowWidth < 480;
  const isTabletWidth = windowWidth < 768;

  // Modal width responsivo
  const getModalWidth = () => {
    if (Platform.OS !== 'web') return '90%';
    if (isMobileWidth) return '95%';
    if (isTabletWidth) return '85%';
    return 480;
  };

  return (
    <>
      <Pressable
        onPress={() => setModalVisible(true)}
        style={({ pressed }) => [
          styles.container,
          pressed && styles.pressed,
          variant === 'mobile' && styles.mobileContainer,
        ]}
        accessibilityLabel="Notificações"
        accessibilityHint={`${naoLidas} notificações não lidas`}
      >
        <Ionicons
          name={naoLidas > 0 ? 'notifications' : 'notifications-outline'}
          size={iconSize}
          color={variant === 'desktop' ? '#334155' : '#FFFFFF'}
        />
        {naoLidas > 0 && (
          <View style={[styles.badge, { width: badgeSize, height: badgeSize }]}>
            <Text style={[styles.badgeText, { fontSize: badgeSize * 0.6 }]}>
              {naoLidas > 99 ? '99+' : naoLidas}
            </Text>
          </View>
        )}
      </Pressable>

      <Modal
        visible={modalVisible}
        animationType={Platform.OS === 'web' ? 'none' : 'slide'}
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
          testID="modal-overlay"
        >
          <Pressable
            style={[styles.modalContent, { width: getModalWidth() }]}
            onPress={(e) => e.stopPropagation()}
            testID="modal-content"
          >
            <NotificationList onClose={() => setModalVisible(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 8,
    borderRadius: 8,
  },
  mobileContainer: {
    padding: 4,
  },
  pressed: {
    opacity: 0.7,
    backgroundColor: '#f1f5f9',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    maxWidth: 600,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      },
    }),
  },
});
