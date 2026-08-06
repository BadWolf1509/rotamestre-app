import { Stack } from 'expo-router';

import { useUnistyles } from '@/utils/styles';

/**
 * Layout para telas de onboarding (primeira configuração)
 * Usado para telas como first-password que requerem ação antes de usar o app
 */
export default function OnboardingLayout() {
  const { theme } = useUnistyles();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.white,
        headerTitleStyle: {
          fontFamily: theme.typography.fontSansBold,
        },
        // Não mostrar botão de voltar - usuário deve completar o onboarding
        headerBackVisible: false,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen
        name="first-password"
        options={{
          title: 'Definir Senha',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="criar-unidade"
        options={{
          title: 'Criar sua unidade',
          headerShown: true,
        }}
      />
    </Stack>
  );
}
