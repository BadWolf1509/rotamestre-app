import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { useUnistyles } from '@/utils/styles';

export default function PerfilLayout() {
  const { theme } = useUnistyles();
  const router = useRouter();

  // Helper para voltar com fallback para home do motorista
  const handleGoBack = (navigation: any) => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // Fallback: navegar para home do motorista
      router.replace('/motorista/(tabs)');
    }
  };

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
        animation: 'slide_from_right', // Animação de navegação
        }}
      >
        <Stack.Screen
          name="index"
          options={({ navigation }) => ({
            title: 'Meu Perfil',
            headerLeft: () => (
              <Pressable
                onPress={() => handleGoBack(navigation)}
                style={{ paddingHorizontal: 12, paddingVertical: 4 }}
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={22} color={theme.colors.white} />
              </Pressable>
            ),
          })}
        />
        <Stack.Screen
          name="editar"
          options={({ navigation }) => ({
            title: 'Editar Perfil',
            headerLeft: () => (
              <Pressable
                onPress={() => handleGoBack(navigation)}
                style={{ paddingHorizontal: 12, paddingVertical: 4 }}
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={22} color={theme.colors.white} />
              </Pressable>
            ),
          })}
        />
        <Stack.Screen
          name="senha"
          options={({ navigation }) => ({
            title: 'Alterar Senha',
            headerLeft: () => (
              <Pressable
                onPress={() => handleGoBack(navigation)}
                style={{ paddingHorizontal: 12, paddingVertical: 4 }}
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={22} color={theme.colors.white} />
              </Pressable>
            ),
          })}
        />
        <Stack.Screen
          name="configuracoes"
          options={({ navigation }) => ({
            title: 'Configurações',
            headerLeft: () => (
              <Pressable
                onPress={() => handleGoBack(navigation)}
                style={{ paddingHorizontal: 12, paddingVertical: 4 }}
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={22} color={theme.colors.white} />
              </Pressable>
            ),
          })}
        />
    </Stack>
  );
}
