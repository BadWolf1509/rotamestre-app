import { render } from '@testing-library/react-native';
import React from 'react';
import { Pressable, TouchableOpacity, StyleSheet } from 'react-native';

import { CORES_SOBRE_O_MAPA } from '../coresSobreOMapa';
import { PinoDaUnidade } from '../PinoDaUnidade';
import { pontosDaUnidade } from '../pontosDaUnidade';

const base = { latitude: -7.1, longitude: -34.8, endereco: 'Av. X, 1' };
const [sede] = pontosDaUnidade([
  { ...base, id: 'p0', ordem: 0 },
  { ...base, id: 'c9', ordem: 9 },
]);
const [, chegada] = pontosDaUnidade([
  { ...base, id: 'p0', ordem: 0 },
  { ...base, id: 'c9', ordem: 9, latitude: -7.2 },
]);

describe('PinoDaUnidade', () => {
  it('sede: ícone de casa, fundo azul-marinho, rotulada', () => {
    const { getByLabelText, UNSAFE_getByProps } = render(
      <PinoDaUnidade ponto={sede} tamanho={28} testID="pino" />,
    );

    const pino = getByLabelText('Sede da unidade, Av. X, 1');
    expect(StyleSheet.flatten(pino.props.style).backgroundColor).toBe(
      CORES_SOBRE_O_MAPA.sede,
    );
    expect(UNSAFE_getByProps({ name: 'home' })).toBeTruthy();
  });

  it('chegada separada usa o ícone de local', () => {
    const { UNSAFE_getByProps } = render(
      <PinoDaUnidade ponto={chegada} tamanho={28} />,
    );
    expect(UNSAFE_getByProps({ name: 'location' })).toBeTruthy();
  });

  it('nada clicável dentro (o toque é do <Marker>, no Android)', () => {
    const { UNSAFE_queryAllByType } = render(
      <PinoDaUnidade ponto={sede} tamanho={28} />,
    );
    expect(UNSAFE_queryAllByType(Pressable)).toHaveLength(0);
    expect(UNSAFE_queryAllByType(TouchableOpacity)).toHaveLength(0);
  });
});
