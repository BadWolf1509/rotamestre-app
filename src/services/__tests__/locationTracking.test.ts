/**
 * Tests for LocationTrackingService
 * Covers: startTracking, stopTracking, isTracking, processLocationUpdate,
 * arrival detection, proximity notifications, and navigation preferences.
 */

// Supabase chainable mock helper
function createChain(singleResult = { data: null, error: null }) {
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockResolvedValue({ error: null });
  chain.update = jest.fn().mockReturnValue(chain);
  chain.upsert = jest.fn().mockResolvedValue({ error: null });
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.neq = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(singleResult);
  return chain;
}

// Mock dependencies BEFORE imports
const mockFrom = jest.fn().mockImplementation(() => createChain());
const mockGetUser = jest
  .fn()
  .mockResolvedValue({ data: { user: { id: 'user-1' } } });
const mockGetSession = jest
  .fn()
  .mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'granted' }),
  requestBackgroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'granted' }),
  getForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'undetermined' }),
  getBackgroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'undetermined' }),
  watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  startLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
  stopLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
  hasStartedLocationUpdatesAsync: jest.fn().mockResolvedValue(false),
  Accuracy: { BestForNavigation: 6, High: 4 },
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn().mockResolvedValue(false),
  unregisterTaskAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    auth: {
      getUser: (...args: any[]) => mockGetUser(...args),
      getSession: (...args: any[]) => mockGetSession(...args),
    },
  },
}));

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(
      (
        _title: string,
        _message: string,
        buttons?: Array<{ onPress?: () => void }>,
      ) => buttons?.[1]?.onPress?.(),
    ),
  },
  Platform: { OS: 'ios' },
}));

jest.mock('@/utils/styles', () => ({
  defaultTheme: { colors: { primary: '#FF8C42' } },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

import locationTrackingService from '../locationTracking';

describe('LocationTrackingService', () => {
  let consoleSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress logger output in tests
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Reset singleton internal state
    (locationTrackingService as any).navigationState = null;
    (locationTrackingService as any).chegadaAnunciadaPara = null;
    (locationTrackingService as any).lastNotificationTime = 0;

    // Default mock state
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(
      { status: 'granted' },
    );
    (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue(
      { status: 'granted' },
    );
    (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(
      false,
    );

    mockFrom.mockImplementation(() => createChain());
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  // =========================================================================
  // getNavigationPreferences
  // =========================================================================

  describe('getNavigationPreferences', () => {
    /**
     * POR QUE ESTES TESTES MUDARAM. Antes, `getNavigationPreferences` devolvia
     * `{}` quando nada estava salvo, e cada consumidor aplicava o proprio
     * default. Dois deles tinham tabelas SEPARADAS (`DEFAULT_SETTINGS` em
     * NavigationSettings, `DEFAULT_PREFERENCES` em useNavigationModeLogic) e
     * outros nao aplicavam default nenhum.
     *
     * O efeito foi medido em aparelho: a tela de Configuracoes mostrava
     * "Avanco Automatico" LIGADO (default proprio dela), enquanto
     * `handleNavigateToStop` lia `prefs.autoAdvance` cru, recebia `undefined`
     * e mandava o motorista para o app externo. A navegacao interna ficava
     * inalcancavel, e a tela dizia que estava ligada.
     */
    it('aplica os defaults quando nao ha nada salvo', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const prefs = await locationTrackingService.getNavigationPreferences();

      // O caso exato do bug: um consumidor que faz `if (prefs.autoAdvance)`
      // precisa receber `true`, nao `undefined`.
      expect(prefs.autoAdvance).toBe(true);
      expect(prefs.soundAlerts).toBe(true);
      expect(prefs.vibrationAlerts).toBe(true);
      expect(prefs.proximityRadius).toBe(50);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(
        'navigationPreferences',
      );
    });

    it('o que esta salvo vence o default', async () => {
      const savedPrefs = {
        autoAdvance: false,
        soundAlerts: true,
        vibrationAlerts: false,
        proximityRadius: 100,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(savedPrefs),
      );

      const prefs = await locationTrackingService.getNavigationPreferences();

      expect(prefs).toMatchObject(savedPrefs);
    });

    it('preenche so o que falta quando o salvo e parcial', async () => {
      // O estado real de quem nunca mexeu numa das chaves — que e como o
      // aparelho estava quando o defeito apareceu.
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ soundAlerts: false }),
      );

      const prefs = await locationTrackingService.getNavigationPreferences();

      expect(prefs.soundAlerts).toBe(false);
      expect(prefs.autoAdvance).toBe(true);
    });

    it('aplica os defaults quando o JSON salvo esta corrompido', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid-json{');

      const prefs = await locationTrackingService.getNavigationPreferences();

      // Devolver `{}` aqui era o mesmo defeito por outro caminho: o consumidor
      // sem default trataria storage corrompido como "tudo desligado".
      expect(prefs.autoAdvance).toBe(true);
      expect(prefs.proximityRadius).toBe(50);
    });
  });

  describe('ida e volta entre gravar e ler', () => {
    it('grava só o que foi escolhido, e a leitura completa o resto', async () => {
      // Esta e a propriedade que separa "default na fonte" de "default
      // congelado no storage": se o update gravasse o objeto ja preenchido, um
      // padrao alterado numa versao futura nunca alcancaria quem tivesse
      // tocado em qualquer ajuste.
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await locationTrackingService.updateNavigationPreferences({
        soundAlerts: false,
      });

      const gravado = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        (c) => c[0] === 'navigationPreferences',
      )?.[1];
      expect(JSON.parse(gravado)).toEqual({ soundAlerts: false });

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(gravado);
      const lido = await locationTrackingService.getNavigationPreferences();
      expect(lido.soundAlerts).toBe(false);
      expect(lido.autoAdvance).toBe(true);
    });
  });

  // =========================================================================
  // updateNavigationPreferences
  // =========================================================================

  describe('updateNavigationPreferences', () => {
    it('deve atualizar preferências existentes (merge)', async () => {
      const currentPrefs = { autoAdvance: true, soundAlerts: false };
      const newPrefs = { vibrationAlerts: true, proximityRadius: 75 };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(currentPrefs),
      );

      await locationTrackingService.updateNavigationPreferences(newPrefs);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'navigationPreferences',
        JSON.stringify({
          autoAdvance: true,
          soundAlerts: false,
          vibrationAlerts: true,
          proximityRadius: 75,
        }),
      );
    });

    it('deve criar preferências se não existirem', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const newPrefs = { autoAdvance: false };

      await locationTrackingService.updateNavigationPreferences(newPrefs);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'navigationPreferences',
        JSON.stringify(newPrefs),
      );
    });

    it('deve tratar erro ao atualizar preferências', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      await locationTrackingService.updateNavigationPreferences({
        autoAdvance: true,
      });

      // Logger outputs: [ERROR], message with prefix, error object
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ERROR]',
        '[LocationTracking] Error updating preferences',
        expect.any(Error),
      );
    });
  });

  // =========================================================================
  // startTracking
  // =========================================================================

  describe('startTracking', () => {
    const stopData = {
      latitude: -23.55,
      longitude: -46.63,
      endereco: 'Rua Test 123',
    };

    it('deve iniciar tracking com sucesso', async () => {
      const chain = createChain({ data: stopData, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await locationTrackingService.startTracking(
        'rota-1',
        'stop-1',
        'stop-2',
      );

      expect(result).toBe(true);
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
      expect(Location.requestBackgroundPermissionsAsync).toHaveBeenCalled();
      expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
        'background-location-tracking',
        expect.objectContaining({
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000,
          distanceInterval: 10,
        }),
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'navigationState',
        expect.stringContaining('"rotaId":"rota-1"'),
      );

      // Verify navigation state was set correctly
      const state = (locationTrackingService as any).navigationState;
      expect(state.enabled).toBe(true);
      expect(state.rotaId).toBe('rota-1');
      expect(state.currentStopId).toBe('stop-1');
      expect(state.nextStopId).toBe('stop-2');
      expect(state.currentStopLocation).toEqual({
        latitude: -23.55,
        longitude: -46.63,
      });
    });

    it('deve retornar false quando foreground permission negada', async () => {
      (
        Location.requestForegroundPermissionsAsync as jest.Mock
      ).mockResolvedValueOnce({ status: 'denied' });

      const result = await locationTrackingService.startTracking(
        'rota-1',
        'stop-1',
      );

      expect(result).toBe(false);
      expect(Alert.alert).toHaveBeenCalledWith('Erro', expect.any(String));
      expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
    });

    it('deve continuar quando background permission negada (warn)', async () => {
      (
        Location.requestBackgroundPermissionsAsync as jest.Mock
      ).mockResolvedValueOnce({ status: 'denied' });
      const chain = createChain({ data: stopData, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await locationTrackingService.startTracking(
        'rota-1',
        'stop-1',
      );

      // Background denied is a warning, not a blocker
      expect(result).toBe(true);
      expect(Location.startLocationUpdatesAsync).toHaveBeenCalled();
    });

    it('deve retornar false quando parada não encontrada', async () => {
      const chain = createChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await locationTrackingService.startTracking(
        'rota-1',
        'stop-1',
      );

      expect(result).toBe(false);
      expect(Alert.alert).toHaveBeenCalledWith('Erro', expect.any(String));
    });
  });

  // =========================================================================
  // stopTracking
  // =========================================================================

  describe('stopTracking', () => {
    it('deve parar task e limpar estado quando task está rodando', async () => {
      // Simulate active tracking
      (locationTrackingService as any).navigationState = {
        enabled: true,
        rotaId: 'r1',
      };
      (locationTrackingService as any).chegadaAnunciadaPara = 'stop-1';
      (
        Location.hasStartedLocationUpdatesAsync as jest.Mock
      ).mockResolvedValueOnce(true);

      const result = await locationTrackingService.stopTracking();

      expect(result).toBe(true);
      expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(
        'background-location-tracking',
      );
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('navigationState');
      expect((locationTrackingService as any).navigationState).toBeNull();
      expect((locationTrackingService as any).chegadaAnunciadaPara).toBeNull();
    });

    it('deve limpar estado sem erro quando nenhuma task rodando', async () => {
      (
        Location.hasStartedLocationUpdatesAsync as jest.Mock
      ).mockResolvedValueOnce(false);

      const result = await locationTrackingService.stopTracking();

      expect(result).toBe(true);
      expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('navigationState');
    });
  });

  // =========================================================================
  // isTracking
  // =========================================================================

  describe('isTracking', () => {
    it('deve delegar para Location.hasStartedLocationUpdatesAsync', async () => {
      (
        Location.hasStartedLocationUpdatesAsync as jest.Mock
      ).mockResolvedValueOnce(true);

      const result = await locationTrackingService.isTracking();

      expect(result).toBe(true);
      expect(Location.hasStartedLocationUpdatesAsync).toHaveBeenCalledWith(
        'background-location-tracking',
      );
    });
  });

  // =========================================================================
  // processLocationUpdate
  // =========================================================================

  describe('processLocationUpdate', () => {
    const baseLocation = {
      latitude: -23.55,
      longitude: -46.63,
      accuracy: 10,
      timestamp: Date.now(),
      speed: 5,
      heading: 90,
    };

    const stopLocation = { latitude: -23.55, longitude: -46.63 };

    function setUpNavigationState(overrides: Record<string, any> = {}) {
      (locationTrackingService as any).navigationState = {
        enabled: true,
        autoAdvance: false,
        soundAlerts: false,
        vibrationAlerts: false,
        proximityRadius: 50,
        currentStopLocation: stopLocation,
        currentStopId: 'stop-1',
        rotaId: 'rota-1',
        ...overrides,
      };
    }

    it('deve retornar sem fazer nada se navigationState não existe', async () => {
      (locationTrackingService as any).navigationState = null;

      await locationTrackingService.processLocationUpdate(baseLocation);

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('deve atualizar posição do motorista no banco', async () => {
      setUpNavigationState();
      // Location far from stop (won't trigger arrival)
      const farLocation = {
        ...baseLocation,
        latitude: -23.56,
        longitude: -46.64,
      };

      await locationTrackingService.processLocationUpdate(farLocation);

      expect(mockFrom).toHaveBeenCalledWith('motorista_locations');
    });

    // Cada posição fazia um GET /auth/v1/user (getUser vai ao servidor):
    // em 03/10/2026 foram 140 envios e 140 consultas ao Auth em 24 h. O id
    // vem da sessão local; quem valida o token é o RLS do insert.
    it('não consulta o servidor de Auth a cada posição', async () => {
      setUpNavigationState();

      await locationTrackingService.processLocationUpdate({
        ...baseLocation,
        latitude: -23.56,
        longitude: -46.64,
      });

      expect(mockGetUser).not.toHaveBeenCalled();
      expect(mockGetSession).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith('motorista_locations');
    });

    it('sem sessão, não envia a posição', async () => {
      setUpNavigationState();
      mockGetSession.mockResolvedValue({ data: { session: null } });

      await locationTrackingService.processLocationUpdate({
        ...baseLocation,
        latitude: -23.56,
        longitude: -46.64,
      });

      expect(mockFrom).not.toHaveBeenCalledWith('motorista_locations');
    });

    it('anuncia a chegada quando dentro do geofence com accuracy válida', async () => {
      setUpNavigationState({ autoAdvance: true });

      // Same coordinates as stop = 0m distance, accuracy 10 <= 50
      await locationTrackingService.processLocationUpdate({
        ...baseLocation,
        latitude: stopLocation.latitude,
        longitude: stopLocation.longitude,
        accuracy: 10,
      });

      expect((locationTrackingService as any).chegadaAnunciadaPara).toBe(
        'stop-1',
      );
    });

    it('NÃO considera chegada quando accuracy > MIN_ACCURACY (50m)', async () => {
      setUpNavigationState({ autoAdvance: true });

      await locationTrackingService.processLocationUpdate({
        ...baseLocation,
        latitude: stopLocation.latitude,
        longitude: stopLocation.longitude,
        accuracy: 100, // > 50m MIN_ACCURACY
      });

      expect((locationTrackingService as any).chegadaAnunciadaPara).toBeNull();
    });

    it('volta a anunciar depois que o motorista sai do raio', async () => {
      setUpNavigationState({ autoAdvance: true });

      await locationTrackingService.processLocationUpdate({
        ...baseLocation,
        latitude: stopLocation.latitude,
        longitude: stopLocation.longitude,
        accuracy: 10,
      });
      expect((locationTrackingService as any).chegadaAnunciadaPara).toBe(
        'stop-1',
      );

      // ~1100m de distância
      await locationTrackingService.processLocationUpdate({
        ...baseLocation,
        latitude: -23.56,
        longitude: -46.64,
        accuracy: 10,
      });

      expect((locationTrackingService as any).chegadaAnunciadaPara).toBeNull();
    });
  });

  // =========================================================================
  // Chegar à parada NUNCA conclui nada
  //
  // Incidente de 08/09 a 01/10/2026 (motorista José Inácio, app 1.12.6): com
  // o modo navegação ativo e "Avanço Automático" ligado, entrar no raio de
  // 50 m disparava, 5 s depois, um UPDATE `status: 'concluida'` SEM foto — e o
  // app pulava para a próxima parada, sem nunca abrir o comprovante. 28
  // entregas ficaram sem foto. Ninguém viu porque o log `auto_concluida` era
  // descartado pelo trigger `prevent_duplicate_log` (o `log_parada_status` do
  // banco gravava antes, nos mesmos 5 s).
  //
  // Concluir exige comprovante, e comprovante exige o motorista. A chegada
  // só pode AVISAR — quem conclui é o fluxo com foto, pela tela.
  // =========================================================================

  describe('chegada à parada', () => {
    const naParada = {
      latitude: -23.55,
      longitude: -46.63,
      accuracy: 10,
      timestamp: Date.now(),
    };

    beforeEach(() => {
      jest.useFakeTimers();
      (locationTrackingService as any).navigationState = {
        enabled: true,
        autoAdvance: true,
        soundAlerts: false,
        vibrationAlerts: false,
        proximityRadius: 50,
        currentStopLocation: { latitude: -23.55, longitude: -46.63 },
        currentStopId: 'stop-1',
        nextStopId: 'stop-2',
        rotaId: 'rota-1',
      };
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('não grava parada, rota nem log — nem depois de o tempo passar', async () => {
      const chains: any[] = [];
      mockFrom.mockImplementation(() => {
        const chain = createChain();
        chains.push(chain);
        return chain;
      });

      await locationTrackingService.processLocationUpdate(naParada);
      // Bem além dos 5 s do antigo AUTO_ADVANCE_DELAY.
      await jest.advanceTimersByTimeAsync(60_000);

      const tabelas = mockFrom.mock.calls.map(([tabela]) => tabela);
      // A única escrita legítima aqui é a posição do motorista.
      expect(tabelas.every((t) => t === 'motorista_locations')).toBe(true);
      for (const chain of chains) {
        expect(chain.update).not.toHaveBeenCalled();
      }
    });
  });

  // =========================================================================
  // handleProximityNotifications (via processLocationUpdate)
  // =========================================================================

  describe('handleProximityNotifications via processLocationUpdate', () => {
    const stopLocation = { latitude: -23.55, longitude: -46.63 };

    function setUpNavigationState() {
      (locationTrackingService as any).navigationState = {
        enabled: true,
        autoAdvance: false,
        soundAlerts: false,
        vibrationAlerts: false,
        proximityRadius: 50,
        currentStopLocation: stopLocation,
        currentStopId: 'stop-1',
        rotaId: 'rota-1',
      };
    }

    it('deve atualizar lastNotificationTime para distância < 100m', async () => {
      setUpNavigationState();
      (locationTrackingService as any).lastNotificationTime = 0;

      // ~78m from stop (within 100m, outside 50m geofence)
      await locationTrackingService.processLocationUpdate({
        latitude: -23.5507,
        longitude: -46.63,
        accuracy: 10,
        timestamp: Date.now(),
      });

      expect(
        (locationTrackingService as any).lastNotificationTime,
      ).toBeGreaterThan(0);
    });

    it('deve atualizar lastNotificationTime para distância < 500m', async () => {
      setUpNavigationState();
      (locationTrackingService as any).lastNotificationTime = 0;

      // ~333m from stop (within 500m range)
      await locationTrackingService.processLocationUpdate({
        latitude: -23.553,
        longitude: -46.63,
        accuracy: 10,
        timestamp: Date.now(),
      });

      expect(
        (locationTrackingService as any).lastNotificationTime,
      ).toBeGreaterThan(0);
    });

    it('deve respeitar throttle de 30 segundos', async () => {
      setUpNavigationState();
      // Set last notification to "just now"
      (locationTrackingService as any).lastNotificationTime = Date.now();

      const timeBefore = (locationTrackingService as any).lastNotificationTime;

      // ~78m from stop
      await locationTrackingService.processLocationUpdate({
        latitude: -23.5507,
        longitude: -46.63,
        accuracy: 10,
        timestamp: Date.now(),
      });

      // Should NOT update because throttle (< 30s since last)
      expect((locationTrackingService as any).lastNotificationTime).toBe(
        timeBefore,
      );
    });
  });
});
