/**
 * MenuDeAcoes sem pisca: a lista só aparece depois que o `measureInWindow`
 * da abertura atual responde. Antes, ela surgia no canto (sem âncora) e
 * pulava para baixo do botão; ao reabrir, aparecia na âncora da vez anterior.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { MenuDeAcoes } from '../MenuDeAcoes';

type RespostaDaMedida = (
  x: number,
  y: number,
  largura: number,
  altura: number,
) => void;

// Cada chamada de measureInWindow fica guardada; o teste decide quando responde.
const mockMedidas: RespostaDaMedida[] = [];

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
  return Object.create(RN, { View: { value: ViewMedida } });
});

const item = { id: '1' };
const acoes = [
  {
    label: 'Excluir rota',
    icon: 'trash-outline' as const,
    type: 'danger' as const,
    onPress: jest.fn(),
  },
];

const lista = () => screen.UNSAFE_queryByProps({ accessibilityRole: 'menu' });

beforeEach(() => {
  mockMedidas.length = 0;
});

it('ao abrir, a lista só aparece quando a medida do botão responde', () => {
  render(<MenuDeAcoes item={item} acoes={acoes} testID="menu" />);

  fireEvent.press(screen.getByLabelText('Mais ações'));
  expect(mockMedidas).toHaveLength(1);
  expect(lista()).toBeNull();

  act(() => mockMedidas[0](100, 200, 32, 32));

  expect(lista()).not.toBeNull();
  expect(screen.getByRole('menuitem', { name: 'Excluir rota' })).toBeTruthy();
});

it('ao reabrir, não usa a âncora da abertura anterior', () => {
  render(<MenuDeAcoes item={item} acoes={acoes} testID="menu" />);

  fireEvent.press(screen.getByLabelText('Mais ações'));
  act(() => mockMedidas[0](100, 200, 32, 32));
  fireEvent.press(screen.getByTestId('menu-fora'));
  expect(lista()).toBeNull();

  fireEvent.press(screen.getByLabelText('Mais ações'));
  expect(lista()).toBeNull();

  // Resposta atrasada da abertura anterior não vale para esta.
  act(() => mockMedidas[0](100, 200, 32, 32));
  expect(lista()).toBeNull();

  act(() => mockMedidas[1](100, 500, 32, 32));
  expect(lista()).not.toBeNull();
});
