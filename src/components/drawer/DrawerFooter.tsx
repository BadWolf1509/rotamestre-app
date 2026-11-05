/**
 * DrawerFooter component
 * Footer section with profile link, logout, and version info
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { getVersionString } from '@/lib/appVersion';
import { StyleSheet, type Theme } from '@/utils/styles';

interface DrawerFooterProps {
  isMotorista: boolean;
  onNavigateProfile: () => void;
  onLogout: () => void;
}

export function DrawerFooter({ isMotorista, onNavigateProfile, onLogout }: DrawerFooterProps) {
  return (
    <View style={styles.footer}>
      {/* Meu Perfil apenas para gestor (motorista já tem no menu) */}
      {!isMotorista && (
        <TouchableOpacity
          style={styles.footerItem}
          onPress={onNavigateProfile}
          activeOpacity={0.7}
        >
          <Text style={styles.footerIcon}>👤</Text>
          <Text style={styles.footerLabel}>Meu Perfil</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.footerItem} onPress={onLogout} activeOpacity={0.7}>
        <Text style={styles.footerIcon}>🚪</Text>
        <Text style={styles.footerLabel}>Sair</Text>
      </TouchableOpacity>

      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>{getVersionString()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    marginTop: 'auto',
    gap: theme.spacing['1'],
    backgroundColor: theme.colors.gray50,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.components.drawer.itemPaddingV,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
  },
  footerIcon: {
    fontSize: theme.typography.fontSize.lg,
    marginRight: theme.spacing.md,
    width: theme.components.drawer.menuIconWidth,
  },
  footerLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray600,
  },
  versionContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    alignItems: 'center',
  },
  versionText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray400,
    fontFamily: theme.typography.fontSansMedium,
  },
}));
