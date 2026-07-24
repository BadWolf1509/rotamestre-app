import { act, renderHook } from '@testing-library/react-native';

import type {
  EnderecoUnidade,
  Parada,
  RotaOtimizadaState,
} from '@/components/gestor/nova-entrega/types';
import { googleMapsService } from '@/lib/google';
import { supabase } from '@/lib/supabase';

import { generateRequestId } from '../../useNovaEntrega.helpers';
import { useRouteCreation } from '../useRouteCreation';

jest.mock('@/lib/google', () => ({
  googleMapsService: {
    getDirections: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock('../../useNovaEntrega.helpers', () => {
  const actual = jest.requireActual<
    typeof import('../../useNovaEntrega.helpers')
  >('../../useNovaEntrega.helpers');
  return {
    ...actual,
    generateRequestId: jest.fn(),
  };
});

const stops: Parada[] = [
  {
    id: 'stop-1',
    tipo: 'entrega',
    endereco: 'Rua A, 123',
    destinatario: 'João',
    telefone: '11999999999',
    observacoes: '',
    latitude: -23.55,
    longitude: -46.65,
    ordem: 1,
  },
];

const base: EnderecoUnidade = {
  endereco: 'Av. Paulista, 1000',
  latitude: -23.5,
  longitude: -46.6,
};

const optimizedRoute: RotaOtimizadaState = {
  distancia_total_metros: 10000,
  duracao_total_segundos: 600,
  legs: [],
  polyline: 'encoded',
  isEstimated: false,
};

describe('useRouteCreation', () => {
  const defaultOptions = {
    paradas: stops,
    enderecoUnidade: base,
    rotaOtimizada: optimizedRoute,
    distanciaManualReal: null,
    ordemManual: false,
    motoristaSelecionado: 'motorista-123',
    unidadeAtiva: 'unidade-123',
    unidadeNome: 'Unidade Teste',
    dataRota: '2099-07-24',
    isLoading: false,
    setIsLoading: jest.fn(),
    showToast: jest.fn(),
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (generateRequestId as jest.Mock)
      .mockReset()
      .mockReturnValueOnce('request-1')
      .mockReturnValueOnce('request-2');
  });

  it('validates the complete draft before calling the database', async () => {
    const options = { ...defaultOptions, paradas: [] };
    const { result } = renderHook(() => useRouteCreation(options));

    await act(async () => {
      expect(await result.current.gerarRota()).toBe(false);
    });

    expect(options.showToast).toHaveBeenCalledWith(
      'Adicione pelo menos uma parada.',
      'error',
      5000,
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('blocks route creation when routing returned only an estimate', async () => {
    const options = {
      ...defaultOptions,
      rotaOtimizada: { ...optimizedRoute, isEstimated: true },
    };
    const { result } = renderHook(() => useRouteCreation(options));

    await act(async () => {
      expect(await result.current.gerarRota()).toBe(false);
    });

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(options.showToast).toHaveBeenCalledWith(
      expect.stringContaining('confirmar o percurso viário'),
      'error',
      6000,
    );
  });

  it('creates route, checkpoints and stops through one atomic RPC', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: { success: true, rota_id: 'route-1', reused: false },
      error: null,
    });
    const { result } = renderHook(() => useRouteCreation(defaultOptions));

    await act(async () => {
      expect(await result.current.gerarRota()).toBe(true);
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'criar_rota_com_paradas',
      expect.objectContaining({
        p_request_id: 'request-1',
        p_unidade_id: 'unidade-123',
        p_motorista_id: 'motorista-123',
        p_distancia_total: 10,
        p_tempo_total: 10,
        p_paradas: expect.arrayContaining([
          expect.objectContaining({
            ordem: 0,
            is_checkpoint: false,
          }),
          expect.objectContaining({
            ordem: 1,
            is_checkpoint: true,
            _temp_id: 'stop-1',
          }),
          expect.objectContaining({
            ordem: 2,
            is_checkpoint: false,
          }),
        ]),
      }),
    );
    expect(defaultOptions.onSuccess).toHaveBeenCalledWith('route-1');
    expect(defaultOptions.setIsLoading).toHaveBeenNthCalledWith(1, true);
    expect(defaultOptions.setIsLoading).toHaveBeenLastCalledWith(false);
  });

  it('reuses the same request key after an ambiguous failure', async () => {
    (supabase.rpc as jest.Mock)
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'network disconnected' },
      })
      .mockResolvedValueOnce({
        data: { success: true, rota_id: 'route-1', reused: true },
        error: null,
      });
    const { result } = renderHook(() => useRouteCreation(defaultOptions));

    await act(async () => {
      expect(await result.current.gerarRota()).toBe(false);
      expect(await result.current.gerarRota()).toBe(true);
    });

    const firstRequest = (supabase.rpc as jest.Mock).mock.calls[0][1]
      .p_request_id;
    const secondRequest = (supabase.rpc as jest.Mock).mock.calls[1][1]
      .p_request_id;
    expect(firstRequest).toBe('request-1');
    expect(secondRequest).toBe(firstRequest);
    expect(defaultOptions.showToast).toHaveBeenCalledWith(
      expect.stringContaining('já havia sido criada'),
      'success',
      5000,
    );
  });

  it('generates a new request key if the draft changed after a failure', async () => {
    (supabase.rpc as jest.Mock)
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'validation failure' },
      })
      .mockResolvedValueOnce({
        data: { success: true, rota_id: 'route-2', reused: false },
        error: null,
      });
    const { result, rerender } = renderHook(
      ({ paradas }) =>
        useRouteCreation({
          ...defaultOptions,
          paradas,
        }),
      { initialProps: { paradas: stops } },
    );

    await act(async () => {
      expect(await result.current.gerarRota()).toBe(false);
    });
    rerender({
      paradas: [
        ...stops,
        {
          ...stops[0],
          id: 'stop-2',
          ordem: 2,
          endereco: 'Rua B, 456',
          telefone: '11888888888',
        },
      ],
    });
    await act(async () => {
      expect(await result.current.gerarRota()).toBe(true);
    });

    expect((supabase.rpc as jest.Mock).mock.calls[0][1].p_request_id).toBe(
      'request-1',
    );
    expect((supabase.rpc as jest.Mock).mock.calls[1][1].p_request_id).toBe(
      'request-2',
    );
  });

  it('blocks an estimated manual route as well', async () => {
    (googleMapsService.getDirections as jest.Mock).mockResolvedValue({
      distancia_total_metros: 1000,
      duracao_total_segundos: 120,
      polyline: 'fallback',
      legs: [],
      ordem_otimizada: [],
      is_estimated: true,
    });
    const options = {
      ...defaultOptions,
      rotaOtimizada: null,
      ordemManual: true,
    };
    const { result } = renderHook(() => useRouteCreation(options));

    await act(async () => {
      expect(await result.current.gerarRota()).toBe(false);
    });

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('reuses the confirmed metrics shown in the review', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: { success: true, rota_id: 'route-3', reused: false },
      error: null,
    });
    const options = {
      ...defaultOptions,
      rotaOtimizada: null,
      ordemManual: false,
      distanciaManualReal: {
        metros: 12500,
        segundos: 780,
        polyline: 'reviewed-polyline',
        isEstimated: false,
      },
    };
    const { result } = renderHook(() => useRouteCreation(options));

    await act(async () => {
      expect(await result.current.gerarRota()).toBe(true);
    });

    expect(googleMapsService.getDirections).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith(
      'criar_rota_com_paradas',
      expect.objectContaining({
        p_distancia_total: 12.5,
        p_tempo_total: 13,
        p_polyline: 'reviewed-polyline',
      }),
    );
  });
});
