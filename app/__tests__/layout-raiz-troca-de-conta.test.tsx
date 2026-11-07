/**
 * A pilha raiz remonta só quando uma conta é trocada por OUTRA (A→B direto).
 *
 * Origem: depois de sair do gestor e entrar como motorista (moto g15,
 * 04/11/2026), a Minha Unidade do gestor seguia montada embaixo do login,
 * pedindo a equipe com a sessão do motorista. Desde a N-1 (07/11) a saída
 * (A→null) é resolvida pela dona da navegação de saída, que esvazia a pilha
 * raiz; remontar ali fazia a pilha renascer na área antiga sem sessão. A
 * troca A→B, que não passa pela dona, segue remontando.
 *
 * N-2: a conta vem da SESSÃO (`useAuth`), o mesmo sinal da dona — não do
 * perfil (`useUser`), que chega depois: na troca A→B as telas de A rodavam
 * com a sessão de B até o perfil de B chegar, e o perfil sem linha (null com
 * sessão viva) era lido como saída.
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
  return { Stack, usePathname: () => mockCaminho.atual };
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
const mockCaminho = { atual: '/' };
const mockSessao: {
  user: { id: string } | null;
  usuarioOfflineId: string | null;
} = { user: null, usuarioOfflineId: null };
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ ...mockSessao, loading: false }),
}));
const mockUsuario: { userData: { id: string; papel?: string } | null } = {
  userData: null,
};
jest.mock('@/hooks/useUser', () => ({ useUser: () => mockUsuario }));
const mockTela = { isDesktop: false };
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockTela,
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

function entrar(id: string | null) {
  mockSessao.user = id ? { id } : null;
}

describe('layout raiz: troca de conta', () => {
  beforeEach(() => {
    mockMontagensDaPilha.total = 0;
    mockSessao.user = null;
    mockSessao.usuarioOfflineId = null;
    mockUsuario.userData = null;
    mockCaminho.atual = '/';
    mockTela.isDesktop = false;
  });

  // N-1: na saída, quem limpa a pilha é a dona (useNavegacaoDeSaida). Remontar
  // aqui fazia a pilha renascer na área antiga sem sessão antes do login.
  it('não remonta a pilha quando a conta sai', () => {
    entrar('gestor');
    const { rerender } = render(<RootLayout />);
    expect(mockMontagensDaPilha.total).toBe(1);

    entrar(null);
    rerender(<RootLayout />);

    expect(mockMontagensDaPilha.total).toBe(1);
  });

  it('remonta a pilha quando a sessão troca de conta, sem esperar o perfil novo', () => {
    entrar('gestor');
    mockUsuario.userData = { id: 'gestor' };
    const { rerender } = render(<RootLayout />);

    // A sessão já é de B; o perfil ainda é o de A (chega depois).
    entrar('motorista');
    rerender(<RootLayout />);

    expect(mockMontagensDaPilha.total).toBe(2);
  });

  it('não remonta a pilha quando alguém entra vindo de nenhuma conta', () => {
    const { rerender } = render(<RootLayout />);

    entrar('motorista');
    rerender(<RootLayout />);

    expect(mockMontagensDaPilha.total).toBe(1);
  });

  it('perfil sem linha com a sessão viva não remonta a pilha (não é saída nem troca)', () => {
    entrar('gestor');
    mockUsuario.userData = { id: 'gestor' };
    const { rerender } = render(<RootLayout />);

    mockUsuario.userData = null;
    rerender(<RootLayout />);
    mockUsuario.userData = { id: 'gestor' };
    rerender(<RootLayout />);

    expect(mockMontagensDaPilha.total).toBe(1);
  });

  it('sessão offline do mesmo dono não remonta a pilha', () => {
    entrar('motorista');
    const { rerender } = render(<RootLayout />);

    mockSessao.user = null;
    mockSessao.usuarioOfflineId = 'motorista';
    rerender(<RootLayout />);
    entrar('motorista');
    mockSessao.usuarioOfflineId = null;
    rerender(<RootLayout />);

    expect(mockMontagensDaPilha.total).toBe(1);
  });
});
