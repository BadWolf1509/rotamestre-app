/**
 * Aba Paradas: "Retomar" só vale com a rota em andamento.
 *
 * POR QUE EXISTE. Depois de "Finalizar" com paradas puladas, a rota segue na
 * tela por um tempo; retomar ali deixava parada `pendente` numa rota
 * `concluida`, sem mais como concluí-la pelo app. O card esconde o botão, e a
 * tela confere de novo (estado velho, toque no meio da troca). Quando o banco
 * recusa por rota encerrada, a mensagem diz isso em vez do erro técnico.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import CheckpointsMotorista from '../checkpoints';

const PULADA = {
  id: 'p3',
  ordem: 3,
  tipo: 'entrega',
  status: 'pulada',
  endereco: 'Rua A, 1',
  latitude: -7.1,
  longitude: -34.8,
  is_checkpoint: true,
};

const mockRefreshRoute = jest.fn(() => Promise.resolve());
const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
const mockShowWarning = jest.fn();
const mockShowConfirm = jest.fn(() => Promise.resolve(true));
const mockUpdateParadaStatus = jest.fn();
const mockLogParadaAction = jest.fn();

let mockRota: { id: string; status: string; unidade_id: string } = {
  id: 'rota-1',
  status: 'em_andamento',
  unidade_id: 'u-1',
};

jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => ({
    route: mockRota,
    paradas: [PULADA],
    loading: false,
    error: null,
    atualizadoEm: null,
    routeStatus: 'active',
    refreshRoute: mockRefreshRoute,
    skipStop: jest.fn(),
    paradasComEnvioPendente: new Set<string>(),
  }),
}));

jest.mock('@/hooks/useAlert', () => ({
  useAlert: () => ({
    showWarning: (...a: unknown[]) => mockShowWarning(...a),
    showSuccess: (...a: unknown[]) => mockShowSuccess(...a),
    showError: (...a: unknown[]) => mockShowError(...a),
    showConfirm: (...a: unknown[]) => mockShowConfirm(...(a as [])),
    AlertDialog: null,
  }),
}));

jest.mock('@/lib/queries/paradas', () => ({
  updateParadaStatus: (...a: unknown[]) => mockUpdateParadaStatus(...a),
  logParadaAction: (...a: unknown[]) => mockLogParadaAction(...a),
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
      onRetomar: (p: unknown) => void;
    }) => (
      <P onPress={() => props.onRetomar(props.parada)}>
        <T>{`retomar:${props.parada.id}`}</T>
      </P>
    ),
  };
});

jest.mock('@/components/motorista/StopCompletionFlow', () => ({
  StopCompletionFlow: () => null,
}));
jest.mock('@/components/motorista/SkipReasonModal', () => ({
  SkipReasonModal: () => null,
}));
jest.mock('@/components/IncidentReportWizard', () => ({
  IncidentReportWizard: () => null,
}));

describe('aba Paradas — retomar parada pulada', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRota = { id: 'rota-1', status: 'em_andamento', unidade_id: 'u-1' };
    mockUpdateParadaStatus.mockResolvedValue({ success: true, data: {} });
  });

  it('com a rota em andamento, volta a parada a pendente e limpa o horário do pulo', async () => {
    const { getByText } = render(<CheckpointsMotorista />);
    fireEvent.press(getByText('retomar:p3'));

    await waitFor(() => expect(mockShowSuccess).toHaveBeenCalled());
    expect(mockUpdateParadaStatus).toHaveBeenCalledWith('p3', 'pendente', {
      concluida_em: null,
    });
  });

  it('com a rota encerrada, não grava nada e explica por quê', async () => {
    mockRota = { id: 'rota-1', status: 'concluida', unidade_id: 'u-1' };
    const { getByText } = render(<CheckpointsMotorista />);
    fireEvent.press(getByText('retomar:p3'));

    await waitFor(() => expect(mockShowWarning).toHaveBeenCalled());
    expect(mockShowWarning.mock.calls[0][0]).toBe('Rota encerrada');
    expect(mockShowConfirm).not.toHaveBeenCalled();
    expect(mockUpdateParadaStatus).not.toHaveBeenCalled();
  });

  it('recusa do banco por rota encerrada vira aviso claro e recarrega a rota', async () => {
    mockUpdateParadaStatus.mockResolvedValue({
      success: false,
      error: {
        type: 'unknown',
        code: 'P0001',
        message: 'ROTA_ENCERRADA',
        originalError: { code: 'P0001', message: 'ROTA_ENCERRADA' },
      },
    });
    const { getByText } = render(<CheckpointsMotorista />);
    fireEvent.press(getByText('retomar:p3'));

    await waitFor(() => expect(mockShowWarning).toHaveBeenCalled());
    expect(mockShowWarning.mock.calls[0][0]).toBe('Rota encerrada');
    expect(mockShowError).not.toHaveBeenCalled();
    expect(mockRefreshRoute).toHaveBeenCalled();
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });
});
