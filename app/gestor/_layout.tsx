import { Tabs, useRouter, Slot } from 'expo-router';
import { TouchableOpacity, Text } from 'react-native';
import { StyleSheet, useUnistyles } from '@/utils/styles';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { authService } from '@/lib/auth';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useResponsive } from '@/hooks/useResponsive';

/**
 * Layout do Gestor
 *
 * Desktop: Renderiza apenas <Slot /> porque Sidebar é gerenciado pelo app/_layout.tsx
 * Mobile/Tablet: Usa <Tabs> com navegação inferior
 */
export default function GestorLayout() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);

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

  const LogoutButton = () => {
    const [pressed, setPressed] = useState(false);

    return (
      <TouchableOpacity
        onPress={() => setShowLogoutDialog(true)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[
          styles.logoutButton,
          pressed && styles.logoutButtonPressed,
        ]}
        accessibilityLabel="Sair da conta"
        accessibilityRole="button"
      >
        <Ionicons name="log-out-outline" size={20} color="#fff" />
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>
    );
  };

  // Desktop: Apenas Slot (Sidebar gerenciado pelo root layout)
  if (isDesktop) {
    return (
      <>
        <Slot />

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

  // Mobile/Tablet: Layout com tabs na parte inferior
  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#1e5aa8', // Azul Main - Brand Guidelines
          headerStyle: {
            backgroundColor: '#0D5A9C', // Azul Dark - Brand Guidelines
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerRight: () => <LogoutButton />,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarLabel: 'Início',
          }}
        />
        <Tabs.Screen
          name="nova-entrega"
          options={{
            title: 'Nova Entrega',
            tabBarLabel: 'Nova Rota',
          }}
        />
        <Tabs.Screen
          name="historico"
          options={{
            title: 'Histórico',
            tabBarLabel: 'Histórico',
          }}
        />
        <Tabs.Screen
          name="motoristas"
          options={{
            title: 'Motoristas',
            tabBarLabel: 'Motoristas',
          }}
        />
        <Tabs.Screen
          name="mapa-rota"
          options={{
            title: 'Mapa da Rota',
            href: null, // Ocultar da barra de tabs (acessível apenas via navegação programática)
          }}
        />
      </Tabs>

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
  // Mobile logout button
  logoutButton: {
    marginRight: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: theme.spacing.sm - 2,
    borderWidth: 1,
    borderColor: theme.colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm - 2,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  logoutButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ scale: 0.97 }],
  },
  logoutText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
  },
}));
