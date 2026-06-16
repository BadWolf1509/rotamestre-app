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

// Mock expo-audio (substitui expo-av, descontinuado no SDK 56)
const mockSetAudioModeAsync = jest.fn();
const mockPlay = jest.fn();
const mockRemove = jest.fn();
const mockCreateAudioPlayer = jest.fn(() => ({
  volume: 1,
  play: mockPlay,
  remove: mockRemove,
}));

jest.mock('expo-audio', () => ({
  setAudioModeAsync: () => mockSetAudioModeAsync(),
  createAudioPlayer: (...args: unknown[]) => mockCreateAudioPlayer(...args),
}));

// Mock AsyncStorage
const mockAsyncStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) =>
    Promise.resolve(mockAsyncStorage[key] || null),
  ),
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
    Object.keys(mockAsyncStorage).forEach(
      (key) => delete mockAsyncStorage[key],
    );
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

      expect(mockAsyncStorage['@rotamestre:notification_sound_enabled']).toBe(
        'false',
      );
    });
  });

  describe('initializeNotificationAudio', () => {
    it('deve configurar modo de áudio', async () => {
      mockSetAudioModeAsync.mockResolvedValueOnce(undefined);

      await initializeNotificationAudio();

      expect(mockSetAudioModeAsync).toHaveBeenCalled();
    });

    it('deve tratar erro silenciosamente', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockSetAudioModeAsync.mockRejectedValueOnce(new Error('Audio error'));

      await initializeNotificationAudio();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('playNotificationSound', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('não deve tocar som se desabilitado', async () => {
      await setNotificationSoundEnabled(false);

      await playNotificationSound();

      expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
    });

    it('deve criar e tocar som sintetizado quando habilitado', async () => {
      await playNotificationSound();

      // Verifica que foi criado com data URI (som sintetizado) e tocado
      expect(mockCreateAudioPlayer).toHaveBeenCalled();
      const callArgs = mockCreateAudioPlayer.mock.calls[0];
      expect(callArgs[0]).toHaveProperty('uri');
      expect(callArgs[0].uri).toContain('data:audio/wav;base64,');
      expect(mockPlay).toHaveBeenCalled();
    });

    it('deve tratar erro ao tocar som', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockCreateAudioPlayer.mockImplementationOnce(() => {
        throw new Error('Sound error');
      });

      await playNotificationSound();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('deve remover o player após o som terminar', async () => {
      await playNotificationSound();

      // Avançar timers para disparar o setTimeout que libera o player
      jest.advanceTimersByTime(1000);

      expect(mockRemove).toHaveBeenCalled();
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

      expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
    });

    it('deve criar e tocar som de sucesso sintetizado com setTimeout', async () => {
      await playSuccessSound();

      // Avançar os timers para disparar os 3 sons (C-E-G em sequência)
      await jest.runAllTimersAsync();

      // O success sound toca 3 notas em sequência (C-E-G) com delays de 100ms
      expect(mockCreateAudioPlayer).toHaveBeenCalled();
      expect(mockPlay).toHaveBeenCalled();
    });
  });

  describe('cleanupNotificationSounds', () => {
    it('deve fazer cleanup sem erros', async () => {
      await cleanupNotificationSounds();

      // Não deve lançar erro - cleanup agora é no-op para sons sintetizados
      expect(true).toBe(true);
    });

    it('cleanup não faz nada para sons sintetizados', async () => {
      await playNotificationSound();

      // Clear previous calls
      mockRemove.mockClear();

      await cleanupNotificationSounds();

      // Cleanup é no-op: cada beep é liberado individualmente via timer interno
      expect(mockRemove).not.toHaveBeenCalled();
    });
  });
});
