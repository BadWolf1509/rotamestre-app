/**
 * Tests for useNavigationModeLogic hook
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useNavigationModeLogic } from '../useNavigationModeLogic';

// Mock dependencies
jest.mock('@/lib/osrm', () => ({
  calculateHaversineDistance: jest.fn().mockReturnValue(500),
  getRoute: jest.fn().mockResolvedValue({ polyline: 'mock_polyline' }),
  decodePolyline: jest.fn().mockReturnValue([
    { latitude: -23.55, longitude: -46.63 },
    { latitude: -23.56, longitude: -46.64 },
  ]),
}));

jest.mock('@/services/locationTracking', () => ({
  __esModule: true,
  default: {
    startTracking: jest.fn().mockResolvedValue(true),
    stopTracking: jest.fn().mockResolvedValue(undefined),
    getNavigationPreferences: jest.fn().mockResolvedValue({
      soundAlerts: true,
      vibrationAlerts: true,
      showSpeedometer: true,
      navegarCom: 'mapa',
      proximityRadius: 50,
    }),
  },
}));

jest.mock('@/utils/styles', () => ({
  useUnistyles: jest.fn().mockReturnValue({
    theme: {
      colors: {
        success: '#00FF00',
        warning: '#FFFF00',
        error: '#FF0000',
      },
    },
  }),
}));

const mockParadaBase = {
  id: 'parada-1',
  ordem: 1,
  tipo: 'entrega' as const,
  status: 'pendente' as const,
  endereco: 'Rua Teste, 123',
  latitude: -23.55,
  longitude: -46.63,
  destinatario: 'Cliente Teste',
  telefone: '11999999999',
};

const mockCurrentStop = { ...mockParadaBase };

const mockParadas = [
  { ...mockParadaBase, id: 'checkpoint-start', is_checkpoint: false, ordem: 0 },
  { ...mockParadaBase, id: 'parada-1', ordem: 1 },
  { ...mockParadaBase, id: 'parada-2', ordem: 2, status: 'pendente' as const },
  { ...mockParadaBase, id: 'parada-3', ordem: 3, status: 'concluida' as const },
  { ...mockParadaBase, id: 'checkpoint-end', is_checkpoint: false, ordem: 4 },
];

describe('useNavigationModeLogic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          nextStop: null,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      expect(result.current.userLocation).toBeNull();
      expect(result.current.speed).toBe(0);
      expect(result.current.distance).toBeNull();
      expect(result.current.eta).toBeNull();
      expect(result.current.isTracking).toBe(false);
      expect(result.current.showSettings).toBe(false);
      expect(result.current.isInitializing).toBe(true);
    });

    it('should have default preferences', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          nextStop: null,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      expect(result.current.preferences).toEqual({
        soundAlerts: true,
        vibrationAlerts: true,
        showSpeedometer: true,
        preventScreenSleep: true,
        navegarCom: 'mapa',
        preferredNavApp: 'default',
        proximityRadius: 50,
      });
    });
  });

  describe('derived values', () => {
    it('should filter real paradas (exclude checkpoints)', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      // Should have 3 real paradas (excluding checkpoints with is_checkpoint === false)
      expect(result.current.realParadas.length).toBe(3);
      expect(
        result.current.realParadas.every((p) => p.is_checkpoint !== false),
      ).toBe(true);
    });

    it('should identify checkpoints', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      expect(result.current.checkpoints.length).toBe(2);
      expect(result.current.startCheckpoint?.id).toBe('checkpoint-start');
      expect(result.current.endCheckpoint?.id).toBe('checkpoint-end');
    });

    it('should calculate current stop index (1-based)', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      expect(result.current.currentStopIndex).toBe(1);
    });

    it('should identify next stop after current', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      expect(result.current.nextStopAfterCurrent?.id).toBe('parada-2');
    });

    it('should filter pending stops', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      // parada-2 is pending and not current
      expect(result.current.pendingStops.length).toBe(1);
      expect(result.current.pendingStops[0].id).toBe('parada-2');
    });

    it('should check if stop is entrega', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: { ...mockCurrentStop, tipo: 'entrega' },
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      expect(result.current.isEntrega).toBe(true);
    });

    it('should check if stop is retirada', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: { ...mockCurrentStop, tipo: 'retirada' },
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      expect(result.current.isEntrega).toBe(false);
    });
  });

  describe('formatDistance', () => {
    it('should format meters for short distances', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      expect(result.current.formatDistance(150)).toBe('150m');
      expect(result.current.formatDistance(999)).toBe('999m');
    });

    it('should format kilometers for long distances', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      expect(result.current.formatDistance(1000)).toBe('1,0km');
      expect(result.current.formatDistance(1500)).toBe('1,5km');
      expect(result.current.formatDistance(10000)).toBe('10,0km');
    });
  });

  describe('getSpeedColor', () => {
    it('should return success color for low speed', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      expect(result.current.getSpeedColor(30)).toBe('#00FF00');
      expect(result.current.getSpeedColor(40)).toBe('#00FF00');
    });

    it('should return warning color for medium speed', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      expect(result.current.getSpeedColor(50)).toBe('#FFFF00');
      expect(result.current.getSpeedColor(80)).toBe('#FFFF00');
    });

    it('should return error color for high speed', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      expect(result.current.getSpeedColor(81)).toBe('#FF0000');
      expect(result.current.getSpeedColor(120)).toBe('#FF0000');
    });
  });

  describe('updateLocationFromCoords', () => {
    it('should update user location', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      act(() => {
        result.current.updateLocationFromCoords(
          { latitude: -23.55, longitude: -46.63, heading: 90 },
          10,
        );
      });

      expect(result.current.userLocation).toEqual({
        latitude: -23.55,
        longitude: -46.63,
        heading: 90,
      });
    });

    it('should convert speed from m/s to km/h', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      act(() => {
        result.current.updateLocationFromCoords(
          { latitude: -23.55, longitude: -46.63 },
          10, // 10 m/s = 36 km/h
        );
      });

      expect(result.current.speed).toBe(36);
    });

    it('should calculate distance to destination', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      act(() => {
        result.current.updateLocationFromCoords(
          { latitude: -23.55, longitude: -46.63 },
          10,
        );
      });

      expect(result.current.distance).toBe(500); // Mock returns 500m
    });

    // Parado num semáforo o GPS marca ~1 km/h: dividir a distância por isso
    // dava "13 min" para 131 m. O tempo vem da duração da rota OSRM.
    it('usa a duração da rota OSRM, não a velocidade instantânea', async () => {
      const { getRoute } = jest.requireMock('@/lib/osrm');
      getRoute.mockResolvedValueOnce({
        polyline: 'mock_polyline',
        distance: 900,
        duration: 180,
      });
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      act(() => {
        result.current.updateLocationFromCoords(
          { latitude: -23.55, longitude: -46.63 },
          0.3, // ~1 km/h, parado
        );
      });

      await waitFor(() => expect(result.current.eta).toBe('3 min'));
    });

    // Motorista parado: sem novo tick de GPS, a troca de parada precisa
    // refazer rota, distância e tempo sozinha.
    it('troca de parada com o motorista parado refaz rota, distância e tempo', async () => {
      const { getRoute } = jest.requireMock('@/lib/osrm');
      const { calculateHaversineDistance } = jest.requireMock('@/lib/osrm');
      // Distância plana (graus -> m) para o teste ser determinístico.
      calculateHaversineDistance.mockImplementation(
        (la1: number, lo1: number, la2: number, lo2: number) =>
          Math.hypot(la1 - la2, lo1 - lo2) * 111000,
      );
      getRoute
        .mockResolvedValueOnce({
          polyline: 'mock_polyline',
          distance: 900,
          duration: 180,
        })
        .mockResolvedValueOnce({
          polyline: 'mock_polyline',
          distance: 4000,
          duration: 600,
        });
      const paradaB = {
        ...mockParadaBase,
        id: 'parada-2',
        latitude: -23.59,
        longitude: -46.63,
      };

      try {
        const { result, rerender } = renderHook(
          ({ stop }: { stop: typeof mockCurrentStop }) =>
            useNavigationModeLogic({
              currentStop: stop,
              paradas: mockParadas,
              rotaId: 'rota-123',
            }),
          { initialProps: { stop: mockCurrentStop } },
        );

        act(() => {
          result.current.updateLocationFromCoords(
            { latitude: -23.5495, longitude: -46.63 },
            0,
          );
        });
        await waitFor(() => expect(result.current.eta).toBe('3 min'));
        expect(getRoute).toHaveBeenCalledTimes(1);

        // Mesma posição, outra parada.
        rerender({ stop: paradaB });

        await waitFor(() => expect(getRoute).toHaveBeenCalledTimes(2));
        expect(getRoute).toHaveBeenLastCalledWith(
          { latitude: -23.5495, longitude: -46.63 },
          { latitude: -23.59, longitude: -46.63 },
        );
        await waitFor(() => expect(result.current.eta).toBe('10 min'));
        // ~4,5 km até a nova parada, não os ~55 m da anterior.
        expect(result.current.distance).toBeGreaterThan(4000);
        expect(result.current.routePath.length).toBeGreaterThanOrEqual(2);
      } finally {
        calculateHaversineDistance.mockReset();
        calculateHaversineDistance.mockReturnValue(500);
      }
    });

    it('sem rota, estima pela velocidade média urbana', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      act(() => {
        result.current.updateLocationFromCoords(
          { latitude: -23.55, longitude: -46.63 },
          0.3,
        );
      });

      // 500 m (mock) a 30 km/h = 60 s
      expect(result.current.eta).toBe('1 min');
    });
  });

  describe('state setters', () => {
    it('should update showSettings', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      act(() => {
        result.current.setShowSettings(true);
      });

      expect(result.current.showSettings).toBe(true);
    });
  });

  describe('isNearDestination', () => {
    it('should be true when distance < 100m', () => {
      const { calculateHaversineDistance } = require('@/lib/osrm');
      calculateHaversineDistance.mockReturnValue(50);

      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      act(() => {
        result.current.updateLocationFromCoords(
          { latitude: -23.55, longitude: -46.63 },
          5,
        );
      });

      expect(result.current.isNearDestination).toBe(true);
    });

    it('should be false when distance >= 100m', () => {
      const { calculateHaversineDistance } = require('@/lib/osrm');
      calculateHaversineDistance.mockReturnValue(500);

      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        }),
      );

      act(() => {
        result.current.updateLocationFromCoords(
          { latitude: -23.55, longitude: -46.63 },
          5,
        );
      });

      expect(result.current.isNearDestination).toBe(false);
    });
  });
});
