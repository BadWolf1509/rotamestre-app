import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, Platform } from 'react-native';

import type { RouteData } from '@/context/route-status/types';

import { useGarantirRastreamentoDaRota } from '../useGarantirRastreamentoDaRota';

jest.mock('@/lib/logger');

const mockGarantir = jest.fn();
const mockRequestAndStart = jest.fn();
jest.mock('@/services/unifiedLocationTracking', () => ({
  garantirRastreamentoDaRota: (...args: unknown[]) => mockGarantir(...args),
  requestAndStartTracking: (...args: unknown[]) => mockRequestAndStart(...args),
}));

let ouvintesAppState: Array<(estado: string) => void> = [];

function voltarAoPrimeiroPlano() {
  act(() => {
    ouvintesAppState.forEach((cb) => cb('active'));
  });
}

const rotaEmAndamento: RouteData = {
  id: 'rota-1',
  unidade_id: 'unidade-1',
  unidade_nome: 'Loja',
  status: 'em_andamento',
  iniciada_em: '2026-10-21T11:00:00Z',
};
const motorista = { id: 'motorista-1', nome: 'Ana' };

describe('useGarantirRastreamentoDaRota', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ouvintesAppState = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _tipo: string,
      cb: (estado: string) => void,
    ) => {
      ouvintesAppState.push(cb);
      return {
        remove: () => {
          ouvintesAppState = ouvintesAppState.filter((f) => f !== cb);
        },
      };
    }) as unknown as typeof AppState.addEventListener);
    mockGarantir.mockResolvedValue('ativo');
    mockRequestAndStart.mockResolvedValue({
      started: true,
      hasBackgroundPermission: true,
    });
  });

  it('garante o rastreamento ao abrir com rota própria em andamento', async () => {
    renderHook(() =>
      useGarantirRastreamentoDaRota({ route: rotaEmAndamento, motorista }),
    );

    await waitFor(() => expect(mockGarantir).toHaveBeenCalledTimes(1));
    expect(mockGarantir).toHaveBeenCalledWith({
      rotaId: 'rota-1',
      motoristaId: 'motorista-1',
      motoristaNome: 'Ana',
      startedAt: '2026-10-21T11:00:00Z',
    });
  });

  it('não faz nada com rota pendente', async () => {
    renderHook(() =>
      useGarantirRastreamentoDaRota({
        route: { ...rotaEmAndamento, status: 'pendente' },
        motorista,
      }),
    );
    voltarAoPrimeiroPlano();

    await new Promise((r) => setTimeout(r, 0));
    expect(mockGarantir).not.toHaveBeenCalled();
  });

  it('não faz nada na web', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');

    renderHook(() =>
      useGarantirRastreamentoDaRota({ route: rotaEmAndamento, motorista }),
    );

    await new Promise((r) => setTimeout(r, 0));
    expect(mockGarantir).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('confere de novo quando o app volta ao primeiro plano', async () => {
    renderHook(() =>
      useGarantirRastreamentoDaRota({ route: rotaEmAndamento, motorista }),
    );
    await waitFor(() => expect(mockGarantir).toHaveBeenCalledTimes(1));

    voltarAoPrimeiroPlano();

    await waitFor(() => expect(mockGarantir).toHaveBeenCalledTimes(2));
  });

  it('mostra o aviso quando falta a permissão de segundo plano, sem pedir', async () => {
    mockGarantir.mockResolvedValue('sem-segundo-plano');

    const { result } = renderHook(() =>
      useGarantirRastreamentoDaRota({ route: rotaEmAndamento, motorista }),
    );

    await waitFor(() => expect(result.current.avisoVisivel).toBe(true));
    expect(mockRequestAndStart).not.toHaveBeenCalled();
  });

  it('o aviso leva ao fluxo com a divulgação e some quando o rastreamento liga', async () => {
    mockGarantir.mockResolvedValueOnce('sem-segundo-plano');
    const { result } = renderHook(() =>
      useGarantirRastreamentoDaRota({ route: rotaEmAndamento, motorista }),
    );
    await waitFor(() => expect(result.current.avisoVisivel).toBe(true));

    mockGarantir.mockResolvedValue('ativo');
    await act(async () => {
      await result.current.ativar();
    });

    expect(mockRequestAndStart).toHaveBeenCalledWith(
      expect.objectContaining({ rotaId: 'rota-1', motoristaId: 'motorista-1' }),
    );
    expect(result.current.avisoVisivel).toBe(false);
  });

  it('dispensar é definitivo enquanto o app vive', async () => {
    mockGarantir.mockResolvedValue('sem-segundo-plano');
    const { result } = renderHook(() =>
      useGarantirRastreamentoDaRota({ route: rotaEmAndamento, motorista }),
    );
    await waitFor(() => expect(result.current.avisoVisivel).toBe(true));

    act(() => result.current.dispensar());
    voltarAoPrimeiroPlano();

    await waitFor(() => expect(mockGarantir).toHaveBeenCalledTimes(2));
    // Deixa a segunda conferência terminar antes de olhar o aviso.
    await act(async () => {});
    expect(result.current.avisoVisivel).toBe(false);
  });

  it('não sobrepõe duas conferências ao mesmo tempo', async () => {
    let liberar: (v: string) => void = () => {};
    mockGarantir.mockImplementationOnce(
      () => new Promise((resolve) => (liberar = resolve)),
    );
    renderHook(() =>
      useGarantirRastreamentoDaRota({ route: rotaEmAndamento, motorista }),
    );
    await waitFor(() => expect(mockGarantir).toHaveBeenCalledTimes(1));

    voltarAoPrimeiroPlano();
    await new Promise((r) => setTimeout(r, 0));
    expect(mockGarantir).toHaveBeenCalledTimes(1);

    await act(async () => liberar('ativo'));
  });
});
