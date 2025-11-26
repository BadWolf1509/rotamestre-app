import { useRouter, usePathname } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity, Platform, Image } from 'react-native';

import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { StyleSheet, type Theme } from '@/utils/styles';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

const menuItems: MenuItem[] = [
  { id: 'inicio', label: 'Início', icon: '📊', path: '/gestor/inicio' },
  { id: 'nova-rota', label: 'Nova Rota', icon: '➕', path: '/gestor/nova-entrega' },
  { id: 'gestao-rotas', label: 'Gestão de Rotas', icon: '📋', path: '/gestor/gestao-rotas' },
  { id: 'motoristas', label: 'Motoristas', icon: '👥', path: '/gestor/motoristas' },
];

export function GestorSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { userData } = useUser();

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  }

  function isActive(path: string): boolean {
    return pathname === path;
  }

  return (
    <View style={styles.sidebar}>
      {/* Logo RotaMestre Completa */}
      <View style={styles.header}>
        <Image
          source={require('../../assets/splash-icon.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        {userData?.unidades?.nome && (
          <Text style={styles.unidadeName} numberOfLines={2}>
            {userData.unidades.nome}
          </Text>
        )}
      </View>

      {/* Menu Items */}
      <View style={styles.menu}>
        {menuItems.map((item) => {
          const active = isActive(item.path);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, active && styles.menuItemActive]}
              onPress={() => router.push(item.path as any)}
            >
              <Text style={[styles.menuIcon, active && styles.menuIconActive]}>{item.icon}</Text>
              <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* User Info & Logout */}
      <View style={styles.footer}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userData?.nome?.charAt(0).toUpperCase() || 'G'}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName} numberOfLines={1}>
              {userData?.nome || 'Gestor'}
            </Text>
            <Text style={styles.userRole}>Gestor</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  sidebar: {
    width: 260,
    height: '100%',
    backgroundColor: theme.colors.primaryDark,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'column',
    ...(Platform.OS === 'web' && {
      position: 'fixed' as any,
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 1000,
    }),
  },
  header: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  logoImage: {
    width: 220,
    height: 180,
    marginBottom: theme.spacing.sm,
  },
  unidadeName: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 16,
    textAlign: 'center',
  },
  menu: {
    flex: 1,
    paddingTop: theme.spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.secondary,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: theme.spacing.sm,
    opacity: 0.8,
  },
  menuIconActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  menuLabel: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  menuLabelActive: {
    color: theme.colors.background,
    fontWeight: '700',
  },
  footer: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.background,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.background,
    marginBottom: 2,
  },
  userRole: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoutIcon: {
    fontSize: 16,
    marginRight: theme.spacing.xs,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.background,
  },
}));
