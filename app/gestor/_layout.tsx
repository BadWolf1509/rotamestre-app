import { Ionicons } from '@expo/vector-icons';
import { Stack, Slot } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Sidebar } from '@/components/gestor/dashboard/_components/desktop/Sidebar';
import { DrawerMenuProvider, useDrawerMenu } from '@/context/DrawerMenuContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useUser } from '@/hooks/useUser';
import { useUnistyles } from '@/utils/styles';

export default function GestorLayout() {
  const { isDesktop } = useResponsive();
  const { userData } = useUser();
  
  const { theme } = useUnistyles();

  // Desktop Layout - Sidebar fixa + conteúdo
  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: theme.colors.gray50 }}>
        <Sidebar userData={userData} />
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
      </View>
    );
  }

  // Tablet & Mobile - Drawer Menu + Stack Navigation
  return (
    <DrawerMenuProvider>
      <GestorStack />
    </DrawerMenuProvider>
  );
}

function GestorStack() {
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
          fontFamily: theme.typography.fontDisplay,
          fontSize: theme.typography.lg,
        },
        animation: 'slide_from_right',
        headerLeft: ({ tintColor }) => renderMenuButton(tintColor),
      }}
    >
      <Stack.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
        }}
      />
      <Stack.Screen
        name="nova-entrega"
        options={{
          title: 'Nova Rota',
        }}
      />
      <Stack.Screen
        name="historico"
        options={{
          title: 'Histórico',
        }}
      />
      <Stack.Screen
        name="motoristas"
        options={{
          title: 'Motoristas',
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





