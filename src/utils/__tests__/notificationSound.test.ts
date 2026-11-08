/**
 * Tests for notificationSound.ts
 * Utilitário de sons de notificação com sons sintetizados
 */

import { playNotificationSound } from '../notificationSound';

// Mock expo-audio (substitui expo-av, descontinuado no SDK 56)
const mockPlay = jest.fn();
const mockRemove = jest.fn();
const mockCreateAudioPlayer = jest.fn(() => ({
  volume: 1,
  play: mockPlay,
  remove: mockRemove,
}));

jest.mock('expo-audio', () => ({
  createAudioPlayer: (...args: unknown[]) => mockCreateAudioPlayer(...args),
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
  });

  describe('playNotificationSound', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('deve criar e tocar som sintetizado', async () => {
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
});
