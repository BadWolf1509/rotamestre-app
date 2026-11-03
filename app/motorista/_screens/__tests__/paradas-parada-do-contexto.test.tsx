/**
 * Aba Paradas: concluir e pular entregam a parada do CONTEXTO, não uma cópia.
 *
 * POR QUE EXISTE (B16). A lista mostra `Parada` (o tipo do card), e a tela
 * reconstruía o `ParadaData` a partir dela (a conversão inversa que saiu de
 * `typeMappers`) antes de abrir o comprovante e
 * o pulo. A volta perdia todo campo que o card não carrega (`foto_url`,
 * `updated_at`...). Agora a tela busca pelo id a parada que o contexto tem.
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { useRestaurarConclusaoEmVoo } from '@/hooks/motorista/useRestaurarConclusaoEmVoo';

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
  foto_url: 'u1/r1/p3_1.jpg',
  updated_at: '2026-11-03T12:00:00Z',
};
const RETIRADA = {
  ...ENTREGA,
  id: 'p4',
  ordem: 4,
  tipo: 'retirada',
  status: 'pendente',
  foto_url: null,
};

// Mutável: o último caso tira a p3 do contexto entre um render e outro.
let mockParadasDoContexto: Array<typeof ENTREGA | typeof RETIRADA> = [];

const mockPropsFluxo = jest.fn();
const mockPropsPulo = jest.fn();

jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => ({
    route: { id: 'rota-1', status: 'em_andamento', unidade_id: 'u-1' },
    paradas: mockParadasDoContexto,
    loading: false,
    routeStatus: 'active',
    refreshRoute: jest.fn(() => Promise.resolve()),
    skipStop: jest.fn(() => Promise.resolve()),
  }),
}));

jest.mock('@/hooks/useAlert', () => ({
  useAlert: () => ({
    showWarning: jest.fn(),
    showSuccess: jest.fn(),
    showError: jest.fn(),
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
    }) => {
      mockPropsFluxo(props);
      return props.visible && props.parada ? (
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
      ) : null;
    },
  };
});

jest.mock('@/components/motorista/SkipReasonModal', () => {
  const { Pressable: P, Text: T } = jest.requireActual('react-native');
  return {
    SkipReasonModal: (props: {
      parada: { id: string };
      outrosServicosNoLocal?: Array<{ id: string }>;
      onConfirm: (m: string, o?: string, incluir?: boolean) => void;
    }) => {
      mockPropsPulo(props);
      return (
        <>
          <T>{`outros:${(props.outrosServicosNoLocal ?? []).map((p) => p.id).join(',')}`}</T>
          <P
            onPress={() => props.onConfirm('cliente_ausente', undefined, true)}
          >
            <T>confirmar-com-outros</T>
          </P>
        </>
      );
    },
  };
});

const p3DoContexto = () => mockParadasDoContexto.find((p) => p.id === 'p3');

describe('aba Paradas — a parada do contexto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParadasDoContexto = [{ ...ENTREGA }, { ...RETIRADA }];
  });

  it('concluir entrega ao fluxo o ParadaData do contexto, sem perder campos', () => {
    const { getByText } = render(<CheckpointsMotorista />);

    fireEvent.press(getByText('concluir:p3'));

    expect(mockPropsFluxo.mock.calls.at(-1)[0].parada).toBe(p3DoContexto());
  });

  it('pular entrega ao modal o ParadaData do contexto', () => {
    const { getByText } = render(<CheckpointsMotorista />);

    fireEvent.press(getByText('pular:p3'));

    expect(mockPropsPulo.mock.calls.at(-1)[0].parada).toBe(p3DoContexto());
  });

  it('restauração pós-câmera reabre o fluxo com o ParadaData do contexto', () => {
    render(<CheckpointsMotorista />);

    const restaurar = (useRestaurarConclusaoEmVoo as jest.Mock).mock.calls.at(
      -1,
    )[2];
    act(() => restaurar(p3DoContexto()));

    expect(mockPropsFluxo.mock.calls.at(-1)[0].parada).toBe(p3DoContexto());
  });

  it('parada que sumiu do contexto não abre o modal de pulo', () => {
    const { getByText, queryByText, rerender } = render(
      <CheckpointsMotorista />,
    );

    fireEvent.press(getByText('pular:p3'));
    expect(getByText('confirmar-com-outros')).toBeTruthy();

    mockParadasDoContexto = mockParadasDoContexto.filter((p) => p.id !== 'p3');
    rerender(<CheckpointsMotorista />);

    expect(queryByText('confirmar-com-outros')).toBeNull();
  });
});
