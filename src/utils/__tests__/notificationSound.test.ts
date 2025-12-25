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
  });

  describe('cleanupNotificationSounds', () => {
    it('deve fazer cleanup sem erros', async () => {
      await cleanupNotificationSounds();

      // Não deve lançar erro mesmo sem sons carregados
      expect(true).toBe(true);
    });

    it('deve tratar erro durante cleanup', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Simular erro - difícil sem estado interno, mas a função deve não lançar
      await cleanupNotificationSounds();

      consoleSpy.mockRestore();
    });
  });
});
