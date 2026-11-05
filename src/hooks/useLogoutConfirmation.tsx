import React, { useState } from 'react';

import { Dialog } from '@/design-system';
import { authService } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * Sair sem rede com o token vencido: o signOut do supabase-js devolve o erro
 * da leitura da sessão ANTES de removê-la, então não chega SIGNED_OUT e o
 * layout raiz (useNavegacaoDeSaida) não tem o que reagir. Alternativas: (a)
 * avisar, como o menu lateral (useDrawerLogout) — escolhida; (b) forçar a
 * limpeza local da sessão — desloga de verdade, mas diverge do menu lateral
 * e o pedido de saída ficaria sem o servidor saber (token de push ainda no
 * banco). A pessoa tenta de novo com rede.
 */
export function useLogoutConfirmation() {
  const [visible, setVisible] = useState(false);
  const [erroVisible, setErroVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await authService.signOut();
    } catch (error) {
      // Quando o signOut dá certo, o SIGNED_OUT leva ao login pelo layout raiz
      // (useNavegacaoDeSaida, R-NUC-1) — daqui não se navega. Quando falha
      // antes de remover a sessão (token vencido e sem rede), não vem
      // SIGNED_OUT: o aviso abaixo é a única resposta ao toque em Sair.
      logger.warn('[Logout] Erro ao encerrar sessão:', error);
      setErroVisible(true);
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

  const erroModal = (
    <Dialog
      visible={erroVisible}
      variant="alert"
      title="Erro ao sair"
      message="Não foi possível encerrar sua sessão. Tente novamente."
      confirmText="Entendi"
      type="danger"
      onConfirm={() => setErroVisible(false)}
    />
  );

  return {
    showLogoutModal: () => setVisible(true),
    logoutModal: (
      <>
        {modal}
        {erroModal}
      </>
    ),
  };
}
