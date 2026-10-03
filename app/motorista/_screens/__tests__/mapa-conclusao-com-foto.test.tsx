/**
 * Concluir pela aba Mapa passa pelo comprovante, como em qualquer outra tela.
 *
 * POR QUE EXISTE. O "Concluir" do bottom sheet da parada chamava
 * `completeStop(parada.id)` direto: concluía SEM foto e sem nem oferecer a
 * câmera. Era a única porta do app que fazia isso — Início, Paradas e o modo
 * navegação abrem o `StopCompletionFlow`. Achado em 02/10/2026 ao investigar
 * entregas sem comprovante.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import MapaMotorista from '../mapa';

const PARADA = {
  id: 'parada-1',
  ordem: 1,
  status: 'em_andamento',
  endereco: 'Rua A, 1',
  latitude: -7.1,
  longitude: -34.8,
  is_checkpoint: true,
};

const mockCompleteStop = jest.fn();

jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => ({
    route: { id: 'rota-1', status: 'em_andamento', unidade_id: 'u-1' },
    paradas: [PARADA],
    loading: false,
    routeStatus: 'active',
    completeStop: (...a: unknown[]) => mockCompleteStop(...a),
  }),
}));

jest.mock('@/components/MapaAdapter', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    MapaAdapter: (props: { onMarkerPress: (id: string) => void }) => (
      <P onPress={() => props.onMarkerPress('parada-1')}>
        <T>marcador</T>
      </P>
    ),
  };
});

jest.mock('@/components/motorista/ParadaBottomSheet', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    ParadaBottomSheet: (props: {
      parada: { id: string } | null;
      visible: boolean;
      onMarkComplete?: (p: { id: string }) => void;
      onClose: () => void;
    }) =>
      props.visible && props.parada ? (
        <P
          onPress={() => {
            props.onMarkComplete?.(props.parada as { id: string });
            props.onClose();
          }}
        >
          <T>sheet-concluir</T>
        </P>
      ) : null,
  };
});

jest.mock('@/components/motorista/StopCompletionFlow', () => {
  const { Text: T } = jest.requireActual('react-native');
  return {
    StopCompletionFlow: (props: {
      visible: boolean;
      parada: { id: string } | null;
    }) =>
      props.visible && props.parada ? (
        <T>{`fluxo-conclusao:${props.parada.id}`}</T>
      ) : null,
  };
});

jest.mock('@/hooks/useDriverLocationBroadcast', () => ({
  useDriverLocationBroadcast: jest.fn(),
}));

describe('aba Mapa — concluir parada', () => {
  beforeEach(() => jest.clearAllMocks());

  it('abre o fluxo com foto em vez de concluir direto', async () => {
    const { getByText } = render(<MapaMotorista />);

    fireEvent.press(getByText('marcador'));
    fireEvent.press(getByText('sheet-concluir'));

    await waitFor(() => {
      expect(getByText('fluxo-conclusao:parada-1')).toBeTruthy();
    });
    expect(mockCompleteStop).not.toHaveBeenCalled();
  });
});
