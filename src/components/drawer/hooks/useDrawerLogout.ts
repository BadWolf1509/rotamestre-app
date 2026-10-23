/**
 * Hook for handling drawer logout logic
 */

import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';

import { authService } from '@/lib/auth';
import { logger } from '@/lib/logger';

interface UseDrawerLogoutOptions {
  onClose: () => void;
}

export function useDrawerLogout({ onClose }: UseDrawerLogoutOptions) {
  const router = useRouter();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  const handleLogoutPress = useCallback(() => {
    setShowLogoutDialog(true);
  }, []);

  const handleLogoutConfirm = useCallback(async () => {
    setShowLogoutDialog(false);

    try {
      // authService: tira o token de push do banco e limpa o estado local.
      await authService.signOut();
      onClose();
      router.replace('/auth/login');
    } catch (error) {
      logger.error('Erro ao fazer logout:', error);
      setShowErrorDialog(true);
    }
  }, [onClose, router]);

  const handleLogoutCancel = useCallback(() => {
    setShowLogoutDialog(false);
  }, []);

  const handleErrorDismiss = useCallback(() => {
    setShowErrorDialog(false);
  }, []);

  return {
    showLogoutDialog,
    showErrorDialog,
    handleLogoutPress,
    handleLogoutConfirm,
    handleLogoutCancel,
    handleErrorDismiss,
  };
}
