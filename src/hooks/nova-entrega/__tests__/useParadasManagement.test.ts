import { act, renderHook } from '@testing-library/react-native';
import { useState } from 'react';

import type {
  Parada,
  ParadaFormDataWithCoords,
  RotaOtimizadaState,
} from '@/components/gestor/nova-entrega/types';
import { photonService } from '@/lib/photon';
import { MAX_ROUTE_STOPS } from '@/lib/routeOptimization';

import { useParadasManagement } from '../useParadasManagement';

jest.mock('@/lib/photon', () => ({
  photonService: {
    geocodeAddress: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

const baseStop: ParadaFormDataWithCoords = {
  tipo: 'entrega',
  endereco: 'Rua A, 123',
  destinatario: 'João',
  telefone: '11999999999',
  observacoes: '',
  latitude: -23.5,
  longitude: -46.6,
};

function createStop(index: number, overrides: Partial<Parada> = {}): Parada {
  return {
    id: `stop-${index}`,
    ordem: index + 1,
    ...baseStop,
    endereco: `Rua ${index}, 100`,
    destinatario: `Cliente ${index}`,
    telefone: `1199999${String(index).padStart(4, '0')}`,
    ...overrides,
  };
}

describe('useParadasManagement', () => {
  const callbacks = {
    onOrdemManualChange: jest.fn(),
    onRotaOtimizadaReset: jest.fn(),
    onDistanciaManualRealReset: jest.fn(),
    showToast: jest.fn(),
    onFormReset: jest.fn(),
  };

  function useSubject(
    initial: Parada[] = [],
    rotaOtimizada: RotaOtimizadaState | null = null,
  ) {
    const [paradas, setParadas] = useState(initial);
    const management = useParadasManagement({
      paradas,
      setParadas,
      rotaOtimizada,
      ...callbacks,
    });
    return { paradas, ...management };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts empty with the correct status', () => {
    const { result } = renderHook(() => useSubject());

    expect(result.current.paradas).toEqual([]);
    expect(result.current.retiradasDisponiveis).toEqual([]);
    expect(result.current.paradasStatus).toEqual({
      texto: 'Nenhuma parada adicionada',
      cor: 'default',
      icone: null,
    });
  });

  it('adds a validated stop and invalidates previous optimization', async () => {
    const { result } = renderHook(() => useSubject());

    await act(async () => {
      await result.current.onAddParada(baseStop);
    });

    expect(result.current.paradas).toHaveLength(1);
    expect(result.current.paradas[0]).toMatchObject({
      endereco: baseStop.endereco,
      ordem: 1,
    });
    expect(callbacks.onFormReset).toHaveBeenCalled();
    expect(callbacks.onRotaOtimizadaReset).toHaveBeenCalled();
  });

  it('geocodes a stop only when coordinates are absent', async () => {
    (photonService.geocodeAddress as jest.Mock).mockResolvedValue({
      coordenadas: { latitude: -23.51, longitude: -46.61 },
    });
    const {
      latitude: _latitude,
      longitude: _longitude,
      ...withoutCoords
    } = baseStop;
    const { result } = renderHook(() => useSubject());

    await act(async () => {
      await result.current.onAddParada(withoutCoords);
    });

    expect(photonService.geocodeAddress).toHaveBeenCalledWith(
      baseStop.endereco,
    );
    expect(result.current.paradas[0]).toMatchObject({
      latitude: -23.51,
      longitude: -46.61,
    });
  });

  it('blocks duplicates unless the user explicitly confirms', async () => {
    const { result } = renderHook(() => useSubject([createStop(0)]));
    const duplicate = {
      ...baseStop,
      endereco: 'Rua 0, 100',
      telefone: '11888888888',
    };

    await act(async () => {
      expect(await result.current.onAddParada(duplicate)).toBe(false);
    });
    expect(result.current.paradas).toHaveLength(1);

    await act(async () => {
      expect(
        await result.current.onAddParada(
          { ...duplicate, telefone: '11777777777' },
          undefined,
          undefined,
          true,
        ),
      ).toBe(true);
    });
    expect(result.current.paradas).toHaveLength(2);
  });

  it('enforces the operational stop limit', async () => {
    const initial = Array.from({ length: MAX_ROUTE_STOPS }, (_, index) =>
      createStop(index),
    );
    const { result } = renderHook(() => useSubject(initial));

    await act(async () => {
      expect(
        await result.current.onAddParada({
          ...baseStop,
          endereco: 'Rua excedente',
        }),
      ).toBe(false);
    });

    expect(result.current.paradas).toHaveLength(MAX_ROUTE_STOPS);
    expect(callbacks.showToast).toHaveBeenCalledWith(
      expect.stringContaining('limite'),
      'error',
      5000,
    );
  });

  it('removes a pickup, unlinks dependents and offers a complete undo', () => {
    const pickup = createStop(0, { tipo: 'retirada' });
    const delivery = createStop(1, { vinculo_parada_id: pickup.id });
    const { result } = renderHook(() => useSubject([pickup, delivery]));

    act(() => result.current.removeParada(0));

    expect(result.current.paradas).toHaveLength(1);
    expect(result.current.paradas[0].vinculo_parada_id).toBeUndefined();
    const action = callbacks.showToast.mock.calls.at(-1)?.[3];

    act(() => action?.onPress());
    expect(result.current.paradas).toEqual([pickup, delivery]);
  });

  it('prevents reordering a delivery before its pickup', () => {
    const pickup = createStop(0, { tipo: 'retirada' });
    const delivery = createStop(1, { vinculo_parada_id: pickup.id });
    const { result } = renderHook(() => useSubject([pickup, delivery]));

    act(() => result.current.moveParadaUp(1));

    expect(result.current.paradas[0].id).toBe(pickup.id);
    expect(callbacks.showToast).toHaveBeenCalledWith(
      expect.stringContaining('precisa ocorrer antes'),
      'error',
      5000,
    );
  });

  it('prevents changing a pickup type while deliveries still depend on it', async () => {
    const pickup = createStop(0, { tipo: 'retirada' });
    const delivery = createStop(1, { vinculo_parada_id: pickup.id });
    const { result } = renderHook(() => useSubject([pickup, delivery]));

    await act(async () => {
      expect(
        await result.current.onAddParada(
          { ...pickup, tipo: 'entrega' },
          undefined,
          pickup.id,
        ),
      ).toBe(false);
    });

    expect(result.current.paradas[0].tipo).toBe('retirada');
    expect(callbacks.showToast).toHaveBeenCalledWith(
      expect.stringContaining('retirada inexistente'),
      'error',
      5000,
    );
  });

  it('marks a reordered optimized route as manual', () => {
    const optimized: RotaOtimizadaState = {
      distancia_total_metros: 1000,
      duracao_total_segundos: 300,
      legs: [],
    };
    const { result } = renderHook(() =>
      useSubject([createStop(0), createStop(1)], optimized),
    );

    act(() => result.current.moveParadaDown(0));

    expect(result.current.paradas[0].id).toBe('stop-1');
    expect(callbacks.onOrdemManualChange).toHaveBeenCalledWith(true);
    expect(callbacks.onDistanciaManualRealReset).toHaveBeenCalled();
  });

  it('clears the draft and restores it through the toast action', () => {
    const previous = [createStop(0)];
    const extraUndo = jest.fn();
    const { result } = renderHook(() => useSubject(previous));

    act(() => result.current.clearParadas(extraUndo));
    expect(result.current.paradas).toEqual([]);

    const action = callbacks.showToast.mock.calls.at(-1)?.[3];
    act(() => action?.onPress());

    expect(result.current.paradas).toEqual(previous);
    expect(extraUndo).toHaveBeenCalled();
  });

  it('imports valid rows and reports duplicates without losing good rows', async () => {
    (photonService.geocodeAddress as jest.Mock).mockResolvedValue({
      coordenadas: { latitude: -23.6, longitude: -46.7 },
    });
    const existing = createStop(0);
    const { result } = renderHook(() => useSubject([existing]));

    let importResult;
    await act(async () => {
      importResult = await result.current.importParadas([
        {
          ...baseStop,
          endereco: existing.endereco,
          telefone: '11777777777',
        },
        {
          ...baseStop,
          endereco: 'Rua nova, 500',
          telefone: '11666666666',
          latitude: undefined,
          longitude: undefined,
        },
      ]);
    });

    expect(importResult).toMatchObject({ adicionadas: 1, ignoradas: 1 });
    expect(result.current.paradas).toHaveLength(2);
  });
});
