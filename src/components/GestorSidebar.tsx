import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/gestor/dashboard' },
  { id: 'nova-rota', label: 'Nova Rota', icon: '➕', path: '/gestor/nova-entrega' },
  { id: 'historico', label: 'Histórico', icon: '📋', path: '/gestor/historico' },
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

const styles = StyleSheet.create({
  sidebar: {
    width: 260,
    height: '100%',
    backgroundColor: '#0D5A9C', // Azul Dark - Brand Guidelines
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
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  logoImage: {
    width: 220,
    height: 180,
    marginBottom: 12,
  },
  unidadeName: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 16,
    textAlign: 'center',
  },
  menu: {
    flex: 1,
    paddingTop: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderLeftWidth: 4,
    borderLeftColor: '#f7a02a', // Laranja - Brand Guidelines
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 12,
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
    color: '#fff',
    fontWeight: '700',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF8C00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
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
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoutIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
