import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  Text,
  View,
} from 'react-native';

import { useNotificationModal } from '@/context/NotificationModalContext';
import { useNotifications } from '@/hooks/useNotifications';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface NotificationBellProps {
  variant?: 'desktop' | 'mobile';
}

export function NotificationBell({ variant = 'desktop' }: NotificationBellProps) {
  const { theme } = useUnistyles();
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
        color={variant === 'desktop' ? theme.colors.gray700 : theme.colors.white}
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

const styles = StyleSheet.create((theme: Theme) => ({
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
    backgroundColor: theme.colors.gray50,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: theme.colors.error,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 18,
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  badgeText: {
    color: theme.colors.white,
    fontWeight: '700',
    textAlign: 'center',
  },
}));
