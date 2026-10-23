/**
 * Aba Paradas: recarga não troca a lista por skeleton nem desmonta o wizard.
 *
 * POR QUE EXISTE. Toda recarga da rota (realtime, polling, ação) ligava o
 * `loading` do contexto, e a aba trocava a lista inteira por skeleton — o
 * wizard de incidente, que morava dentro dessa lista, era desmontado no meio
 * do relato. O mesmo defeito já tinha sido corrigido na aba Mapa.
 */
import { fireEvent, render } from '@testing-library/react-native';
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

let mockLoading = false;
let mockParadasDoContexto: typeof mockParadas = mockParadas;
let mockRota: { id: string; status: string; unidade_id: string } | null = {
  id: 'rota-1',
  status: 'em_andamento',
  unidade_id: 'u-1',
};
let mockErro: Error | null = null;

jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => ({
    route: mockRota,
    paradas: mockParadasDoContexto,
    loading: mockLoading,
    error: mockErro,
    atualizadoEm: null,
    routeStatus: mockRota ? 'active' : 'no-route',
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
      onReportar: (p: unknown) => void;
    }) => (
      <>
        <P onPress={() => props.onReportar(props.parada)}>
          <T>{`reportar:${props.parada.id}`}</T>
        </P>
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

jest.mock('@/components/IncidentReportWizard', () => {
  const { Text: T } = jest.requireActual('react-native');
  return {
    IncidentReportWizard: (props: { paradaId: string }) => (
      <T>{`wizard:${props.paradaId}`}</T>
    ),
  };
});

describe('aba Paradas — recarga silenciosa', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoading = false;
    mockParadasDoContexto = mockParadas;
    mockRota = { id: 'rota-1', status: 'em_andamento', unidade_id: 'u-1' };
    mockErro = null;
  });

  // Sem sinal ao abrir o app: a aba dizia "Nenhuma rota ativa" ao motorista
  // no meio da rota.
  it('erro sem nunca ter carregado: "Sem conexão" com tentar de novo', () => {
    mockRota = null;
    mockParadasDoContexto = [];
    mockErro = new Error('Network request failed');
    const { getByText, queryByText } = render(<CheckpointsMotorista />);

    expect(getByText('Sem conexão')).toBeTruthy();
    expect(queryByText('Nenhuma rota ativa no momento')).toBeNull();

    fireEvent.press(getByText('Tentar novamente'));
    expect(mockRefreshRoute).toHaveBeenCalledTimes(1);
  });

  it('loading com paradas na tela mantém a lista (não vira skeleton)', () => {
    const { getByTestId, rerender } = render(<CheckpointsMotorista />);
    expect(getByTestId('motorista-checkpoints-list')).toBeTruthy();

    mockLoading = true;
    rerender(<CheckpointsMotorista />);

    expect(getByTestId('motorista-checkpoints-list')).toBeTruthy();
  });

  it('o wizard de incidente aberto sobrevive ao skeleton', () => {
    const { getByText, rerender } = render(<CheckpointsMotorista />);
    fireEvent.press(getByText('reportar:p3'));
    expect(getByText('wizard:p3')).toBeTruthy();

    mockLoading = true;
    mockParadasDoContexto = [];
    rerender(<CheckpointsMotorista />);

    expect(getByText('wizard:p3')).toBeTruthy();
  });
});
