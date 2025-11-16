import { useRouter } from 'expo-router';
import React, { useState } from 'react';

import { ConfirmModal } from '@/components/ConfirmModal';
import { authService } from '@/lib/auth';

export function useLogoutConfirmation() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await authService.signOut();
      router.replace('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  const modal = (
    <ConfirmModal
      visible={visible}
      title="Sair da conta"
      message="Deseja realmente encerrar sua sessao?"
      confirmText="Sair"
      cancelText="Cancelar"
      type="destructive"
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
