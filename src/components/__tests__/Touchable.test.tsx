import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { Touchable } from '../Touchable';

// Pressable só liga `pressed` pelo sistema de responder: simula o toque inicial.
const evento = () => ({
  persist: () => undefined,
  nativeEvent: { touches: [], changedTouches: [], timestamp: Date.now() },
});
const apertar = (el: Parameters<typeof fireEvent>[0]) =>
  act(() => {
    fireEvent(el, 'responderGrant', evento());
  });
// O Pressable segura o pressOut por `minPressDuration` (130 ms): avança o relógio.
const soltar = (el: Parameters<typeof fireEvent>[0]) =>
  act(() => {
    fireEvent(el, 'responderTerminate', evento());
    jest.advanceTimersByTime(300);
  });

const estilo = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

describe('Touchable', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('chama onPress e renderiza os filhos', () => {
    const aoTocar = jest.fn();
    const { getByText } = render(
      <Touchable onPress={aoTocar}>
        <Text>Tocar</Text>
      </Touchable>,
    );
    fireEvent.press(getByText('Tocar'));
    expect(aoTocar).toHaveBeenCalledTimes(1);
  });

  it('não chama onPress quando disabled', () => {
    const aoTocar = jest.fn();
    const { getByText } = render(
      <Touchable onPress={aoTocar} disabled>
        <Text>Tocar</Text>
      </Touchable>,
    );
    fireEvent.press(getByText('Tocar'));
    expect(aoTocar).not.toHaveBeenCalled();
  });

  it('aceita array de estilos com falsy no meio (o motivo da troca)', () => {
    const { getByTestId } = render(
      <Touchable
        testID="t"
        style={[{ padding: 4 }, false, null, undefined, { margin: 2 }]}
      >
        <Text>x</Text>
      </Touchable>,
    );
    expect(estilo(getByTestId('t'))).toMatchObject({ padding: 4, margin: 2 });
  });

  it('só reduz a opacidade enquanto pressionado, com o activeOpacity pedido', () => {
    const { getByTestId } = render(
      <Touchable testID="t" activeOpacity={0.7} style={{ padding: 4 }}>
        <Text>x</Text>
      </Touchable>,
    );
    expect(estilo(getByTestId('t')).opacity).toBeUndefined();
    apertar(getByTestId('t'));
    expect(estilo(getByTestId('t'))).toMatchObject({
      padding: 4,
      opacity: 0.7,
    });
    soltar(getByTestId('t'));
    expect(estilo(getByTestId('t')).opacity).toBeUndefined();
  });

  it('activeOpacity padrão é 0.2, como o TouchableOpacity', () => {
    const { getByTestId } = render(
      <Touchable testID="t">
        <Text>x</Text>
      </Touchable>,
    );
    apertar(getByTestId('t'));
    expect(estilo(getByTestId('t')).opacity).toBe(0.2);
  });

  it('activeOpacity 1 não muda nada ao pressionar', () => {
    const { getByTestId } = render(
      <Touchable testID="t" activeOpacity={1}>
        <Text>x</Text>
      </Touchable>,
    );
    apertar(getByTestId('t'));
    expect(estilo(getByTestId('t')).opacity).toBeUndefined();
  });

  it('accessibilityRole é "button" por padrão e pode ser trocado', () => {
    const { getByTestId, rerender } = render(
      <Touchable testID="t">
        <Text>x</Text>
      </Touchable>,
    );
    expect(getByTestId('t').props.accessibilityRole).toBe('button');
    rerender(
      <Touchable testID="t" accessibilityRole="link">
        <Text>x</Text>
      </Touchable>,
    );
    expect(getByTestId('t').props.accessibilityRole).toBe('link');
  });
});
