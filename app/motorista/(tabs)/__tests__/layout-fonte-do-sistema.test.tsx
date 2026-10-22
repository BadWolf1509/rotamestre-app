/**
 * Rótulos da tab bar do motorista com a fonte do sistema em 2.0.
 *
 * A barra tem altura fixa (60 + inset). Sem teto de escala, o rótulo
 * crescia e ficava cortado atrás da barra de navegação do Android
 * (moto g15, 1.14.2, 22/10/2026). O Label padrão do react-navigation só
 * repassa `allowFontScaling`, então o rótulo é nosso.
 */
import { render } from '@testing-library/react-native';
import React from 'react';

type LabelFn = (props: {
  focused: boolean;
  color: string;
  position: 'below-icon' | 'beside-icon';
  children: string;
}) => React.ReactNode;

interface ScreenOptions {
  title?: string;
  tabBarLabel?: LabelFn | string;
}

jest.mock('expo-router', () => {
  const ReactLib = jest.requireActual<typeof import('react')>('react');
  const Screen = (_props: { name: string; options?: ScreenOptions }) => null;
  // Desenha o rótulo de cada aba como a tab bar faria, com o título da tela.
  const Tabs = ({
    screenOptions,
    children,
  }: {
    screenOptions: ScreenOptions;
    children: React.ReactNode;
  }) =>
    ReactLib.createElement(
      ReactLib.Fragment,
      null,
      ReactLib.Children.toArray(children).map((filho) => {
        const { name, options } = (
          filho as React.ReactElement<{ name: string; options?: ScreenOptions }>
        ).props;
        const label = options?.tabBarLabel ?? screenOptions.tabBarLabel;
        const titulo = options?.title ?? name;
        return ReactLib.createElement(
          ReactLib.Fragment,
          { key: name },
          typeof label === 'function'
            ? label({
                focused: false,
                color: '#000',
                position: 'below-icon',
                children: titulo,
              })
            : null,
        );
      }),
    );
  Tabs.Screen = Screen;
  return { Tabs };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }),
}));

jest.mock('@/components/NotificationBell', () => ({
  NotificationBell: () => null,
}));

jest.mock('@/context/DrawerMenuContext', () => ({
  useDrawerMenu: () => ({ openDrawer: jest.fn() }),
}));

jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => ({ paradas: [] }),
}));

import TabLayout from '../_layout';

describe('tab bar do motorista com a fonte do sistema em 2.0', () => {
  it.each(['Início', 'Paradas', 'Mapa', 'Histórico'])(
    'o rótulo "%s" tem teto de escala e fica numa linha',
    (titulo) => {
      const { getByText } = render(<TabLayout />);

      const rotulo = getByText(titulo);
      expect(rotulo.props.numberOfLines).toBe(1);
      expect(rotulo.props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.3);
    },
  );
});
