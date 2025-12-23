import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useNotificationModal } from '@/context/NotificationModalContext';
import { useNotifications } from '@/hooks/useNotifications';

interface NotificationBellProps {
  variant?: 'desktop' | 'mobile';
}

export function NotificationBell({ variant = 'desktop' }: NotificationBellProps) {
  const { naoLidas } = useNotifications();
  const { openModal } = useNotificationModal();

  const handlePress = () => {
    openModal();
  };

  const iconSize = variant === 'desktop' ? 24 : 26;
  const badgeSize = variant === 'desktop' ? 18 : 20;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        variant === 'mobile' && styles.mobileContainer,
      ]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 8,
    borderRadius: 8,
  },
  mobileContainer: {
    padding: 8,
    marginRight: 8,
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
});
