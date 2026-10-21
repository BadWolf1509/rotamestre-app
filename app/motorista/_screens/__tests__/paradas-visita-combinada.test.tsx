/**
 * Aba Paradas: entrega + retirada no mesmo local são uma visita.
 *
 * POR QUE EXISTE. A conclusão em sequência e o "Pular também" só existiam na
 * Início. Pela aba Paradas o motorista concluía a entrega e tinha de achar a
 * retirada na lista, e pulava um serviço por vez — com "cliente ausente", que
 * vale para o local inteiro.
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import CheckpointsMotorista from '../checkpoints';

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
const mockParadas = [
  ENTREGA,
  { ...ENTREGA, id: 'p4', ordem: 4, tipo: 'retirada', status: 'pendente' },
];

const mockRefreshRoute = jest.fn(() => Promise.resolve());
const mockSkipStop = jest.fn();
const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();

jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => ({
    route: { id: 'rota-1', status: 'em_andamento', unidade_id: 'u-1' },
    paradas: mockParadas,
    loading: false,
    routeStatus: 'active',
    refreshRoute: mockRefreshRoute,
    skipStop: (...a: unknown[]) => mockSkipStop(...a),
  }),
}));

jest.mock('@/hooks/useAlert', () => ({
  useAlert: () => ({
    showWarning: jest.fn(),
    showSuccess: (...a: unknown[]) => mockShowSuccess(...a),
    showError: (...a: unknown[]) => mockShowError(...a),
    showConfirm: jest.fn(),
    AlertDialog: null,
  }),
}));

jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native');
  return { GestureHandlerRootView: View };
});

jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'm-1' } }),
}));
jest.mock('@/hooks/useDriverLocationBroadcast', () => ({
  useDriverLocationBroadcast: jest.fn(),
}));
jest.mock('@/hooks/motorista/useRestaurarConclusaoEmVoo', () => ({
  useRestaurarConclusaoEmVoo: jest.fn(),
}));
jest.mock('@/hooks/motorista/useRestaurarRascunhoIncidente', () => ({
  useRestaurarRascunhoIncidente: jest.fn(),
}));

jest.mock('@/components/motorista/ParadaCard', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    ParadaCard: (props: {
      parada: { id: string };
      onConcluir: (p: unknown) => void;
      onPular: (p: unknown) => void;
    }) => (
      <>
        <P onPress={() => props.onConcluir(props.parada)}>
          <T>{`concluir:${props.parada.id}`}</T>
        </P>
        <P onPress={() => props.onPular(props.parada)}>
          <T>{`pular:${props.parada.id}`}</T>
        </P>
      </>
    ),
  };
});

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

jest.mock('@/components/motorista/SkipReasonModal', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    SkipReasonModal: (props: {
      parada: { id: string };
      outrosServicosNoLocal?: Array<{ id: string }>;
      onConfirm: (m: string, o?: string, incluir?: boolean) => void;
    }) => (
      <>
        <T>{`outros:${(props.outrosServicosNoLocal ?? []).map((p) => p.id).join(',')}`}</T>
        <P onPress={() => props.onConfirm('cliente_ausente', undefined, true)}>
          <T>confirmar-com-outros</T>
        </P>
      </>
    ),
  };
});

describe('aba Paradas — visita combinada', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSkipStop.mockResolvedValue(undefined);
  });

  it('concluir a entrega emenda o comprovante da retirada', async () => {
    const { getByText } = render(<CheckpointsMotorista />);

    fireEvent.press(getByText('concluir:p3'));
    expect(getByText('fluxo-conclusao:p3')).toBeTruthy();
    expect(getByText('Mais 1 serviço neste local: Retirada')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('confirmar-conclusao'));
    });

    await waitFor(() => {
      expect(getByText('fluxo-conclusao:p4')).toBeTruthy();
    });
  });

  it('o modal de pular oferece os outros serviços do local', () => {
    const { getByText } = render(<CheckpointsMotorista />);

    fireEvent.press(getByText('pular:p3'));

    expect(getByText('outros:p4')).toBeTruthy();
  });

  it('pular junto pula os dois serviços, com o mesmo motivo', async () => {
    const { getByText } = render(<CheckpointsMotorista />);

    fireEvent.press(getByText('pular:p3'));
    fireEvent.press(getByText('confirmar-com-outros'));

    await waitFor(() => expect(mockSkipStop).toHaveBeenCalledTimes(2));
    expect(mockSkipStop.mock.calls.map((c) => c[0])).toEqual(['p3', 'p4']);
    expect(mockShowSuccess).toHaveBeenCalledWith(
      'Paradas Puladas',
      expect.any(String),
    );
  });

  it('falha parcial diz qual serviço foi pulado e qual falhou', async () => {
    mockSkipStop
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('falhou'));
    const { getByText } = render(<CheckpointsMotorista />);

    fireEvent.press(getByText('pular:p3'));
    fireEvent.press(getByText('confirmar-com-outros'));

    await waitFor(() => expect(mockShowError).toHaveBeenCalledTimes(1));
    expect(mockShowError.mock.calls[0][0].title).toBe('Pulo incompleto');
  });
});
