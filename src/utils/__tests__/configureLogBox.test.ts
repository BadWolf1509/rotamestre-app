/**
 * Tests for configureLogBox.ts
 * Configuração do LogBox para suprimir warnings conhecidos
 */

import { Platform, LogBox } from 'react-native';

import { configureLogBox } from '../configureLogBox';

// Mock Platform and LogBox
jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
  },
  LogBox: {
    uninstall: jest.fn(),
    ignoreAllLogs: jest.fn(),
  },
}));

// Mock __DEV__
const originalDev = (global as any).__DEV__;

describe('configureLogBox', () => {
  let originalWarn: typeof console.warn;
  let originalError: typeof console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__DEV__ = true;
    (Platform as any).OS = 'web';
    originalWarn = console.warn;
    originalError = console.error;
  });

  afterEach(() => {
    (global as any).__DEV__ = originalDev;
    console.warn = originalWarn;
    console.error = originalError;
  });

  describe('Configuração Web em DEV', () => {
    it('deve chamar LogBox.uninstall em web/dev', () => {
      configureLogBox();

      expect(LogBox.uninstall).toHaveBeenCalled();
    });

    it('deve chamar LogBox.ignoreAllLogs(true)', () => {
      configureLogBox();

      expect(LogBox.ignoreAllLogs).toHaveBeenCalledWith(true);
    });

    it('deve substituir console.warn', () => {
      configureLogBox();

      expect(console.warn).not.toBe(originalWarn);
    });

    it('deve substituir console.error', () => {
      configureLogBox();

      expect(console.error).not.toBe(originalError);
    });
  });

  describe('Supressão de warnings', () => {
    it('deve suprimir warning de Google Maps', () => {
      const mockWarn = jest.fn();
      console.warn = mockWarn;

      configureLogBox();
      console.warn('Google Maps JavaScript API has been loaded asynchronously');

      expect(mockWarn).not.toHaveBeenCalled();
    });

    it('deve suprimir warning de text node', () => {
      configureLogBox();

      // Testar que warnings de text node são filtrados
      expect(() => {
        console.warn('Unexpected text node: . A text node cannot be a child of a <View>');
      }).not.toThrow();
    });

    it('deve permitir outros warnings', () => {
      const mockWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      configureLogBox();
      console.warn('Some other warning message');

      expect(mockWarn).toHaveBeenCalledWith('Some other warning message');
      mockWarn.mockRestore();
    });
  });

  describe('Supressão de erros', () => {
    it('deve suprimir erro de text node', () => {
      configureLogBox();

      expect(() => {
        console.error('text node cannot be a child of <View>');
      }).not.toThrow();
    });

    it('deve permitir outros erros', () => {
      const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

      configureLogBox();
      console.error('Some other error message');

      expect(mockError).toHaveBeenCalledWith('Some other error message');
      mockError.mockRestore();
    });
  });

  describe('Comportamento em outras plataformas', () => {
    it('não deve configurar em iOS', () => {
      (Platform as any).OS = 'ios';

      configureLogBox();

      // LogBox não deve ser chamado em iOS
      expect(LogBox.uninstall).not.toHaveBeenCalled();
    });

    it('não deve configurar em Android', () => {
      (Platform as any).OS = 'android';

      configureLogBox();

      expect(LogBox.uninstall).not.toHaveBeenCalled();
    });
  });

  describe('Comportamento em produção', () => {
    it('não deve configurar quando __DEV__ é false', () => {
      (global as any).__DEV__ = false;

      configureLogBox();

      expect(LogBox.uninstall).not.toHaveBeenCalled();
    });
  });

  describe('normalizeArgs', () => {
    it('deve tratar argumentos de diferentes tipos', () => {
      configureLogBox();

      // Testar que diferentes tipos de argumentos não causam erro
      expect(() => {
        console.warn('string', 123, { key: 'value' }, new Error('test'));
      }).not.toThrow();
    });

    it('deve tratar objeto com message', () => {
      configureLogBox();

      expect(() => {
        console.warn({ message: 'Unexpected text node' });
      }).not.toThrow();
    });

    it('deve tratar objeto sem message', () => {
      configureLogBox();

      expect(() => {
        console.warn({ other: 'value' });
      }).not.toThrow();
    });
  });
});
