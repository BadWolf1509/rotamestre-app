/**
 * Hook para gerenciamento de motoristas (tela do Gestor)
 * Extrai state e callbacks para melhor manutenibilidade
 */

import { useCallback, useEffect, useState } from 'react';

import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import {
  maskPhone,
  validatePhone,
  getPhoneErrorMessage,
} from '@/utils/phoneValidation';

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

type VinculacaoComUsuario = {
  usuario_id: string;
  usuarios: MotoristaDetalhado | null;
};

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
  toastState: ReturnType<typeof useToast>['toast'];
  hideToast: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useMotoristasGestor(): UseMotoristasGestorReturn {
  const { userData } = useUser();
  const { unidadeAtiva } = useUnidadeAtiva();
  const { toast: toastState, showToast, hideToast, withToast } = useToast();

  // Data state
  const [motoristas, setMotoristas] = useState<MotoristaDetalhado[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [motoristaEditando, setMotoristaEditando] =
    useState<MotoristaDetalhado | null>(null);
  const [motoristaParaToggle, setMotoristaParaToggle] =
    useState<MotoristaDetalhado | null>(null);

  // Form state
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formSenha, setFormSenha] = useState('');

  // Validation state
  const [emailError, setEmailError] = useState('');
  const [telefoneError, setTelefoneError] = useState('');

  // Computed
  const totalMotoristas = motoristas.length;
  const ativosMotoristas = motoristas.filter((m) => m.ativo).length;

  // ============================================================================
  // Load motoristas
  // ============================================================================

  const loadMotoristas = useCallback(async () => {
    if (!unidadeAtiva) return;

    try {
      setLoading(true);

      const { data: vinculacoesData, error: vinculacoesError } = await supabase
        .from('usuario_unidades')
        .select(
          `
          usuario_id,
          usuarios (
            id, nome, email, telefone, foto_url, ativo, created_at
          )
        `
        )
        .eq('unidade_id', unidadeAtiva)
        .eq('papel', 'motorista')
        .eq('ativo', true)
        .returns<VinculacaoComUsuario[]>();

      if (vinculacoesError) throw vinculacoesError;

      const motoristasData = vinculacoesData
        ?.map((v) => v.usuarios)
        .filter((u): u is MotoristaDetalhado => u !== null)
        .sort((a, b) => a.nome.localeCompare(b.nome));

      setMotoristas(motoristasData || []);
    } catch (error) {
      logger.error('[Motoristas] Erro ao carregar motoristas', error);
      showToast('Não foi possível carregar os motoristas', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, unidadeAtiva]);

  useEffect(() => {
    loadMotoristas();
  }, [loadMotoristas]);

  // ============================================================================
  // Form helpers
  // ============================================================================

  function resetFormulario() {
    setFormNome('');
    setFormEmail('');
    setFormTelefone('');
    setFormSenha('');
    setEmailError('');
    setTelefoneError('');
  }

  function validateEmailField(email: string): boolean {
    setEmailError('');
    if (!email.trim()) return true;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setEmailError('Digite um email válido');
      return false;
    }
    return true;
  }

  function handleTelefoneChange(text: string) {
    const formatted = maskPhone(text);
    setFormTelefone(formatted);

    if (text.length > 0) {
      const error = getPhoneErrorMessage(formatted);
      setTelefoneError(error || '');
    } else {
      setTelefoneError('');
    }
  }

  // ============================================================================
  // Modal controls
  // ============================================================================

  function abrirModalAdicionar() {
    resetFormulario();
    setShowAddModal(true);
  }

  function abrirModalEditar(motorista: MotoristaDetalhado) {
    setMotoristaEditando(motorista);
    setFormNome(motorista.nome);
    setFormEmail(motorista.email);
    setFormTelefone(motorista.telefone || '');
    setEmailError('');
    setTelefoneError('');
    setShowEditModal(true);
  }

  // ============================================================================
  // CRUD operations
  // ============================================================================

  async function adicionarMotorista() {
    // Validate required fields
    if (!formNome.trim() || !formEmail.trim() || !formSenha.trim()) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formEmail.trim())) {
      showToast('Digite um email válido', 'error');
      return;
    }

    // Validate phone if filled
    if (formTelefone && !validatePhone(formTelefone)) {
      showToast('Telefone inválido', 'error');
      return;
    }

    setSalvando(true);
    try {
      logger.info('[Motoristas] Iniciando criação de motorista...');

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        logger.error('[Motoristas] Erro ao obter sessão', sessionError);
        showToast(
          `Erro ao obter sessão: ${sessionError.message}. Faça logout e login novamente.`,
          'error'
        );
        return;
      }

      if (!session) {
        logger.error('[Motoristas] Sessão não encontrada');
        showToast(
          'Sua sessão expirou. Por favor, faça login novamente.',
          'error'
        );
        return;
      }

      logger.debug('[Motoristas] Sessão obtida', { email: session.user.email });

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/criar-motorista`;

      logger.debug('[Motoristas] Chamando Edge Function', { functionUrl });

      let response;
      try {
        response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            nome: formNome.trim(),
            email: formEmail.trim(),
            senha: formSenha.trim(),
            telefone: formTelefone.trim() || null,
          }),
        });
      } catch (fetchError: any) {
        logger.error('[Motoristas] Erro de rede', fetchError);
        showToast(
          `Erro de conexão: ${fetchError.message}. Verifique se a função foi deployada.`,
          'error'
        );
        return;
      }

      logger.debug('[Motoristas] Response status', { status: response.status });

      let result;
      try {
        const responseText = await response.text();
        logger.debug('[Motoristas] Response text', { responseText });
        result = responseText ? JSON.parse(responseText) : {};
      } catch (parseError: any) {
        logger.error('[Motoristas] Erro ao parsear resposta', parseError);
        showToast(
          'A Edge Function retornou uma resposta inválida. Função não deployada corretamente.',
          'error'
        );
        return;
      }

      if (!response.ok) {
        logger.error('[Motoristas] Resposta com erro', result);
        showToast(result.error || 'Erro desconhecido', 'error');
        return;
      }

      logger.info('[Motoristas] Motorista criado', result);

      // Create log
      logger.debug('[Motoristas] Criando log...');
      const { error: logError } = await supabase.from('logs').insert({
        usuario_id: userData!.id,
        evento: 'motorista_criado',
        detalhes: {
          motorista_nome: formNome.trim(),
          motorista_email: formEmail.trim(),
        },
      });

      if (logError) {
        logger.warn('[Motoristas] Erro ao criar log (não crítico)', logError);
      }

      logger.info('[Motoristas] Processo concluído com sucesso!');
      showToast('Motorista adicionado com sucesso!', 'success');
      setShowAddModal(false);
      loadMotoristas();
    } catch (error: any) {
      logger.error('[Motoristas] Erro inesperado ao adicionar motorista', error);
      showToast(
        error.message || 'Não foi possível adicionar o motorista',
        'error'
      );
    } finally {
      setSalvando(false);
    }
  }

  async function editarMotorista() {
    if (!formNome.trim() || !formEmail.trim()) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formEmail.trim())) {
      showToast('Digite um email válido', 'error');
      return;
    }

    if (formTelefone && !validatePhone(formTelefone)) {
      showToast('Telefone inválido', 'error');
      return;
    }

    setSalvando(true);
    try {
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({
          nome: formNome.trim(),
          email: formEmail.trim(),
          telefone: formTelefone.trim() || null,
        })
        .eq('id', motoristaEditando!.id);

      if (updateError) throw updateError;

      await supabase.from('logs').insert({
        usuario_id: userData!.id,
        evento: 'motorista_editado',
        detalhes: {
          motorista_id: motoristaEditando!.id,
          motorista_nome: formNome.trim(),
        },
      });

      showToast('Motorista atualizado com sucesso!', 'success');
      setShowEditModal(false);
      setMotoristaEditando(null);
      loadMotoristas();
    } catch (error: any) {
      logger.error('[Motoristas] Erro ao editar motorista', error);
      showToast(
        error.message || 'Não foi possível editar o motorista',
        'error'
      );
    } finally {
      setSalvando(false);
    }
  }

  function toggleAtivo(motorista: MotoristaDetalhado) {
    setMotoristaParaToggle(motorista);
    setShowConfirmModal(true);
  }

  async function confirmarToggleAtivo() {
    if (!motoristaParaToggle) return;

    const motorista = motoristaParaToggle;
    const novoStatus = !motorista.ativo;

    setShowConfirmModal(false);
    setMotoristaParaToggle(null);

    try {
      await withToast(
        async () => {
          const { error } = await supabase
            .from('usuarios')
            .update({ ativo: novoStatus })
            .eq('id', motorista.id);

          if (error) throw error;

          await supabase.from('logs').insert({
            usuario_id: userData!.id,
            evento: novoStatus ? 'motorista_ativado' : 'motorista_desativado',
            detalhes: {
              motorista_id: motorista.id,
              motorista_nome: motorista.nome,
            },
          });
        },
        {
          loading: `${novoStatus ? 'Ativando' : 'Desativando'} motorista...`,
          success: `Motorista ${novoStatus ? 'ativado' : 'desativado'} com sucesso!`,
          error: 'Não foi possível alterar o status do motorista',
        }
      );
      loadMotoristas();
    } catch (error: any) {
      logger.error('[Motoristas] Erro ao alterar status', error);
    }
  }

  return {
    // State
    motoristas,
    loading,
    salvando,
    totalMotoristas,
    ativosMotoristas,

    // Modal state
    showAddModal,
    showEditModal,
    showConfirmModal,
    motoristaEditando,
    motoristaParaToggle,

    // Form state
    formNome,
    formEmail,
    formTelefone,
    formSenha,
    emailError,
    telefoneError,

    // Form setters
    setFormNome,
    setFormEmail,
    setFormTelefone,
    setFormSenha,

    // Modal controls
    setShowAddModal,
    setShowEditModal,
    setShowConfirmModal,
    setMotoristaEditando,
    setMotoristaParaToggle,

    // Actions
    loadMotoristas,
    abrirModalAdicionar,
    abrirModalEditar,
    adicionarMotorista,
    editarMotorista,
    toggleAtivo,
    confirmarToggleAtivo,
    resetFormulario,

    // Validation
    validateEmail: validateEmailField,
    handleTelefoneChange,

    // Toast
    toastState,
    hideToast,
  };
}
