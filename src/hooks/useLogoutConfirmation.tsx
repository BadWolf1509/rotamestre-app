import { useRouter } from 'expo-router';
import React, { useState } from 'react';

import { Dialog } from '@/design-system';
import { authService } from '@/lib/auth';
import { logger } from '@/lib/logger';

export function useLogoutConfirmation() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await authService.signOut();
    } catch (error) {
      // Ignora erros - o objetivo é redirecionar para login de qualquer forma
      logger.warn('[Logout] Erro ao encerrar sessão:', error);
    } finally {
      setLoading(false);
      // Sempre redireciona para login, independente de erros
      router.replace('/auth/login');
    }
  };

  const modal = (
    <Dialog
      visible={visible}
      variant="confirm"
      title="Sair da conta"
      message="Deseja realmente encerrar sua sessão?"
      confirmText="Sair"
      cancelText="Cancelar"
      type="danger"
      loading={loading}
      onConfirm={async () => {
        await handleLogout();
        setVisible(false);
      }}
      onCancel={() => setVisible(false)}
    />
  );

  return {
    showLogoutModal: () => setVisible(true),
    logoutModal: modal,
  };
}
