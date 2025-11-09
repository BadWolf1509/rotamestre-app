import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Pressable } from 'react-native';

import { useDrawerMenu } from '@/context/DrawerMenuContext';
import { useUnistyles } from '@/utils/styles';

export default function PerfilLayout() {
  const { theme } = useUnistyles();
  const { openDrawer } = useDrawerMenu();

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
        animation: 'slide_from_right', // Animação de navegação
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Meu Perfil',
            headerLeft: () => (
              <Pressable
                onPress={openDrawer}
                style={{ paddingHorizontal: 12, paddingVertical: 4 }}
                hitSlop={8}
              >
                <Ionicons name="menu" size={22} color={theme.colors.white} />
              </Pressable>
            ),
          }}
        />
        <Stack.Screen
          name="editar"
          options={({ navigation }) => ({
            title: 'Editar Perfil',
            headerLeft: () => (
              <Pressable
                onPress={() => navigation.goBack()}
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
                onPress={() => navigation.goBack()}
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
