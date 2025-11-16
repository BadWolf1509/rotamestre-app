import { Ionicons } from '@expo/vector-icons';
import { Stack, Slot } from 'expo-router';
import { Pressable } from 'react-native';

import { DrawerMenuProvider, useDrawerMenu } from '@/context/DrawerMenuContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useUnistyles } from '@/utils/styles';

export default function MotoristaLayout() {
  const { isDesktop } = useResponsive();

  if (isDesktop) {
    return <Slot />;
  }

  return (
    <DrawerMenuProvider>
      <MobileStack />
    </DrawerMenuProvider>
  );
}

function MobileStack() {
  const { theme } = useUnistyles();
  const { openDrawer } = useDrawerMenu();

  const renderMenuButton = (tintColor?: string) => (
    <Pressable
      onPress={openDrawer}
      style={{ paddingHorizontal: 12, paddingVertical: 4 }}
      hitSlop={8}
    >
      <Ionicons name="menu" size={22} color={tintColor ?? theme.colors.white} />
    </Pressable>
  );

  const renderBackButton = (navigation: any) => (
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
        headerLeft: ({ tintColor }) => renderMenuButton(tintColor),
      }}
    >
      <Stack.Screen
        name="inicio"
        options={{
          title: 'Início',
        }}
      />
      <Stack.Screen
        name="rota"
        options={{
          title: 'Rota Atual',
        }}
      />
      <Stack.Screen
        name="checkpoints"
        options={{
          title: 'Paradas',
        }}
      />
      <Stack.Screen
        name="checkpoints-enhanced"
        options={{
          title: 'Checkpoints 2.0',
        }}
      />
      <Stack.Screen
        name="mapa"
        options={{
          title: 'Mapa',
        }}
      />
      <Stack.Screen
        name="historico"
        options={{
          title: 'Histórico',
        }}
      />
      <Stack.Screen
        name="resumo"
        options={{
          title: 'Resumo',
        }}
      />
      <Stack.Screen
        name="perfil"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="mapa-rota"
        options={({ navigation }) => ({
          title: 'Mapa da Rota',
          headerLeft: () => renderBackButton(navigation),
        })}
      />
    </Stack>
  );
}
