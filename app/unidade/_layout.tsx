import { Ionicons } from '@expo/vector-icons';
import { Stack, Slot } from 'expo-router';
import { Pressable } from 'react-native';

import { DrawerMenuProvider, useDrawerMenu } from '@/context/DrawerMenuContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useUnistyles } from '@/utils/styles';

export default function UnidadeLayout() {
  const { isDesktop } = useResponsive();

  // Desktop Layout - Apenas conteúdo (Sidebar já está no layout pai)
  if (isDesktop) {
    return <Slot />;
  }

  // Tablet & Mobile - Drawer Menu + Stack Navigation
  return (
    <DrawerMenuProvider>
      <UnidadeStack />
    </DrawerMenuProvider>
  );
}

function UnidadeStack() {
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
        name="index"
        options={{
          title: 'Minha Unidade',
        }}
      />
      <Stack.Screen
        name="equipe"
        options={{
          title: 'Equipe',
        }}
      />
    </Stack>
  );
}
