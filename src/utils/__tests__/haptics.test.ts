/**
 * Tests for haptics.ts
 * Utilitários de feedback háptico
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import {
  lightHaptic,
  mediumHaptic,
  heavyHaptic,
  successHaptic,
  warningHaptic,
  errorHaptic,
  selectionHaptic,
  withHaptic,
} from '../haptics';

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
    Heavy: 'Heavy',
  },
  NotificationFeedbackType: {
    Success: 'Success',
    Warning: 'Warning',
    Error: 'Error',
  },
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

describe('haptics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('lightHaptic', () => {
    it('deve chamar impactAsync com Light', async () => {
      await lightHaptic();

      expect(Haptics.impactAsync).toHaveBeenCalledWith('Light');
    });

    it('deve silenciar erros', async () => {
      (Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(new Error('Haptic error'));

      // Não deve lançar erro
      await expect(lightHaptic()).resolves.toBeUndefined();
    });
  });

  describe('mediumHaptic', () => {
    it('deve chamar impactAsync com Medium', async () => {
      await mediumHaptic();

      expect(Haptics.impactAsync).toHaveBeenCalledWith('Medium');
    });
  });

  describe('heavyHaptic', () => {
    it('deve chamar impactAsync com Heavy', async () => {
      await heavyHaptic();

      expect(Haptics.impactAsync).toHaveBeenCalledWith('Heavy');
    });
  });

  describe('successHaptic', () => {
    it('deve chamar notificationAsync com Success', async () => {
      await successHaptic();

      expect(Haptics.notificationAsync).toHaveBeenCalledWith('Success');
    });
  });

  describe('warningHaptic', () => {
    it('deve chamar notificationAsync com Warning', async () => {
      await warningHaptic();

      expect(Haptics.notificationAsync).toHaveBeenCalledWith('Warning');
    });
  });

  describe('errorHaptic', () => {
    it('deve chamar notificationAsync com Error', async () => {
      await errorHaptic();

      expect(Haptics.notificationAsync).toHaveBeenCalledWith('Error');
    });
  });

  describe('selectionHaptic', () => {
    it('deve chamar selectionAsync', async () => {
      await selectionHaptic();

      expect(Haptics.selectionAsync).toHaveBeenCalled();
    });
  });

  describe('withHaptic', () => {
    it('deve executar função com haptic light por padrão', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      const wrappedFn = withHaptic(mockFn);

      const result = await wrappedFn('arg1', 'arg2');

      expect(Haptics.impactAsync).toHaveBeenCalledWith('Light');
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result).toBe('result');
    });

    it('deve executar função com haptic medium', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      const wrappedFn = withHaptic(mockFn, 'medium');

      await wrappedFn();

      expect(Haptics.impactAsync).toHaveBeenCalledWith('Medium');
      expect(mockFn).toHaveBeenCalled();
    });

    it('deve executar função com haptic heavy', async () => {
      const mockFn = jest.fn();
      const wrappedFn = withHaptic(mockFn, 'heavy');

      await wrappedFn();

      expect(Haptics.impactAsync).toHaveBeenCalledWith('Heavy');
    });

    it('deve executar função com haptic success', async () => {
      const mockFn = jest.fn();
      const wrappedFn = withHaptic(mockFn, 'success');

      await wrappedFn();

      expect(Haptics.notificationAsync).toHaveBeenCalledWith('Success');
    });

    it('deve executar função com haptic warning', async () => {
      const mockFn = jest.fn();
      const wrappedFn = withHaptic(mockFn, 'warning');

      await wrappedFn();

      expect(Haptics.notificationAsync).toHaveBeenCalledWith('Warning');
    });

    it('deve executar função com haptic error', async () => {
      const mockFn = jest.fn();
      const wrappedFn = withHaptic(mockFn, 'error');

      await wrappedFn();

      expect(Haptics.notificationAsync).toHaveBeenCalledWith('Error');
    });

    it('deve executar função com haptic selection', async () => {
      const mockFn = jest.fn();
      const wrappedFn = withHaptic(mockFn, 'selection');

      await wrappedFn();

      expect(Haptics.selectionAsync).toHaveBeenCalled();
    });

    it('deve retornar o resultado da função wrapped', async () => {
      const mockFn = jest.fn().mockResolvedValue({ data: 'test' });
      const wrappedFn = withHaptic(mockFn, 'success');

      const result = await wrappedFn();

      expect(result).toEqual({ data: 'test' });
    });
  });
});

// Nota: Testes para web requerem reimportação do módulo após mudar Platform.OS
// pois isHapticsAvailable é calculado no momento da importação.
// Isso seria feito em testes de integração.
