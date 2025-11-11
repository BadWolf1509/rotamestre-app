import { Ionicons } from '@expo/vector-icons';
import { Stack, Slot } from 'expo-router';
import { Pressable, View } from 'react-native';

import { DrawerMenuProvider, useDrawerMenu } from '@/context/DrawerMenuContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useUnistyles } from '@/utils/styles';
import { Sidebar } from '@/components/gestor/dashboard/_components/desktop/Sidebar';

export default function UnidadeLayout() {
  const { isDesktop } = useResponsive();

  // Desktop Layout - Sidebar fixa + conteúdo
  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#f9fafb' }}>
        <Sidebar />
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
      </View>
    );
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