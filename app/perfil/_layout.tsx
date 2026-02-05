import { Ionicons } from '@expo/vector-icons';
import { Stack, Slot, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';
import { DrawerMenuProvider, useDrawerMenu } from '@/context/DrawerMenuContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useResponsive } from '@/hooks/useResponsive';
import { useUnistyles } from '@/utils/styles';

export default function PerfilGestorLayout() {
  const { isReady, isAuthorized } = useRequireAuth({ role: 'any' });
  const { isDesktop } = useResponsive();

  // Aguardar verificação de autenticação
  if (!isReady) {
    return <AuthLoadingScreen />;
  }

  // Se não autorizado, retorna null (redirect já aconteceu)
  if (!isAuthorized) {
    return null;
  }

  // Desktop - sem header, usa o layout global
  if (isDesktop) {
    return <Slot />;
  }

  // Mobile/Tablet - com header e DrawerMenu
  return (
    <DrawerMenuProvider>
      <PerfilStack />
    </DrawerMenuProvider>
  );
}

function PerfilStack() {
  const { theme } = useUnistyles();
  const { openDrawer } = useDrawerMenu();
  const router = useRouter();

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
          fontFamily: theme.typography.fontSansBold,
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
        options={{
          title: 'Editar Perfil',
          headerLeft: () => renderBackButton(),
        }}
      />
      <Stack.Screen
        name="trocar-senha"
        options={{
          title: 'Alterar Senha',
          headerLeft: () => renderBackButton(),
        }}
      />
    </Stack>
  );
}
