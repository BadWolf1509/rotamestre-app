import { useRouter, usePathname } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import LogoHorizontal from '@/../assets/logo-horizontal1.png';
import { ConfirmDialog } from '@/components/ConfirmDialog';
// REMOVIDO: import { useUser } from '@/hooks/useUser'; // userData agora vem como prop
import { authService } from '@/lib/auth';
import { StyleSheet } from '@/utils/styles';

interface SidebarProps {
  onNavigate?: () => void;
  userData?: any; // ✅ Receber userData como prop
}

/**
 * Sidebar fixa para layout desktop
 * Inspirada no design do rotamestre-painel
 * Compatível com DrawerMenu mobile
 */
export function Sidebar({ onNavigate, userData }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  // REMOVIDO: const { userData } = useUser(); // Evitar chamada duplicada
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  const navItems = [
    {
      label: 'Dashboard',
      icon: '🏠',
      path: '/gestor/dashboard',
      show: true,
    },
    {
      label: 'Nova Rota',
      icon: '📦',
      path: '/gestor/nova-entrega',
      show: true,
    },
    {
      label: 'Histórico',
      icon: '📋',
      path: '/gestor/historico',
      show: true,
    },
    {
      label: 'Motoristas',
      icon: '👥',
      path: '/gestor/motoristas',
      show: true,
    },
    {
      label: 'Meu Perfil',
      icon: '👤',
      path: '/perfil',
      show: true,
    },
    {
      label: 'Minha Unidade',
      icon: '🏢',
      path: '/unidade',
      show: userData?.papel === 'gestor',
    },
    {
      label: 'Equipe',
      icon: '👥',
      path: '/unidade/equipe',
      show: userData?.papel === 'gestor',
    },
  ];

  const handleNavigation = (path: string) => {
    router.push(path as any);
    onNavigate?.();
  };

  async function handleLogoutConfirm() {
    setShowLogoutDialog(false);
    try {
      await authService.signOut();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      setShowErrorDialog(true);
    }
  }

  return (
    <>
      <View style={styles.container}>
        {/* Logo / Brand */}
        <View style={styles.header}>
          <Image source={LogoHorizontal} style={styles.logoImage} />
          <Text style={styles.brandSubtitle}>Painel do Gestor</Text>
        </View>

        {/* Navigation */}
        <ScrollView style={styles.scrollView}>
          <View style={styles.navigation}>
            {navItems
              .filter((item) => item.show)
              .map((item) => {
                const isActive = pathname === item.path;

                return (
                  <TouchableOpacity
                    key={item.path}
                    onPress={() => handleNavigation(item.path)}
                    style={[
                      styles.navItem,
                      isActive && styles.navItemActive,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.navIcon}>{item.icon}</Text>
                    <Text
                      style={[
                        styles.navLabel,
                        isActive && styles.navLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </View>
        </ScrollView>

        {/* Logout Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => setShowLogoutDialog(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutIcon}>🚪</Text>
            <Text style={styles.logoutText}>Sair da Conta</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Dialogs */}
      <ConfirmDialog
        visible={showLogoutDialog}
        title="Sair da conta"
        message="Deseja realmente encerrar sua sessão? Você precisará fazer login novamente."
        confirmText="Sair"
        cancelText="Cancelar"
        type="destructive"
        onConfirm={handleLogoutConfirm}
        onCancel={() => setShowLogoutDialog(false)}
      />

      <ConfirmDialog
        visible={showErrorDialog}
        title="Erro ao sair"
        message="Não foi possível encerrar sua sessão. Verifique sua conexão e tente novamente."
        confirmText="Entendi"
        cancelText="Fechar"
        type="destructive"
        onConfirm={() => setShowErrorDialog(false)}
        onCancel={() => setShowErrorDialog(false)}
      />
    </>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    width: theme.layout.sidebarWidth,
    backgroundColor: theme.colors.white,
    borderRightWidth: 1,
    borderRightColor: theme.colors.gray200,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: theme.spacing['2xl'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  logoImage: {
    width: 270,
    height: 72,
    resizeMode: 'contain',
  },
  brandSubtitle: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
  },
  navigation: {
    padding: theme.spacing.lg,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
  },
  navItemActive: {
    backgroundColor: `${theme.colors.primary}15`, // 15 = ~10% opacity
  },
  navIcon: {
    fontSize: 20,
  },
  navLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray700,
  },
  navLabelActive: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  footer: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    marginTop: 'auto',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: `${theme.colors.error}10`, // 10 = ~6% opacity
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: `${theme.colors.error}30`, // 30 = ~19% opacity
  },
  logoutIcon: {
    fontSize: 20,
  },
  logoutText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.error,
  },
}));
