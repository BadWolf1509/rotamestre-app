/**
 * Hook para gerenciamento de incidentes (tela do Gestor)
 * Composes data fetching, filtering, stats, and modal management
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { Theme } from '@/utils/styles';

import {
  createCategoriaLabels,
  createStatusLabels,
  formatIncidentDate,
  useIncidentesModals,
  useIncidentesStats,
} from './incidentes-gestor';

import type {
  CategoriaLabel,
  EstatisticaMotorista,
  FiltroCategoria,
  FiltroStatus,
  Incidente,
  ResumoGeral,
  StatusLabel,
} from './incidentes-gestor';

// Re-export types for backwards compatibility
export type {
  Incidente,
  FiltroStatus,
  FiltroCategoria,
  CategoriaLabel,
  StatusLabel,
  EstatisticaMotorista,
  ResumoGeral,
};

export interface UseIncidentesGestorReturn {
  // Data
  incidentes: Incidente[];
  loading: boolean;
  categoriaLabels: Record<string, CategoriaLabel>;
  statusLabels: Record<string, StatusLabel>;
  estatisticasMotorista: EstatisticaMotorista[];
  resumoGeral: ResumoGeral;

  // Filters
  filtroStatus: FiltroStatus;
  filtroCategoria: FiltroCategoria;
  setFiltroStatus: (value: FiltroStatus) => void;
  setFiltroCategoria: (value: FiltroCategoria) => void;

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

  // Actions
  fetchIncidentes: () => Promise<void>;

  // Toast
  toastState: ReturnType<typeof useToast>['toast'];
  hideToast: () => void;

  // Helpers
  formatDate: (dateString: string) => string;
}

/**
 * Main hook for incident management - composes sub-hooks
 */
export function useIncidentesGestor(theme: Theme): UseIncidentesGestorReturn {
  const { userData } = useUser();
  const { unidadeAtiva, loading: unidadeLoading } = useUnidadeAtiva();
  const { toast: toastState, showToast, hideToast } = useToast();

  // Labels (memoized based on theme)
  const categoriaLabels = useMemo(() => createCategoriaLabels(theme), [theme]);
  const statusLabels = useMemo(() => createStatusLabels(theme), [theme]);

  // Core state
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [filtroCategoria, setFiltroCategoria] =
    useState<FiltroCategoria>('todos');

  // Fetch incidentes from database
  const fetchIncidentes = useCallback(async () => {
    if (unidadeLoading || !userData?.id || !unidadeAtiva) {
      return;
    }

    try {
      setLoading(true);

      const { data: vinculacoes } = await supabase
        .from('usuario_unidades')
        .select('usuario_id')
        .eq('unidade_id', unidadeAtiva)
        .eq('papel', 'motorista')
        .eq('ativo', true);

      const motoristas = vinculacoes?.map((v) => ({ id: v.usuario_id })) || [];

      if (!motoristas || motoristas.length === 0) {
        setIncidentes([]);
        return;
      }

      const motoristasIds = motoristas.map((m) => m.id);

      let query = supabase
        .from('incidentes')
        .select(
          `
          id,
          categoria,
          descricao,
          endereco,
          status,
          foto_url,
          created_at,
          observacoes_gestao,
          motorista_id,
          motorista:usuarios!motorista_id (nome),
          rota:rotas (id, data),
          parada:paradas (endereco)
        `,
        )
        .in('motorista_id', motoristasIds)
        .order('created_at', { ascending: false });

      if (filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus);
      }
      if (filtroCategoria !== 'todos') {
        query = query.eq('categoria', filtroCategoria);
      }

      const { data, error } = await query;

      if (error) throw error;

      const incidentesFormatados = (data || []).map((inc: any) => ({
        id: inc.id,
        categoria: inc.categoria,
        descricao: inc.descricao,
        endereco: inc.endereco,
        status: inc.status,
        foto_url: inc.foto_url,
        created_at: inc.created_at,
        observacoes_gestao: inc.observacoes_gestao,
        motorista_nome: inc.motorista?.nome || 'Desconhecido',
        motorista_id: inc.motorista_id,
        unidade_nome: userData?.unidades?.nome || '',
        rota_id: inc.rota?.id || null,
        rota_data: inc.rota?.data || null,
        parada_endereco: inc.parada?.endereco || null,
      }));

      setIncidentes(incidentesFormatados);
    } catch (error) {
      logger.error('Erro ao buscar incidentes:', error);
      showToast('Erro ao carregar incidentes', 'error');
    } finally {
      setLoading(false);
    }
  }, [
    unidadeAtiva,
    unidadeLoading,
    userData?.id,
    userData?.unidades?.nome,
    filtroStatus,
    filtroCategoria,
    showToast,
  ]);

  useEffect(() => {
    fetchIncidentes();
  }, [fetchIncidentes]);

  // Statistics (computed from incidentes)
  const { estatisticasMotorista, resumoGeral } = useIncidentesStats({
    incidentes,
  });

  // Modal management
  const modals = useIncidentesModals({
    incidentes,
    onStatusUpdate: fetchIncidentes,
  });

  return {
    // Data
    incidentes,
    loading,
    categoriaLabels,
    statusLabels,
    estatisticasMotorista,
    resumoGeral,

    // Filters
    filtroStatus,
    filtroCategoria,
    setFiltroStatus,
    setFiltroCategoria,

    // Detalhes modal
    incidenteSelecionado: modals.incidenteSelecionado,
    showDetalhesModal: modals.showDetalhesModal,
    fotoLoading: modals.fotoLoading,
    fotoError: modals.fotoError,
    handleVerDetalhes: modals.handleVerDetalhes,
    handleFotoLoad: modals.handleFotoLoad,
    handleFotoError: modals.handleFotoError,
    handleFotoRetry: modals.handleFotoRetry,
    setShowDetalhesModal: modals.setShowDetalhesModal,

    // Status modal
    showAlterarStatusModal: modals.showAlterarStatusModal,
    novoStatus: modals.novoStatus,
    observacoes: modals.observacoes,
    atualizando: modals.atualizando,
    handleAlterarStatus: modals.handleAlterarStatus,
    confirmarAlterarStatus: modals.confirmarAlterarStatus,
    setNovoStatus: modals.setNovoStatus,
    setObservacoes: modals.setObservacoes,
    setShowAlterarStatusModal: modals.setShowAlterarStatusModal,

    // Histórico motorista modal
    showHistoricoMotoristaModal: modals.showHistoricoMotoristaModal,
    motoristaSelecionado: modals.motoristaSelecionado,
    incidentesMotorista: modals.incidentesMotorista,
    historicoLoading: modals.historicoLoading,
    handleVerHistoricoMotorista: modals.handleVerHistoricoMotorista,
    setShowHistoricoMotoristaModal: modals.setShowHistoricoMotoristaModal,

    // Actions
    fetchIncidentes,

    // Toast
    toastState,
    hideToast,

    // Helpers
    formatDate: formatIncidentDate,
  };
}
