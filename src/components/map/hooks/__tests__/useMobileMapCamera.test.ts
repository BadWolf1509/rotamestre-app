import { act, renderHook } from '@testing-library/react-native';

import { useMobileMapCamera } from '../useMobileMapCamera';

// MapLibre mocked in jest.setup.js

describe('useMobileMapCamera', () => {
  it('returns defined cameraRef and initialCamera with empty paradas', () => {
    const { result } = renderHook(() => useMobileMapCamera([]));
    expect(result.current.cameraRef).toBeDefined();
    expect(result.current.initialCamera).toBeDefined();
    expect(result.current.initialCamera.center).toBeDefined();
    expect(result.current.initialCamera.zoom).toBeDefined();
  });

  it('sets initialCamera to default coords when no paradas', () => {
    const { result } = renderHook(() => useMobileMapCamera([]));
    // Default region: lat=0, lng=0, deltas=0.05
    // toLngLat returns [lng, lat] = [0, 0]
    const [lng, lat] = result.current.initialCamera.center;
    expect(lat).toBe(0);
    expect(lng).toBe(0);
  });

  it('sets initialCamera to parada coords with single parada', () => {
    const paradas = [
      {
        id: 'p1',
        endereco: 'Test',
        latitude: -23.55,
        longitude: -46.63,
        status: 'pendente',
        ordem: 1,
        is_checkpoint: false,
      },
    ];
    const { result } = renderHook(() =>
      useMobileMapCamera(paradas as Parameters<typeof useMobileMapCamera>[0]),
    );
    const [lng, lat] = result.current.initialCamera.center;
    expect(lat).toBeCloseTo(-23.55);
    expect(lng).toBeCloseTo(-46.63);
  });

  it('computes center from multiple paradas', () => {
    const paradas = [
      {
        id: 'p1',
        endereco: 'A',
        latitude: -23.0,
        longitude: -46.0,
        status: 'pendente',
        ordem: 1,
        is_checkpoint: false,
      },
      {
        id: 'p2',
        endereco: 'B',
        latitude: -24.0,
        longitude: -47.0,
        status: 'pendente',
        ordem: 2,
        is_checkpoint: false,
      },
    ];
    const { result } = renderHook(() =>
      useMobileMapCamera(paradas as Parameters<typeof useMobileMapCamera>[0]),
    );
    const [lng, lat] = result.current.initialCamera.center;
    // Center between -23 and -24 → -23.5
    expect(lat).toBeCloseTo(-23.5);
    // Center between -46 and -47 → -46.5
    expect(lng).toBeCloseTo(-46.5);
  });

  // Realtime/refetch entregam um array NOVO com as mesmas paradas. Re-enquadrar
  // nisso devolvia o mapa à visão geral no meio do uso (pino selecionado e
  // balão perdidos). Medido no moto g15 em 20/10/2026 (PR #594).
  describe('enquadramento inicial', () => {
    const duas = () => [
      {
        id: 'p1',
        endereco: 'A',
        latitude: -23.0,
        longitude: -46.0,
        status: 'pendente',
        ordem: 1,
        is_checkpoint: false,
      },
      {
        id: 'p2',
        endereco: 'B',
        latitude: -24.0,
        longitude: -47.0,
        status: 'pendente',
        ordem: 2,
        is_checkpoint: false,
      },
    ];
    type Paradas = Parameters<typeof useMobileMapCamera>[0];

    afterEach(() => jest.useRealTimers());

    // Como no app: o mapa (e a câmera) monta antes de as paradas chegarem.
    function montar() {
      jest.useFakeTimers();
      const fitBounds = jest.fn();
      const view = renderHook(
        ({ paradas }: { paradas: Paradas }) => useMobileMapCamera(paradas),
        { initialProps: { paradas: [] as Paradas } },
      );
      // @ts-expect-error - ref do hook preenchida como o <Camera> faria
      view.result.current.cameraRef.current = { fitBounds };
      view.rerender({ paradas: duas() as Paradas });
      act(() => {
        jest.advanceTimersByTime(600);
      });
      return { ...view, fitBounds };
    }

    it('enquadra uma vez quando as paradas chegam', () => {
      const { fitBounds } = montar();
      expect(fitBounds).toHaveBeenCalledTimes(1);
    });

    it('array novo com as mesmas paradas não re-enquadra', () => {
      const { fitBounds, rerender } = montar();

      rerender({ paradas: duas() as Paradas });
      act(() => {
        jest.advanceTimersByTime(600);
      });

      expect(fitBounds).toHaveBeenCalledTimes(1);
    });

    it('paradas diferentes re-enquadram', () => {
      const { fitBounds, rerender } = montar();
      const outras = duas();
      outras[1].latitude = -25.0;

      rerender({ paradas: outras as Paradas });
      act(() => {
        jest.advanceTimersByTime(600);
      });

      expect(fitBounds).toHaveBeenCalledTimes(2);
    });
  });
});
