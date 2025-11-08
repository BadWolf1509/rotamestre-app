import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { StyleSheet, useUnistyles } from '@/utils/styles';
import { useRouter, usePathname } from 'expo-router';
import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { authService } from '@/lib/auth';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface SidebarProps {
  onNavigate?: () => void;
}

/**
 * Sidebar fixa para layout desktop
 * Inspirada no design do rotamestre-painel
 * Compatível com DrawerMenu mobile
 */
export function Sidebar({ onNavigate }: SidebarProps) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const pathname = usePathname();
  const { userData } = useUser();
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
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoEmoji}>🚚</Text>
            </View>
            <View>
              <Text style={styles.brandTitle}>
                Rota Mestre
              </Text>
              <Text style={styles.brandSubtitle}>
                Painel do Gestor
              </Text>
            </View>
          </View>
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
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  logoIcon: {
    width: 48,
    height: 48,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: {
    fontSize: 24,
  },
  brandTitle: {
    fontSize: theme.typography.xl,
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
  },
  brandSubtitle: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
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
