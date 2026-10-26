/**
 * Hook para gerenciamento de motoristas (tela do Gestor)
 *
 * Composes sub-hooks for better maintainability:
 * - useMotoristasForm: formulários de criar/editar (useForm + Zod)
 * - useMotoristasModals: Modal visibility state
 * - useMotoristasOperations: Data loading and CRUD operations
 */

import { useCallback } from 'react';

import {
  useMotoristasForm,
  useMotoristasModals,
  useMotoristasOperations,
} from './motoristas-gestor';

import type { UseMotoristasFormReturn } from './motoristas-gestor';

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
  /**
   * Vínculo com a loja ativa. `false` só para quem atende outra loja e foi
   * desativado nesta: a RLS de usuarios o esconde, então perfil e edição não
   * abrem (só reativar). Ausente fora da lista de listar_motoristas_unidade.
   */
  vinculo_ativo?: boolean;
}

const MSG_VINCULO_INATIVO =
  'Este motorista está desativado nesta loja. Ative-o para ver o perfil ou editar.';

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

  /** Formulário de criação: a tela liga os campos por Controller. */
  formCriar: UseMotoristasFormReturn['formCriar'];
  /** Formulário de edição (nome e telefone). */
  formEditar: UseMotoristasFormReturn['formEditar'];

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
  /** Avisa e devolve true quando o vínculo desta loja está inativo. */
  avisarSeVinculoInativo: (motorista: MotoristaDetalhado) => boolean;
  /** Valida pelo schema (erro no campo) e, válido, cria. */
  adicionarMotorista: () => Promise<void>;
  /** Valida pelo schema (erro no campo) e, válido, salva. */
  editarMotorista: () => Promise<void>;
  toggleAtivo: (motorista: MotoristaDetalhado) => void;
  confirmarToggleAtivo: () => Promise<void>;
  resetFormulario: () => void;

  /** Desativação recusada por rota aberta: a tela mostra as rotas. */
  bloqueioDesativacao: ReturnType<
    typeof useMotoristasOperations
  >['bloqueioDesativacao'];
  fecharBloqueioDesativacao: () => void;

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

  const { showToast } = operations;
  const avisarSeVinculoInativo = useCallback(
    (motorista: MotoristaDetalhado) => {
      if (motorista.vinculo_ativo !== false) return false;
      showToast(MSG_VINCULO_INATIVO, 'info');
      return true;
    },
    [showToast],
  );

  const abrirModalEditar = useCallback(
    (motorista: MotoristaDetalhado) => {
      if (avisarSeVinculoInativo(motorista)) return;
      modals.openEditModal(motorista);
    },
    [avisarSeVinculoInativo, modals],
  );

  // handleSubmit: inválido não chega em operations — o erro fica no campo.
  const adicionarMotorista = useCallback(
    () =>
      form.formCriar.handleSubmit((valores) =>
        operations.adicionarMotorista(valores, () => {
          modals.setShowAddModal(false);
          form.resetFormulario();
        }),
      )(),
    [form, modals, operations],
  );

  const editarMotorista = useCallback(async () => {
    const editando = modals.motoristaEditando;
    if (!editando) return;

    await form.formEditar.handleSubmit((valores) =>
      operations.editarMotorista(valores, editando.id, () => {
        modals.setShowEditModal(false);
        modals.setMotoristaEditando(null);
        form.resetFormulario();
      }),
    )();
  }, [form, modals, operations]);

  const toggleAtivo = useCallback(
    (motorista: MotoristaDetalhado) => {
      modals.openConfirmModal(motorista);
    },
    [modals],
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

    // Formulários
    formCriar: form.formCriar,
    formEditar: form.formEditar,

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
    avisarSeVinculoInativo,
    adicionarMotorista,
    editarMotorista,
    toggleAtivo,
    confirmarToggleAtivo,
    resetFormulario: form.resetFormulario,
    bloqueioDesativacao: operations.bloqueioDesativacao,
    fecharBloqueioDesativacao: operations.fecharBloqueioDesativacao,

    // Toast
    toastState: operations.toastState,
    hideToast: operations.hideToast,
  };
}
