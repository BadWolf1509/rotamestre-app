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
  temEnvioParaTentar,
  temPendencias,
} from '@/lib/motorista/pendenciasDoAparelho';
import { solicitarEnvioFila } from '@/lib/offline';

/** Guarda da contagem de pendências (leitura local; não é prazo de rede). */
const PRAZO_CONTAGEM_MS = 2_000;

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
  const [contandoPendencias, setContandoPendencias] = useState(false);
  const contandoRef = useRef(false);
  // Descarta a contagem de uma abertura anterior do diálogo
  const aberturaRef = useRef(0);

  const handleLogoutPress = useCallback(() => {
    const abertura = ++aberturaRef.current;
    setLogoutMessage(MENSAGEM_SAIDA_PADRAO);
    setComPendencias(false);
    setShowLogoutDialog(true);
    if (!motoristaId) return;

    // "Sair" espera a contagem (leitura local, milissegundos): sair antes
    // dela é sair sem o aviso. A guarda de tempo evita prender o diálogo se
    // o AsyncStorage não responder.
    contandoRef.current = true;
    setContandoPendencias(true);
    let guarda: ReturnType<typeof setTimeout> | undefined;
    const semResposta = new Promise<null>((resolve) => {
      guarda = setTimeout(() => resolve(null), PRAZO_CONTAGEM_MS);
    });
    void Promise.race([contarPendenciasDaConta(motoristaId), semResposta])
      .then((pendencias) => {
        if (abertura !== aberturaRef.current) return;
        if (!pendencias || !temPendencias(pendencias)) return;
        setLogoutMessage(mensagemDeSaida(pendencias));
        setComPendencias(true);
        // O envio da fila manda ações e fotos; posições, não
        if (!temEnvioParaTentar(pendencias)) return;
        solicitarEnvioFila().catch((erro) =>
          logger.warn('[Logout] Falha ao tentar enviar a fila', erro),
        );
      })
      .finally(() => {
        clearTimeout(guarda);
        if (abertura !== aberturaRef.current) return;
        contandoRef.current = false;
        setContandoPendencias(false);
      });
  }, [motoristaId]);

  const handleLogoutConfirm = useCallback(async () => {
    if (contandoRef.current) return;
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
    contandoRef.current = false;
    setContandoPendencias(false);
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
    contandoPendencias,
    handleLogoutPress,
    handleLogoutConfirm,
    handleLogoutCancel,
    handleErrorDismiss,
  };
}
