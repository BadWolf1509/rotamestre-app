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
  onStatusUpdate: () => Promise<void>;
}

interface UseIncidentesModalsResult {
  // Detalhes modal
  incidenteSelecionado: Incidente | null;
  showDetalhesModal: boolean;
  fotoLoading: boolean;
  fotoError: boolean;
  fotoRetryCount: number;
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
  incidentes,
  onStatusUpdate,
}: UseIncidentesModalsOptions): UseIncidentesModalsResult {
  const { showToast } = useToast();

  // Detalhes modal state
  const [incidenteSelecionado, setIncidenteSelecionado] = useState<Incidente | null>(
    null
  );
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [fotoLoading, setFotoLoading] = useState(true);
  const [fotoError, setFotoError] = useState(false);
  const [fotoRetryCount, setFotoRetryCount] = useState(0);

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
  const [incidentesMotorista, setIncidentesMotorista] = useState<Incidente[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);

  // Detalhes modal handlers
  const handleVerDetalhes = useCallback((incidente: Incidente) => {
    setIncidenteSelecionado(incidente);
    setFotoLoading(true);
    setFotoError(false);
    setFotoRetryCount(0);
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

  const handleFotoRetry = useCallback(() => {
    setFotoRetryCount((prev) => prev + 1);
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

      const { error } = await supabase
        .from('incidentes')
        .update({
          status: novoStatus,
          observacoes_gestao: observacoes || null,
          updated_at: new Date().toISOString(),
          ...(novoStatus === 'resolvido' && {
            resolvido_em: new Date().toISOString(),
          }),
        })
        .eq('id', incidenteSelecionado.id);

      if (error) throw error;

      showToast('Status atualizado com sucesso', 'success');
      setShowAlterarStatusModal(false);
      await onStatusUpdate();
    } catch (error) {
      logger.error('Erro ao atualizar status:', error);
      showToast('Erro ao atualizar status', 'error');
    } finally {
      setAtualizando(false);
    }
  }, [incidenteSelecionado, novoStatus, observacoes, onStatusUpdate, showToast]);

  // Histórico motorista handlers — busca direto do Supabase (ignora filtros ativos)
  const handleVerHistoricoMotorista = useCallback(
    async (motoristaId: string, motoristaNome: string) => {
      setMotoristaSelecionado({ id: motoristaId, nome: motoristaNome });
      setIncidentesMotorista([]);
      setShowHistoricoMotoristaModal(true);
      setHistoricoLoading(true);

      const result = await fetchIncidentesForGestor({ motoristasIds: [motoristaId] });
      if (result.success) {
        setIncidentesMotorista(result.data);
      } else {
        logger.warn('[useIncidentesModals] Erro ao buscar histórico:', result.error);
        showToast('Erro ao carregar histórico', 'error');
      }
      setHistoricoLoading(false);
    },
    [showToast]
  );

  return {
    // Detalhes modal
    incidenteSelecionado,
    showDetalhesModal,
    fotoLoading,
    fotoError,
    fotoRetryCount,
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
