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

const COMO_SAIU: Record<string, string> = {
  em_andamento: 'iniciada',
  concluida: 'concluída',
  pulada: 'pulada',
};

/** Avisa que o motorista mexeu numa parada do preview enquanto o gestor editava. */
function mensagemSaiuDoPreview(paradas: Parada[]): string {
  const quais = paradas
    .map((p) => {
      const nome = p.endereco?.trim() || 'sem endereço';
      return `${nome} (${COMO_SAIU[p.status] ?? p.status})`;
    })
    .join(', ');
  const plural = paradas.length > 1;
  return (
    `O motorista atualizou ${plural ? 'as paradas' : 'a parada'} ${quais}, ` +
    `que ${plural ? 'ficaram fixas' : 'ficou fixa'}. O resto da sua ordem foi mantido; confira antes de salvar.`
  );
}

export function useReorderState({
  paradas,
  onReorder,
  rotaStatus,
  onWebChangesChange,
}: UseReorderStateOptions): UseReorderStateReturn {
  // Preview da reordenação na web (antes de salvar): guarda só a ORDEM dos
  // ids. A lista mostrada é derivada das paradas frescas a cada render, porque
  // a tela grava um array novo a cada evento do realtime — um reset por
  // identidade do array jogava fora a ordem que o gestor acabou de montar.
  const [ordemLocal, setOrdemLocal] = useState<string[] | null>(null);
  const [avisoVinculo, setAviso] = useState<string | null>(null);
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

  // Lista atual para web: a ordem do gestor aplicada às pendentes de agora.
  // Parada que deixou de ser pendente (o motorista iniciou, concluiu ou pulou)
  // sai do preview e passa às fixas pelo split acima; pendente que não estava
  // no preview entra no fim. O resto da ordem do gestor fica.
  const { currentWebList, sairamDoPreview } = useMemo(() => {
    if (!ordemLocal) {
      return { currentWebList: reorderableParadas, sairamDoPreview: [] };
    }
    const pendentes = new Map(reorderableParadas.map((p) => [p.id, p]));
    const naOrdem = ordemLocal.flatMap((id) => {
      const parada = pendentes.get(id);
      return parada ? [parada] : [];
    });
    const novas = reorderableParadas.filter((p) => !ordemLocal.includes(p.id));
    const fixasPorId = new Map(fixedParadas.map((p) => [p.id, p]));
    const sairam = ordemLocal.flatMap((id) => {
      const parada = fixasPorId.get(id);
      return parada ? [parada] : [];
    });
    return { currentWebList: [...naOrdem, ...novas], sairamDoPreview: sairam };
  }, [ordemLocal, reorderableParadas, fixedParadas]);

  // Mudança pendente = a ordem mostrada difere da gravada.
  const hasChanges =
    ordemLocal !== null &&
    currentWebList.some((p, i) => p.id !== reorderableParadas[i]?.id);

  const aviso =
    avisoVinculo ??
    (sairamDoPreview.length > 0
      ? mensagemSaiuDoPreview(sairamDoPreview)
      : null);

  // Verificar se a reordenação é permitida
  const canReorder = rotaStatus === 'pendente' || rotaStatus === 'em_andamento';

  // Notificar parent sobre mudanças
  useEffect(() => {
    onWebChangesChange?.(hasChanges);
  }, [hasChanges, onWebChangesChange]);

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
      setOrdemLocal(list.map((p) => p.id));
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
      setOrdemLocal(list.map((p) => p.id));
    },
    [currentWebList, recusaPorVinculo],
  );

  // Salvar alterações da web
  const saveChanges = useCallback(async () => {
    if (!ordemLocal || !hasChanges) return;

    const newOrder = currentWebList.map((p, idx) => ({
      ...p,
      ordem: fixedParadas.length + idx + 1,
    }));

    try {
      await onReorder([...fixedParadas, ...newOrder]);
      // Only clear state if save was successful
      setOrdemLocal(null);
      setAviso(null);
    } catch (error) {
      // Error is handled by onReorder (handleReorderParadas)
      // Don't clear state so user can retry
      logger.error('[useReorderState] Error saving:', error);
    }
  }, [ordemLocal, hasChanges, currentWebList, fixedParadas, onReorder]);

  // Cancelar alterações da web
  const cancelChanges = useCallback(() => {
    setOrdemLocal(null);
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
