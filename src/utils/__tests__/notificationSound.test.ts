/**
 * Tests for notificationSound.ts
 * Utilitário de sons de notificação
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
      createAsync: () => mockCreateAsync(),
    },
  },
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
  });

  describe('setNotificationSoundEnabled / isNotificationSoundEnabled', () => {
    it('deve retornar true por padrão', () => {
      setNotificationSoundEnabled(true);
      expect(isNotificationSoundEnabled()).toBe(true);
    });

    it('deve permitir desabilitar sons', () => {
      setNotificationSoundEnabled(false);

      expect(isNotificationSoundEnabled()).toBe(false);
    });

    it('deve permitir reabilitar sons', () => {
      setNotificationSoundEnabled(false);
      setNotificationSoundEnabled(true);

      expect(isNotificationSoundEnabled()).toBe(true);
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
      setNotificationSoundEnabled(false);

      await playNotificationSound();

      expect(mockCreateAsync).not.toHaveBeenCalled();
    });

    it('deve criar e tocar som quando habilitado', async () => {
      const mockSound = {
        unloadAsync: mockUnloadAsync,
        setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
      };

      mockCreateAsync.mockResolvedValueOnce({ sound: mockSound });

      await playNotificationSound();

      expect(mockCreateAsync).toHaveBeenCalled();
      expect(mockSetOnPlaybackStatusUpdate).toHaveBeenCalled();
    });

    it('deve tratar erro ao tocar som', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockCreateAsync.mockRejectedValueOnce(new Error('Sound error'));

      await playNotificationSound();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('deve descarregar som anterior e reagir ao status', async () => {
      const callbacks: Array<(status: any) => void> = [];
      mockSetOnPlaybackStatusUpdate.mockImplementation((cb: any) => {
        callbacks.push(cb);
      });

      const mockSound = {
        unloadAsync: mockUnloadAsync,
        setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
      };

      mockCreateAsync.mockResolvedValue({ sound: mockSound });

      await playNotificationSound();
      await playNotificationSound();

      expect(mockUnloadAsync).toHaveBeenCalled();
      expect(callbacks.length).toBeGreaterThan(0);

      mockUnloadAsync.mockClear();
      callbacks[0]({ isLoaded: false, didJustFinish: false });
      callbacks[0]({ isLoaded: true, didJustFinish: true });
      expect(mockUnloadAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('playSuccessSound', () => {
    it('não deve tocar som se desabilitado', async () => {
      setNotificationSoundEnabled(false);

      await playSuccessSound();

      expect(mockCreateAsync).not.toHaveBeenCalled();
    });

    it('deve criar e tocar som de sucesso', async () => {
      const mockSound = {
        unloadAsync: mockUnloadAsync,
        setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
      };

      mockCreateAsync.mockResolvedValueOnce({ sound: mockSound });

      await playSuccessSound();

      expect(mockCreateAsync).toHaveBeenCalled();
    });

    it('deve descarregar successSound anterior e reagir ao status', async () => {
      const callbacks: Array<(status: any) => void> = [];
      mockSetOnPlaybackStatusUpdate.mockImplementation((cb: any) => {
        callbacks.push(cb);
      });

      const mockSound = {
        unloadAsync: mockUnloadAsync,
        setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
      };

      mockCreateAsync.mockResolvedValue({ sound: mockSound });

      await playSuccessSound();
      await playSuccessSound();

      expect(mockUnloadAsync).toHaveBeenCalled();
      expect(callbacks.length).toBeGreaterThan(0);

      mockUnloadAsync.mockClear();
      callbacks[0]({ isLoaded: false, didJustFinish: false });
      callbacks[0]({ isLoaded: true, didJustFinish: true });
      expect(mockUnloadAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanupNotificationSounds', () => {
    it('deve fazer cleanup sem erros', async () => {
      await cleanupNotificationSounds();

      // Não deve lançar erro mesmo sem sons carregados
      expect(true).toBe(true);
    });

    it('deve tratar erro durante cleanup', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockSound = {
        unloadAsync: mockUnloadAsync,
        setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
      };

      mockCreateAsync.mockResolvedValue({ sound: mockSound });
      mockUnloadAsync.mockRejectedValueOnce(new Error('Cleanup error'));

      await playNotificationSound();
      await cleanupNotificationSounds();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('deve limpar sons carregados', async () => {
      const mockSound = {
        unloadAsync: mockUnloadAsync,
        setOnPlaybackStatusUpdate: mockSetOnPlaybackStatusUpdate,
      };

      mockCreateAsync.mockResolvedValue({ sound: mockSound });

      await playNotificationSound();
      await playSuccessSound();
      await cleanupNotificationSounds();

      expect(mockUnloadAsync).toHaveBeenCalled();
    });
  });
});
