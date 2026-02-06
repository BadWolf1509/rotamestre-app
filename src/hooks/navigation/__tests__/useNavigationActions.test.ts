/**
 * Tests for useNavigationActions hook
 *
 * Covers stop completion, skip, exit, and open in maps actions.
 */

import { renderHook, act } from '@testing-library/react-native';

import { useNavigationActions } from '../useNavigationActions';

// Mock navigation module
jest.mock('@/lib/navigation', () => ({
  abrirNavegacao: jest.fn(),
}));

const { abrirNavegacao } = require('@/lib/navigation') as { abrirNavegacao: jest.Mock };

function createMockOptions(overrides: Partial<Parameters<typeof useNavigationActions>[0]> = {}) {
  return {
    currentStop: {
      id: 'stop-1',
      rota_id: 'rota-1',
      tipo: 'entrega' as const,
      endereco: 'Rua Teste, 123',
      latitude: -23.55,
      longitude: -46.63,
      ordem: 1,
      status: 'pendente' as const,
      created_at: new Date().toISOString(),
    },
    preferences: {
      soundAlerts: true,
      vibrationAlerts: true,
      showSpeedometer: true,
      internalNavigation: false,
    },
    triggerHaptic: jest.fn().mockResolvedValue(undefined),
    playNotificationSound: jest.fn().mockResolvedValue(undefined),
    showConfirm: jest.fn().mockResolvedValue(true),
    setNavigationMode: jest.fn(),
    stopNavigation: jest.fn().mockResolvedValue(undefined),
    onComplete: jest.fn(),
    onSkip: jest.fn(),
    onExit: jest.fn(),
    ...overrides,
  };
}

describe('useNavigationActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleOpenInMaps', () => {
    it('deve abrir navegação externa quando internalNavigation=false', () => {
      const options = createMockOptions();
      const { result } = renderHook(() => useNavigationActions(options));

      act(() => {
        result.current.handleOpenInMaps();
      });

      expect(abrirNavegacao).toHaveBeenCalledWith({
        latitude: -23.55,
        longitude: -46.63,
        endereco: 'Rua Teste, 123',
      });
    });

    it('deve mudar para turn-by-turn quando internalNavigation=true', () => {
      const options = createMockOptions({
        preferences: {
          soundAlerts: true,
          vibrationAlerts: true,
          showSpeedometer: true,
          internalNavigation: true,
        },
      });
      const { result } = renderHook(() => useNavigationActions(options));

      act(() => {
        result.current.handleOpenInMaps();
      });

      expect(options.setNavigationMode).toHaveBeenCalledWith('turn-by-turn');
      expect(abrirNavegacao).not.toHaveBeenCalled();
    });
  });

  describe('handleCompleteStop', () => {
    it('deve chamar haptic → confirm → sound → haptic success → onComplete', async () => {
      const options = createMockOptions();
      const { result } = renderHook(() => useNavigationActions(options));

      await act(async () => {
        await result.current.handleCompleteStop();
      });

      // Order: haptic impact → showConfirm → playNotificationSound → haptic success → onComplete
      expect(options.triggerHaptic).toHaveBeenCalledWith('impact');
      expect(options.showConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Confirmar Entrega',
          confirmText: 'Confirmar',
        })
      );
      expect(options.playNotificationSound).toHaveBeenCalled();
      expect(options.triggerHaptic).toHaveBeenCalledWith('success');
      expect(options.onComplete).toHaveBeenCalled();
    });

    it('deve NÃO chamar onComplete quando usuário cancela', async () => {
      const options = createMockOptions({
        showConfirm: jest.fn().mockResolvedValue(false),
      });
      const { result } = renderHook(() => useNavigationActions(options));

      await act(async () => {
        await result.current.handleCompleteStop();
      });

      expect(options.triggerHaptic).toHaveBeenCalledWith('impact');
      expect(options.showConfirm).toHaveBeenCalled();
      expect(options.playNotificationSound).not.toHaveBeenCalled();
      expect(options.onComplete).not.toHaveBeenCalled();
    });
  });

  describe('handleSkipStop', () => {
    it('deve chamar haptic → confirm → haptic warning → onSkip', async () => {
      const options = createMockOptions();
      const { result } = renderHook(() => useNavigationActions(options));

      await act(async () => {
        await result.current.handleSkipStop();
      });

      expect(options.triggerHaptic).toHaveBeenCalledWith('impact');
      expect(options.showConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Pular Parada',
          type: 'danger',
        })
      );
      expect(options.triggerHaptic).toHaveBeenCalledWith('warning');
      expect(options.onSkip).toHaveBeenCalled();
    });

    it('deve NÃO chamar onSkip quando usuário cancela', async () => {
      const options = createMockOptions({
        showConfirm: jest.fn().mockResolvedValue(false),
      });
      const { result } = renderHook(() => useNavigationActions(options));

      await act(async () => {
        await result.current.handleSkipStop();
      });

      expect(options.onSkip).not.toHaveBeenCalled();
    });
  });

  describe('handleExitNavigation', () => {
    it('deve chamar confirm → stopNavigation → onExit', async () => {
      const options = createMockOptions();
      const { result } = renderHook(() => useNavigationActions(options));

      await act(async () => {
        await result.current.handleExitNavigation();
      });

      expect(options.showConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Sair da Navegação',
          type: 'danger',
        })
      );
      expect(options.stopNavigation).toHaveBeenCalled();
      expect(options.onExit).toHaveBeenCalled();
    });

    it('deve NÃO chamar onExit quando usuário cancela', async () => {
      const options = createMockOptions({
        showConfirm: jest.fn().mockResolvedValue(false),
      });
      const { result } = renderHook(() => useNavigationActions(options));

      await act(async () => {
        await result.current.handleExitNavigation();
      });

      expect(options.stopNavigation).not.toHaveBeenCalled();
      expect(options.onExit).not.toHaveBeenCalled();
    });
  });
});
