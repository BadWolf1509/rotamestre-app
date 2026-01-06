/**
 * Tests for notificationSound.ts
 * Utilitário de sons de notificação com sons sintetizados
 */

import {
  setNotificationSoundEnabled,
  isNotificationSoundEnabled,
  initializeNotificationAudio,
  playNotificationSound,
  playSuccessSound,
  cleanupNotificationSounds,
} from '../notificationSound';

// Mock expo-av
const mockSetAudioModeAsync = jest.fn();
const mockUnloadAsync = jest.fn();
const mockCreateAsync = jest.fn();
const mockSetOnPlaybackStatusUpdate = jest.fn();

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: () => mockSetAudioModeAsync(),
    Sound: {
      createAsync: (...args: unknown[]) => mockCreateAsync(...args),
    },
  },
}));

// Mock AsyncStorage
const mockAsyncStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockAsyncStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage[key] = value;
    return Promise.resolve();
  }),
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (obj: Record<string, unknown>) => obj.ios || obj.default,
  },
}));

describe('notificationSound', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset sound enabled state
    setNotificationSoundEnabled(true);
    // Clear AsyncStorage mock
    Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
  });

  describe('setNotificationSoundEnabled / isNotificationSoundEnabled', () => {
    it('deve retornar true por padrão', () => {
      setNotificationSoundEnabled(true);
      expect(isNotificationSoundEnabled()).toBe(true);
    });

    it('deve permitir desabilitar sons', async () => {
      await setNotificationSoundEnabled(false);

      expect(isNotificationSoundEnabled()).toBe(false);
    });

    it('deve permitir reabilitar sons', async () => {
      await setNotificationSoundEnabled(false);
      await setNotificationSoundEnabled(true);

      expect(isNotificationSoundEnabled()).toBe(true);
    });

    it('deve persistir preferência no AsyncStorage', async () => {
      await setNotificationSoundEnabled(false);

      expect(mockAsyncStorage['@rotamestre:notification_sound_enabled']).toBe('false');
    });
  });

  describe('initializeNotificationAudio', () => {
    it('deve configurar modo de áudio', async () => {
      mockSetAudioModeAsync.mockResolvedValueOnce(undefined);

      await initializeNotificationAudio();

      expect(mockSetAudioModeAsync).toHaveBeenCalled();
    });

    it('deve tratar erro silenciosamente', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockSetAudioModeAsync.mockRejectedValueOnce(new Error('Audio error'));

      await initializeNotificationAudio();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('playNotificationSound', () => {
    it('não deve tocar som se desabilitado', async () => {
      await setNotificationSoundEnabled(false);

      await playNotificationSound();

      expect(mockCreateAsync).not.toHaveBeenCalled();
    });

    it('deve criar e tocar som sintetizado quando habilitado', async () => {
      const mockSound = {
        unloadAsync: mockUnloadAsync,
        setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
      };

      mockCreateAsync.mockResolvedValue({ sound: mockSound });

      await playNotificationSound();

      // Verifica que foi chamado com data URI (som sintetizado)
      expect(mockCreateAsync).toHaveBeenCalled();
      const callArgs = mockCreateAsync.mock.calls[0];
      expect(callArgs[0]).toHaveProperty('uri');
      expect(callArgs[0].uri).toContain('data:audio/wav;base64,');
    });

    it('deve tratar erro ao tocar som', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockCreateAsync.mockRejectedValueOnce(new Error('Sound error'));

      await playNotificationSound();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('deve configurar callback para descarregar som após terminar', async () => {
      const callbacks: Array<(status: { isLoaded: boolean; didJustFinish: boolean }) => void> = [];
      mockSetOnPlaybackStatusUpdate.mockImplementation((cb: (status: { isLoaded: boolean; didJustFinish: boolean }) => void) => {
        callbacks.push(cb);
      });

      const mockSound = {
        unloadAsync: mockUnloadAsync,
        setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
      };

      mockCreateAsync.mockResolvedValue({ sound: mockSound });

      await playNotificationSound();

      expect(callbacks.length).toBeGreaterThan(0);

      // Simular término do som
      callbacks[0]({ isLoaded: true, didJustFinish: true });
      expect(mockUnloadAsync).toHaveBeenCalled();
    });
  });

  describe('playSuccessSound', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('não deve tocar som se desabilitado', async () => {
      await setNotificationSoundEnabled(false);

      await playSuccessSound();

      // Avançar todos os timers
      jest.runAllTimers();

      expect(mockCreateAsync).not.toHaveBeenCalled();
    });

    it('deve criar e tocar som de sucesso sintetizado com setTimeout', async () => {
      const mockSound = {
        unloadAsync: mockUnloadAsync,
        setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
      };

      mockCreateAsync.mockResolvedValue({ sound: mockSound });

      await playSuccessSound();

      // Avançar os timers para disparar os 3 sons (C-E-G em sequência)
      await jest.runAllTimersAsync();

      // O success sound toca 3 notas em sequência (C-E-G) com delays de 100ms
      expect(mockCreateAsync).toHaveBeenCalled();
    });
  });

  describe('cleanupNotificationSounds', () => {
    it('deve fazer cleanup sem erros', async () => {
      await cleanupNotificationSounds();

      // Não deve lançar erro - cleanup agora é no-op para sons sintetizados
      expect(true).toBe(true);
    });

    it('cleanup não faz nada para sons sintetizados', async () => {
      const mockSound = {
        unloadAsync: mockUnloadAsync,
        setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
      };

      mockCreateAsync.mockResolvedValue({ sound: mockSound });

      await playNotificationSound();

      // Clear previous calls
      mockUnloadAsync.mockClear();

      await cleanupNotificationSounds();

      // Cleanup não deve chamar unloadAsync - cada som é gerenciado individualmente
      // via setOnPlaybackStatusUpdate callback
      expect(mockUnloadAsync).not.toHaveBeenCalled();
    });
  });
});
