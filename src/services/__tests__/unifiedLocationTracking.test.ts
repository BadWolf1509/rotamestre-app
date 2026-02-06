/**
 * Tests for unifiedLocationTracking.ts
 * Serviço Unificado de Rastreamento de Localização
 */

import { Alert } from 'react-native';

import {
  requestLocationPermissions,
  checkLocationPermissions,
  startBackgroundTracking,
  stopBackgroundTracking,
  isBackgroundTrackingActive,
  getTrackingContext,
  updateTrackingContext,
  requestAndStartTracking,
} from '../unifiedLocationTracking';

import type { TrackingContext } from '../unifiedLocationTracking';

// Mock AsyncStorage
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockRemoveItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  setItem: (...args: unknown[]) => mockSetItem(...args),
  removeItem: (...args: unknown[]) => mockRemoveItem(...args),
}));

// Mock expo-location
const mockRequestForegroundPermissions = jest.fn();
const mockRequestBackgroundPermissions = jest.fn();
const mockGetForegroundPermissions = jest.fn();
const mockGetBackgroundPermissions = jest.fn();
const mockHasStartedLocationUpdates = jest.fn();
const mockStartLocationUpdates = jest.fn();
const mockStopLocationUpdates = jest.fn();

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => mockRequestForegroundPermissions(),
  requestBackgroundPermissionsAsync: () => mockRequestBackgroundPermissions(),
  getForegroundPermissionsAsync: () => mockGetForegroundPermissions(),
  getBackgroundPermissionsAsync: () => mockGetBackgroundPermissions(),
  hasStartedLocationUpdatesAsync: () => mockHasStartedLocationUpdates(),
  startLocationUpdatesAsync: () => mockStartLocationUpdates(),
  stopLocationUpdatesAsync: () => mockStopLocationUpdates(),
  Accuracy: {
    High: 5,
    Balanced: 3,
  },
  ActivityType: {
    AutomotiveNavigation: 1,
  },
}));

// Mock expo-task-manager
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

// Mock Alert
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

describe('unifiedLocationTracking', () => {
  const mockContext: TrackingContext = {
    rotaId: 'rota-123',
    motoristaId: 'motorista-456',
    motoristaNome: 'João Motorista',
    startedAt: '2025-12-25T10:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockReset();
    mockSetItem.mockReset();
    mockRemoveItem.mockReset();
  });

  describe('requestLocationPermissions', () => {
    it('deve retornar false para ambos quando foreground negado', async () => {
      mockRequestForegroundPermissions.mockResolvedValueOnce({ status: 'denied' });

      const result = await requestLocationPermissions();

      expect(result).toEqual({ foreground: false, background: false });
    });

    it('deve solicitar background quando foreground concedido', async () => {
      mockRequestForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockRequestBackgroundPermissions.mockResolvedValueOnce({ status: 'granted' });

      const result = await requestLocationPermissions();

      expect(result).toEqual({ foreground: true, background: true });
      expect(mockRequestBackgroundPermissions).toHaveBeenCalled();
    });

    it('deve retornar foreground true e background false', async () => {
      mockRequestForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockRequestBackgroundPermissions.mockResolvedValueOnce({ status: 'denied' });

      const result = await requestLocationPermissions();

      expect(result).toEqual({ foreground: true, background: false });
    });
  });

  describe('checkLocationPermissions', () => {
    it('deve verificar status das permissões', async () => {
      mockGetForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetBackgroundPermissions.mockResolvedValueOnce({ status: 'denied' });

      const result = await checkLocationPermissions();

      expect(result).toEqual({ foreground: true, background: false });
    });

    it('deve retornar ambos verdadeiros', async () => {
      mockGetForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetBackgroundPermissions.mockResolvedValueOnce({ status: 'granted' });

      const result = await checkLocationPermissions();

      expect(result).toEqual({ foreground: true, background: true });
    });
  });

  describe('startBackgroundTracking', () => {
    it('deve retornar false sem permissão foreground', async () => {
      mockGetForegroundPermissions.mockResolvedValueOnce({ status: 'denied' });
      mockGetBackgroundPermissions.mockResolvedValueOnce({ status: 'denied' });

      const result = await startBackgroundTracking(mockContext);

      expect(result).toBe(false);
    });

    it('deve salvar contexto e iniciar tracking', async () => {
      mockGetForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetBackgroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockHasStartedLocationUpdates.mockResolvedValueOnce(false);
      mockStartLocationUpdates.mockResolvedValueOnce(undefined);

      const result = await startBackgroundTracking(mockContext);

      expect(mockSetItem).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('deve retornar true se já está rastreando', async () => {
      mockGetForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetBackgroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockHasStartedLocationUpdates.mockResolvedValueOnce(true);

      const result = await startBackgroundTracking(mockContext);

      expect(result).toBe(true);
      expect(mockStartLocationUpdates).not.toHaveBeenCalled();
    });

    it('deve retornar true mesmo sem permissão background', async () => {
      mockGetForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetBackgroundPermissions.mockResolvedValueOnce({ status: 'denied' });
      mockHasStartedLocationUpdates.mockResolvedValueOnce(false);

      const result = await startBackgroundTracking(mockContext);

      expect(result).toBe(true);
      expect(mockStartLocationUpdates).not.toHaveBeenCalled();
    });
  });

  describe('stopBackgroundTracking', () => {
    it('deve parar tracking e remover contexto', async () => {
      mockHasStartedLocationUpdates.mockResolvedValueOnce(true);
      mockStopLocationUpdates.mockResolvedValueOnce(undefined);

      await stopBackgroundTracking();

      expect(mockStopLocationUpdates).toHaveBeenCalled();
      expect(mockRemoveItem).toHaveBeenCalled();
    });

    it('deve apenas remover contexto se não está rastreando', async () => {
      mockHasStartedLocationUpdates.mockResolvedValueOnce(false);

      await stopBackgroundTracking();

      expect(mockStopLocationUpdates).not.toHaveBeenCalled();
      expect(mockRemoveItem).toHaveBeenCalled();
    });
  });

  describe('isBackgroundTrackingActive', () => {
    it('deve retornar true quando ativo', async () => {
      mockHasStartedLocationUpdates.mockResolvedValueOnce(true);

      const result = await isBackgroundTrackingActive();

      expect(result).toBe(true);
    });

    it('deve retornar false quando inativo', async () => {
      mockHasStartedLocationUpdates.mockResolvedValueOnce(false);

      const result = await isBackgroundTrackingActive();

      expect(result).toBe(false);
    });

    it('deve retornar false em caso de erro', async () => {
      mockHasStartedLocationUpdates.mockRejectedValueOnce(new Error('Error'));

      const result = await isBackgroundTrackingActive();

      expect(result).toBe(false);
    });
  });

  describe('getTrackingContext', () => {
    it('deve retornar contexto quando existe', async () => {
      mockGetItem.mockResolvedValueOnce(JSON.stringify(mockContext));

      const result = await getTrackingContext();

      expect(result).toEqual(mockContext);
    });

    it('deve retornar null quando não existe', async () => {
      mockGetItem.mockResolvedValueOnce(null);

      const result = await getTrackingContext();

      expect(result).toBeNull();
    });

    it('deve retornar null em caso de erro', async () => {
      mockGetItem.mockRejectedValueOnce(new Error('Error'));

      const result = await getTrackingContext();

      expect(result).toBeNull();
    });
  });

  describe('updateTrackingContext', () => {
    it('deve atualizar contexto existente', async () => {
      mockGetItem.mockResolvedValueOnce(JSON.stringify(mockContext));

      await updateTrackingContext({ motoristaNome: 'Novo Nome' });

      expect(mockSetItem).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Novo Nome')
      );
    });

    it('não deve fazer nada se contexto não existe', async () => {
      mockGetItem.mockResolvedValueOnce(null);

      await updateTrackingContext({ motoristaNome: 'Novo Nome' });

      expect(mockSetItem).not.toHaveBeenCalled();
    });
  });

  describe('requestAndStartTracking', () => {
    it('deve mostrar alerta e retornar started=false quando foreground negado', async () => {
      mockRequestForegroundPermissions.mockResolvedValueOnce({ status: 'denied' });

      const result = await requestAndStartTracking(mockContext);

      expect(result).toEqual({ started: false, hasBackgroundPermission: false });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Permissão Necessária',
        expect.stringContaining('localização'),
        [{ text: 'OK' }]
      );
    });

    it('deve iniciar tracking com ambas permissões concedidas', async () => {
      // requestLocationPermissions mocks
      mockRequestForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockRequestBackgroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      // startBackgroundTracking internally calls checkLocationPermissions
      mockGetForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetBackgroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockHasStartedLocationUpdates.mockResolvedValueOnce(false);
      mockStartLocationUpdates.mockResolvedValueOnce(undefined);

      const result = await requestAndStartTracking(mockContext);

      expect(result).toEqual({ started: true, hasBackgroundPermission: true });
      // No "limited tracking" alert when background is granted
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('deve mostrar alerta de rastreamento limitado quando background negado', async () => {
      // requestLocationPermissions mocks
      mockRequestForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockRequestBackgroundPermissions.mockResolvedValueOnce({ status: 'denied' });
      // startBackgroundTracking internally calls checkLocationPermissions
      mockGetForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockGetBackgroundPermissions.mockResolvedValueOnce({ status: 'denied' });
      mockHasStartedLocationUpdates.mockResolvedValueOnce(false);

      const result = await requestAndStartTracking(mockContext);

      expect(result).toEqual({ started: true, hasBackgroundPermission: false });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Rastreamento Limitado',
        expect.stringContaining('segundo plano'),
        [{ text: 'Entendi' }]
      );
    });

    it('deve retornar started=false quando startBackgroundTracking falha', async () => {
      // requestLocationPermissions mocks
      mockRequestForegroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      mockRequestBackgroundPermissions.mockResolvedValueOnce({ status: 'granted' });
      // startBackgroundTracking fails (foreground denied internally)
      mockGetForegroundPermissions.mockResolvedValueOnce({ status: 'denied' });
      mockGetBackgroundPermissions.mockResolvedValueOnce({ status: 'denied' });

      const result = await requestAndStartTracking(mockContext);

      expect(result).toEqual({ started: false, hasBackgroundPermission: true });
      // No alert for limited tracking since started=false
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });
});
