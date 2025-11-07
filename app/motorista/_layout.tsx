import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { authService } from '@/lib/auth';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function MotoristaLayout() {
  const { theme } = useUnistyles();
  const router = useRouter();
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

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.colors.primary,
          headerStyle: {
            backgroundColor: theme.colors.primary,
          },
          headerTintColor: theme.colors.white,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerRight: () => <LogoutButton />,
        }}
      >
        <Tabs.Screen
          name="rota"
          options={{
            title: 'Rota Atual',
            tabBarLabel: 'Rota',
          }}
        />
        <Tabs.Screen
          name="checkpoints"
          options={{
            title: 'Paradas',
            tabBarLabel: 'Paradas',
          }}
        />
        <Tabs.Screen
          name="mapa"
          options={{
            title: 'Mapa',
            tabBarLabel: 'Mapa',
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
          name="resumo"
          options={{
            title: 'Resumo',
            tabBarLabel: 'Resumo',
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
  logoutButton: {
    marginRight: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.white,
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
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
}));
