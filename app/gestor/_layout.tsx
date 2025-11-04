import { Tabs, useRouter, Slot } from 'expo-router';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { authService } from '@/lib/auth';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useResponsive } from '@/hooks/useResponsive';
import { GestorSidebar } from '@/components/GestorSidebar';

const SIDEBAR_WIDTH = 260;

export default function GestorLayout() {
  const router = useRouter();
  const { isDesktop, width } = useResponsive();
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

  // Desktop: Layout com sidebar
  if (isDesktop) {
    return (
      <>
        <View style={styles.desktopContainer}>
          {/* Sidebar fixa à esquerda */}
          <GestorSidebar />

          {/* Conteúdo principal com margem da sidebar */}
          <View style={styles.desktopContent}>
            <Slot />
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

const styles = StyleSheet.create({
  // Desktop layout
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f9fafb', // Gray 50 - Brand Guidelines
  },
  desktopContent: {
    flex: 1,
    marginLeft: SIDEBAR_WIDTH, // Largura da sidebar
    backgroundColor: '#f9fafb',
    minHeight: '100vh' as any,
    overflowY: 'auto' as any,
    overflowX: 'hidden' as any,
  },
  // Mobile logout button
  logoutButton: {
    marginRight: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  logoutButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ scale: 0.97 }],
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
