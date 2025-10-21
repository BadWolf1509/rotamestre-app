import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, Text, Alert, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { authService } from '@/lib/auth';

export default function MotoristaLayout() {
  const router = useRouter();

  async function handleLogout() {
    Alert.alert(
      'Sair',
      'Deseja realmente sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.signOut();
              router.replace('/auth/login');
            } catch (error) {
              console.error('Erro ao fazer logout:', error);
              Alert.alert('Erro', 'Não foi possível sair. Tente novamente.');
            }
          },
        },
      ]
    );
  }

  const LogoutButton = () => {
    const [pressed, setPressed] = useState(false);

    return (
      <TouchableOpacity
        onPress={handleLogout}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[
          styles.logoutButton,
          pressed && styles.logoutButtonPressed,
          Platform.OS === 'web' && styles.logoutButtonWeb,
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
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563eb',
        headerStyle: {
          backgroundColor: '#2563eb',
        },
        headerTintColor: '#fff',
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
  );
}

const styles = StyleSheet.create({
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
  logoutButtonWeb: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
