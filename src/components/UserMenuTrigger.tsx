import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

import { useSignedUrl } from '@/hooks/storage/useSignedUrl';
import { useUnistyles } from '@/utils/styles';

interface UserMenuTriggerProps {
  name?: string;
  imageUrl?: string | null;
  isOpen?: boolean;
}

export function UserMenuTrigger({
  name,
  imageUrl,
  isOpen,
}: UserMenuTriggerProps) {
  const { url: signedImageUrl } = useSignedUrl(imageUrl);
  const { theme } = useUnistyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.lg,
        },
        greeting: {
          fontSize: theme.typography.sm,
          color: theme.colors.gray700,
        },
        name: {
          fontFamily: theme.typography.fontSansSemiBold,
        },
        avatarContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        avatar: {
          width: 40,
          height: 40,
          borderRadius: theme.borderRadius.full,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        avatarImage: {
          width: 40,
          height: 40,
        },
        avatarText: {
          color: theme.colors.white,
          fontFamily: theme.typography.fontSansBold,
          fontSize: theme.typography.lg,
        },
        chevron: {
          marginLeft: -4,
        },
      }),
    [theme],
  );

  const displayName = name?.trim().split(/\s+/)[0] || 'Usuário';
  const initial = displayName.charAt(0).toUpperCase() || '?';

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        Olá, <Text style={styles.name}>{displayName}</Text>
      </Text>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          {signedImageUrl ? (
            <Image
              source={{ uri: signedImageUrl }}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.avatarText}>{initial}</Text>
          )}
        </View>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.gray600}
          style={styles.chevron}
        />
      </View>
    </View>
  );
}
