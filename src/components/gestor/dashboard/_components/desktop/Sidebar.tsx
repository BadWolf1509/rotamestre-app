import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View, ImageStyle } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

import LogoHorizontalDark from '@/../assets/logo-horizontal.png';
import LogoHorizontalLight from '@/../assets/logo-horizontal1.png';
import { ConfirmDialog } from '@/design-system';
import { authService } from '@/lib/auth';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

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
  const { theme } = useUnistyles();
  const router = useRouter();
  const pathname = usePathname();
  // REMOVIDO: const { userData } = useUser(); // Evitar chamada duplicada
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  // Detectar tema escuro para usar logo apropriada
  const isDarkMode = UnistylesRuntime.themeName?.startsWith('dark');
  const LogoHorizontal = isDarkMode ? LogoHorizontalDark : LogoHorizontalLight;

  const navItems: Array<{
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    path: string;
    show: boolean;
  }> = [
    {
      label: 'Início',
      icon: 'home-outline',
      path: '/gestor/inicio',
      show: true,
    },
    {
      label: 'Nova Rota',
      icon: 'add-circle-outline',
      path: '/gestor/nova-entrega',
      show: true,
    },
    {
      label: 'Gestão de Rotas',
      icon: 'clipboard-outline',
      path: '/gestor/gestao-rotas',
      show: true,
    },
    {
      label: 'Incidentes',
      icon: 'warning-outline',
      path: '/gestor/incidentes',
      show: true,
    },
    {
      label: 'Motoristas',
      icon: 'people-outline',
      path: '/gestor/motoristas',
      show: true,
    },
    {
      label: 'Minha Unidade',
      icon: 'business-outline',
      path: '/unidade',
      show: userData?.papel === 'gestor',
    },
    {
      label: 'Equipe',
      icon: 'people-circle-outline',
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
          <Image source={LogoHorizontal} style={styles.logoImage as ImageStyle} />
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
                    <Ionicons
                      name={item.icon}
                      size={22}
                      color={isActive ? theme.colors.primary : theme.colors.gray500}
                    />
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

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    width: theme.layout.sidebarWidth,
    minWidth: theme.layout.sidebarWidth,
    maxWidth: theme.layout.sidebarWidth,
    backgroundColor: theme.colors.white,
    borderRightWidth: 1,
    borderRightColor: theme.colors.gray200,
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    padding: theme.spacing['2xl'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  logoImage: {
    width: 200,
    height: 82, // Proporção 336:138 (2.43:1) ajustada para caber no sidebar
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
    backgroundColor: theme.colors.primaryBg,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.secondary,
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
}));


