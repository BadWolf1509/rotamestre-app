import {
  DrawerContentScrollView,
  DrawerItemList,
  DrawerItem,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { authService } from '@/lib/auth';
import { Usuario } from '@/types/usuario';
import { StyleSheet, useUnistyles } from '@/utils/styles';



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
        style={[styles(theme).container, { pointerEvents: isDialogOpen ? 'none' : 'auto' }]}
        contentContainerStyle={styles(theme).contentContainer}
      >
        <View style={{ flexGrow: 1, justifyContent: 'space-between' }}>
          {/* Seção de Perfil (topo) */}
          <View style={styles(theme).header}>
            <View style={styles(theme).avatar}>
              <Text style={styles(theme).avatarText}>
                {usuario?.nome?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={styles(theme).userName} numberOfLines={1}>
              {usuario?.nome || 'Carregando...'}
            </Text>
            <Text style={styles(theme).userEmail} numberOfLines={1}>
              {usuario?.email || ''}
            </Text>
            <View style={styles(theme).roleBadge}>
              <Text style={styles(theme).roleBadgeText}>Motorista</Text>
            </View>
          </View>

          {/* Navegação Principal */}
          <View style={styles(theme).menuSection}>
            <DrawerItemList {...props} />
            <DrawerItem
              label="Meu Perfil"
              icon={() => <Text style={styles(theme).menuIcon}>👤</Text>}
              onPress={() => {
                props.navigation.closeDrawer();
                router.push('/motorista/perfil');
              }}
              labelStyle={styles(theme).drawerLabel}
              activeTintColor={theme.colors.primary}
              inactiveTintColor={theme.colors.gray700}
            />
          </View>

          {/* Itens Secundários */}
          <View style={styles(theme).secondarySection}>
            <DrawerItem
              label="Configurações"
              icon={() => <Text style={styles(theme).menuIcon}>⚙️</Text>}
              onPress={() => {
                props.navigation.closeDrawer();
                // TODO: Implementar tela de configurações
              }}
              labelStyle={styles(theme).drawerLabel}
              activeTintColor={theme.colors.primary}
              inactiveTintColor={theme.colors.gray700}
            />
            <DrawerItem
              label="Ajuda"
              icon={() => <Text style={styles(theme).menuIcon}>❓</Text>}
              onPress={() => {
                props.navigation.closeDrawer();
                // TODO: Implementar tela de ajuda
              }}
              labelStyle={styles(theme).drawerLabel}
              activeTintColor={theme.colors.primary}
              inactiveTintColor={theme.colors.gray700}
            />
          </View>

          {/* Botão Sair (footer) */}
          <View style={styles(theme).footer}>
            <TouchableOpacity
              style={styles(theme).logoutButton}
              onPress={handleLogoutPress}
              activeOpacity={0.8}
            >
              <Text style={styles(theme).logoutIcon}>🚪</Text>
              <Text style={styles(theme).logoutText}>Sair da Conta</Text>
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

const styles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.white,
    },
    contentContainer: {
      paddingTop: 0,
      paddingBottom: 0,
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
      borderRadius: theme.borderRadius?.full || 32,
      backgroundColor: theme.colors.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    avatarText: {
      fontSize: theme.typography?.['2xl'] || 28,
      fontFamily: theme.typography?.fontSansBold || 'System',
      color: theme.colors.white,
    },
    userName: {
      fontSize: theme.typography?.lg || 18,
      fontFamily: theme.typography?.fontSansSemiBold || 'System',
      color: theme.colors.gray900,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: theme.typography?.sm || 14,
      color: theme.colors.gray500,
      marginBottom: theme.spacing.sm,
    },
    roleBadge: {
      backgroundColor: `${theme.colors.primary}10`,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderRadius: theme.borderRadius?.md || 8,
      marginTop: theme.spacing.sm,
    },
    roleBadgeText: {
      fontSize: theme.typography?.xs || 12,
      fontFamily: theme.typography?.fontSansSemiBold || 'System',
      color: theme.colors.primaryDark || theme.colors.primary,
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
      fontSize: 20,
      marginRight: theme.spacing.lg,
      width: 24,
    },
    drawerLabel: {
      fontSize: theme.typography?.base || 15,
      fontFamily: theme.typography?.fontSansMedium || 'System',
      marginLeft: -16,
    },
    footer: {
      padding: theme.spacing.xl,
      borderTopWidth: 1,
      borderTopColor: theme.colors.gray200,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      backgroundColor: `${theme.colors.error}10`,
      borderRadius: theme.borderRadius?.lg || 12,
      borderWidth: 1,
      borderColor: `${theme.colors.error}30`,
    },
    logoutIcon: {
      fontSize: 20,
      marginRight: theme.spacing.md,
    },
    logoutText: {
      fontSize: theme.typography?.base || 15,
      fontFamily: theme.typography?.fontSansSemiBold || 'System',
      color: theme.colors.error,
    },
  });
