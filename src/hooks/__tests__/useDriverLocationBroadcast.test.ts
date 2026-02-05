import { renderHook, waitFor, act } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';

import { useDriverLocationBroadcast } from '../useDriverLocationBroadcast';

// Mock do getTrackingContext
const mockGetTrackingContext = jest.fn();
jest.mock('@/services/unifiedLocationTracking', () => ({
  getTrackingContext: () => mockGetTrackingContext(),
}));

// Mock do Supabase
const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockFrom = jest.fn().mockReturnValue({
  insert: mockInsert,
});
const mockGetUser = jest.fn().mockResolvedValue({
  data: { user: { id: 'user-123' } },
});

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

// Mock do expo-location (sobrescrever o mock global)
const mockWatchPositionRemove = jest.fn();
const mockWatchPositionAsync = jest.fn().mockResolvedValue({
  remove: mockWatchPositionRemove,
});
const mockRequestForegroundPermissionsAsync = jest.fn().mockResolvedValue({
  status: 'granted',
});

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => mockRequestForegroundPermissionsAsync(),
  watchPositionAsync: (...args: unknown[]) => mockWatchPositionAsync(...args),
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
    BestForNavigation: 6,
  },
}));

describe('useDriverLocationBroadcast', () => {
  // Mock do navigator.geolocation para testes web
  const mockClearWatch = jest.fn();
  const mockWatchPosition = jest.fn().mockReturnValue(123);
  const originalNavigator = global.navigator;
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset Platform para mobile por padrao
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });

    // Reset mocks para estado padrao
    mockGetTrackingContext.mockResolvedValue({
      motoristaId: 'motorista-123',
      rotaId: 'rota-123',
    });
    mockInsert.mockResolvedValue({ error: null });
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });

    // Mock navigator.geolocation
    Object.defineProperty(global, 'navigator', {
      value: {
        geolocation: {
          watchPosition: mockWatchPosition,
          clearWatch: mockClearWatch,
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(Platform, 'OS', {
      value: originalPlatformOS,
      configurable: true,
    });
  });

  describe('Inicializacao', () => {
    it('nao deve iniciar tracking quando rotaId e null', async () => {
      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: null,
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(mockWatchPositionAsync).not.toHaveBeenCalled();
      });
    });

    it('nao deve iniciar tracking quando rotaId e undefined', async () => {
      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: undefined,
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(mockWatchPositionAsync).not.toHaveBeenCalled();
      });
    });

    it('nao deve iniciar tracking quando status nao e em_andamento', async () => {
      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'pendente',
        })
      );

      await waitFor(() => {
        expect(mockWatchPositionAsync).not.toHaveBeenCalled();
      });
    });

    it('nao deve iniciar tracking quando status e concluida', async () => {
      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'concluida',
        })
      );

      await waitFor(() => {
        expect(mockWatchPositionAsync).not.toHaveBeenCalled();
      });
    });

    it('nao deve iniciar tracking quando enabled e false', async () => {
      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
          enabled: false,
        })
      );

      await waitFor(() => {
        expect(mockWatchPositionAsync).not.toHaveBeenCalled();
      });
    });
  });

  describe('Tracking Mobile (Android/iOS)', () => {
    beforeEach(() => {
      // Garantir que estamos em mobile
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
    });

    it('deve solicitar permissao de localizacao ao iniciar', async () => {
      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(mockRequestForegroundPermissionsAsync).toHaveBeenCalled();
      });
    });

    it('deve iniciar watchPositionAsync quando tem permissao', async () => {
      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(mockWatchPositionAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            accuracy: Location.Accuracy.High,
            timeInterval: 10000,
            distanceInterval: 20,
          }),
          expect.any(Function)
        );
      });
    });

    it('nao deve iniciar tracking quando permissao e negada', async () => {
      mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(mockRequestForegroundPermissionsAsync).toHaveBeenCalled();
      });

      expect(mockWatchPositionAsync).not.toHaveBeenCalled();
    });

    it('deve usar updateInterval customizado', async () => {
      const customInterval = 5000;

      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
          updateInterval: customInterval,
        })
      );

      await waitFor(() => {
        expect(mockWatchPositionAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            timeInterval: customInterval,
          }),
          expect.any(Function)
        );
      });
    });
  });

  describe('Tracking Web', () => {
    beforeEach(() => {
      // Simular ambiente web
      Object.defineProperty(Platform, 'OS', {
        value: 'web',
        configurable: true,
      });
    });

    it('deve usar navigator.geolocation.watchPosition em web', async () => {
      const { unmount } = renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(mockWatchPosition).toHaveBeenCalledWith(
          expect.any(Function),
          expect.any(Function),
          expect.objectContaining({
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000,
          })
        );
      });

      // Cleanup explicitamente antes que o afterEach mude o navigator
      unmount();
    });

    it('nao deve iniciar tracking web quando geolocation nao esta disponivel', async () => {
      // Remover geolocation
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
        configurable: true,
      });

      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(mockWatchPosition).not.toHaveBeenCalled();
      });
    });

    it('deve enviar localizacao via web geolocation quando callback e chamado', async () => {
      let positionCallback: ((position: GeolocationPosition) => void) | null = null;

      mockWatchPosition.mockImplementation(
        (successCallback: (position: GeolocationPosition) => void) => {
          positionCallback = successCallback;
          return 456;
        }
      );

      const { unmount } = renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(positionCallback).not.toBeNull();
      });

      // Simular recebimento de posicao via web geolocation
      await act(async () => {
        positionCallback!({
          coords: {
            latitude: -23.5505,
            longitude: -46.6333,
            accuracy: 15,
            altitude: 800,
            altitudeAccuracy: 5,
            heading: 180,
            speed: 20,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
      });

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('motorista_locations');
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({
            latitude: -23.5505,
            longitude: -46.6333,
            precisao: 15,
            heading: 180,
            velocidade: 72, // 20 m/s * 3.6 = 72 km/h
            fonte: 'foreground',
          })
        );
      });

      // Cleanup
      unmount();
    });

    it('deve tratar erro de web geolocation graciosamente', async () => {
      let errorCallback: ((error: GeolocationPositionError) => void) | null = null;

      mockWatchPosition.mockImplementation(
        (_successCallback: (position: GeolocationPosition) => void, errCallback: (error: GeolocationPositionError) => void) => {
          errorCallback = errCallback;
          return 789;
        }
      );

      const loggerSpy = jest.spyOn(logger, 'error');

      const { unmount } = renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(errorCallback).not.toBeNull();
      });

      // Simular erro de geolocation
      await act(async () => {
        errorCallback!({
          code: 1,
          message: 'User denied geolocation',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
      });

      await waitFor(() => {
        expect(loggerSpy).toHaveBeenCalledWith(
          '[LocationBroadcast] Web geolocation error:',
          expect.any(Object)
        );
      });

      loggerSpy.mockRestore();
      unmount();
    });
  });

  describe('Broadcast de Localizacao', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
    });

    it('deve enviar localizacao para o banco de dados', async () => {
      let locationCallback: ((location: Location.LocationObject) => void) | null = null;

      mockWatchPositionAsync.mockImplementation(
        (_options: unknown, callback: (location: Location.LocationObject) => void) => {
          locationCallback = callback;
          return Promise.resolve({ remove: mockWatchPositionRemove });
        }
      );

      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(locationCallback).not.toBeNull();
      });

      // Simular recebimento de localizacao
      await act(async () => {
        locationCallback!({
          coords: {
            latitude: -23.5505,
            longitude: -46.6333,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: 90,
            speed: 15, // m/s
          },
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('motorista_locations');
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({
            motorista_id: 'motorista-123',
            rota_id: 'rota-123',
            latitude: -23.5505,
            longitude: -46.6333,
            precisao: 10,
            heading: 90,
            velocidade: 54, // 15 m/s * 3.6 = 54 km/h
            fonte: 'foreground',
          })
        );
      });
    });

    it('deve usar contexto unificado para obter motoristaId', async () => {
      let locationCallback: ((location: Location.LocationObject) => void) | null = null;

      mockWatchPositionAsync.mockImplementation(
        (_options: unknown, callback: (location: Location.LocationObject) => void) => {
          locationCallback = callback;
          return Promise.resolve({ remove: mockWatchPositionRemove });
        }
      );

      mockGetTrackingContext.mockResolvedValue({
        motoristaId: 'motorista-from-context',
        rotaId: 'rota-123',
      });

      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(locationCallback).not.toBeNull();
      });

      await act(async () => {
        locationCallback!({
          coords: {
            latitude: -23.5505,
            longitude: -46.6333,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({
            motorista_id: 'motorista-from-context',
          })
        );
      });
    });

    it('deve usar auth como fallback quando contexto nao tem motoristaId', async () => {
      let locationCallback: ((location: Location.LocationObject) => void) | null = null;

      mockWatchPositionAsync.mockImplementation(
        (_options: unknown, callback: (location: Location.LocationObject) => void) => {
          locationCallback = callback;
          return Promise.resolve({ remove: mockWatchPositionRemove });
        }
      );

      // Contexto sem motoristaId
      mockGetTrackingContext.mockResolvedValue({
        rotaId: 'rota-123',
      });

      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(locationCallback).not.toBeNull();
      });

      await act(async () => {
        locationCallback!({
          coords: {
            latitude: -23.5505,
            longitude: -46.6333,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(mockGetUser).toHaveBeenCalled();
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({
            motorista_id: 'user-123',
          })
        );
      });
    });

    it('nao deve enviar quando nao ha usuario autenticado', async () => {
      let locationCallback: ((location: Location.LocationObject) => void) | null = null;

      mockWatchPositionAsync.mockImplementation(
        (_options: unknown, callback: (location: Location.LocationObject) => void) => {
          locationCallback = callback;
          return Promise.resolve({ remove: mockWatchPositionRemove });
        }
      );

      // Sem contexto e sem usuario
      mockGetTrackingContext.mockResolvedValue(null);
      mockGetUser.mockResolvedValue({ data: { user: null } });

      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(locationCallback).not.toBeNull();
      });

      await act(async () => {
        locationCallback!({
          coords: {
            latitude: -23.5505,
            longitude: -46.6333,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        });
      });

      // Aguardar um pouco para garantir que nao foi chamado
      await waitFor(() => {
        expect(mockInsert).not.toHaveBeenCalled();
      });
    });

    it('deve converter velocidade de m/s para km/h', async () => {
      let locationCallback: ((location: Location.LocationObject) => void) | null = null;

      mockWatchPositionAsync.mockImplementation(
        (_options: unknown, callback: (location: Location.LocationObject) => void) => {
          locationCallback = callback;
          return Promise.resolve({ remove: mockWatchPositionRemove });
        }
      );

      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(locationCallback).not.toBeNull();
      });

      await act(async () => {
        locationCallback!({
          coords: {
            latitude: -23.5505,
            longitude: -46.6333,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: 10, // 10 m/s = 36 km/h
          },
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({
            velocidade: 36, // 10 * 3.6
          })
        );
      });
    });

    it('deve enviar velocidade null quando speed e null', async () => {
      let locationCallback: ((location: Location.LocationObject) => void) | null = null;

      mockWatchPositionAsync.mockImplementation(
        (_options: unknown, callback: (location: Location.LocationObject) => void) => {
          locationCallback = callback;
          return Promise.resolve({ remove: mockWatchPositionRemove });
        }
      );

      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(locationCallback).not.toBeNull();
      });

      await act(async () => {
        locationCallback!({
          coords: {
            latitude: -23.5505,
            longitude: -46.6333,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({
            velocidade: null,
          })
        );
      });
    });
  });

  describe('Intervalo entre Updates', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
    });

    it('deve respeitar intervalo minimo entre atualizacoes', async () => {
      let locationCallback: ((location: Location.LocationObject) => void) | null = null;

      mockWatchPositionAsync.mockImplementation(
        (_options: unknown, callback: (location: Location.LocationObject) => void) => {
          locationCallback = callback;
          return Promise.resolve({ remove: mockWatchPositionRemove });
        }
      );

      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
          updateInterval: 10000,
        })
      );

      await waitFor(() => {
        expect(locationCallback).not.toBeNull();
      });

      const mockLocation: Location.LocationObject = {
        coords: {
          latitude: -23.5505,
          longitude: -46.6333,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      };

      // Primeiro update
      await act(async () => {
        locationCallback!(mockLocation);
      });

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledTimes(1);
      });

      // Segundo update imediatamente - deve ser ignorado
      await act(async () => {
        locationCallback!(mockLocation);
      });

      // Ainda deve ser 1
      expect(mockInsert).toHaveBeenCalledTimes(1);

      // Avancar tempo
      jest.advanceTimersByTime(11000);

      // Terceiro update apos intervalo
      await act(async () => {
        locationCallback!(mockLocation);
      });

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Cleanup e Unmount', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
    });

    it('deve remover subscription ao desmontar', async () => {
      const { unmount } = renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(mockWatchPositionAsync).toHaveBeenCalled();
      });

      unmount();

      await waitFor(() => {
        expect(mockWatchPositionRemove).toHaveBeenCalled();
      });
    });

    it('deve remover subscription quando status muda de em_andamento', async () => {
      const { rerender } = renderHook(
        ({ rotaStatus }: { rotaStatus: string }) =>
          useDriverLocationBroadcast({
            rotaId: 'rota-123',
            rotaStatus,
          }),
        { initialProps: { rotaStatus: 'em_andamento' } }
      );

      await waitFor(() => {
        expect(mockWatchPositionAsync).toHaveBeenCalled();
      });

      // Mudar status para concluida
      rerender({ rotaStatus: 'concluida' });

      await waitFor(() => {
        expect(mockWatchPositionRemove).toHaveBeenCalled();
      });
    });

    it('deve remover subscription quando enabled muda para false', async () => {
      const { rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) =>
          useDriverLocationBroadcast({
            rotaId: 'rota-123',
            rotaStatus: 'em_andamento',
            enabled,
          }),
        { initialProps: { enabled: true } }
      );

      await waitFor(() => {
        expect(mockWatchPositionAsync).toHaveBeenCalled();
      });

      rerender({ enabled: false });

      await waitFor(() => {
        expect(mockWatchPositionRemove).toHaveBeenCalled();
      });
    });

    it('deve limpar watchId web ao desmontar', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'web',
        configurable: true,
      });

      // Garantir que o mock retorna o valor esperado
      mockWatchPosition.mockReturnValue(123);

      const { unmount } = renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(mockWatchPosition).toHaveBeenCalled();
      });

      unmount();

      await waitFor(() => {
        expect(mockClearWatch).toHaveBeenCalledWith(123);
      });
    });
  });

  describe('Tratamento de Erros', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
    });

    it('deve tratar erro ao inserir no banco', async () => {
      let locationCallback: ((location: Location.LocationObject) => void) | null = null;

      mockWatchPositionAsync.mockImplementation(
        (_options: unknown, callback: (location: Location.LocationObject) => void) => {
          locationCallback = callback;
          return Promise.resolve({ remove: mockWatchPositionRemove });
        }
      );

      mockInsert.mockResolvedValue({ error: { message: 'Database error' } });

      const loggerSpy = jest.spyOn(logger, 'error');

      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(locationCallback).not.toBeNull();
      });

      await act(async () => {
        locationCallback!({
          coords: {
            latitude: -23.5505,
            longitude: -46.6333,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(loggerSpy).toHaveBeenCalledWith(
          '[LocationBroadcast] Erro ao enviar localização:',
          expect.objectContaining({ message: 'Database error' })
        );
      });

      loggerSpy.mockRestore();
    });

    it('deve tratar erro ao iniciar tracking', async () => {
      mockWatchPositionAsync.mockRejectedValue(new Error('Location error'));

      const loggerSpy = jest.spyOn(logger, 'error');

      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(loggerSpy).toHaveBeenCalledWith(
          '[LocationBroadcast] Erro ao iniciar tracking:',
          expect.any(Error)
        );
      });

      loggerSpy.mockRestore();
    });

    it('deve tratar erro de getTrackingContext graciosamente', async () => {
      let locationCallback: ((location: Location.LocationObject) => void) | null = null;

      mockWatchPositionAsync.mockImplementation(
        (_options: unknown, callback: (location: Location.LocationObject) => void) => {
          locationCallback = callback;
          return Promise.resolve({ remove: mockWatchPositionRemove });
        }
      );

      mockGetTrackingContext.mockRejectedValue(new Error('Context error'));

      const loggerSpy = jest.spyOn(logger, 'error');

      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: 'rota-123',
          rotaStatus: 'em_andamento',
        })
      );

      await waitFor(() => {
        expect(locationCallback).not.toBeNull();
      });

      await act(async () => {
        locationCallback!({
          coords: {
            latitude: -23.5505,
            longitude: -46.6333,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(loggerSpy).toHaveBeenCalledWith(
          '[LocationBroadcast] Erro:',
          expect.any(Error)
        );
      });

      loggerSpy.mockRestore();
    });
  });

  describe('Retorno do Hook', () => {
    it('deve retornar isActive inicialmente como false', () => {
      const { result } = renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: null,
          rotaStatus: null,
        })
      );

      expect(result.current.isActive).toBe(false);
    });
  });

  describe('Comportamento com rotaId vazio ou invalido', () => {
    it('nao deve enviar localizacao quando rotaId e string vazia', async () => {
      renderHook(() =>
        useDriverLocationBroadcast({
          rotaId: '',
          rotaStatus: 'em_andamento',
        })
      );

      // Nao deve iniciar tracking para rotaId vazio
      await waitFor(() => {
        expect(mockWatchPositionAsync).not.toHaveBeenCalled();
      });
    });
  });

  describe('Reatividade a mudancas de props', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
    });

    it('deve reiniciar tracking quando rotaId muda', async () => {
      const { rerender } = renderHook(
        ({ rotaId }: { rotaId: string }) =>
          useDriverLocationBroadcast({
            rotaId,
            rotaStatus: 'em_andamento',
          }),
        { initialProps: { rotaId: 'rota-1' } }
      );

      await waitFor(() => {
        expect(mockWatchPositionAsync).toHaveBeenCalled();
      });

      mockWatchPositionAsync.mockClear();
      mockWatchPositionRemove.mockClear();

      rerender({ rotaId: 'rota-2' });

      await waitFor(() => {
        // Deve remover subscription antiga
        expect(mockWatchPositionRemove).toHaveBeenCalled();
      });

      await waitFor(() => {
        // Deve criar nova subscription
        expect(mockWatchPositionAsync).toHaveBeenCalled();
      });
    });
  });
});
