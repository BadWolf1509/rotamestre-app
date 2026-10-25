/**
 * Hook para gerenciamento de incidentes (tela do Gestor)
 * Composes data fetching, filtering, stats, and modal management
 *
 * A lista é paginada no servidor (50 por vez, "carregar mais"), com o total e
 * as contagens por status da loja inteira — até 24/10/2026 não havia limite,
 * e o corte de 1.000 linhas do Supabase escondia os mais antigos e falseava
 * os cartões de resumo. A consulta mora em
 * `incidentes-gestor/consultaIncidentes.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ShowToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { nomeDoMotorista } from '@/lib/incidentes/nomeDoMotorista';
import { logger } from '@/lib/logger';
import type { Theme } from '@/utils/styles';

import {
  createCategoriaLabels,
  createStatusLabels,
  formatIncidentDate,
  useIncidentesModals,
  useIncidentesStats,
} from './incidentes-gestor';
import {
  buscarIncidentes,
  contarIncidentesPorStatus,
  TAMANHO_PAGINA_INCIDENTES,
  type ContagemIncidentesPorStatus,
  type FiltrosIncidentes,
  type LinhaIncidente,
} from './incidentes-gestor/consultaIncidentes';

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

export interface UseIncidentesGestorOptions {
  /**
   * Toast da PÁGINA: `useToast` é estado local de cada instância, e é a
   * página que renderiza o `<Toast>`. Obrigatório para que esquecer vire erro
   * de tipo, não toast mudo.
   */
  showToast: ShowToast;
}

export interface UseIncidentesGestorReturn {
  // Data
  incidentes: Incidente[];
  /** Quantos incidentes casam com os filtros na loja inteira. */
  total: number | null;
  /** Há incidentes além dos carregados. */
  temMais: boolean;
  carregandoMais: boolean;
  carregarMais: () => Promise<void>;
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

  // Helpers
  formatDate: (dateString: string) => string;
}

function paraIncidente(inc: LinhaIncidente, unidadeNome: string): Incidente {
  return {
    id: inc.id,
    categoria: inc.categoria,
    descricao: inc.descricao,
    endereco: inc.endereco,
    status: inc.status,
    foto_url: inc.foto_url,
    created_at: inc.created_at,
    observacoes_gestao: inc.observacoes_gestao,
    motorista_nome: nomeDoMotorista(inc.motorista_id, inc.motorista?.nome),
    motorista_id: inc.motorista_id,
    unidade_nome: unidadeNome,
    rota_id: inc.rota?.id || null,
    rota_data: inc.rota?.data || null,
    parada_endereco: inc.parada?.endereco || null,
  };
}

/**
 * Main hook for incident management - composes sub-hooks
 */
export function useIncidentesGestor(
  theme: Theme,
  { showToast }: UseIncidentesGestorOptions,
): UseIncidentesGestorReturn {
  const { userData } = useUser();
  const { unidadeAtiva, loading: unidadeLoading } = useUnidadeAtiva();

  // Labels (memoized based on theme)
  const categoriaLabels = useMemo(() => createCategoriaLabels(theme), [theme]);
  const statusLabels = useMemo(() => createStatusLabels(theme), [theme]);

  // Core state
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [contagens, setContagens] =
    useState<ContagemIncidentesPorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [filtroCategoria, setFiltroCategoria] =
    useState<FiltroCategoria>('todos');

  // Quantos a lista mostra: cresce com "carregar mais" e é o tamanho da
  // recarga (depois de alterar um status), para não fechar o que o gestor
  // abriu. Volta a uma página quando o filtro muda.
  const quantidadeRef = useRef(TAMANHO_PAGINA_INCIDENTES);
  const chaveFiltrosRef = useRef<string | null>(null);
  // Só a resposta da carga mais recente vale (filtro trocado no meio).
  const geracaoRef = useRef(0);
  const incidentesRef = useRef<Incidente[]>([]);
  incidentesRef.current = incidentes;
  // Travas do "carregar mais" (as mesmas da Gestão de Rotas). Por ref, não
  // por estado: dois toques no mesmo render veriam o mesmo `carregandoMais`.
  const cargaEmVooRef = useRef(false);
  const maisEmVooRef = useRef(false);

  const unidadeNome = userData?.unidades?.nome || '';
  const filtros = useMemo<FiltrosIncidentes | null>(
    () =>
      unidadeAtiva
        ? {
            unidadeId: unidadeAtiva,
            status: filtroStatus,
            categoria: filtroCategoria,
          }
        : null,
    [unidadeAtiva, filtroStatus, filtroCategoria],
  );

  // Fetch incidentes from database
  const fetchIncidentes = useCallback(async () => {
    if (unidadeLoading || !userData?.id || !filtros) {
      return;
    }

    const chave = JSON.stringify(filtros);
    if (chave !== chaveFiltrosRef.current) {
      chaveFiltrosRef.current = chave;
      quantidadeRef.current = TAMANHO_PAGINA_INCIDENTES;
    }
    const geracao = ++geracaoRef.current;
    cargaEmVooRef.current = true;

    try {
      setLoading(true);

      const pagina = await buscarIncidentes({
        filtros,
        quantidade: quantidadeRef.current,
        contar: true,
      });
      // Contagem por status no servidor só quando a lista não trouxe tudo:
      // com tudo carregado, contar as linhas dá o mesmo número, e a loja
      // típica faz uma consulta em vez de cinco.
      const faltam =
        pagina.total !== null && pagina.total > pagina.linhas.length;
      const porStatus = faltam
        ? await contarIncidentesPorStatus(filtros)
        : null;
      if (geracao !== geracaoRef.current) return;

      setIncidentes(pagina.linhas.map((i) => paraIncidente(i, unidadeNome)));
      setTotal(pagina.total);
      setContagens(porStatus);
    } catch (error) {
      if (geracao !== geracaoRef.current) return;
      logger.error('Erro ao buscar incidentes:', error);
      showToast('Erro ao carregar incidentes', 'error');
    } finally {
      if (geracao === geracaoRef.current) {
        cargaEmVooRef.current = false;
        setLoading(false);
      }
    }
  }, [unidadeLoading, userData?.id, filtros, unidadeNome, showToast]);

  useEffect(() => {
    fetchIncidentes();
  }, [fetchIncidentes]);

  const temMais = total !== null && incidentes.length < total;

  const carregarMais = useCallback(async () => {
    // Com uma carga em voo o toque é ignorado: o cursor de agora ficaria
    // velho quando ela chegasse e substituísse a lista.
    if (
      !filtros ||
      !temMais ||
      maisEmVooRef.current ||
      cargaEmVooRef.current
    ) {
      return;
    }
    maisEmVooRef.current = true;
    const geracao = geracaoRef.current;
    const atuais = incidentesRef.current;
    const ultimo = atuais[atuais.length - 1];
    setCarregandoMais(true);
    try {
      const { linhas } = await buscarIncidentes({
        filtros,
        quantidade: TAMANHO_PAGINA_INCIDENTES,
        cursor: ultimo
          ? { created_at: ultimo.created_at, id: ultimo.id }
          : undefined,
      });
      // Uma carga nova (filtro trocado) chegou no meio: estas são velhas.
      if (geracao !== geracaoRef.current) return;
      quantidadeRef.current += TAMANHO_PAGINA_INCIDENTES;
      setIncidentes((anteriores) => {
        const vistos = new Set(anteriores.map((i) => i.id));
        return [
          ...anteriores,
          ...linhas
            .filter((i) => !vistos.has(i.id))
            .map((i) => paraIncidente(i, unidadeNome)),
        ];
      });
    } catch (error) {
      logger.error('Erro ao carregar mais incidentes:', error);
      showToast('Não foi possível carregar mais incidentes.', 'error', 5000);
    } finally {
      maisEmVooRef.current = false;
      setCarregandoMais(false);
    }
  }, [filtros, temMais, unidadeNome, showToast]);

  // Top 5 motoristas: dos incidentes carregados (a tela avisa quando há
  // mais). Os cartões de resumo vêm das contagens da loja inteira.
  const { estatisticasMotorista, resumoGeral: resumoCarregados } =
    useIncidentesStats({ incidentes });
  const resumoGeral = useMemo<ResumoGeral>(
    () =>
      contagens
        ? {
            ...resumoCarregados,
            total: total ?? resumoCarregados.total,
            abertos: contagens.aberto,
            emAnalise: contagens.em_analise,
            resolvidos: contagens.resolvido,
            fechados: contagens.fechado,
          }
        : resumoCarregados,
    [contagens, total, resumoCarregados],
  );

  // Modal management
  const modals = useIncidentesModals({
    incidentes,
    unidadeId: unidadeAtiva,
    onStatusUpdate: fetchIncidentes,
    // Toast da página (a mesma instância que ela renderiza).
    showToast,
  });

  return {
    // Data
    incidentes,
    total,
    temMais,
    carregandoMais,
    carregarMais,
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

    // Helpers
    formatDate: formatIncidentDate,
  };
}
