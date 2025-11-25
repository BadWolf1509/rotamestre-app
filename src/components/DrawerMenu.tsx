import { useRouter, usePathname } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
} from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import { StyleSheet } from '@/utils/styles';

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function DrawerMenu({ visible, onClose }: DrawerMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<any>(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);

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

  function handleLogoutPress() {

    setShowLogoutDialog(true);

  }



  async function handleLogoutConfirm() {

    setShowLogoutDialog(false);

    try {

      await supabase.auth.signOut();

      onClose();

      router.replace('/auth/login');

    } catch (error) {

      console.error('Erro ao fazer logout:', error);

      setShowErrorDialog(true);

    }

  }

  const gestorMenuItems = [
    { icon: '🏠', label: 'Início', path: '/gestor/inicio', show: true },
    { icon: '📦', label: 'Nova Rota', path: '/gestor/nova-entrega', show: true },
    { icon: '📋', label: 'Gestão de Rotas', path: '/gestor/gestao-rotas', show: true },
    { icon: '⚠️', label: 'Incidentes', path: '/gestor/incidentes', show: true },
    { icon: '🧑‍✈️', label: 'Motoristas', path: '/gestor/motoristas', show: true },
    { icon: '🏢', label: 'Minha Unidade', path: '/unidade', show: profile?.papel === 'gestor' },
    { icon: '👥', label: 'Equipe', path: '/unidade/equipe', show: profile?.papel === 'gestor' },
  ];

  const motoristaMenuItems = [
    { icon: '🏠', label: 'Início', path: '/motorista/inicio', show: true },
    { icon: '📍', label: 'Paradas', path: '/motorista/checkpoints', show: true },
    { icon: '🗺️', label: 'Mapa', path: '/motorista/mapa', show: true },
    { icon: '📑', label: 'Histórico', path: '/motorista/historico', show: true },
    { icon: '📊', label: 'Resumo', path: '/motorista/resumo', show: true },
  ];

  const isMotorista = profile?.papel === 'motorista';
  const menuItems = isMotorista ? motoristaMenuItems : gestorMenuItems;


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

              {/* Footer Actions */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.footerItem}
                  onPress={() => navigate(isMotorista ? '/motorista/perfil' : '/perfil')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.footerIcon}>👤</Text>
                  <Text style={styles.footerLabel}>Meu Perfil</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.footerItem}
                  onPress={handleLogoutPress}
                  activeOpacity={0.7}
                >
                  <Text style={styles.footerIcon}>🚪</Text>
                  <Text style={styles.footerLabel}>Sair</Text>
                </TouchableOpacity>

                <View style={styles.versionContainer}>
                  <Text style={styles.versionText}>Versão 1.0.0</Text>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </TouchableOpacity>
      </TouchableOpacity>
      <ConfirmDialog
        visible={showLogoutDialog}
        title="Sair da conta"
        message="Deseja realmente encerrar sua sessão?"
        confirmText="Sair"
        cancelText="Cancelar"
        type="destructive"
        onConfirm={handleLogoutConfirm}
        onCancel={() => setShowLogoutDialog(false)}
      />
      <ConfirmDialog
        visible={showErrorDialog}
        title="Erro ao sair"
        message="Não foi possível encerrar sua sessão. Tente novamente."
        confirmText="Entendi"
        cancelText="Fechar"
        type="destructive"
        onConfirm={() => setShowErrorDialog(false)}
        onCancel={() => setShowErrorDialog(false)}
      />
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
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    marginTop: 'auto',
    gap: 4,
    backgroundColor: theme.colors.gray50,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
  },
  footerIcon: {
    fontSize: 18,
    marginRight: theme.spacing.md,
    width: 24,
  },
  footerLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray600,
  },
  versionContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    alignItems: 'center',
  },
  versionText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray400,
    fontFamily: theme.typography.fontSansMedium,
  },
}));


