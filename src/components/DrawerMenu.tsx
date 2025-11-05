import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useRouter, usePathname } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function DrawerMenu({ visible, onClose }: DrawerMenuProps) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, [visible]);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('usuarios')
        .select('*, unidades(nome)')
        .eq('id', user.id)
        .single();
      setProfile(data);
    }
  }

  function navigate(path: string) {
    onClose();
    router.push(path);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    onClose();
    router.replace('/auth/login');
  }

  const menuItems = [
    {
      icon: '🏠',
      label: 'Dashboard',
      path: '/gestor/dashboard',
      show: true,
    },
    {
      icon: '📦',
      label: 'Nova Rota',
      path: '/gestor/nova-entrega',
      show: true,
    },
    {
      icon: '📋',
      label: 'Histórico',
      path: '/gestor/historico',
      show: true,
    },
    {
      icon: '👥',
      label: 'Motoristas',
      path: '/gestor/motoristas',
      show: true,
    },
    {
      icon: '👤',
      label: 'Meu Perfil',
      path: '/perfil',
      show: true,
    },
    {
      icon: '🏢',
      label: 'Minha Unidade',
      path: '/unidade',
      show: profile?.papel === 'gestor',
    },
    {
      icon: '👥',
      label: 'Equipe',
      path: '/unidade/equipe',
      show: profile?.papel === 'gestor',
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.drawer}
          onPress={(e) => e.stopPropagation()}
        >
          <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.content}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {profile?.nome?.charAt(0) || '?'}
                  </Text>
                </View>
                <Text style={styles.userName}>{profile?.nome}</Text>
                <Text style={styles.userEmail}>{profile?.email}</Text>
                {profile?.unidades && (
                  <View style={styles.unitBadge}>
                    <Text style={styles.unitBadgeText}>
                      {profile.unidades.nome}
                    </Text>
                  </View>
                )}
                {profile?.is_gestor_principal && (
                  <View style={styles.principalBadge}>
                    <Text style={styles.principalBadgeText}>
                      ⭐ Gestor Principal
                    </Text>
                  </View>
                )}
              </View>

              {/* Menu Items */}
              <View style={styles.menuSection}>
                {menuItems
                  .filter((item) => item.show)
                  .map((item, index) => {
                    const isActive = pathname === item.path;
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.menuItem, isActive && styles.menuItemActive]}
                        onPress={() => navigate(item.path)}
                      >
                        <Text style={styles.menuIcon}>{item.icon}</Text>
                        <Text
                          style={[
                            styles.menuLabel,
                            isActive && styles.menuLabelActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>

              {/* Logout */}
              <View style={styles.footer}>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                  <Text style={styles.logoutIcon}>🚪</Text>
                  <Text style={styles.logoutText}>Sair da Conta</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create(theme => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
  },
  drawer: {
    width: '80%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: theme.colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  avatarText: {
    fontSize: theme.typography['2xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.white,
  },
  userName: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.sm,
  },
  unitBadge: {
    backgroundColor: `${theme.colors.primary}10`,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  unitBadgeText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primaryDark,
  },
  principalBadge: {
    backgroundColor: `${theme.colors.secondary}20`,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  principalBadgeText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.secondary,
  },
  menuSection: {
    paddingVertical: theme.spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.xl,
  },
  menuItemActive: {
    backgroundColor: `${theme.colors.primary}10`,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: theme.spacing.lg,
    width: 24,
  },
  menuLabel: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray700,
  },
  menuLabelActive: {
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
  footer: {
    padding: theme.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    marginTop: 'auto',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: `${theme.colors.error}10`,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: `${theme.colors.error}30`,
  },
  logoutIcon: {
    fontSize: 20,
    marginRight: theme.spacing.md,
  },
  logoutText: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.error,
  },
}));
