import React, { useState } from 'react';

import { Dialog } from '@/design-system';
import { authService } from '@/lib/auth';
import { logger } from '@/lib/logger';

export function useLogoutConfirmation() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await authService.signOut();
    } catch (error) {
      // O supabase-js remove a sessão local mesmo quando a chamada ao
      // servidor falha; o SIGNED_OUT resultante leva ao login, pelo layout
      // raiz (useNavegacaoDeSaida, R-NUC-1) — daqui não se navega.
      logger.warn('[Logout] Erro ao encerrar sessão:', error);
    } finally {
      setLoading(false);
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
      icon="log-out-outline"
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
