/**
 * Hook para gerenciamento de incidentes (tela do Gestor)
 * Extrai state, callbacks e computed values
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import type { IconName } from '@/types/icons';
import type { Theme } from '@/utils/styles';

// ============================================================================
// Types
// ============================================================================

export interface Incidente {
  id: string;
  categoria: string;
  descricao: string;
  endereco: string;
  status: string;
  foto_url: string | null;
  created_at: string;
  motorista_nome: string;
  motorista_id: string;
  unidade_nome: string;
  rota_id: string | null;
  rota_data: string | null;
  parada_endereco: string | null;
  observacoes_gestao: string | null;
}

export type FiltroStatus =
  | 'todos'
  | 'aberto'
  | 'em_analise'
  | 'resolvido'
  | 'fechado';
export type FiltroCategoria =
  | 'todos'
  | 'accident'
  | 'absent'
  | 'wrong_address'
  | 'blocked'
  | 'vehicle'
  | 'other';

export interface CategoriaLabel {
  label: string;
  icon: IconName;
  color: string;
}

export interface StatusLabel {
  label: string;
  color: string;
}

export interface EstatisticaMotorista {
  id: string;
  nome: string;
  total: number;
  abertos: number;
  resolvidos: number;
}

export interface ResumoGeral {
  total: number;
  abertos: number;
  emAnalise: number;
  resolvidos: number;
  fechados: number;
  porCategoria: Record<string, number>;
}

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
  handleVerHistoricoMotorista: (id: string, nome: string) => void;
  setShowHistoricoMotoristaModal: (value: boolean) => void;

  // Actions
  fetchIncidentes: () => Promise<void>;

  // Toast
  toastState: ReturnType<typeof useToast>['toast'];
  hideToast: () => void;

  // Helpers
  formatDate: (dateString: string) => string;
}

// ============================================================================
// Hook
// ============================================================================

export function useIncidentesGestor(
  theme: Theme
): UseIncidentesGestorReturn {
  const { userData } = useUser();
  const { unidadeAtiva, loading: unidadeLoading } = useUnidadeAtiva();
  const { toast: toastState, showToast, hideToast } = useToast();

  // ============================================================================
  // Labels (memoized based on theme)
  // ============================================================================

  const categoriaLabels = useMemo<Record<string, CategoriaLabel>>(
    () => ({
      accident: {
        label: 'Acidente/Incidente',
        icon: 'warning',
        color: theme.colors.incident.accident,
      },
      absent: {
        label: 'Cliente ausente',
        icon: 'home-outline',
        color: theme.colors.incident.absent,
      },
      wrong_address: {
        label: 'Endereço incorreto',
        icon: 'location-outline',
        color: theme.colors.incident.wrongAddress,
      },
      blocked: {
        label: 'Acesso bloqueado',
        icon: 'lock-closed-outline',
        color: theme.colors.incident.blocked,
      },
      vehicle: {
        label: 'Problema no veículo',
        icon: 'car-outline',
        color: theme.colors.incident.vehicle,
      },
      other: {
        label: 'Outros',
        icon: 'ellipsis-horizontal-outline',
        color: theme.colors.incident.other,
      },
    }),
    [theme]
  );

  const statusLabels = useMemo<Record<string, StatusLabel>>(
    () => ({
      aberto: { label: 'Aberto', color: theme.colors.error },
      em_analise: { label: 'Em Análise', color: theme.colors.warning },
      resolvido: { label: 'Resolvido', color: theme.colors.success },
      fechado: { label: 'Fechado', color: theme.colors.gray500 },
    }),
    [theme]
  );

  // ============================================================================
  // State
  // ============================================================================

  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [filtroCategoria, setFiltroCategoria] =
    useState<FiltroCategoria>('todos');

  // Detalhes modal
  const [incidenteSelecionado, setIncidenteSelecionado] =
    useState<Incidente | null>(null);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [fotoLoading, setFotoLoading] = useState(true);
  const [fotoError, setFotoError] = useState(false);
  const [fotoRetryCount, setFotoRetryCount] = useState(0);

  // Status modal
  const [showAlterarStatusModal, setShowAlterarStatusModal] = useState(false);
  const [novoStatus, setNovoStatus] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [atualizando, setAtualizando] = useState(false);

  // Histórico motorista modal
  const [showHistoricoMotoristaModal, setShowHistoricoMotoristaModal] =
    useState(false);
  const [motoristaSelecionado, setMotoristaSelecionado] = useState<{
    id: string;
    nome: string;
  } | null>(null);
  const [incidentesMotorista, setIncidentesMotorista] = useState<Incidente[]>(
    []
  );

  // ============================================================================
  // Computed values
  // ============================================================================

  const estatisticasMotorista = useMemo(() => {
    const stats: Record<
      string,
      { nome: string; total: number; abertos: number; resolvidos: number }
    > = {};

    incidentes.forEach((inc) => {
      if (!stats[inc.motorista_id]) {
        stats[inc.motorista_id] = {
          nome: inc.motorista_nome,
          total: 0,
          abertos: 0,
          resolvidos: 0,
        };
      }
      stats[inc.motorista_id].total++;
      if (inc.status === 'aberto' || inc.status === 'em_analise') {
        stats[inc.motorista_id].abertos++;
      }
      if (inc.status === 'resolvido' || inc.status === 'fechado') {
        stats[inc.motorista_id].resolvidos++;
      }
    });

    return Object.entries(stats)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [incidentes]);

  const resumoGeral = useMemo(() => {
    const abertos = incidentes.filter((i) => i.status === 'aberto').length;
    const emAnalise = incidentes.filter(
      (i) => i.status === 'em_analise'
    ).length;
    const resolvidos = incidentes.filter(
      (i) => i.status === 'resolvido'
    ).length;
    const fechados = incidentes.filter((i) => i.status === 'fechado').length;

    const porCategoria: Record<string, number> = {};
    incidentes.forEach((inc) => {
      porCategoria[inc.categoria] = (porCategoria[inc.categoria] || 0) + 1;
    });

    return {
      total: incidentes.length,
      abertos,
      emAnalise,
      resolvidos,
      fechados,
      porCategoria,
    };
  }, [incidentes]);

  // ============================================================================
  // Fetch incidentes
  // ============================================================================

  const fetchIncidentes = useCallback(async () => {
    // Wait for all data to be ready before fetching
    // unidadeAtiva is set asynchronously after userData loads
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

      const motoristas =
        vinculacoes?.map((v) => ({ id: v.usuario_id })) || [];

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
          motorista:usuarios!motorista_id (nome),
          rota:rotas (id, data),
          parada:paradas (endereco)
        `
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
      console.error('❌ Erro ao buscar incidentes:', error);
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

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleVerDetalhes = (incidente: Incidente) => {
    setIncidenteSelecionado(incidente);
    setFotoLoading(true);
    setFotoError(false);
    setFotoRetryCount(0);
    setShowDetalhesModal(true);
  };

  const handleFotoLoad = () => {
    setFotoLoading(false);
    setFotoError(false);
  };

  const handleFotoError = () => {
    setFotoLoading(false);
    setFotoError(true);
  };

  const handleFotoRetry = () => {
    setFotoRetryCount((prev) => prev + 1);
    setFotoLoading(true);
    setFotoError(false);
  };

  const handleAlterarStatus = (incidente: Incidente) => {
    setIncidenteSelecionado(incidente);
    setNovoStatus(incidente.status);
    setObservacoes(incidente.observacoes_gestao || '');
    setShowAlterarStatusModal(true);
  };

  const confirmarAlterarStatus = async () => {
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
      fetchIncidentes();
    } catch (error) {
      console.error('❌ Erro ao atualizar status:', error);
      showToast('Erro ao atualizar status', 'error');
    } finally {
      setAtualizando(false);
    }
  };

  const handleVerHistoricoMotorista = (
    motoristaId: string,
    motoristaNome: string
  ) => {
    setMotoristaSelecionado({ id: motoristaId, nome: motoristaNome });
    const incidentesDoMotorista = incidentes.filter(
      (inc) => inc.motorista_id === motoristaId
    );
    setIncidentesMotorista(incidentesDoMotorista);
    setShowHistoricoMotoristaModal(true);
  };

  // ============================================================================
  // Helpers
  // ============================================================================

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
    handleVerHistoricoMotorista,
    setShowHistoricoMotoristaModal,

    // Actions
    fetchIncidentes,

    // Toast
    toastState,
    hideToast,

    // Helpers
    formatDate,
  };
}
