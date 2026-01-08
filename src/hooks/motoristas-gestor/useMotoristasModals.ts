/**
 * Modal State Hook for Motoristas Management
 *
 * Handles modal visibility and related state.
 */

import { useState, useCallback } from 'react';

import type { MotoristaDetalhado } from '../useMotoristasGestor';

export interface UseMotoristasModalsReturn {
  // Modal visibility
  showAddModal: boolean;
  showEditModal: boolean;
  showConfirmModal: boolean;

  // Modal state
  motoristaEditando: MotoristaDetalhado | null;
  motoristaParaToggle: MotoristaDetalhado | null;

  // Setters
  setShowAddModal: (value: boolean) => void;
  setShowEditModal: (value: boolean) => void;
  setShowConfirmModal: (value: boolean) => void;
  setMotoristaEditando: (value: MotoristaDetalhado | null) => void;
  setMotoristaParaToggle: (value: MotoristaDetalhado | null) => void;

  // Actions
  openAddModal: () => void;
  openEditModal: (motorista: MotoristaDetalhado) => void;
  openConfirmModal: (motorista: MotoristaDetalhado) => void;
  closeAllModals: () => void;
}

interface UseMotoristasModalsOptions {
  onOpenAdd?: () => void;
  onOpenEdit?: (motorista: MotoristaDetalhado) => void;
}

export function useMotoristasModals(
  options: UseMotoristasModalsOptions = {}
): UseMotoristasModalsReturn {
  const { onOpenAdd, onOpenEdit } = options;

  // Modal visibility state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Modal data state
  const [motoristaEditando, setMotoristaEditando] = useState<MotoristaDetalhado | null>(null);
  const [motoristaParaToggle, setMotoristaParaToggle] = useState<MotoristaDetalhado | null>(null);

  // Open add modal
  const openAddModal = useCallback(() => {
    onOpenAdd?.();
    setShowAddModal(true);
  }, [onOpenAdd]);

  // Open edit modal with motorista data
  const openEditModal = useCallback(
    (motorista: MotoristaDetalhado) => {
      setMotoristaEditando(motorista);
      onOpenEdit?.(motorista);
      setShowEditModal(true);
    },
    [onOpenEdit]
  );

  // Open confirm modal for toggle
  const openConfirmModal = useCallback((motorista: MotoristaDetalhado) => {
    setMotoristaParaToggle(motorista);
    setShowConfirmModal(true);
  }, []);

  // Close all modals and reset state
  const closeAllModals = useCallback(() => {
    setShowAddModal(false);
    setShowEditModal(false);
    setShowConfirmModal(false);
    setMotoristaEditando(null);
    setMotoristaParaToggle(null);
  }, []);

  return {
    // Modal visibility
    showAddModal,
    showEditModal,
    showConfirmModal,

    // Modal state
    motoristaEditando,
    motoristaParaToggle,

    // Setters
    setShowAddModal,
    setShowEditModal,
    setShowConfirmModal,
    setMotoristaEditando,
    setMotoristaParaToggle,

    // Actions
    openAddModal,
    openEditModal,
    openConfirmModal,
    closeAllModals,
  };
}
