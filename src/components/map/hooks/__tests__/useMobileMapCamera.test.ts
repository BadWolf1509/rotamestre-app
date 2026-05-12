import { renderHook } from '@testing-library/react-native';

import { useMobileMapCamera } from '../useMobileMapCamera';

// MapLibre mocked in jest.setup.js

describe('useMobileMapCamera', () => {
  it('returns defined cameraRef and initialCamera with empty paradas', () => {
    const { result } = renderHook(() => useMobileMapCamera([]));
    expect(result.current.cameraRef).toBeDefined();
    expect(result.current.initialCamera).toBeDefined();
    expect(result.current.initialCamera.centerCoordinate).toBeDefined();
    expect(result.current.initialCamera.zoomLevel).toBeDefined();
  });

  it('sets initialCamera to default coords when no paradas', () => {
    const { result } = renderHook(() => useMobileMapCamera([]));
    // Default region: lat=0, lng=0, deltas=0.05
    // toLngLat returns [lng, lat] = [0, 0]
    const [lng, lat] = result.current.initialCamera.centerCoordinate;
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
    const [lng, lat] = result.current.initialCamera.centerCoordinate;
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
    const [lng, lat] = result.current.initialCamera.centerCoordinate;
    // Center between -23 and -24 → -23.5
    expect(lat).toBeCloseTo(-23.5);
    // Center between -46 and -47 → -46.5
    expect(lng).toBeCloseTo(-46.5);
  });
});
