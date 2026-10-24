/**
 * useReorderState - Hook para gerenciar estado de reordenação de paradas
 *
 * Centraliza toda a lógica de:
 * - Separação de paradas fixas vs reordenáveis
 * - Estado local para preview (web)
 * - Operações de mover para cima/baixo
 * - Recusa de ordem que põe a entrega antes da retirada vinculada
 * - Salvar/cancelar alterações
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  mensagemEntregaAntesDaRetirada,
  primeiraViolacaoNova,
} from '@/lib/gestor/vinculoParada';
import { logger } from '@/lib/logger';

import type { Parada } from '../types';

export interface UseReorderStateOptions {
  paradas: Parada[];
  onReorder: (newOrder: Parada[]) => Promise<void>;
  rotaStatus: string;
  onWebChangesChange?: (hasChanges: boolean) => void;
}

export interface UseReorderStateReturn {
  /** Paradas fixas (concluídas/puladas) - não podem ser movidas */
  fixedParadas: Parada[];
  /** Paradas reordenáveis (pendentes) */
  reorderableParadas: Parada[];
  /** Lista atual para exibição na web (local ou original) */
  currentWebList: Parada[];
  /** Se a reordenação é permitida para este status de rota */
  canReorder: boolean;
  /** Se há mudanças pendentes */
  hasChanges: boolean;
  /** Por que o último movimento foi recusado (vínculo retirada -> entrega) */
  aviso: string | null;
  /**
   * Sobe a cada arrasto recusado. A lista nativa guarda a ordem arrastada, e
   * sem remontá-la ela continuaria mostrando uma ordem que não foi gravada.
   */
  resetToken: number;
  /** Move uma parada para cima na lista */
  moveUp: (index: number) => void;
  /** Move uma parada para baixo na lista */
  moveDown: (index: number) => void;
  /** Handler para drag-and-drop (mobile) */
  handleDragEnd: (data: Parada[]) => Promise<void>;
  /** Salva as alterações (web) */
  saveChanges: () => Promise<void>;
  /** Cancela as alterações (web) */
  cancelChanges: () => void;
}

export function useReorderState({
  paradas,
  onReorder,
  rotaStatus,
  onWebChangesChange,
}: UseReorderStateOptions): UseReorderStateReturn {
  // Estado local para reordenação na web (permite preview antes de salvar)
  const [webReorderList, setWebReorderList] = useState<Parada[] | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState(0);

  // Separar paradas fixas (concluídas/puladas) das reordenáveis
  const { fixedParadas, reorderableParadas } = useMemo(() => {
    // Filtrar apenas checkpoints (excluir base points)
    const checkpoints = paradas.filter((p) => p.is_checkpoint !== false);

    // Paradas fixas: concluídas, puladas ou em andamento.
    // em_andamento é a parada atual do motorista — não deve ser reordenável,
    // mas PRECISA entrar no array salvo: se ficar de fora, sua `ordem` no banco
    // colide com a renumeração das demais e o RPC reordenar_paradas falha com
    // duplicate key (UNIQUE rota_id, ordem).
    const fixed = checkpoints
      .filter(
        (p) =>
          p.status === 'concluida' ||
          p.status === 'pulada' ||
          p.status === 'em_andamento',
      )
      .sort((a, b) => a.ordem - b.ordem);

    // Paradas reordenáveis: pendentes
    const reorderable = checkpoints
      .filter((p) => p.status === 'pendente')
      .sort((a, b) => a.ordem - b.ordem);

    return { fixedParadas: fixed, reorderableParadas: reorderable };
  }, [paradas]);

  // Lista atual para web (local ou original)
  const currentWebList = webReorderList || reorderableParadas;

  // Verificar se a reordenação é permitida
  const canReorder = rotaStatus === 'pendente' || rotaStatus === 'em_andamento';

  // Notificar parent sobre mudanças
  useEffect(() => {
    onWebChangesChange?.(hasChanges);
  }, [hasChanges, onWebChangesChange]);

  // Resetar estado local quando paradas mudam externamente
  useEffect(() => {
    setWebReorderList(null);
    setHasChanges(false);
    setAviso(null);
  }, [paradas]);

  // A entrega não pode ir antes da retirada de que depende. Compara a ordem
  // inteira (fixas + reordenáveis) e só recusa violação NOVA: rota que já veio
  // quebrada continua editável, só não dá para piorar. Devolve true quando
  // recusou (e já avisou).
  const recusaPorVinculo = useCallback(
    (antes: Parada[], depois: Parada[]): boolean => {
      const violacao = primeiraViolacaoNova(
        [...fixedParadas, ...antes],
        [...fixedParadas, ...depois],
      );
      if (!violacao) {
        setAviso(null);
        return false;
      }
      setAviso(mensagemEntregaAntesDaRetirada(violacao));
      return true;
    },
    [fixedParadas],
  );

  // Handler de reordenação (mobile - drag-and-drop)
  const handleDragEnd = useCallback(
    async (data: Parada[]) => {
      if (!canReorder) return;

      if (recusaPorVinculo(currentWebList, data)) {
        setResetToken((t) => t + 1);
        return;
      }

      // Recalcular ordem considerando as paradas fixas
      const newOrder = data.map((p, idx) => ({
        ...p,
        ordem: fixedParadas.length + idx + 1,
      }));

      await onReorder([...fixedParadas, ...newOrder]);
    },
    [canReorder, currentWebList, fixedParadas, onReorder, recusaPorVinculo],
  );

  // Move parada para cima
  const moveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      const list = [...currentWebList];
      [list[index - 1], list[index]] = [list[index], list[index - 1]];
      if (recusaPorVinculo(currentWebList, list)) return;
      setWebReorderList(list);
      setHasChanges(true);
    },
    [currentWebList, recusaPorVinculo],
  );

  // Move parada para baixo
  const moveDown = useCallback(
    (index: number) => {
      if (index >= currentWebList.length - 1) return;
      const list = [...currentWebList];
      [list[index], list[index + 1]] = [list[index + 1], list[index]];
      if (recusaPorVinculo(currentWebList, list)) return;
      setWebReorderList(list);
      setHasChanges(true);
    },
    [currentWebList, recusaPorVinculo],
  );

  // Salvar alterações da web
  const saveChanges = useCallback(async () => {
    if (!webReorderList || !hasChanges) return;

    const newOrder = webReorderList.map((p, idx) => ({
      ...p,
      ordem: fixedParadas.length + idx + 1,
    }));

    try {
      await onReorder([...fixedParadas, ...newOrder]);
      // Only clear state if save was successful
      setWebReorderList(null);
      setHasChanges(false);
    } catch (error) {
      // Error is handled by onReorder (handleReorderParadas)
      // Don't clear state so user can retry
      logger.error('[useReorderState] Error saving:', error);
    }
  }, [webReorderList, hasChanges, fixedParadas, onReorder]);

  // Cancelar alterações da web
  const cancelChanges = useCallback(() => {
    setWebReorderList(null);
    setHasChanges(false);
    setAviso(null);
  }, []);

  return {
    fixedParadas,
    reorderableParadas,
    currentWebList,
    canReorder,
    hasChanges,
    aviso,
    resetToken,
    moveUp,
    moveDown,
    handleDragEnd,
    saveChanges,
    cancelChanges,
  };
}
