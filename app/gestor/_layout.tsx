import { Ionicons } from '@expo/vector-icons';
import { Stack, Slot, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';
import { Sidebar } from '@/components/gestor/dashboard/_components/desktop/Sidebar';
import { DrawerMenuProvider, useDrawerMenu } from '@/context/DrawerMenuContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useResponsive } from '@/hooks/useResponsive';
import { useUnistyles } from '@/utils/styles';

export default function GestorLayout() {
  const { isReady, isAuthorized, userData } = useRequireAuth({ role: 'gestor' });
  const { isDesktop } = useResponsive();
  const { theme } = useUnistyles();

  // Aguardar verificação de autenticação
  if (!isReady) {
    return <AuthLoadingScreen />;
  }

  // Se não autorizado, retorna null (redirect já aconteceu)
  if (!isAuthorized) {
    return null;
  }

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
  const router = useRouter();

  const renderMenuButton = (tintColor?: string) => (
    <Pressable
      onPress={openDrawer}
      style={{ paddingHorizontal: 12, paddingVertical: 4 }}
      hitSlop={8}
    >
      <Ionicons name="menu" size={22} color={tintColor ?? theme.colors.white} />
    </Pressable>
  );

  const renderBackButton = () => (
    <Pressable
      onPress={() => router.back()}
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
        name="inicio"
        options={{
          title: 'Início',
        }}
      />
      <Stack.Screen
        name="nova-entrega"
        options={{
          title: 'Nova Rota',
        }}
      />
      <Stack.Screen
        name="gestao-rotas"
        options={{
          title: 'Gestão de Rotas',
        }}
      />
      <Stack.Screen
        name="motoristas"
        options={{
          title: 'Motoristas',
        }}
      />
      <Stack.Screen
        name="motorista-perfil"
        options={{
          title: 'Perfil do Motorista',
          headerLeft: () => renderBackButton(),
        }}
      />
      <Stack.Screen
        name="mapa-rota"
        options={{
          title: 'Mapa da Rota',
          headerLeft: () => renderBackButton(),
        }}
      />
      <Stack.Screen
        name="incidentes"
        options={{
          title: 'Incidentes',
        }}
      />
    </Stack>
  );
}





