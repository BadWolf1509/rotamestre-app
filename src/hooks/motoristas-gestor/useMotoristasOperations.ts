/**
 * Data Operations Hook for Motoristas Management
 *
 * Handles loading motoristas and CRUD operations.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import {
  chamarCriarMotorista,
  MSG_FALHA_CRIAR,
} from '@/lib/gestor/criarMotorista';
import {
  alternarMotoristaNaLoja,
  editarDadosMotorista,
  mensagemErroMotorista,
} from '@/lib/gestor/motoristaNaLoja';
import { logger } from '@/lib/logger';
import { logUserAction } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

import {
  useBloqueioDesativacao,
  type BloqueioDesativacao,
} from './useBloqueioDesativacao';

import type { MotoristaDetalhado } from '../useMotoristasGestor';

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
  const { unidadeAtiva, loading: unidadeLoading } = useUnidadeAtiva();
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
    // Loja ainda resolvendo: `unidadeAtiva` é null de passagem, e zerar aqui
    // piscaria "sem motoristas" antes do spinner (mesma guarda de Incidentes).
    if (unidadeLoading) return;
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
  }, [showToast, unidadeAtiva, unidadeLoading]);

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
        // Pelo cliente do Supabase: prazo de 15 s, token renovado e versão do
        // app nos logs (o `fetch` cru ficava fora de tudo isso).
        const resultado = await chamarCriarMotorista({
          nome: nome.trim(),
          email: email.trim(),
          senha: senha.trim(),
          telefone: telefone?.trim() || null,
          unidade_id: unidadeAtiva,
        });

        if (!resultado.ok) {
          showToast(resultado.mensagem, 'error');
          return;
        }

        // Create log using centralized logging
        if (userData) {
          logUserAction(userData.id, 'motorista_criado', {
            motorista_nome: nome.trim(),
            motorista_email: email.trim(),
          });
        }

        showToast('Motorista adicionado com sucesso!', 'success');
        onSuccess();
        loadMotoristas();
      } catch (error: unknown) {
        logger.error(
          '[Motoristas] Erro inesperado ao adicionar motorista',
          error,
        );
        showToast(MSG_FALHA_CRIAR, 'error');
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
          mensagemErroMotorista(error, 'Não foi possível editar o motorista.'),
          'error',
        );
      };

      setSalvando(true);
      try {
        // E-mail não é editável (é o login, no Auth): a lib só grava nome e
        // telefone e registra a auditoria.
        await editarDadosMotorista({
          motoristaId,
          nome,
          telefone,
          gestorId: userData?.id,
        });

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
            // Quem atende outra loja é desativado só nesta (o vínculo); a
            // decisão é do banco. A lib também grava a auditoria.
            await alternarMotoristaNaLoja({
              motoristaId: motorista.id,
              motoristaNome: motorista.nome,
              unidadeId: unidadeAtiva,
              ativo: novoStatus,
              gestorId: userData?.id,
            });
          },
          {
            loading: `${novoStatus ? 'Ativando' : 'Desativando'} motorista...`,
            success: `Motorista ${novoStatus ? 'ativado' : 'desativado'} com sucesso!`,
            // No caso do telefone, o motivo é a informação útil (reativar
            // esbarra em outro motorista ativo); um toast só, sem piscar.
            error: (e) =>
              mensagemErroMotorista(
                e,
                'Não foi possível alterar o status do motorista',
              ),
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
