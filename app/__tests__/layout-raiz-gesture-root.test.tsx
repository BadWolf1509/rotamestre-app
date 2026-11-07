/**
 * Um único GestureHandlerRootView, na raiz do app.
 *
 * No Gesture Handler 3 (Expo SDK 58) todo detector exige um root view acima:
 * em __DEV__ lança erro, no release o gesto simplesmente não é reconhecido. A
 * Nova Entrega (DraggableFlatList) e a vitrine do design system
 * (ReanimatedSwipeable) não tinham nenhum — só o layout do motorista, o
 * DraggableStopList e a tela de checkpoints montavam o próprio. Agora o raiz
 * monta um só, e os internos saíram.
 */
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

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
  const Stack = () => <Text>pilha-de-rotas</Text>;
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
jest.mock('@/hooks/useUser', () => ({ useUser: () => ({ userData: null }) }));
// A geração da conta lê a sessão (N-2); a troca de conta tem teste próprio.
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, usuarioOfflineId: null, loading: false }),
}));
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

describe('layout raiz', () => {
  it('envolve a árvore inteira num GestureHandlerRootView com flex 1', () => {
    const { toJSON } = render(<RootLayout />);

    const raiz = screen.getByTestId('gesture-handler-root');
    // Objeto simples, não estilo do Unistyles: no web este vira classe, que o
    // View de dentro do GestureHandlerRootView ignora (raiz com altura 0).
    expect(raiz.props.style).toEqual({ flex: 1 });
    expect(StyleSheet.flatten(raiz.props.style)).toEqual(
      expect.objectContaining({ flex: 1 }),
    );
    // É o nó mais externo, e as rotas ficam dentro dele.
    const arvore = toJSON();
    const topo = Array.isArray(arvore) ? arvore[0] : arvore;
    expect(topo?.props.testID).toBe('gesture-handler-root');
    expect(screen.getByText('pilha-de-rotas')).toBeTruthy();
  });
});
