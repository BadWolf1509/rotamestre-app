import { Ionicons } from '@expo/vector-icons';
import { Stack, Slot, useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';
import { DrawerMenuProvider, useDrawerMenu } from '@/context/DrawerMenuContext';
import { RouteStatusProvider } from '@/context/RouteStatusContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useResponsive } from '@/hooks/useResponsive';
import { useUnistyles } from '@/utils/styles';

export default function MotoristaLayout() {
  const { isReady, isAuthorized } = useRequireAuth({ role: 'motorista' });
  const { isDesktop } = useResponsive();

  // Aguardar verificação de autenticação
  if (!isReady) {
    return <AuthLoadingScreen />;
  }

  // Se não autorizado, retorna null (redirect já aconteceu)
  if (!isAuthorized) {
    return null;
  }

  if (isDesktop) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <DrawerMenuProvider>
          <RouteStatusProvider>
            <Slot />
          </RouteStatusProvider>
        </DrawerMenuProvider>
      </GestureHandlerRootView>
    );
  }

  // Mobile: Stack com Tabs + telas secundárias
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DrawerMenuProvider>
        <RouteStatusProvider>
          <MobileNavigation />
        </RouteStatusProvider>
      </DrawerMenuProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Navegação Mobile com Bottom Tabs como tela principal
 * Stack Navigator para telas secundárias (resumo, perfil, mapa-rota)
 */
function MobileNavigation() {
  const { theme } = useUnistyles();
  const { openDrawer } = useDrawerMenu();
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

  const renderBackButton = (navigation: any) => (
    <Pressable
      onPress={() => handleGoBack(navigation)}
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
      {/* Tabs como tela principal - header gerenciado pelo TabLayout */}
      <Stack.Screen
        name="(tabs)"
        options={{
          headerShown: false,
        }}
      />

      {/* Telas de Stack (fora das tabs) */}
      <Stack.Screen
        name="resumo"
        options={({ navigation }) => ({
          title: 'Resumo',
          headerLeft: () => renderBackButton(navigation),
        })}
      />

      <Stack.Screen
        name="perfil"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="sos"
        options={({ navigation }) => ({
          title: 'SOS / Emergência',
          headerLeft: () => renderBackButton(navigation),
        })}
      />

      <Stack.Screen
        name="desempenho"
        options={({ navigation }) => ({
          title: 'Meu Desempenho',
          headerLeft: () => renderBackButton(navigation),
        })}
      />

      <Stack.Screen
        name="ajuda"
        options={({ navigation }) => ({
          title: 'Ajuda',
          headerLeft: () => renderBackButton(navigation),
        })}
      />

      {/*
        Nota: Telas de tabs (_screens/) são acessadas via (tabs)/.
        O mapa-rota do motorista é a tab Mapa, não uma tela separada.
      */}
    </Stack>
  );
}
