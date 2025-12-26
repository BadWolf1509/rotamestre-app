/**
 * DraggableStopList - Lista de paradas com reordenação
 *
 * Componente orquestrador que coordena os subcomponentes:
 * - useReorderState: Hook para gerenciamento de estado
 * - Instructions: Instruções contextuais (web/mobile)
 * - FixedStopsList: Paradas concluídas/puladas
 * - ReorderableList: Paradas pendentes (web: setas, mobile: drag)
 * - EmptyState: Estados vazios/bloqueados
 * - LoadingOverlay: Feedback de salvamento
 *
 * @example
 * <DraggableStopList
 *   paradas={paradas}
 *   onReorder={handleReorder}
 *   rotaStatus="pendente"
 *   controlRef={controlRef}
 * />
 */

import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, type Theme } from '@/utils/styles';

import type { Parada } from '../types';

import { EmptyState } from './EmptyState';
import { FixedStopsList } from './FixedStopsList';
import { Instructions } from './Instructions';
import { LoadingOverlay } from './LoadingOverlay';
import { ReorderableList } from './ReorderableList';
import { useReorderState } from './useReorderState';

/** Interface de controle exposta via ref */
export interface DraggableStopListControl {
  saveChanges: () => Promise<void>;
  cancelChanges: () => void;
  hasChanges: boolean;
}

export interface DraggableStopListProps {
  paradas: Parada[];
  onReorder: (newOrder: Parada[]) => Promise<void>;
  rotaStatus: string;
  isLoading?: boolean;
  /** Callback chamado quando há mudanças pendentes na web */
  onWebChangesChange?: (hasChanges: boolean) => void;
  /** Ref para expor métodos de controle (save/cancel) */
  controlRef?: React.MutableRefObject<DraggableStopListControl | null>;
}

export function DraggableStopList({
  paradas,
  onReorder,
  rotaStatus,
  isLoading = false,
  onWebChangesChange,
  controlRef,
}: DraggableStopListProps) {
  const { isDesktop } = useResponsive();

  // Hook centralizado para gerenciamento de estado
  const {
    fixedParadas,
    reorderableParadas,
    currentWebList,
    canReorder,
    hasChanges,
    moveUp,
    moveDown,
    handleDragEnd,
    saveChanges,
    cancelChanges,
  } = useReorderState({
    paradas,
    onReorder,
    rotaStatus,
    onWebChangesChange,
  });

  // Expor controles via ref
  useEffect(() => {
    if (controlRef) {
      controlRef.current = {
        saveChanges,
        cancelChanges,
        hasChanges,
      };
    }
  }, [controlRef, saveChanges, cancelChanges, hasChanges]);

  // Estado: Rota não pode ser reordenada
  if (!canReorder) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <EmptyState variant="locked" />
      </GestureHandlerRootView>
    );
  }

  // Estado: Sem paradas
  if (reorderableParadas.length === 0 && fixedParadas.length === 0) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <EmptyState variant="empty" />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Loading overlay */}
      <LoadingOverlay visible={isLoading} />

      {/* Instruções */}
      <Instructions isDesktop={isDesktop} />

      {/* Paradas fixas (concluídas/puladas) */}
      <FixedStopsList paradas={fixedParadas} isDesktop={isDesktop} />

      {/* Paradas reordenáveis */}
      <ReorderableList
        paradas={currentWebList}
        orderOffset={fixedParadas.length}
        onMoveUp={moveUp}
        onMoveDown={moveDown}
        onDragEnd={handleDragEnd}
        isDesktop={isDesktop}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
}));
