import { useState, useCallback } from 'react';

/**
 * Hook para gerenciar estado de todos os modais da página MapaRota
 * Centraliza a lógica de abertura/fechamento de modais
 */
export function useMapaRotaModals() {
  // Modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [showChangeDriverModal, setShowChangeDriverModal] = useState(false);
  const [showRemoveStopModal, setShowRemoveStopModal] = useState(false);
  const [showEditStopModal, setShowEditStopModal] = useState(false);
  const [showAddStopModal, setShowAddStopModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [showReorderConfirmClose, setShowReorderConfirmClose] = useState(false);

  // Modal action handlers
  const openCancelModal = useCallback(() => setShowCancelModal(true), []);
  const closeCancelModal = useCallback(() => setShowCancelModal(false), []);

  const openReactivateModal = useCallback(() => setShowReactivateModal(true), []);
  const closeReactivateModal = useCallback(() => setShowReactivateModal(false), []);

  const openChangeDriverModal = useCallback(() => setShowChangeDriverModal(true), []);
  const closeChangeDriverModal = useCallback(() => setShowChangeDriverModal(false), []);

  const openRemoveStopModal = useCallback(() => setShowRemoveStopModal(true), []);
  const closeRemoveStopModal = useCallback(() => {
    setShowRemoveStopModal(false);
  }, []);

  const openEditStopModal = useCallback(() => setShowEditStopModal(true), []);
  const closeEditStopModal = useCallback(() => {
    setShowEditStopModal(false);
  }, []);

  const openAddStopModal = useCallback(() => setShowAddStopModal(true), []);
  const closeAddStopModal = useCallback(() => setShowAddStopModal(false), []);

  const openReorderModal = useCallback(() => setShowReorderModal(true), []);
  const closeReorderModal = useCallback(() => setShowReorderModal(false), []);

  const openReorderConfirmClose = useCallback(() => setShowReorderConfirmClose(true), []);
  const closeReorderConfirmClose = useCallback(() => setShowReorderConfirmClose(false), []);

  return {
    // Modal states
    showCancelModal,
    showReactivateModal,
    showChangeDriverModal,
    showRemoveStopModal,
    showEditStopModal,
    showAddStopModal,
    showReorderModal,
    showReorderConfirmClose,

    // Action handlers
    openCancelModal,
    closeCancelModal,
    openReactivateModal,
    closeReactivateModal,
    openChangeDriverModal,
    closeChangeDriverModal,
    openRemoveStopModal,
    closeRemoveStopModal,
    openEditStopModal,
    closeEditStopModal,
    openAddStopModal,
    closeAddStopModal,
    openReorderModal,
    closeReorderModal,
    openReorderConfirmClose,
    closeReorderConfirmClose,
  };
}

