/**
 * Hook for handling drawer logout logic
 */

import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';

import { supabase } from '@/lib/supabase';

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
      await supabase.auth.signOut();
      onClose();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
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
