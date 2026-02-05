import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { useUnistyles } from '@/utils/styles';

export default function PerfilLayout() {
  const { theme } = useUnistyles();
  const router = useRouter();

  // Helper para voltar com fallback para home do motorista
  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback: navegar para home do motorista
      router.replace('/motorista/(tabs)');
    }
  };

  const renderBackButton = () => (
    <Pressable
      onPress={handleGoBack}
      style={{ paddingHorizontal: 12, paddingVertical: 4 }}
      hitSlop={8}
    >
      <Ionicons name="chevron-back" size={22} color={theme.colors.white} />
    </Pressable>
  );

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
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Meu Perfil',
          headerLeft: () => renderBackButton(),
        }}
      />
      <Stack.Screen
        name="editar"
        options={{
          title: 'Editar Perfil',
          headerLeft: () => renderBackButton(),
        }}
      />
      <Stack.Screen
        name="senha"
        options={{
          title: 'Alterar Senha',
          headerLeft: () => renderBackButton(),
        }}
      />
      <Stack.Screen
        name="configuracoes"
        options={{
          title: 'Configurações',
          headerLeft: () => renderBackButton(),
        }}
      />
    </Stack>
  );
}
