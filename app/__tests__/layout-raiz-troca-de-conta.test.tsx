/**
 * A pilha raiz remonta quando a conta sai ou é trocada, e só então.
 *
 * O logout navega com `router.replace('/auth/login')`, que só troca a tela do
 * topo: depois de sair do gestor e entrar como motorista (moto g15,
 * 04/11/2026), a Minha Unidade do gestor seguia montada embaixo, pedindo a
 * equipe com a sessão do motorista, e a barra de abas do motorista parou de
 * responder. Ver `src/hooks/useGeracaoDaConta.ts`.
 */
import { render } from '@testing-library/react-native';
import React from 'react';

import RootLayout from '../_layout';

jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native');
  return {
    GestureHandlerRootView: ({
      children,
      style,
    }: {
      children: React.ReactNode;
      style?: unknown;
    }) => (
      <View testID="gesture-handler-root" style={style}>
        {children}
      </View>
    ),
  };
});
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  const { useEffect } = jest.requireActual('react');
  const Stack = () => {
    useEffect(() => {
      mockMontagensDaPilha.total += 1;
    }, []);
    return <Text>pilha-de-rotas</Text>;
  };
  Stack.Screen = () => null;
  return { Stack, usePathname: () => '/' };
});
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('react-native-toast-message', () => () => null);
// A navegação de saída tem teste próprio (useNavegacaoDeSaida.test.ts).
jest.mock('@/hooks/auth/useNavegacaoDeSaida', () => ({
  useNavegacaoDeSaida: jest.fn(),
}));
jest.mock('@/hooks/useManterPushTokenAtualizado', () => ({
  useManterPushTokenAtualizado: jest.fn(),
}));
const mockMontagensDaPilha = { total: 0 };
const mockUsuario: { userData: { id: string } | null } = { userData: null };
jest.mock('@/hooks/useUser', () => ({ useUser: () => mockUsuario }));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: false }),
}));
const repassa = ({ children }: { children: React.ReactNode }) => children;
jest.mock('@/hooks/useUnidadeAtiva', () => ({ UnidadeAtivaProvider: repassa }));
jest.mock('@/context/NotificationDataContext', () => ({
  NotificationDataProvider: repassa,
}));
jest.mock('@/context/NotificationModalContext', () => ({
  NotificationModalProvider: repassa,
}));
jest.mock('@/components/gestor/dashboard/_components/desktop/Sidebar', () => ({
  Sidebar: () => null,
}));
jest.mock('@/lib/notificationHandlers', () => ({
  setupNotificationResponseHandler: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('@/lib/notifications', () => ({
  initializeNotifications: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/lib/offline', () => ({
  setupOfflineSync: jest.fn(() => () => {}),
}));
jest.mock('@/lib/themePreference', () => ({
  applyThemePreferences: jest.fn(),
  getThemePreferences: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('@/utils/navigationPreferencesMigration', () => ({
  migrateNavigationPreferences: jest.fn(() => Promise.resolve()),
}));

describe('layout raiz: troca de conta', () => {
  beforeEach(() => {
    mockMontagensDaPilha.total = 0;
  });

  it('remonta a pilha quando a conta sai', () => {
    mockUsuario.userData = { id: 'gestor' };
    const { rerender } = render(<RootLayout />);
    expect(mockMontagensDaPilha.total).toBe(1);

    mockUsuario.userData = null;
    rerender(<RootLayout />);

    expect(mockMontagensDaPilha.total).toBe(2);
  });

  it('não remonta a pilha quando alguém entra vindo de nenhuma conta', () => {
    mockUsuario.userData = null;
    const { rerender } = render(<RootLayout />);

    mockUsuario.userData = { id: 'motorista' };
    rerender(<RootLayout />);

    expect(mockMontagensDaPilha.total).toBe(1);
  });
});
