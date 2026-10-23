/**
 * Hook for managing incident modal state and handlers
 */

import { useState, useCallback } from 'react';

import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger';
import { fetchIncidentesForGestor } from '@/lib/queries/incidentes';
import { supabase } from '@/lib/supabase';

import type { Incidente } from './types';

interface UseIncidentesModalsOptions {
  incidentes: Incidente[];
  /** Loja ativa: o histórico do motorista fica nela (Migration 43). */
  unidadeId?: string | null;
  onStatusUpdate: () => Promise<void>;
}

interface UseIncidentesModalsResult {
  // Detalhes modal
  incidenteSelecionado: Incidente | null;
  showDetalhesModal: boolean;
  fotoLoading: boolean;
  fotoError: boolean;
  handleVerDetalhes: (incidente: Incidente) => void;
  handleFotoLoad: () => void;
  handleFotoError: () => void;
  handleFotoRetry: () => void;
  setShowDetalhesModal: (value: boolean) => void;

  // Status modal
  showAlterarStatusModal: boolean;
  novoStatus: string;
  observacoes: string;
  atualizando: boolean;
  handleAlterarStatus: (incidente: Incidente) => void;
  confirmarAlterarStatus: () => Promise<void>;
  setNovoStatus: (value: string) => void;
  setObservacoes: (value: string) => void;
  setShowAlterarStatusModal: (value: boolean) => void;

  // Histórico motorista modal
  showHistoricoMotoristaModal: boolean;
  motoristaSelecionado: { id: string; nome: string } | null;
  incidentesMotorista: Incidente[];
  historicoLoading: boolean;
  handleVerHistoricoMotorista: (id: string, nome: string) => Promise<void>;
  setShowHistoricoMotoristaModal: (value: boolean) => void;

  // Toast
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * Manages modal state and handlers for incident management
 */
export function useIncidentesModals({
  incidentes: _incidentes,
  unidadeId,
  onStatusUpdate,
}: UseIncidentesModalsOptions): UseIncidentesModalsResult {
  const { showToast } = useToast();

  // Detalhes modal state
  const [incidenteSelecionado, setIncidenteSelecionado] =
    useState<Incidente | null>(null);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [fotoLoading, setFotoLoading] = useState(true);
  const [fotoError, setFotoError] = useState(false);

  // Status modal state
  const [showAlterarStatusModal, setShowAlterarStatusModal] = useState(false);
  const [novoStatus, setNovoStatus] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [atualizando, setAtualizando] = useState(false);

  // Histórico motorista modal state
  const [showHistoricoMotoristaModal, setShowHistoricoMotoristaModal] =
    useState(false);
  const [motoristaSelecionado, setMotoristaSelecionado] = useState<{
    id: string;
    nome: string;
  } | null>(null);
  const [incidentesMotorista, setIncidentesMotorista] = useState<Incidente[]>(
    [],
  );
  const [historicoLoading, setHistoricoLoading] = useState(false);

  // Detalhes modal handlers
  const handleVerDetalhes = useCallback((incidente: Incidente) => {
    setIncidenteSelecionado(incidente);
    setFotoLoading(true);
    setFotoError(false);
    setShowDetalhesModal(true);
  }, []);

  const handleFotoLoad = useCallback(() => {
    setFotoLoading(false);
    setFotoError(false);
  }, []);

  const handleFotoError = useCallback(() => {
    setFotoLoading(false);
    setFotoError(true);
  }, []);

  // Retry por remount: fotoError=false remonta o <Image> do modal (desmontado durante o erro).
  const handleFotoRetry = useCallback(() => {
    setFotoLoading(true);
    setFotoError(false);
  }, []);

  // Status modal handlers
  const handleAlterarStatus = useCallback((incidente: Incidente) => {
    setIncidenteSelecionado(incidente);
    setNovoStatus(incidente.status);
    setObservacoes(incidente.observacoes_gestao || '');
    setShowAlterarStatusModal(true);
  }, []);

  const confirmarAlterarStatus = useCallback(async () => {
    if (!incidenteSelecionado) return;

    try {
      setAtualizando(true);

      const { data: alteradas, error } = await supabase
        .from('incidentes')
        .update({
          status: novoStatus,
          observacoes_gestao: observacoes || null,
          updated_at: new Date().toISOString(),
          ...(novoStatus === 'resolvido' && {
            resolvido_em: new Date().toISOString(),
          }),
        })
        .eq('id', incidenteSelecionado.id)
        .select('id');

      if (error) throw error;
      // A RLS recusa UPDATE sem erro (0 linhas) — por exemplo, motorista
      // que não tem mais vínculo ativo com esta loja. Sem esta conferência a
      // tela dizia "atualizado" e o status ficava o mesmo.
      if ((alteradas?.length ?? 0) === 0) {
        showToast(
          'O status não foi atualizado: este incidente não pode ser alterado por você. Atualize a lista.',
          'error',
        );
        return;
      }

      showToast('Status atualizado com sucesso', 'success');
      setShowAlterarStatusModal(false);
      await onStatusUpdate();
    } catch (error) {
      logger.error('Erro ao atualizar status:', error);
      showToast('Erro ao atualizar status', 'error');
    } finally {
      setAtualizando(false);
    }
  }, [
    incidenteSelecionado,
    novoStatus,
    observacoes,
    onStatusUpdate,
    showToast,
  ]);

  // Histórico motorista handlers — busca direto do Supabase (ignora filtros ativos)
  const handleVerHistoricoMotorista = useCallback(
    async (motoristaId: string, motoristaNome: string) => {
      setMotoristaSelecionado({ id: motoristaId, nome: motoristaNome });
      setIncidentesMotorista([]);
      setShowHistoricoMotoristaModal(true);

      // Fail-closed: sem a loja, o filtro cairia em todas as lojas que a RLS
      // deixa ver (motorista que atende duas lojas). Melhor lista vazia.
      if (!unidadeId) {
        logger.warn(
          '[useIncidentesModals] Histórico sem unidadeId; nada buscado',
          { motoristaId },
        );
        return;
      }

      setHistoricoLoading(true);

      // Só os incidentes desta loja: motorista que atende duas lojas tem
      // histórico nas duas, e o da outra não é deste gestor.
      const result = await fetchIncidentesForGestor({
        motoristasIds: [motoristaId],
        unidadeId,
      });
      if (result.success) {
        setIncidentesMotorista(result.data);
      } else {
        logger.warn(
          '[useIncidentesModals] Erro ao buscar histórico:',
          result.error,
        );
        showToast('Erro ao carregar histórico', 'error');
      }
      setHistoricoLoading(false);
    },
    [showToast, unidadeId],
  );

  return {
    // Detalhes modal
    incidenteSelecionado,
    showDetalhesModal,
    fotoLoading,
    fotoError,
    handleVerDetalhes,
    handleFotoLoad,
    handleFotoError,
    handleFotoRetry,
    setShowDetalhesModal,

    // Status modal
    showAlterarStatusModal,
    novoStatus,
    observacoes,
    atualizando,
    handleAlterarStatus,
    confirmarAlterarStatus,
    setNovoStatus,
    setObservacoes,
    setShowAlterarStatusModal,

    // Histórico motorista modal
    showHistoricoMotoristaModal,
    motoristaSelecionado,
    incidentesMotorista,
    historicoLoading,
    handleVerHistoricoMotorista,
    setShowHistoricoMotoristaModal,

    // Toast
    showToast,
  };
}
