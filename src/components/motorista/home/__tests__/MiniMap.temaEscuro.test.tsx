/**
 * MiniMap no tema escuro.
 *
 * O estilo do mapa é sempre claro, mas `colors.white`/`colors.black` se
 * INVERTEM no tema escuro (`white` vira #1a2029). Tudo o que fica sobre o
 * mapa usa cores fixas: borda e número dos pinos, chip e ícones.
 *
 * Arquivo à parte porque o `StyleSheet.create` do componente é avaliado na
 * importação, com o tema do mock.
 */

import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { MiniMap } from '../MiniMap';

jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      // Valores do darkTheme (src/utils/styles.base.ts)
      white: '#1a2029',
      black: '#f9fafb',
      primary: '#7a9bdf',
      success: '#34d399',
      warning: '#fbbf24',
      info: '#60a5fa',
      gray200: '#374151',
      gray400: '#6b7280',
      gray500: '#9ca3af',
    },
    typography: { fontSize: { xs: 12, sm: 14 } },
    spacing: { '1.5': 6, '2': 8, '3': 12, '4': 16 },
    borderRadius: { xs: 4, xl: 20, full: 9999 },
  };
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: unknown) =>
        typeof fn === 'function' ? fn(theme) : (fn as object),
    },
  };
});

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('@/hooks/useRouteDirections', () => ({
  useRouteDirections: () => ({
    routeCoordinates: [],
    routeInfo: null,
    isLoading: false,
    error: null,
  }),
}));

const BRANCO = '#ffffff';

const paradas = [
  {
    id: 'partida',
    ordem: 0,
    endereco: 'Base',
    latitude: -23.5,
    longitude: -46.6,
    status: 'pendente',
    is_checkpoint: false,
  },
  {
    id: 'p1',
    ordem: 1,
    endereco: 'Rua A',
    latitude: -23.55,
    longitude: -46.63,
    status: 'pendente',
  },
  {
    id: 'p2',
    ordem: 2,
    endereco: 'Rua B',
    latitude: -23.6,
    longitude: -46.7,
    status: 'pendente',
  },
];

describe('MiniMap no tema escuro', () => {
  const tela = () =>
    render(<MiniMap paradas={paradas} onToggleExpand={jest.fn()} />);

  const estiloDoPino = (texto: ReturnType<typeof render>['getByText']) => {
    let no = texto('2').parent;
    while (no && no.props.testID !== 'marker') no = no.parent;
    return StyleSheet.flatten(no?.props.style);
  };

  it('pino mantém borda e número brancos de verdade', () => {
    const { getByText } = tela();

    expect(estiloDoPino(getByText).borderColor).toBe(BRANCO);
    expect(StyleSheet.flatten(getByText('2').props.style).color).toBe(BRANCO);
  });

  it('pino mantém o fundo da paleta clara, como o mapa', () => {
    const { getByText } = tela();

    expect(estiloDoPino(getByText).backgroundColor).not.toBe('#9ca3af');
  });

  it('chip mantém texto branco sobre a cor da marca da paleta clara', () => {
    const { getByText, getByTestId } = tela();
    const texto = getByText(/paradas restantes/);

    expect(StyleSheet.flatten(texto.props.style).color).toBe(BRANCO);
    const fundo = StyleSheet.flatten(
      getByTestId('mini-mapa-chip').props.style,
    ).backgroundColor;
    expect(fundo).toBeTruthy();
    expect(fundo).not.toMatch(/122, 155, 223/); // não o primary do escuro (#7a9bdf)
  });

  it('checkpoint e ícone do botão continuam claros', () => {
    const { UNSAFE_getAllByType, getByLabelText } = tela();
    const icones = UNSAFE_getAllByType('Ionicons' as never);

    const doBotao = getByLabelText('Expandir mapa').findByType(
      'Ionicons' as never,
    );
    expect(doBotao.props.color).toBe(BRANCO);

    const doCheckpoint = icones.find((i) => i.props.name === 'location');
    expect(
      StyleSheet.flatten(doCheckpoint?.parent?.props.style).backgroundColor,
    ).toBe(BRANCO);
  });
});
