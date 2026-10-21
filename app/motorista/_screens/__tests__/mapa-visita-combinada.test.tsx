/**
 * Pino agrupado na aba Mapa: entrega + retirada no mesmo local.
 *
 * POR QUE EXISTE. O bottom sheet do pino recebia só a parada principal, e o
 * "Concluir" dele abria o comprovante de um serviço só: o da retirada nunca
 * emendava, e o motorista tinha de voltar ao mapa para achar o 2º serviço
 * debaixo do mesmo pino. Na Início isso já era uma sequência
 * (`useConclusaoEmSequencia`); aqui passou a ser também.
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import MapaMotorista from '../mapa';

const ENTREGA = {
  id: 'p3',
  ordem: 3,
  tipo: 'entrega',
  status: 'em_andamento',
  endereco: 'Rua A, 1',
  latitude: -7.1,
  longitude: -34.8,
  is_checkpoint: true,
};
const RETIRADA = {
  ...ENTREGA,
  id: 'p4',
  ordem: 4,
  tipo: 'retirada',
  status: 'pendente',
};
const OUTRO_LOCAL = {
  ...ENTREGA,
  id: 'p5',
  ordem: 5,
  status: 'pendente',
  latitude: -7.2,
  longitude: -34.9,
};

const mockParadas = [ENTREGA, RETIRADA, OUTRO_LOCAL];
const mockRefreshRoute = jest.fn(() => Promise.resolve());

jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => ({
    route: { id: 'rota-1', status: 'em_andamento', unidade_id: 'u-1' },
    paradas: mockParadas,
    loading: false,
    routeStatus: 'active',
    refreshRoute: mockRefreshRoute,
  }),
}));

jest.mock('@/components/MapaAdapter', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    MapaAdapter: (props: { onSelectedMarkerPress?: (id: string) => void }) => (
      <P onPress={() => props.onSelectedMarkerPress?.('p3')}>
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
      servicosNoLocal?: Array<{ id: string }>;
      visible: boolean;
      onMarkComplete?: (p: { id: string }) => void;
      onClose: () => void;
    }) =>
      props.visible && props.parada ? (
        <>
          <T>{`servicos:${(props.servicosNoLocal ?? []).map((s) => s.id).join(',')}`}</T>
          <P
            onPress={() => {
              props.onMarkComplete?.(props.parada as { id: string });
              props.onClose();
            }}
          >
            <T>sheet-concluir</T>
          </P>
        </>
      ) : null,
  };
});

// O mock imita a ordem real do StopCompletionFlow: onSuccess e, logo depois,
// onClose no mesmo tique.
jest.mock('@/components/motorista/StopCompletionFlow', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    StopCompletionFlow: (props: {
      visible: boolean;
      parada: { id: string } | null;
      contexto?: string | null;
      onSuccess?: () => void;
      onClose: () => void;
    }) =>
      props.visible && props.parada ? (
        <>
          <T>{`fluxo-conclusao:${props.parada.id}`}</T>
          {props.contexto ? <T>{props.contexto}</T> : null}
          <P
            onPress={() => {
              props.onSuccess?.();
              props.onClose();
            }}
          >
            <T>confirmar-conclusao</T>
          </P>
        </>
      ) : null,
  };
});

jest.mock('@/hooks/useDriverLocationBroadcast', () => ({
  useDriverLocationBroadcast: jest.fn(),
}));

describe('aba Mapa — visita combinada', () => {
  beforeEach(() => jest.clearAllMocks());

  it('o sheet recebe todos os serviços do local do pino', () => {
    const { getByText } = render(<MapaMotorista />);

    fireEvent.press(getByText('marcador'));

    expect(getByText('servicos:p3,p4')).toBeTruthy();
  });

  it('Concluir emenda o comprovante do 2º serviço do local', async () => {
    const { getByText, queryByText } = render(<MapaMotorista />);

    fireEvent.press(getByText('marcador'));
    fireEvent.press(getByText('sheet-concluir'));

    expect(getByText('fluxo-conclusao:p3')).toBeTruthy();
    expect(getByText('Mais 1 serviço neste local: Retirada')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('confirmar-conclusao'));
    });

    await waitFor(() => {
      expect(getByText('fluxo-conclusao:p4')).toBeTruthy();
    });
    expect(mockRefreshRoute).toHaveBeenCalled();
    expect(queryByText(/Mais 1 serviço/)).toBeNull();
  });
});
