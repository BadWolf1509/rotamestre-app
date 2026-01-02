import {
  DrawerContentScrollView,
  DrawerItemList,
  DrawerItem,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { ConfirmDialog } from '@/design-system';
import { authService } from '@/lib/auth';
import { Usuario } from '@/types/usuario';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';



export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const isDialogOpen = showLogoutDialog || showErrorDialog;

  function handleLogoutPress() {
    props.navigation.closeDrawer();
    setTimeout(() => setShowLogoutDialog(true), 200);
  }

  useEffect(() => {
    loadUsuario();
  }, []);

  async function loadUsuario() {
    try {
      const session = await authService.getSession();
      if (session?.user) {
        const userData = await authService.getUsuario(session.user.id);
        setUsuario(userData);
      }
    } catch (error) {
      console.error('Erro ao carregar usuário no drawer:', error);
    }
  }

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
    <View style={{ flex: 1 }}>
      <DrawerContentScrollView
        {...props}
        bounces={false}
        overScrollMode="never"
        alwaysBounceVertical={false}
        scrollEnabled={!isDialogOpen}
        style={[styles.container, { pointerEvents: isDialogOpen ? 'none' : 'auto' }]}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={{ flexGrow: 1, justifyContent: 'space-between' }}>
          {/* Seção de Perfil (topo) */}
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {usuario?.nome?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={styles.userName} numberOfLines={1}>
              {usuario?.nome || 'Carregando...'}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {usuario?.email || ''}
            </Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Motorista</Text>
            </View>
          </View>

          {/* Navegação Principal */}
          <View style={styles.menuSection}>
            <DrawerItemList {...props} />
            <DrawerItem
              label="Meu Perfil"
              icon={() => <Text style={styles.menuIcon}>👤</Text>}
              onPress={() => {
                props.navigation.closeDrawer();
                router.push('/motorista/perfil');
              }}
              labelStyle={styles.drawerLabel}
              activeTintColor={theme.colors.primary}
              inactiveTintColor={theme.colors.gray700}
            />
          </View>

          {/* Itens Secundários */}
          <View style={styles.secondarySection}>
            <DrawerItem
              label="Configurações"
              icon={() => <Text style={styles.menuIcon}>⚙️</Text>}
              onPress={() => {
                props.navigation.closeDrawer();
                // TODO: Implementar tela de configurações
              }}
              labelStyle={styles.drawerLabel}
              activeTintColor={theme.colors.primary}
              inactiveTintColor={theme.colors.gray700}
            />
            <DrawerItem
              label="Ajuda"
              icon={() => <Text style={styles.menuIcon}>❓</Text>}
              onPress={() => {
                props.navigation.closeDrawer();
                // TODO: Implementar tela de ajuda
              }}
              labelStyle={styles.drawerLabel}
              activeTintColor={theme.colors.primary}
              inactiveTintColor={theme.colors.gray700}
            />
          </View>

          {/* Botão Sair (footer) */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogoutPress}
              activeOpacity={0.8}
            >
              <Text style={styles.logoutIcon}>🚪</Text>
              <Text style={styles.logoutText}>Sair da Conta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </DrawerContentScrollView>

      {/* Dialogs - Renderizados fora do DrawerContentScrollView para evitar problemas de z-index */}
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
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  contentContainer: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  header: {
    padding: theme.components.drawer.headerPadding,
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
  roleBadge: {
    backgroundColor: `${theme.colors.primary}10`,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  roleBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primaryDark,
  },
  menuSection: {
    paddingVertical: theme.spacing.sm,
  },
  secondarySection: {
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  menuIcon: {
    fontSize: theme.components.drawer.menuIconSize,
    marginRight: theme.spacing.lg,
    width: theme.components.drawer.menuIconWidth,
  },
  drawerLabel: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansMedium,
    marginLeft: -theme.spacing.lg,
  },
  footer: {
    padding: theme.components.drawer.footerPadding,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.components.drawer.itemPaddingV,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: `${theme.colors.error}10`,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: `${theme.colors.error}30`,
  },
  logoutIcon: {
    fontSize: theme.components.drawer.menuIconSize,
    marginRight: theme.spacing.md,
  },
  logoutText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.error,
  },
}));
