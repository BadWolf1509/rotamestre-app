/**
 * Aba Mapa: o 1º toque no pino só seleciona (balão); as ações vêm depois.
 *
 * POR QUE EXISTE. Com o toque no pino consertado no Android (PR #594), o 1º
 * toque abria o balão E o ParadaBottomSheet juntos, e o fundo escuro do
 * modal cobria o mapa e o balão. Agora: 1º toque seleciona; tocar no balão
 * ou de novo no pino selecionado (onSelectedMarkerPress) abre as ações.
 */
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import MapaMotorista from '../mapa';

const PARADA = {
  id: 'parada-1',
  ordem: 1,
  status: 'pendente',
  endereco: 'Rua A, 1',
  latitude: -7.1,
  longitude: -34.8,
  is_checkpoint: true,
};

jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => ({
    route: { id: 'rota-1', status: 'em_andamento', unidade_id: 'u-1' },
    paradas: [PARADA],
    loading: false,
    routeStatus: 'active',
    completeStop: jest.fn(),
  }),
}));

jest.mock('@/components/MapaAdapter', () => {
  const { Pressable: P, Text: T, View: V } = jest.requireActual('react-native');
  return {
    MapaAdapter: (props: {
      selectedParadaId?: string | null;
      onMarkerPress: (id: string) => void;
      onSelectedMarkerPress?: (id: string) => void;
      onMapPress: () => void;
    }) => (
      <V>
        <T>{`selecionada:${props.selectedParadaId ?? 'nenhuma'}`}</T>
        <P onPress={() => props.onMarkerPress('parada-1')}>
          <T>toque-no-pino</T>
        </P>
        <P onPress={() => props.onSelectedMarkerPress?.('parada-1')}>
          <T>toque-no-pino-selecionado</T>
        </P>
        <P onPress={props.onMapPress}>
          <T>toque-no-mapa</T>
        </P>
      </V>
    ),
  };
});

jest.mock('@/components/motorista/ParadaBottomSheet', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    ParadaBottomSheet: (props: {
      parada: { id: string } | null;
      visible: boolean;
      onClose: () => void;
    }) =>
      props.visible && props.parada ? (
        <P onPress={props.onClose}>
          <T>{`sheet:${props.parada.id}`}</T>
        </P>
      ) : null,
  };
});

jest.mock('@/components/motorista/StopCompletionFlow', () => ({
  StopCompletionFlow: () => null,
}));

jest.mock('@/hooks/useDriverLocationBroadcast', () => ({
  useDriverLocationBroadcast: jest.fn(),
}));

describe('aba Mapa — seleção em dois toques', () => {
  it('o 1º toque seleciona a parada sem abrir o sheet', () => {
    const { getByText, queryByText } = render(<MapaMotorista />);

    fireEvent.press(getByText('toque-no-pino'));

    expect(getByText('selecionada:parada-1')).toBeTruthy();
    expect(queryByText('sheet:parada-1')).toBeNull();
  });

  it('o toque no pino já selecionado abre o sheet', () => {
    const { getByText } = render(<MapaMotorista />);

    fireEvent.press(getByText('toque-no-pino'));
    fireEvent.press(getByText('toque-no-pino-selecionado'));

    expect(getByText('sheet:parada-1')).toBeTruthy();
  });

  it('fechar o sheet mantém a seleção (e o balão)', () => {
    const { getByText, queryByText } = render(<MapaMotorista />);

    fireEvent.press(getByText('toque-no-pino'));
    fireEvent.press(getByText('toque-no-pino-selecionado'));
    fireEvent.press(getByText('sheet:parada-1'));

    expect(queryByText('sheet:parada-1')).toBeNull();
    expect(getByText('selecionada:parada-1')).toBeTruthy();
  });

  it('o toque no mapa vazio limpa a seleção', () => {
    const { getByText } = render(<MapaMotorista />);

    fireEvent.press(getByText('toque-no-pino'));
    fireEvent.press(getByText('toque-no-mapa'));

    expect(getByText('selecionada:nenhuma')).toBeTruthy();
  });
});
