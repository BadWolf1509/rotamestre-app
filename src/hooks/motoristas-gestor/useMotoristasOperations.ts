/**
 * Data Operations Hook for Motoristas Management
 *
 * Handles loading motoristas and CRUD operations.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { getErrorMessage, isNetworkError } from '@/lib/errorMapping';
import { logger } from '@/lib/logger';
import { mensagemRegraDoBanco } from '@/lib/motorista/mensagemRegraDoBanco';
import { updateUsuario, logUserAction } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

import {
  useBloqueioDesativacao,
  type BloqueioDesativacao,
} from './useBloqueioDesativacao';

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

const MSG_SEM_CONEXAO = 'Sem conexão. Tente de novo.';
const MSG_FALHA_CRIAR = 'Não foi possível criar o motorista. Tente de novo.';

/**
 * Falha ao criar motorista sem texto da Edge Function: rede (fetch do web,
 * "Network request failed" do nativo, FunctionsFetchError do supabase-js)
 * vira "Sem conexão"; o resto, a mensagem genérica. Nunca o texto técnico.
 */
function mensagemFalhaCriacao(error: unknown): string {
  // Hoje a criação usa fetch cru (não supabase.functions.invoke), então este
  // ramo não dispara; cobre a migração futura para invoke, cuja falha de
  // rede tem mensagem que o isNetworkError não reconhece.
  if (error instanceof Error && error.name === 'FunctionsFetchError') {
    return MSG_SEM_CONEXAO;
  }
  return isNetworkError(error) ? MSG_SEM_CONEXAO : MSG_FALHA_CRIAR;
}

/**
 * Dados já validados pelo formulário (`motoristaSchema`, em
 * useMotoristasForm): a validação mora no schema, com erro no campo, e não
 * se repete aqui por toast.
 */
interface DadosCriacao {
  nome: string;
  email: string;
  telefone?: string;
  senha: string;
}

/** Edição: só nome e telefone (`motoristaEdicaoSchema`). */
interface DadosEdicao {
  nome: string;
  telefone?: string;
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
    formData: DadosCriacao,
    onSuccess: () => void,
  ) => Promise<void>;
  editarMotorista: (
    formData: DadosEdicao,
    motoristaId: string,
    onSuccess: () => void,
  ) => Promise<void>;
  confirmarToggleAtivo: (
    motorista: MotoristaDetalhado,
    onSuccess: () => void,
  ) => Promise<void>;

  /** Desativação recusada por rota aberta (Migration 54): a tela lista as rotas. */
  bloqueioDesativacao: BloqueioDesativacao | null;
  fecharBloqueioDesativacao: () => void;

  // Toast
  toastState: ReturnType<typeof useToast>['toast'];
  showToast: ReturnType<typeof useToast>['showToast'];
  hideToast: () => void;
}

export function useMotoristasOperations(): UseMotoristasOperationsReturn {
  const { userData } = useUser();
  const { unidadeAtiva } = useUnidadeAtiva();
  const { toast: toastState, showToast, hideToast, withToast } = useToast();
  const { bloqueio, mostrarSeBloqueado, fecharBloqueio } =
    useBloqueioDesativacao();

  // Data state
  const [motoristas, setMotoristas] = useState<MotoristaDetalhado[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  // Contador de requisição: só a carga mais recente escreve (a resposta
  // atrasada da loja anterior não entra na lista da nova).
  const requisicaoRef = useRef(0);
  // Loja da última carga iniciada: se mudou, a lista na tela é da OUTRA loja.
  const lojaDaCargaRef = useRef<string | null>(null);

  // Computed
  const totalMotoristas = motoristas.length;
  const ativosMotoristas = motoristas.filter((m) => m.ativo).length;

  // ============================================================================
  // Load motoristas
  // ============================================================================

  const loadMotoristas = useCallback(async () => {
    if (!unidadeAtiva) {
      // Sem loja: a lista da anterior sai da tela e a carga dela em voo é
      // invalidada (o contador avança), senão chegaria depois e voltaria.
      ++requisicaoRef.current;
      lojaDaCargaRef.current = null;
      setMotoristas([]);
      setLoading(false);
      return;
    }

    const minha = ++requisicaoRef.current;
    const vigente = () => minha === requisicaoRef.current;

    // Loja trocada: os motoristas da anterior saem da tela antes da carga
    // (se ela falhar, a tela fica vazia + toast, nunca com a lista da outra).
    if (lojaDaCargaRef.current !== unidadeAtiva) {
      if (lojaDaCargaRef.current !== null) setMotoristas([]);
      lojaDaCargaRef.current = unidadeAtiva;
    }

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

      if (vigente()) setMotoristas(motoristasData || []);
    } catch (error) {
      logger.error('[Motoristas] Erro ao carregar motoristas', error);
      if (vigente()) {
        showToast('Não foi possível carregar os motoristas', 'error');
      }
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [showToast, unidadeAtiva]);

  useEffect(() => {
    loadMotoristas();
  }, [loadMotoristas]);

  // ============================================================================
  // Add motorista
  // ============================================================================

  const adicionarMotorista = useCallback(
    async (formData: DadosCriacao, onSuccess: () => void) => {
      const { nome, email, telefone, senha } = formData;

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
              telefone: telefone?.trim() || null,
              unidade_id: unidadeAtiva,
            }),
          });
        } catch (fetchError: unknown) {
          logger.error('[Motoristas] Erro de rede', fetchError);
          showToast(mensagemFalhaCriacao(fetchError), 'error');
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
        } catch (parseError: unknown) {
          logger.error('[Motoristas] Erro ao parsear resposta', parseError);
          showToast(MSG_FALHA_CRIAR, 'error');
          return;
        }

        if (!response.ok) {
          logger.error('[Motoristas] Resposta com erro', result);
          // O texto da função (409 de e-mail/telefone etc.) já é para o
          // gestor; sem ele, a genérica.
          showToast(result.error || MSG_FALHA_CRIAR, 'error');
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
        showToast(mensagemFalhaCriacao(error), 'error');
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
    async (
      formData: DadosEdicao,
      motoristaId: string,
      onSuccess: () => void,
    ) => {
      const { nome, telefone } = formData;

      // Toast nunca leva o texto cru do erro: só a colisão de telefone e a
      // regra do banco (P0001, já em português) têm frase própria. O erro
      // ORIGINAL do PostgREST é o que carrega o `code`; embrulhá-lo num
      // `new Error` (como antes) apagaria o P0001.
      const falhar = (error: unknown) => {
        logger.error('[Motoristas] Erro ao editar motorista', error);
        showToast(
          mensagemTelefoneDuplicado(error) ??
            mensagemRegraDoBanco(error) ??
            'Não foi possível editar o motorista.',
          'error',
        );
      };

      setSalvando(true);
      try {
        // E-mail não é editável (é o login, no Auth): a edição não o regrava.
        const result = await updateUsuario(motoristaId, {
          nome: nome.trim(),
          telefone: telefone?.trim() || null,
        });

        if (!result.success) {
          falhar(result.error.originalError ?? result.error);
          return;
        }

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
        falhar(error);
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
        // Rota aberta: o aviso com a lista (por cima da tela) substitui o
        // toast de erro que o withToast acabou de mostrar.
        if (mostrarSeBloqueado(error, motorista.nome)) {
          hideToast();
          return;
        }
        logger.error('[Motoristas] Erro ao alterar status', error);
        // withToast já mostrou o toast de erro.
      }
    },
    [
      hideToast,
      loadMotoristas,
      mostrarSeBloqueado,
      unidadeAtiva,
      userData,
      withToast,
    ],
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
    bloqueioDesativacao: bloqueio,
    fecharBloqueioDesativacao: fecharBloqueio,

    // Toast
    toastState,
    showToast,
    hideToast,
  };
}
