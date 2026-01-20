/**
 * Tests for useNavigationModeLogic hook
 */

import { renderHook, act } from '@testing-library/react-native';

import { useNavigationModeLogic } from '../useNavigationModeLogic';

// Mock dependencies
jest.mock('@/lib/osrm', () => ({
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
      internalNavigation: false,
      autoAdvance: true,
      proximityRadius: 50,
    }),
  },
}));

jest.mock('@/services/turnByTurnNavigation', () => ({
  calculateHaversineDistance: jest.fn().mockReturnValue(500),
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
        })
      );

      expect(result.current.userLocation).toBeNull();
      expect(result.current.speed).toBe(0);
      expect(result.current.distance).toBeNull();
      expect(result.current.eta).toBeNull();
      expect(result.current.isTracking).toBe(false);
      expect(result.current.showSettings).toBe(false);
      expect(result.current.navigationMode).toBe('map');
      expect(result.current.isInitializing).toBe(true);
    });

    it('should have default preferences', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          nextStop: null,
          paradas: mockParadas,
          rotaId: 'rota-123',
        })
      );

      expect(result.current.preferences).toEqual({
        soundAlerts: true,
        vibrationAlerts: true,
        showSpeedometer: true,
        internalNavigation: false,
        autoAdvance: true,
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
        })
      );

      // Should have 3 real paradas (excluding checkpoints with is_checkpoint === false)
      expect(result.current.realParadas.length).toBe(3);
      expect(result.current.realParadas.every((p) => p.is_checkpoint !== false)).toBe(true);
    });

    it('should identify checkpoints', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        })
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
        })
      );

      expect(result.current.currentStopIndex).toBe(1);
    });

    it('should identify next stop after current', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        })
      );

      expect(result.current.nextStopAfterCurrent?.id).toBe('parada-2');
    });

    it('should filter pending stops', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        })
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
        })
      );

      expect(result.current.isEntrega).toBe(true);
    });

    it('should check if stop is retirada', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: { ...mockCurrentStop, tipo: 'retirada' },
          paradas: mockParadas,
          rotaId: 'rota-123',
        })
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
        })
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
        })
      );

      expect(result.current.formatDistance(1000)).toBe('1.0km');
      expect(result.current.formatDistance(1500)).toBe('1.5km');
      expect(result.current.formatDistance(10000)).toBe('10.0km');
    });
  });

  describe('getSpeedColor', () => {
    it('should return success color for low speed', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        })
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
        })
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
        })
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
        })
      );

      act(() => {
        result.current.updateLocationFromCoords(
          { latitude: -23.55, longitude: -46.63, heading: 90 },
          10
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
        })
      );

      act(() => {
        result.current.updateLocationFromCoords(
          { latitude: -23.55, longitude: -46.63 },
          10 // 10 m/s = 36 km/h
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
        })
      );

      act(() => {
        result.current.updateLocationFromCoords(
          { latitude: -23.55, longitude: -46.63 },
          10
        );
      });

      expect(result.current.distance).toBe(500); // Mock returns 500m
    });

    it('should estimate ETA based on speed', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        })
      );

      act(() => {
        result.current.updateLocationFromCoords(
          { latitude: -23.55, longitude: -46.63 },
          10 // 10 m/s
        );
      });

      // 500m / 10m/s = 50s ~ 1 min
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
        })
      );

      act(() => {
        result.current.setShowSettings(true);
      });

      expect(result.current.showSettings).toBe(true);
    });

    it('should update navigationMode', () => {
      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        })
      );

      act(() => {
        result.current.setNavigationMode('turn-by-turn');
      });

      expect(result.current.navigationMode).toBe('turn-by-turn');
    });
  });

  describe('isNearDestination', () => {
    it('should be true when distance < 100m', () => {
      const { calculateHaversineDistance } = require('@/services/turnByTurnNavigation');
      calculateHaversineDistance.mockReturnValue(50);

      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        })
      );

      act(() => {
        result.current.updateLocationFromCoords(
          { latitude: -23.55, longitude: -46.63 },
          5
        );
      });

      expect(result.current.isNearDestination).toBe(true);
    });

    it('should be false when distance >= 100m', () => {
      const { calculateHaversineDistance } = require('@/services/turnByTurnNavigation');
      calculateHaversineDistance.mockReturnValue(500);

      const { result } = renderHook(() =>
        useNavigationModeLogic({
          currentStop: mockCurrentStop,
          paradas: mockParadas,
          rotaId: 'rota-123',
        })
      );

      act(() => {
        result.current.updateLocationFromCoords(
          { latitude: -23.55, longitude: -46.63 },
          5
        );
      });

      expect(result.current.isNearDestination).toBe(false);
    });
  });
});
