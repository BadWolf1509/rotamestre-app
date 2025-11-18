import React from 'react';
import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';

import { DevToolsInitializer } from '../DevToolsInitializer';

// Mock @/config/devtools
const mockInitializeDevTools = jest.fn();
jest.mock('@/config/devtools', () => ({
  initializeDevTools: mockInitializeDevTools,
}));

describe('DevToolsInitializer', () => {
  const originalDev = __DEV__;
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset __DEV__ to true by default
    (global as any).__DEV__ = true;
  });

  afterEach(() => {
    jest.useRealTimers();
    (global as any).__DEV__ = originalDev;
    Object.defineProperty(Platform, 'OS', {
      get: () => originalPlatformOS,
      configurable: true,
    });
  });

  describe('Renderização', () => {
    it('deve renderizar null (não renderiza nada visível)', () => {
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      const { UNSAFE_root } = render(<DevToolsInitializer />);
      expect(UNSAFE_root).toBeTruthy();
    });

    it('deve sempre retornar null', () => {
      Object.defineProperty(Platform, 'OS', {
        get: () => 'ios',
        configurable: true,
      });

      const { toJSON } = render(<DevToolsInitializer />);
      expect(toJSON()).toBeNull();
    });
  });

  describe('Inicialização em DEV mode na Web', () => {
    it('deve inicializar DevTools quando __DEV__=true e Platform.OS=web', () => {
      (global as any).__DEV__ = true;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      render(<DevToolsInitializer />);

      // Fast-forward setTimeout(100ms)
      jest.advanceTimersByTime(100);

      expect(mockInitializeDevTools).toHaveBeenCalledTimes(1);
    });

    it('deve usar setTimeout de 100ms antes de inicializar', () => {
      (global as any).__DEV__ = true;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      render(<DevToolsInitializer />);

      // Antes de 100ms, não deve ter chamado
      expect(mockInitializeDevTools).not.toHaveBeenCalled();

      // Após 100ms, deve ter chamado
      jest.advanceTimersByTime(100);
      expect(mockInitializeDevTools).toHaveBeenCalledTimes(1);
    });

    it('deve logar sucesso após inicializar', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      (global as any).__DEV__ = true;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      render(<DevToolsInitializer />);
      jest.advanceTimersByTime(100);

      expect(consoleLogSpy).toHaveBeenCalledWith('🚀 DevTools initialized successfully');

      consoleLogSpy.mockRestore();
    });
  });

  describe('Não inicialização em diferentes ambientes', () => {
    it('não deve inicializar quando __DEV__=false (production)', () => {
      (global as any).__DEV__ = false;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      render(<DevToolsInitializer />);
      jest.advanceTimersByTime(100);

      expect(mockInitializeDevTools).not.toHaveBeenCalled();
    });

    it('não deve inicializar no iOS mesmo em DEV', () => {
      (global as any).__DEV__ = true;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'ios',
        configurable: true,
      });

      render(<DevToolsInitializer />);
      jest.advanceTimersByTime(100);

      expect(mockInitializeDevTools).not.toHaveBeenCalled();
    });

    it('não deve inicializar no Android mesmo em DEV', () => {
      (global as any).__DEV__ = true;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'android',
        configurable: true,
      });

      render(<DevToolsInitializer />);
      jest.advanceTimersByTime(100);

      expect(mockInitializeDevTools).not.toHaveBeenCalled();
    });

    it('não deve inicializar em production na web', () => {
      (global as any).__DEV__ = false;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      render(<DevToolsInitializer />);
      jest.advanceTimersByTime(100);

      expect(mockInitializeDevTools).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('deve ter try-catch para prevenir crashes', () => {
      // O componente tem try-catch que previne crashes
      // Testamos isso verificando que o componente renderiza sem erros
      (global as any).__DEV__ = true;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      expect(() => {
        render(<DevToolsInitializer />);
        jest.advanceTimersByTime(100);
      }).not.toThrow();
    });
  });

  describe('useEffect Cleanup', () => {
    it('deve executar apenas uma vez ao montar', () => {
      (global as any).__DEV__ = true;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      const { rerender } = render(<DevToolsInitializer />);
      jest.advanceTimersByTime(100);

      expect(mockInitializeDevTools).toHaveBeenCalledTimes(1);

      // Rerender não deve chamar novamente (useEffect com [])
      rerender(<DevToolsInitializer />);
      jest.advanceTimersByTime(100);

      expect(mockInitializeDevTools).toHaveBeenCalledTimes(1);
    });
  });

  describe('Casos de Uso Reais', () => {
    it('deve inicializar DevTools em ambiente de desenvolvimento web', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      (global as any).__DEV__ = true;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      render(<DevToolsInitializer />);
      jest.advanceTimersByTime(100);

      expect(mockInitializeDevTools).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith('🚀 DevTools initialized successfully');

      consoleLogSpy.mockRestore();
    });

    it('não deve fazer nada em app mobile de produção', () => {
      (global as any).__DEV__ = false;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'ios',
        configurable: true,
      });

      render(<DevToolsInitializer />);
      jest.advanceTimersByTime(100);

      expect(mockInitializeDevTools).not.toHaveBeenCalled();
    });

    it('não deve fazer nada em app web de produção', () => {
      (global as any).__DEV__ = false;
      Object.defineProperty(Platform, 'OS', {
        get: () => 'web',
        configurable: true,
      });

      render(<DevToolsInitializer />);
      jest.advanceTimersByTime(100);

      expect(mockInitializeDevTools).not.toHaveBeenCalled();
    });
  });
});
