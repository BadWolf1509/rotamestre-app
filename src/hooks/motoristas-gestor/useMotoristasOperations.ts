/**
 * Data Operations Hook for Motoristas Management
 *
 * Handles loading motoristas and CRUD operations.
 */

import { useCallback, useEffect, useState } from 'react';

import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { getErrorMessage } from '@/lib/errorMapping';
import { logger } from '@/lib/logger';
import { mensagemRegraDoBanco } from '@/lib/motorista/mensagemRegraDoBanco';
import { validatePhone } from '@/lib/phone';
import { updateUsuario, logUserAction } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

import type { MotoristaDetalhado } from '../useMotoristasGestor';

const INDICE_TELEFONE_MOTORISTA = 'usuarios_motorista_telefone_unico';

/**
 * Se o erro é a colisão do índice único de telefone entre motoristas ativos,
 * devolve a mensagem amigável do errorMapping; senão, null (quem chama mantém
 * o comportamento de sempre). Aceita o Error relançado e o erro do Postgres.
 */
function mensagemTelefoneDuplicado(error: unknown): string | null {
  const texto =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : '';
  if (!texto.includes(INDICE_TELEFONE_MOTORISTA)) return null;
  return getErrorMessage(error).message;
}

interface FormData {
  nome: string;
  email: string;
  telefone: string;
  senha: string;
}

export interface UseMotoristasOperationsReturn {
  // Data state
  motoristas: MotoristaDetalhado[];
  loading: boolean;
  salvando: boolean;
  totalMotoristas: number;
  ativosMotoristas: number;

  // Actions
  loadMotoristas: () => Promise<void>;
  adicionarMotorista: (
    formData: FormData,
    onSuccess: () => void,
  ) => Promise<void>;
  editarMotorista: (
    formData: FormData,
    motoristaId: string,
    onSuccess: () => void,
  ) => Promise<void>;
  confirmarToggleAtivo: (
    motorista: MotoristaDetalhado,
    onSuccess: () => void,
  ) => Promise<void>;

  // Toast
  toastState: ReturnType<typeof useToast>['toast'];
  showToast: ReturnType<typeof useToast>['showToast'];
  hideToast: () => void;
}

export function useMotoristasOperations(): UseMotoristasOperationsReturn {
  const { userData } = useUser();
  const { unidadeAtiva } = useUnidadeAtiva();
  const { toast: toastState, showToast, hideToast, withToast } = useToast();

  // Data state
  const [motoristas, setMotoristas] = useState<MotoristaDetalhado[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

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

      // RPC e não select em usuario_unidades: o vínculo INATIVO desta loja
      // (motorista que atende outra loja e foi desativado só aqui) precisa
      // aparecer para ser reativado, e a RLS de usuarios o esconde.
      const { data, error: listaError } = await supabase.rpc(
        'listar_motoristas_unidade',
        { p_unidade_id: unidadeAtiva },
      );

      if (listaError) throw listaError;

      // Sem tipos gerados: a RPC devolve exatamente as colunas de MotoristaDetalhado
      const lista: MotoristaDetalhado[] = data ?? [];
      const motoristasData = [...lista].sort((a, b) =>
        a.nome.localeCompare(b.nome),
      );

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
  // Add motorista
  // ============================================================================

  const adicionarMotorista = useCallback(
    async (formData: FormData, onSuccess: () => void) => {
      const { nome, email, telefone, senha } = formData;

      // Validate required fields
      if (!nome.trim() || !email.trim() || !senha.trim()) {
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        showToast('Digite um email válido', 'error');
        return;
      }

      // Validate phone if filled
      if (telefone && !validatePhone(telefone)) {
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
            'error',
          );
          return;
        }

        if (!session) {
          logger.error('[Motoristas] Sessão não encontrada');
          showToast(
            'Sua sessão expirou. Por favor, faça login novamente.',
            'error',
          );
          return;
        }

        logger.debug('[Motoristas] Sessão obtida', {
          email: session.user.email,
        });

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
              nome: nome.trim(),
              email: email.trim(),
              senha: senha.trim(),
              telefone: telefone.trim() || null,
              unidade_id: unidadeAtiva,
            }),
          });
        } catch (fetchError: any) {
          logger.error('[Motoristas] Erro de rede', fetchError);
          showToast(
            `Erro de conexão: ${fetchError.message}. Verifique se a função foi deployada.`,
            'error',
          );
          return;
        }

        logger.debug('[Motoristas] Response status', {
          status: response.status,
        });

        let result;
        try {
          const responseText = await response.text();
          logger.debug('[Motoristas] Response text', { responseText });
          result = responseText ? JSON.parse(responseText) : {};
        } catch (parseError: any) {
          logger.error('[Motoristas] Erro ao parsear resposta', parseError);
          showToast(
            'A Edge Function retornou uma resposta inválida. Função não deployada corretamente.',
            'error',
          );
          return;
        }

        if (!response.ok) {
          logger.error('[Motoristas] Resposta com erro', result);
          showToast(result.error || 'Erro desconhecido', 'error');
          return;
        }

        logger.info('[Motoristas] Motorista criado', result);

        // Create log using centralized logging
        if (userData) {
          logger.debug('[Motoristas] Criando log...');
          logUserAction(userData.id, 'motorista_criado', {
            motorista_nome: nome.trim(),
            motorista_email: email.trim(),
          });
        }

        logger.info('[Motoristas] Processo concluído com sucesso!');
        showToast('Motorista adicionado com sucesso!', 'success');
        onSuccess();
        loadMotoristas();
      } catch (error: unknown) {
        logger.error(
          '[Motoristas] Erro inesperado ao adicionar motorista',
          error,
        );
        let message = 'Não foi possível adicionar o motorista';
        if (error instanceof Error) {
          message = error.message;
        } else if (error && typeof error === 'object' && 'message' in error) {
          message = String(error.message);
        }
        showToast(message, 'error');
      } finally {
        setSalvando(false);
      }
    },
    [loadMotoristas, showToast, unidadeAtiva, userData],
  );

  // ============================================================================
  // Edit motorista
  // ============================================================================

  const editarMotorista = useCallback(
    async (formData: FormData, motoristaId: string, onSuccess: () => void) => {
      const { nome, email, telefone } = formData;

      if (!nome.trim() || !email.trim()) {
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        showToast('Digite um email válido', 'error');
        return;
      }

      if (telefone && !validatePhone(telefone)) {
        showToast('Telefone inválido', 'error');
        return;
      }

      setSalvando(true);
      try {
        // Use centralized query for update
        const result = await updateUsuario(motoristaId, {
          nome: nome.trim(),
          email: email.trim(),
          telefone: telefone.trim() || null,
        });

        if (!result.success) throw new Error(result.error.message);

        // Log action using centralized logging
        if (userData) {
          logUserAction(userData.id, 'motorista_editado', {
            motorista_id: motoristaId,
            motorista_nome: nome.trim(),
          });
        }

        showToast('Motorista atualizado com sucesso!', 'success');
        onSuccess();
        loadMotoristas();
      } catch (error: unknown) {
        logger.error('[Motoristas] Erro ao editar motorista', error);
        let message = 'Não foi possível editar o motorista';
        const telefoneDuplicado = mensagemTelefoneDuplicado(error);
        if (telefoneDuplicado) {
          message = telefoneDuplicado;
        } else if (error instanceof Error) {
          message = error.message;
        } else if (error && typeof error === 'object' && 'message' in error) {
          message = String(error.message);
        }
        showToast(message, 'error');
      } finally {
        setSalvando(false);
      }
    },
    [loadMotoristas, showToast, userData],
  );

  // ============================================================================
  // Toggle active status
  // ============================================================================

  const confirmarToggleAtivo = useCallback(
    async (motorista: MotoristaDetalhado, onSuccess: () => void) => {
      if (!unidadeAtiva) return;
      const novoStatus = !motorista.ativo;

      try {
        await withToast(
          async () => {
            // Quem atende outra loja é desativado só nesta (o vínculo); quem
            // atende uma só, a pessoa. A decisão é do banco.
            const { error } = await supabase.rpc(
              'alternar_motorista_na_unidade',
              {
                p_motorista_id: motorista.id,
                p_unidade_id: unidadeAtiva,
                p_ativo: novoStatus,
              },
            );
            if (error) throw error;

            // Log action using centralized logging
            if (userData) {
              logUserAction(
                userData.id,
                novoStatus ? 'motorista_ativado' : 'motorista_desativado',
                {
                  motorista_id: motorista.id,
                  motorista_nome: motorista.nome,
                },
              );
            }
          },
          {
            loading: `${novoStatus ? 'Ativando' : 'Desativando'} motorista...`,
            success: `Motorista ${novoStatus ? 'ativado' : 'desativado'} com sucesso!`,
            // No caso do telefone, o motivo é a informação útil (reativar
            // esbarra em outro motorista ativo); um toast só, sem piscar.
            error: (e) =>
              mensagemTelefoneDuplicado(e) ??
              mensagemRegraDoBanco(e) ??
              'Não foi possível alterar o status do motorista',
          },
        );
        onSuccess();
        loadMotoristas();
      } catch (error: unknown) {
        logger.error('[Motoristas] Erro ao alterar status', error);
        // withToast já mostrou o toast de erro.
      }
    },
    [loadMotoristas, unidadeAtiva, userData, withToast],
  );

  return {
    // Data state
    motoristas,
    loading,
    salvando,
    totalMotoristas,
    ativosMotoristas,

    // Actions
    loadMotoristas,
    adicionarMotorista,
    editarMotorista,
    confirmarToggleAtivo,

    // Toast
    toastState,
    showToast,
    hideToast,
  };
}
