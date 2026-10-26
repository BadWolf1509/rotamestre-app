/**
 * Hook for handling drawer logout logic
 *
 * Do motorista, antes de perguntar, conta o que ainda está no aparelho sem
 * ter chegado ao banco (`pendenciasDoAparelho.ts`): com pendência, o diálogo
 * diz o que fica para trás e o app tenta enviar na hora. Alternativas: (a)
 * botão "Enviar agora" no diálogo — pede um diálogo de três ações que o
 * design system não tem; (b) recusar a saída com pendência — prende quem
 * precisa trocar de conta. Ficou: avisar + disparar o envio ao abrir.
 */

import { useRouter } from 'expo-router';
import { useState, useCallback, useRef } from 'react';

import { authService } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  contarPendenciasDaConta,
  MENSAGEM_SAIDA_PADRAO,
  mensagemDeSaida,
  temPendencias,
} from '@/lib/motorista/pendenciasDoAparelho';
import { solicitarEnvioFila } from '@/lib/offline';

interface UseDrawerLogoutOptions {
  onClose: () => void;
  /** Só o motorista tem filas no aparelho; ausente, não consulta nada. */
  motoristaId?: string;
}

export function useDrawerLogout({
  onClose,
  motoristaId,
}: UseDrawerLogoutOptions) {
  const router = useRouter();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState(MENSAGEM_SAIDA_PADRAO);
  const [comPendencias, setComPendencias] = useState(false);
  // Descarta a contagem de uma abertura anterior do diálogo
  const aberturaRef = useRef(0);

  const handleLogoutPress = useCallback(() => {
    const abertura = ++aberturaRef.current;
    setLogoutMessage(MENSAGEM_SAIDA_PADRAO);
    setComPendencias(false);
    setShowLogoutDialog(true);
    if (!motoristaId) return;

    void contarPendenciasDaConta(motoristaId).then((pendencias) => {
      if (abertura !== aberturaRef.current) return;
      if (!temPendencias(pendencias)) return;
      setLogoutMessage(mensagemDeSaida(pendencias));
      setComPendencias(true);
      solicitarEnvioFila().catch((erro) =>
        logger.warn('[Logout] Falha ao tentar enviar a fila', erro),
      );
    });
  }, [motoristaId]);

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
    aberturaRef.current++;
    setShowLogoutDialog(false);
  }, []);

  const handleErrorDismiss = useCallback(() => {
    setShowErrorDialog(false);
  }, []);

  return {
    showLogoutDialog,
    showErrorDialog,
    logoutMessage,
    logoutConfirmText: comPendencias ? 'Sair mesmo assim' : 'Sair',
    handleLogoutPress,
    handleLogoutConfirm,
    handleLogoutCancel,
    handleErrorDismiss,
  };
}
