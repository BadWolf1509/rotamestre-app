import { Stack } from 'expo-router';
import { useUnistyles } from '@/utils/styles';

export default function PerfilLayout() {
  const { theme } = useUnistyles();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerShown: false, // Ocultar header padrão, usamos custom header nas telas
        animation: 'slide_from_right', // Animação de navegação
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Perfil',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="editar"
        options={{
          title: 'Editar Perfil',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="senha"
        options={{
          title: 'Alterar Senha',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
