/**
 * MenuDeAcoes sem pisca: a lista só aparece depois que o `measureInWindow`
 * da abertura atual responde. Antes, ela surgia no canto (sem âncora) e
 * pulava para baixo do botão; ao reabrir, aparecia na âncora da vez anterior.
 *
 * Também: sem `measureInWindow` ela abre no canto; perto da borda de baixo ela
 * abre para cima; e a janela mudar de tamanho com ela aberta a fecha (a âncora
 * foi medida na janela de antes).
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { MenuDeAcoes } from '../MenuDeAcoes';

type RespostaDaMedida = (
  x: number,
  y: number,
  largura: number,
  altura: number,
) => void;

// Cada chamada de measureInWindow fica guardada; o teste decide quando responde.
const mockMedidas: RespostaDaMedida[] = [];
// false: a View não tem `measureInWindow` (não há como medir).
let mockTemMedida = true;
let mockJanela = { width: 1280, height: 800 };

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const ReactReal = jest.requireActual('react');
  const ViewMedida = ReactReal.forwardRef(
    (props: Record<string, unknown>, ref: unknown) => {
      ReactReal.useImperativeHandle(ref, () =>
        mockTemMedida
          ? {
              measureInWindow: (resposta: RespostaDaMedida) =>
                mockMedidas.push(resposta),
            }
          : {},
      );
      return ReactReal.createElement(RN.View, props);
    },
  );
  return Object.create(RN, {
    View: { value: ViewMedida },
    useWindowDimensions: { value: () => mockJanela },
  });
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

const estiloDaLista = () => StyleSheet.flatten(lista()?.props.style);
const medirLista = (altura: number) =>
  fireEvent(lista()!, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 180, height: altura } },
  });

beforeEach(() => {
  mockMedidas.length = 0;
  mockTemMedida = true;
  mockJanela = { width: 1280, height: 800 };
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

it('sem measureInWindow, a lista abre na hora, no canto superior direito', () => {
  mockTemMedida = false;
  render(<MenuDeAcoes item={item} acoes={acoes} testID="menu" />);

  fireEvent.press(screen.getByLabelText('Mais ações'));

  expect(lista()).not.toBeNull();
  const estilo = estiloDaLista();
  expect(typeof estilo.top).toBe('number');
  expect(typeof estilo.right).toBe('number');
  expect(screen.getByRole('menuitem', { name: 'Excluir rota' })).toBeTruthy();
});

it('com espaço embaixo, a lista abre logo abaixo do botão', () => {
  render(<MenuDeAcoes item={item} acoes={acoes} testID="menu" />);
  fireEvent.press(screen.getByLabelText('Mais ações'));
  act(() => mockMedidas[0](100, 200, 32, 32));

  medirLista(120);

  expect(estiloDaLista().top).toBe(200 + 32 + 4);
  expect(estiloDaLista().opacity).not.toBe(0);
});

it('perto da borda de baixo, a lista abre para cima do botão', () => {
  render(<MenuDeAcoes item={item} acoes={acoes} testID="menu" />);
  fireEvent.press(screen.getByLabelText('Mais ações'));
  act(() => mockMedidas[0](100, 700, 32, 32));

  // Antes de saber a altura, ela não aparece (senão pularia de baixo para cima).
  expect(estiloDaLista().opacity).toBe(0);
  medirLista(120);

  // 700 + 32 + 4 + 120 passa dos 800 da janela: vai para cima (700 - 4 - 120).
  expect(estiloDaLista().top).toBe(576);
  expect(estiloDaLista().opacity).not.toBe(0);
});

it('a janela mudar de tamanho com a lista aberta a fecha', () => {
  const { rerender } = render(
    <MenuDeAcoes item={item} acoes={acoes} testID="menu" />,
  );
  fireEvent.press(screen.getByLabelText('Mais ações'));
  act(() => mockMedidas[0](100, 200, 32, 32));
  expect(lista()).not.toBeNull();

  mockJanela = { width: 1024, height: 800 };
  rerender(<MenuDeAcoes item={item} acoes={acoes} testID="menu" />);

  expect(lista()).toBeNull();
  expect(
    screen.getByLabelText('Mais ações').props.accessibilityState.expanded,
  ).toBe(false);
});
