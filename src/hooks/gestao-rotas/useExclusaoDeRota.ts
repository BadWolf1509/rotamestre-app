/**
 * Exclusão de rota com confirmação — fluxo único da Início desktop e da
 * Gestão de Rotas (antes cada tela tinha o seu, e o da Início mantinha um
 * Toast próprio).
 *
 * - No web a confirmação é o `Dialog`; no nativo, `Alert.alert` (o Dialog
 *   web não existe como botão nativo).
 * - O Toast pertence à página: ela passa `showToast` (padrão de
 *   `useGestaoRotas`), este hook nunca chama `useToast`.
 * - O texto do diálogo fica guardado até a próxima pergunta: confirmar fecha o
 *   `Dialog` (`visible: false`) mas a rota continua guardada, senão o título
 *   voltava a "Excluir Rota" durante a animação de saída.
 */
import { createElement, useCallback, useState, type ReactElement } from 'react';
import { Alert, Platform } from 'react-native';

import { Dialog } from '@/design-system';
import type { ShowToast } from '@/hooks/useToast';
import {
  excluirRota as excluirRotaNoServidor,
  ExclusaoRotaError,
  MENSAGEM_ROTA_EM_ANDAMENTO,
  textoConfirmacaoExclusao,
} from '@/lib/gestor/excluirRota';
import { logger } from '@/lib/logger';

/** O que as duas telas sabem de uma rota na hora de pedir a exclusão. */
export interface RotaParaExcluir {
  id: string;
  status: string;
  motorista_nome?: string | null;
  total_paradas?: number | null;
  /** Rótulo do status no resumo do diálogo (a Gestão de Rotas o mostra). */
  statusLabel?: string | null;
}

interface OpcoesExclusaoDeRota {
  showToast: ShowToast;
  /** Quem exclui (gestor logado); sem ele a exclusão é recusada com aviso. */
  usuarioId: string | undefined;
  /** Chamado depois da exclusão e também quando a lista estava velha. */
  aoExcluir: () => void;
}

export function useExclusaoDeRota({
  showToast,
  usuarioId,
  aoExcluir,
}: OpcoesExclusaoDeRota): {
  pedirExclusao: (rota: RotaParaExcluir) => void;
  dialogo: ReactElement;
} {
  const [aberto, setAberto] = useState(false);
  // Fica guardada depois de fechar: ver o comentário do topo.
  const [rota, setRota] = useState<RotaParaExcluir | null>(null);

  const executar = useCallback(
    async (alvo: RotaParaExcluir) => {
      if (!usuarioId) {
        showToast('Erro de autenticação. Faça login novamente.', 'error');
        return;
      }
      try {
        showToast('Excluindo rota...', 'loading', 0);
        await excluirRotaNoServidor({
          rotaId: alvo.id,
          usuarioId,
          motoristaNome: alvo.motorista_nome,
          paradasCount: alvo.total_paradas,
        });
        showToast('Rota excluída com sucesso!', 'success');
        aoExcluir();
      } catch (erro) {
        if (erro instanceof ExclusaoRotaError) {
          // A tela mostrava dado velho: explica e recarrega.
          showToast(erro.message, 'error', 5000);
          aoExcluir();
          return;
        }
        logger.error('Erro ao excluir rota:', erro);
        showToast('Não foi possível excluir a rota', 'error', 5000);
      }
    },
    [usuarioId, showToast, aoExcluir],
  );

  const pedirExclusao = useCallback(
    (alvo: RotaParaExcluir) => {
      // Atalho de UX: a lista já sabe que está em andamento. `excluirRota`
      // reconsulta o status; a trava no banco é o gatilho da Migration 41.
      if (alvo.status === 'em_andamento') {
        if (Platform.OS === 'web') {
          showToast(MENSAGEM_ROTA_EM_ANDAMENTO, 'error', 5000);
        } else {
          Alert.alert('Ação não permitida', MENSAGEM_ROTA_EM_ANDAMENTO);
        }
        return;
      }

      if (Platform.OS === 'web') {
        setRota(alvo);
        setAberto(true);
        return;
      }
      const { titulo, mensagem } = textoConfirmacaoExclusao({
        status: alvo.status,
        motoristaNome: alvo.motorista_nome ?? null,
        paradasCount: alvo.total_paradas,
      });
      Alert.alert(titulo, mensagem, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            void executar(alvo);
          },
        },
      ]);
    },
    [showToast, executar],
  );

  const confirmar = useCallback(() => {
    setAberto(false);
    if (rota) void executar(rota);
  }, [rota, executar]);

  const cancelar = useCallback(() => setAberto(false), []);

  const confirmacao = textoConfirmacaoExclusao({
    status: rota?.status,
    motoristaNome: rota ? (rota.motorista_nome ?? null) : undefined,
    paradasCount: rota?.total_paradas,
    statusLabel: rota?.statusLabel ?? null,
  });

  const dialogo = createElement(Dialog, {
    visible: aberto,
    variant: 'confirm',
    title: confirmacao.titulo,
    message: confirmacao.mensagem,
    confirmText: 'Excluir',
    cancelText: 'Cancelar',
    type: 'danger',
    onConfirm: confirmar,
    onCancel: cancelar,
  });

  return { pedirExclusao, dialogo };
}
