/**
 * Hook para gerenciamento de motoristas (tela do Gestor)
 *
 * Composes sub-hooks for better maintainability:
 * - useMotoristasForm: Form state and validation
 * - useMotoristasModals: Modal visibility state
 * - useMotoristasOperations: Data loading and CRUD operations
 */

import { useCallback } from 'react';

import {
  useMotoristasForm,
  useMotoristasModals,
  useMotoristasOperations,
} from './motoristas-gestor';

// ============================================================================
// Types
// ============================================================================

export interface MotoristaDetalhado {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  foto_url?: string;
  ativo: boolean;
  created_at: string;
}

export interface UseMotoristasGestorReturn {
  // State
  motoristas: MotoristaDetalhado[];
  loading: boolean;
  salvando: boolean;
  totalMotoristas: number;
  ativosMotoristas: number;

  // Modal state
  showAddModal: boolean;
  showEditModal: boolean;
  showConfirmModal: boolean;
  motoristaEditando: MotoristaDetalhado | null;
  motoristaParaToggle: MotoristaDetalhado | null;

  // Form state
  formNome: string;
  formEmail: string;
  formTelefone: string;
  formSenha: string;
  emailError: string;
  telefoneError: string;

  // Form setters
  setFormNome: (value: string) => void;
  setFormEmail: (value: string) => void;
  setFormTelefone: (value: string) => void;
  setFormSenha: (value: string) => void;

  // Modal controls
  setShowAddModal: (value: boolean) => void;
  setShowEditModal: (value: boolean) => void;
  setShowConfirmModal: (value: boolean) => void;
  setMotoristaEditando: (value: MotoristaDetalhado | null) => void;
  setMotoristaParaToggle: (value: MotoristaDetalhado | null) => void;

  // Actions
  loadMotoristas: () => Promise<void>;
  abrirModalAdicionar: () => void;
  abrirModalEditar: (motorista: MotoristaDetalhado) => void;
  adicionarMotorista: () => Promise<void>;
  editarMotorista: () => Promise<void>;
  toggleAtivo: (motorista: MotoristaDetalhado) => void;
  confirmarToggleAtivo: () => Promise<void>;
  resetFormulario: () => void;

  // Validation
  validateEmail: (email: string) => boolean;
  handleTelefoneChange: (text: string) => void;

  // Toast
  toastState: ReturnType<typeof useMotoristasOperations>['toastState'];
  hideToast: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useMotoristasGestor(): UseMotoristasGestorReturn {
  // Compose sub-hooks
  const form = useMotoristasForm();
  const modals = useMotoristasModals({
    onOpenAdd: form.resetFormulario,
    onOpenEdit: (motorista) => form.prefillForm(motorista),
  });
  const operations = useMotoristasOperations();

  // ============================================================================
  // Coordinated actions
  // ============================================================================

  const abrirModalAdicionar = useCallback(() => {
    modals.openAddModal();
  }, [modals]);

  const abrirModalEditar = useCallback(
    (motorista: MotoristaDetalhado) => {
      modals.openEditModal(motorista);
    },
    [modals]
  );

  const adicionarMotorista = useCallback(async () => {
    await operations.adicionarMotorista(
      {
        nome: form.formNome,
        email: form.formEmail,
        telefone: form.formTelefone,
        senha: form.formSenha,
      },
      () => {
        modals.setShowAddModal(false);
        form.resetFormulario();
      }
    );
  }, [form, modals, operations]);

  const editarMotorista = useCallback(async () => {
    if (!modals.motoristaEditando) return;

    await operations.editarMotorista(
      {
        nome: form.formNome,
        email: form.formEmail,
        telefone: form.formTelefone,
        senha: form.formSenha,
      },
      modals.motoristaEditando.id,
      () => {
        modals.setShowEditModal(false);
        modals.setMotoristaEditando(null);
        form.resetFormulario();
      }
    );
  }, [form, modals, operations]);

  const toggleAtivo = useCallback(
    (motorista: MotoristaDetalhado) => {
      modals.openConfirmModal(motorista);
    },
    [modals]
  );

  const confirmarToggleAtivo = useCallback(async () => {
    if (!modals.motoristaParaToggle) return;

    const motorista = modals.motoristaParaToggle;
    modals.setShowConfirmModal(false);
    modals.setMotoristaParaToggle(null);

    await operations.confirmarToggleAtivo(motorista, () => {
      // Success callback - already handled by operations
    });
  }, [modals, operations]);

  return {
    // State from operations
    motoristas: operations.motoristas,
    loading: operations.loading,
    salvando: operations.salvando,
    totalMotoristas: operations.totalMotoristas,
    ativosMotoristas: operations.ativosMotoristas,

    // Modal state
    showAddModal: modals.showAddModal,
    showEditModal: modals.showEditModal,
    showConfirmModal: modals.showConfirmModal,
    motoristaEditando: modals.motoristaEditando,
    motoristaParaToggle: modals.motoristaParaToggle,

    // Form state
    formNome: form.formNome,
    formEmail: form.formEmail,
    formTelefone: form.formTelefone,
    formSenha: form.formSenha,
    emailError: form.emailError,
    telefoneError: form.telefoneError,

    // Form setters
    setFormNome: form.setFormNome,
    setFormEmail: form.setFormEmail,
    setFormTelefone: form.setFormTelefone,
    setFormSenha: form.setFormSenha,

    // Modal controls
    setShowAddModal: modals.setShowAddModal,
    setShowEditModal: modals.setShowEditModal,
    setShowConfirmModal: modals.setShowConfirmModal,
    setMotoristaEditando: modals.setMotoristaEditando,
    setMotoristaParaToggle: modals.setMotoristaParaToggle,

    // Actions
    loadMotoristas: operations.loadMotoristas,
    abrirModalAdicionar,
    abrirModalEditar,
    adicionarMotorista,
    editarMotorista,
    toggleAtivo,
    confirmarToggleAtivo,
    resetFormulario: form.resetFormulario,

    // Validation
    validateEmail: form.validateEmail,
    handleTelefoneChange: form.handleTelefoneChange,

    // Toast
    toastState: operations.toastState,
    hideToast: operations.hideToast,
  };
}
