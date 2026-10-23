/**
 * Layout do gestor abaixo de 1024px (celular/tablet): o sino de
 * notificações só existia no DesktopPageLayout — o gestor no celular não
 * via notificação nenhuma. O cabeçalho da Stack agora o mostra.
 */
import { render, screen } from '@testing-library/react-native';
import React from 'react';

import GestorLayout from '../_layout';

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    isReady: true,
    isAuthorized: true,
    userData: { id: 'g1' },
  }),
}));
let mockIsDesktop = false;
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: mockIsDesktop }),
}));
jest.mock('@/components/NotificationBell', () => ({
  NotificationBell: ({ variant }: { variant: string }) => {
    const { Text } = require('react-native');
    return <Text>{`sino-${variant}`}</Text>;
  },
}));
jest.mock('@/components/gestor/dashboard/_components/desktop/Sidebar', () => ({
  Sidebar: () => null,
}));
jest.mock('@/context/DrawerMenuContext', () => ({
  DrawerMenuProvider: ({ children }: { children: React.ReactNode }) => children,
  useDrawerMenu: () => ({ openDrawer: jest.fn() }),
}));
jest.mock('expo-router', () => {
  const { View } = require('react-native');
  // A Stack falsa desenha o headerRight das screenOptions, como o
  // cabeçalho nativo faria.
  const Stack = ({
    screenOptions,
  }: {
    screenOptions: { headerRight?: (p: object) => React.ReactNode };
  }) => <View>{screenOptions.headerRight?.({})}</View>;
  Stack.Screen = () => null;
  return {
    Stack,
    Slot: () => null,
    useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  };
});

describe('GestorLayout', () => {
  it('celular/tablet: cabeçalho mostra o sino de notificações', () => {
    mockIsDesktop = false;
    render(<GestorLayout />);

    expect(screen.getByText('sino-mobile')).toBeTruthy();
  });
});
