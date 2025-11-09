import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Pressable } from 'react-native';

import { DrawerMenuProvider, useDrawerMenu } from '@/context/DrawerMenuContext';
import { useUnistyles } from '@/utils/styles';

export default function PerfilGestorLayout() {
  return (
    <DrawerMenuProvider>
      <PerfilStack />
    </DrawerMenuProvider>
  );
}

function PerfilStack() {
  const { theme } = useUnistyles();
  const { openDrawer } = useDrawerMenu();

  const BackButton = ({ navigation }: { navigation: any }) => (
    <Pressable
      onPress={() => navigation.goBack()}
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
          fontWeight: 'bold',
        },
        animation: 'slide_from_right',
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
          headerLeft: () => <BackButton navigation={navigation} />,
        })}
      />
      <Stack.Screen
        name="trocar-senha"
        options={({ navigation }) => ({
          title: 'Alterar Senha',
          headerLeft: () => <BackButton navigation={navigation} />,
        })}
      />
    </Stack>
  );
}
