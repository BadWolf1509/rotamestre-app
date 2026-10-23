/**
 * Pular pela aba Mapa. O sheet da parada tinha "Concluir" mas não "Pular":
 * quem estava no mapa precisava trocar de aba para registrar cliente ausente.
 * O pulo passa pelo mesmo motivo estruturado (SkipReasonModal) das outras
 * telas e pelo mesmo `skipStop` (com a fila offline por trás).
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
  tipo: 'entrega',
};

const mockSkipStop = jest.fn();
const mockShowSuccess = jest.fn();
let mockStatusRota = 'em_andamento';

jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => ({
    route: { id: 'rota-1', status: mockStatusRota, unidade_id: 'u-1' },
    paradas: [PARADA],
    loading: false,
    routeStatus: 'active',
    skipStop: (...a: unknown[]) => mockSkipStop(...a),
    refreshRoute: jest.fn(),
  }),
}));

jest.mock('@/hooks/useAlert', () => ({
  useAlert: () => ({
    showWarning: jest.fn(),
    showSuccess: (...a: unknown[]) => mockShowSuccess(...a),
    showError: jest.fn(),
    AlertDialog: null,
  }),
}));

jest.mock('@/components/MapaAdapter', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    MapaAdapter: (props: { onSelectedMarkerPress?: (id: string) => void }) => (
      <P onPress={() => props.onSelectedMarkerPress?.('parada-1')}>
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
      onSkip?: (p: { id: string }) => void;
      onClose: () => void;
    }) =>
      props.visible && props.parada && props.onSkip ? (
        <P
          onPress={() => {
            props.onSkip?.(props.parada as { id: string });
            props.onClose();
          }}
        >
          <T>sheet-pular</T>
        </P>
      ) : null,
  };
});

jest.mock('@/components/motorista/SkipReasonModal', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    SkipReasonModal: (props: {
      parada: { id: string };
      onConfirm: (m: string, o?: string, incluir?: boolean) => void;
    }) => (
      <P onPress={() => props.onConfirm('cliente_ausente')}>
        <T>{`motivo:${props.parada.id}`}</T>
      </P>
    ),
  };
});

jest.mock('@/components/motorista/StopCompletionFlow', () => ({
  StopCompletionFlow: () => null,
}));

jest.mock('@/hooks/useDriverLocationBroadcast', () => ({
  useDriverLocationBroadcast: jest.fn(),
}));

describe('aba Mapa — pular parada', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatusRota = 'em_andamento';
    mockSkipStop.mockResolvedValue('enviada');
  });

  it('Pular no sheet pede o motivo e pula pela mesma ação das outras telas', async () => {
    const { getByText } = render(<MapaMotorista />);

    fireEvent.press(getByText('marcador'));
    fireEvent.press(getByText('sheet-pular'));
    fireEvent.press(getByText('motivo:parada-1'));

    await waitFor(() => {
      expect(mockSkipStop).toHaveBeenCalledWith(
        'parada-1',
        'cliente_ausente',
        undefined,
      );
    });
    expect(mockShowSuccess).toHaveBeenCalledWith(
      'Parada Pulada',
      'Cliente ausente',
    );
  });
});
