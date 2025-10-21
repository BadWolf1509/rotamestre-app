import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, Text, Alert } from 'react-native';
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

  const LogoutButton = () => (
    <TouchableOpacity
      onPress={handleLogout}
      style={{
        marginRight: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#fff',
      }}
    >
      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
        ⎋ Sair
      </Text>
    </TouchableOpacity>
  );

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
