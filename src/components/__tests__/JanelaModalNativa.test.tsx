import { render } from '@testing-library/react-native';
import React from 'react';
import { Modal as RNModal, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { JanelaModalNativa } from '../JanelaModalNativa';

describe('JanelaModalNativa', () => {
  it('põe o GestureHandlerRootView DENTRO do Modal nativo (commit c80f80a2)', () => {
    const { UNSAFE_getByType } = render(
      <JanelaModalNativa visible onRequestClose={jest.fn()}>
        <Text>conteúdo</Text>
      </JanelaModalNativa>,
    );

    const modal = UNSAFE_getByType(RNModal);
    // A raiz de gestos tem de ser descendente do Modal: no Android ele abre
    // numa janela nativa à parte, que a raiz do app não alcança.
    expect(modal.findByType(GestureHandlerRootView)).toBeTruthy();
    expect(
      UNSAFE_getByType(GestureHandlerRootView).props.style,
    ).toEqual({ flex: 1 });
  });

  it('repassa visible, transparent, animationType e onRequestClose ao Modal', () => {
    const aoFechar = jest.fn();
    const { UNSAFE_getByType } = render(
      <JanelaModalNativa
        visible
        transparent
        animationType="slide"
        onRequestClose={aoFechar}
      >
        <Text>x</Text>
      </JanelaModalNativa>,
    );

    const props = UNSAFE_getByType(RNModal).props;
    expect(props.visible).toBe(true);
    expect(props.transparent).toBe(true);
    expect(props.animationType).toBe('slide');
    expect(props.onRequestClose).toBe(aoFechar);
  });

  it('renderiza os filhos', () => {
    const { getByText } = render(
      <JanelaModalNativa visible>
        <Text>conteúdo</Text>
      </JanelaModalNativa>,
    );
    expect(getByText('conteúdo')).toBeTruthy();
  });
});
