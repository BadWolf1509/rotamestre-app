/**
 * Menu desktop do SeletorPeriodo: só aparece quando a medida do botão da
 * abertura ATUAL responde e o menu mede a si mesmo; abre para cima perto da
 * borda de baixo e fica dentro da janela na horizontal.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { SeletorPeriodo } from '../SeletorPeriodo';

type RespostaDaMedida = (
  x: number,
  y: number,
  largura: number,
  altura: number,
) => void;

const mockMedidas: RespostaDaMedida[] = [];
const mockJanela = { width: 1280, height: 800 };

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: true, isMobile: false }),
}));
jest.mock('react-native-ui-datepicker', () => ({
  __esModule: true,
  default: jest.fn(() => null),
  useDefaultStyles: jest.fn(() => ({})),
}));
jest.mock('@react-native-community/datetimepicker', () => jest.fn(() => null));

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const ReactReal = jest.requireActual('react');
  const ViewMedida = ReactReal.forwardRef(
    (props: Record<string, unknown>, ref: unknown) => {
      ReactReal.useImperativeHandle(ref, () => ({
        measureInWindow: (resposta: RespostaDaMedida) =>
          mockMedidas.push(resposta),
      }));
      return ReactReal.createElement(RN.View, props);
    },
  );
  return Object.create(RN, {
    View: { value: ViewMedida },
    useWindowDimensions: { value: () => mockJanela },
  });
});

const menu = () => screen.UNSAFE_queryByProps({ accessibilityRole: 'menu' });

function abrir() {
  render(<SeletorPeriodo valor={{ tipo: 'este_mes' }} aoMudar={jest.fn()} />);
  fireEvent.press(screen.getByTestId('seletor-periodo'));
}

/** O menu é o pai do `menu` de itens: o que recebe a posição. */
function estiloDoMenu() {
  const lista = menu()!;
  const caixa = lista.parent!.parent!;
  return StyleSheet.flatten(caixa.props.style);
}

function medirMenu(largura: number, altura: number) {
  const lista = menu()!;
  fireEvent(lista.parent!.parent!, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: largura, height: altura } },
  });
}

beforeEach(() => {
  mockMedidas.length = 0;
});

it('só aparece depois que a medida do botão responde', () => {
  abrir();
  expect(mockMedidas).toHaveLength(1);
  expect(menu()).toBeNull();
  act(() => mockMedidas[0](100, 200, 200, 44));
  expect(menu()).not.toBeNull();
});

it('fica invisível até o menu se medir e então abre embaixo do botão', () => {
  abrir();
  act(() => mockMedidas[0](100, 200, 200, 44));
  expect(estiloDoMenu().opacity).toBe(0);
  act(() => medirMenu(240, 300));
  const estilo = estiloDoMenu();
  expect(estilo.opacity).toBeUndefined();
  expect(estilo.top).toBe(248);
  expect(estilo.left).toBe(100);
});

it('perto da borda de baixo abre para cima do botão', () => {
  abrir();
  act(() => mockMedidas[0](100, 700, 200, 44));
  act(() => medirMenu(240, 300));
  expect(estiloDoMenu().top).toBe(700 - 4 - 300);
});

it('na borda direita fica dentro da janela', () => {
  abrir();
  act(() => mockMedidas[0](1200, 100, 60, 44));
  act(() => medirMenu(340, 300));
  expect(estiloDoMenu().left).toBe(1280 - 340 - 8);
});

it('resposta de abertura antiga é descartada', () => {
  abrir();
  fireEvent.press(screen.getByTestId('seletor-periodo-fora'));
  fireEvent.press(screen.getByTestId('seletor-periodo'));
  expect(mockMedidas).toHaveLength(2);
  act(() => mockMedidas[0](10, 10, 10, 10));
  expect(menu()).toBeNull();
  act(() => mockMedidas[1](100, 200, 200, 44));
  expect(menu()).not.toBeNull();
});
