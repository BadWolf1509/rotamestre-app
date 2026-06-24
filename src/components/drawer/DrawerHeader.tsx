/**
 * DrawerHeader component
 * Displays user profile info in the drawer
 */

import React from 'react';
import { View, Text, Image } from 'react-native';

import { useSignedUrl } from '@/hooks/storage/useSignedUrl';
import type { Usuario } from '@/types/usuario';
import { StyleSheet, type Theme } from '@/utils/styles';

interface DrawerHeaderProps {
  profile: Usuario | null;
  unidade: { nome: string } | null;
}

export function DrawerHeader({ profile, unidade }: DrawerHeaderProps) {
  const { url: avatarUrl } = useSignedUrl(profile?.foto_url);

  return (
    <View style={styles.header}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.nome?.charAt(0) || '?'}
          </Text>
        </View>
      )}
      <Text style={styles.userName}>{profile?.nome}</Text>
      <Text style={styles.userEmail}>{profile?.email}</Text>
      {unidade && (
        <View style={styles.unitBadge}>
          <Text style={styles.unitBadgeText}>{unidade.nome}</Text>
        </View>
      )}
      {profile?.is_gestor_principal && (
        <View style={styles.principalBadge}>
          <Text style={styles.principalBadgeText}>⭐ Gestor Principal</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  header: {
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    alignItems: 'center',
  },
  avatar: {
    width: theme.components.drawer.avatarSize,
    height: theme.components.drawer.avatarSize,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  avatarImage: {
    width: theme.components.drawer.avatarSize,
    height: theme.components.drawer.avatarSize,
    borderRadius: theme.borderRadius.full,
    marginBottom: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.gray200,
  },
  avatarText: {
    fontSize: theme.typography.fontSize['2xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.white,
  },
  userName: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  userEmail: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.sm,
  },
  unitBadge: {
    backgroundColor: `${theme.colors.primary}10`,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing['1.5'],
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  unitBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primaryDark,
  },
  principalBadge: {
    backgroundColor: `${theme.colors.secondary}20`,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing['1.5'],
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  principalBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.secondary,
  },
}));
