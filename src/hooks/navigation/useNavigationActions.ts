/**
 * useNavigationActions - Navigation action handlers
 *
 * Extracted from NavigationMode.tsx to reduce component complexity.
 * Handles stop completion, skip, exit, and open in maps actions.
 */

import { useCallback } from 'react';

import type { ParadaData } from '@/context/RouteStatusContext';
import { abrirNavegacao } from '@/lib/navigation';

import type { NavigationPreferences } from './types';

interface UseNavigationActionsOptions {
  currentStop: ParadaData;
  preferences: NavigationPreferences;
  triggerHaptic: (type: 'impact' | 'success' | 'warning') => Promise<void>;
  playNotificationSound: () => Promise<void>;
  showConfirm: (opts: {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    type?: 'danger' | 'warning';
  }) => Promise<boolean>;
  setNavigationMode: (mode: 'map' | 'turn-by-turn') => void;
  stopNavigation: () => Promise<void>;
  onComplete: () => void;
  onSkip: () => void;
  onExit: () => void;
}

export function useNavigationActions({
  currentStop,
  preferences,
  triggerHaptic,
  playNotificationSound,
  showConfirm,
  setNavigationMode,
  stopNavigation,
  onComplete,
  onSkip,
  onExit,
}: UseNavigationActionsOptions) {
  const handleOpenInMaps = useCallback(() => {
    if (!currentStop) return;

    // If internal nav is enabled, switch to turn-by-turn mode
    if (preferences.internalNavigation) {
      setNavigationMode('turn-by-turn');
    } else {
      // Open in external app
      abrirNavegacao({
        latitude: currentStop.latitude,
        longitude: currentStop.longitude,
        endereco: currentStop.endereco,
      });
    }
  }, [currentStop, preferences.internalNavigation, setNavigationMode]);

  const handleCompleteStop = useCallback(async () => {
    await triggerHaptic('impact');
    const confirmed = await showConfirm({
      title: 'Confirmar Entrega',
      message: `Confirma a entrega em:\n${currentStop.endereco}?`,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
    });
    if (confirmed) {
      await playNotificationSound();
      await triggerHaptic('success');
      onComplete();
    }
  }, [currentStop, triggerHaptic, showConfirm, playNotificationSound, onComplete]);

  const handleSkipStop = useCallback(async () => {
    await triggerHaptic('impact');
    const confirmed = await showConfirm({
      title: 'Pular Parada',
      message: `Deseja pular esta parada?\n${currentStop.endereco}`,
      confirmText: 'Pular',
      cancelText: 'Cancelar',
      type: 'danger',
    });
    if (confirmed) {
      await triggerHaptic('warning');
      onSkip();
    }
  }, [currentStop, triggerHaptic, showConfirm, onSkip]);

  const handleExitNavigation = useCallback(async () => {
    const confirmed = await showConfirm({
      title: 'Sair da Navegação',
      message: 'Deseja sair do modo de navegação?',
      confirmText: 'Sair',
      cancelText: 'Cancelar',
      type: 'danger',
    });
    if (confirmed) {
      await stopNavigation();
      onExit();
    }
  }, [showConfirm, stopNavigation, onExit]);

  return { handleOpenInMaps, handleCompleteStop, handleSkipStop, handleExitNavigation };
}
