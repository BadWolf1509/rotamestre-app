/**
 * Hook de gerenciamento de rotas para a tela de Gestão de Rotas
 *
 * Encapsula toda a lógica de estado e ações:
 * - Carregamento paginado no servidor ("carregar mais", 100 por vez), com o
 *   total da loja para a tela avisar quando a lista não mostra tudo
 * - Filtro de status, período e busca (só por motorista) aplicados no servidor
 *   (cobrem todas as rotas)
 * - Exportação para CSV e XLSX de TODAS as rotas do filtro, com progresso
 * - Atualização em tempo real
 * - Cache local para melhor UX (stale-while-revalidate)
 *
 * Até 24/10/2026 a lista era `.limit(100)` sem aviso, e busca, filtro e
 * exportação só viam essas 100 rotas. A consulta mora em
 * `src/lib/gestor/consultaRotas.ts`.
 *
 * Sem PDF: o comprovante por rota (pdfmake) não tinha tela que o chamasse e
 * saiu em 26/10/2026 com a dependência (está no git, se for ligado um dia).
 *
 * Modular architecture:
 * - gestao-rotas/useRotasCache.ts: Cache management
 * - gestao-rotas/useRotasFiltering.ts: Filter state and sort logic
 * - gestao-rotas/routeExport.ts: CSV export utility
 * - gestao-rotas/routeExportXLSX.ts: XLSX export utility
 */

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePeriodoLembrado } from '@/hooks/usePeriodoLembrado';
import { useRealtimeRoutes } from '@/hooks/useRealtimeRoutes';
import type { ShowToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { formatarDecimal } from '@/lib/formatNumber';
import {
  buscarRotas,
  contarRotasPorStatus,
  TAMANHO_PAGINA_ROTAS,
  TETO_EXPORTACAO_ROTAS,
  type ContagemPorStatus,
  type FiltrosRotas,
} from '@/lib/gestor/consultaRotas';
import { rotasDeTesteDaGestao } from '@/lib/gestor/dadosDeTeste';
import { logger } from '@/lib/logger';
import { resolverPeriodo } from '@/lib/periodo';
import {
  classifyError,
  isPostgrestAbortShape,
} from '@/lib/queries/queryClient';
import {
  ROTA_STATUS_LABELS,
  FILTRO_STATUS_OPTIONS as FILTRO_OPTIONS,
  getRotaStatusLabel,
  type RotaStatus,
  type FiltroStatus,
} from '@/lib/statusLabels';
import { isSupabaseConfigured } from '@/lib/supabase';

import {
  useRotasCache,
  useRotasFiltering,
  ordenarRotas,
  exportRotasToCSV,
  exportRotasToXLSX,
} from './gestao-rotas';

import type { RotaHistorico } from './gestao-rotas';

// Re-export types for backwards compatibility
export type { RotaStatus, FiltroStatus, RotaHistorico };

// Constants (re-exports for backwards compatibility)
export const STATUS_LABELS = ROTA_STATUS_LABELS;
export const FILTRO_STATUS_OPTIONS = FILTRO_OPTIONS;

interface UseGestaoRotasOptions {
  statusColorMap: Record<RotaStatus, string>;
  defaultStatusColor: string;
  /**
   * Toast da PÁGINA: `useToast` é estado local de cada instância, e é a
   * página que renderiza o `<Toast>`. Obrigatório para que esquecer vire erro
   * de tipo, não toast mudo.
   */
  showToast: ShowToast;
}

/** Progresso da exportação (busca de todas as páginas). */
export interface ProgressoExportacao {
  formato: 'csv' | 'xlsx';
  carregadas: number;
  /** Quantas serão exportadas (já limitado ao teto); null antes da 1ª página. */
  total: number | null;
}

/**
 * Cancelamento pedido pelo próprio hook (carga nova substituindo esta,
 * "carregar mais" superado, saída da tela). Não é falha.
 *
 * O erro do postgrest-js NUNCA é `instanceof Error`: a biblioteca converte a
 * rejeição do fetch num objeto plano antes de resolver a promise — ver
 * `isPostgrestAbortShape` (queryClient.ts). Fica de fora o NOSSO timeout de
 * 15s (fetchComTimeout.ts), que chega com a mesma forma mas é falha real (a
 * resposta nunca voltou): `classifyError` dá a ele o tipo 'timeout'.
 */
function foiCancelamento(error: unknown): boolean {
  return (
    isPostgrestAbortShape(error) && classifyError(error).type !== 'timeout'
  );
}

export function useGestaoRotas(options: UseGestaoRotasOptions) {
  const { statusColorMap, defaultStatusColor, showToast } = options;

  const router = useRouter();
  const { userData } = useUser();
  const { unidadeAtiva } = useUnidadeAtiva();

  // ============================================
  // STATE
  // ============================================

  // Rotas carregadas, na ordem do servidor (data desc, id desc): a última é o
  // cursor do "carregar mais". A ordenação da tabela fica em `rotasFiltradas`.
  const [rotas, setRotas] = useState<RotaHistorico[]>([]);
  // Quantas rotas casam com o filtro na loja inteira (null = ainda não sei).
  const [total, setTotal] = useState<number | null>(null);
  const [contagens, setContagens] = useState<ContagemPorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [exportacao, setExportacao] = useState<ProgressoExportacao | null>(
    null,
  );
  // Erro da última carga (null = ok). `Alert.alert` era no-op no web: a tela
  // ficava vazia ou com dados velhos sem dizer nada.
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  // Quando há erro e a tela mostra dados anteriores (cache ou carga que deu
  // certo antes): de quando eles são (epoch ms). null = sem dados anteriores.
  const [dadosDe, setDadosDe] = useState<number | null>(null);
  const ultimaCargaOkRef = useRef<number | null>(null);

  // Cancelamento: carga da lista, "carregar mais" e exportação.
  const abortControllerRef = useRef<AbortController | null>(null);
  const maisControllerRef = useRef<AbortController | null>(null);
  const exportControllerRef = useRef<AbortController | null>(null);
  const montadoRef = useRef(true);

  // Quantas rotas a lista mostra: cresce com "carregar mais" e é o tamanho
  // de cada recarga (realtime, "tentar novamente"), para não fechar as
  // páginas que o gestor abriu. Volta a uma página quando o filtro muda.
  const quantidadeRef = useRef(TAMANHO_PAGINA_ROTAS);
  const chaveFiltrosRef = useRef<string | null>(null);
  const cargaEmVooRef = useRef(false);
  const jaMostrouRef = useRef(false);
  // Loja dos dados na tela: o seletor troca a loja sem remontar a tela.
  const lojaDaCargaRef = useRef<string | null>(null);
  const rotasRef = useRef<RotaHistorico[]>([]);
  rotasRef.current = rotas;

  // ============================================
  // EXTRACTED HOOKS
  // ============================================

  // Filtros (aplicados no servidor) e ordenação das linhas carregadas
  const {
    rotasFiltradas,
    filtroStatus,
    setFiltroStatus,
    searchQuery,
    buscaAplicada,
    setSearchQuery,
    sortColumn,
    sortDirection,
    handleSort,
  } = useRotasFiltering({ rotas });

  // Período lembrado no aparelho (padrão: este mês). Só se consulta depois de
  // `carregado`: antes disso o período é o padrão, não o que a pessoa escolheu.
  const { periodo, definirPeriodo, carregado } =
    usePeriodoLembrado('gestao_rotas');
  const intervalo = resolverPeriodo(periodo);
  const periodoDe = intervalo.de;
  const periodoAte = intervalo.ate;

  // Cache (stale-while-revalidate), uma chave por loja e período.
  const periodoDoCache = useMemo(
    () => ({ de: periodoDe, ate: periodoAte }),
    [periodoDe, periodoAte],
  );
  const { loadFromCache, saveToCache } = useRotasCache({
    unidadeId: unidadeAtiva,
    periodo: periodoDoCache,
  });

  const filtros = useMemo<FiltrosRotas | null>(
    () =>
      unidadeAtiva && carregado
        ? {
            unidadeId: unidadeAtiva,
            status: filtroStatus,
            busca: buscaAplicada,
            periodo: { de: periodoDe, ate: periodoAte },
          }
        : null,
    [
      unidadeAtiva,
      carregado,
      filtroStatus,
      buscaAplicada,
      periodoDe,
      periodoAte,
    ],
  );
  // Só a visão sem status nem busca vai para o cache, na chave do período.
  const visaoPadrao = filtroStatus === 'todas' && !buscaAplicada.trim();

  // ============================================
  // DATA LOADING
  // ============================================

  const loadRotas = useCallback(async () => {
    if (!filtros) return;

    const chave = JSON.stringify(filtros);
    if (chave !== chaveFiltrosRef.current) {
      chaveFiltrosRef.current = chave;
      quantidadeRef.current = TAMANHO_PAGINA_ROTAS;
    }

    // Loja trocada: a lista, o total e as contagens da anterior saem da tela
    // e o carregamento aparece (ou o cache da loja nova, logo abaixo). Sem
    // isso, um erro na carga ofereceria os dados da OUTRA loja como "dados
    // de HH:MM".
    if (lojaDaCargaRef.current !== filtros.unidadeId) {
      if (lojaDaCargaRef.current !== null) {
        jaMostrouRef.current = false;
        ultimaCargaOkRef.current = null;
        setRotas([]);
        setTotal(null);
        setContagens(null);
        setErroCarga(null);
        setDadosDe(null);
        setLoading(true);
      }
      lojaDaCargaRef.current = filtros.unidadeId;
    }

    // Esta carga substitui a anterior e qualquer "carregar mais" em voo (ela
    // já traz a quantidade aumentada).
    abortControllerRef.current?.abort();
    maisControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;
    cargaEmVooRef.current = true;

    // Stale-while-revalidate: show cache first (só na visão sem filtro)
    const cache = visaoPadrao ? await loadFromCache() : null;
    const cachedData = cache?.data ?? null;
    const temCache = !!cachedData && cachedData.length > 0;
    if (signal.aborted) return;
    if (temCache && !jaMostrouRef.current) {
      setRotas(cachedData);
      setLoading(false);
    }

    try {
      // Skeleton só enquanto nada foi mostrado: trocar a tela por
      // "Carregando" a cada filtro tiraria o foco da busca no meio da
      // digitação.
      if (!jaMostrouRef.current && !temCache) {
        setLoading(true);
      }

      // MOCK DATA FOR E2E/CI
      if (!isSupabaseConfigured) {
        logger.warn('[GestaoRotas] Mocking data for E2E/CI');
        await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate delay

        const mockRotas = rotasDeTesteDaGestao();
        setRotas(mockRotas);
        setTotal(mockRotas.length);
        jaMostrouRef.current = true;
        setLoading(false);
        return;
      }

      const [pagina, porStatus] = await Promise.all([
        buscarRotas({
          filtros,
          quantidade: quantidadeRef.current,
          contar: true,
          signal,
        }),
        contarRotasPorStatus(filtros, signal),
      ]);
      if (signal.aborted) return;

      setRotas(pagina.rotas);
      setTotal(pagina.total);
      setContagens(porStatus);
      jaMostrouRef.current = true;
      setErroCarga(null);
      setDadosDe(null);
      ultimaCargaOkRef.current = Date.now();

      // Save to cache for future use
      if (visaoPadrao) await saveToCache(pagina.rotas);
    } catch (error) {
      // Cancelamento pedido pelo próprio hook (carga nova, saída da tela):
      // um aviso aqui seria de um erro que o app decidiu ter, não que
      // aconteceu.
      if (foiCancelamento(error) || signal.aborted) return;
      logger.error('Erro ao carregar rotas:', error);
      setErroCarga('Não foi possível carregar as rotas.');
      setDadosDe(
        temCache ? (cache?.timestamp ?? null) : ultimaCargaOkRef.current,
      );
    } finally {
      if (abortControllerRef.current === controller) {
        cargaEmVooRef.current = false;
        setLoading(false);
      }
    }
  }, [filtros, visaoPadrao, loadFromCache, saveToCache]);

  const temMais = total !== null && rotas.length < total;

  const carregarMais = useCallback(async () => {
    // Com uma carga em voo o toque é ignorado: o cursor de agora ficaria
    // velho quando ela chegasse, e recarregar a cada toque somava 100 por
    // toque e reiniciava a carga (três toques impacientes = 400 rotas).
    if (
      !filtros ||
      !temMais ||
      maisControllerRef.current ||
      cargaEmVooRef.current
    ) {
      return;
    }
    quantidadeRef.current += TAMANHO_PAGINA_ROTAS;

    const controller = new AbortController();
    maisControllerRef.current = controller;
    setCarregandoMais(true);
    try {
      const atuais = rotasRef.current;
      const ultima = atuais[atuais.length - 1];
      const { rotas: novas } = await buscarRotas({
        filtros,
        quantidade: TAMANHO_PAGINA_ROTAS,
        cursor: ultima ? { data: ultima.data, id: ultima.id } : undefined,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setRotas((anteriores) => {
        const vistas = new Set(anteriores.map((r) => r.id));
        return [...anteriores, ...novas.filter((r) => !vistas.has(r.id))];
      });
    } catch (error) {
      if (foiCancelamento(error) || controller.signal.aborted) return;
      quantidadeRef.current -= TAMANHO_PAGINA_ROTAS;
      logger.error('Erro ao carregar mais rotas:', error);
      showToast('Não foi possível carregar mais rotas.', 'error', 5000);
    } finally {
      if (maisControllerRef.current === controller) {
        maisControllerRef.current = null;
      }
      if (montadoRef.current) setCarregandoMais(false);
    }
  }, [filtros, temMais, showToast]);

  // ============================================
  // EFFECTS
  // ============================================

  // Load routes on mount, unit change and filter change
  useEffect(() => {
    // Disparo proposital, sem espera: o carregador trata o próprio erro (try/catch com log).
    void loadRotas();
  }, [loadRotas]);

  // Saída da tela: cancela carga, "carregar mais" e exportação.
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      abortControllerRef.current?.abort();
      maisControllerRef.current?.abort();
      exportControllerRef.current?.abort();
    };
  }, []);

  // Realtime: Update when routes/stops change
  useRealtimeRoutes({
    enabled: !!unidadeAtiva,
    onRouteUpdate: () => {
      // Disparo proposital, sem espera: o carregador trata o próprio erro (try/catch com log).
      void loadRotas();
    },
  });

  // ============================================
  // ACTIONS
  // ============================================

  const verDetalhes = useCallback(
    (rota: RotaHistorico) => {
      router.push({
        pathname: '/gestor/mapa-rota',
        params: { id: rota.id },
      });
    },
    [router],
  );

  /**
   * Exporta TODAS as rotas que casam com o filtro e a busca (não só as
   * carregadas na lista), na ordenação escolhida na tabela. Busca em páginas
   * até o fim ou até `TETO_EXPORTACAO_ROTAS`, mostrando o progresso; sair da
   * tela cancela sem gravar arquivo.
   */
  const exportar = useCallback(
    async (formato: 'csv' | 'xlsx') => {
      if (exportControllerRef.current) return; // já exportando
      const gerar = formato === 'csv' ? exportRotasToCSV : exportRotasToXLSX;

      // E2E/CI sem Supabase: exporta o que está na tela.
      if (!isSupabaseConfigured || !filtros) {
        await gerar({
          rotas: rotasFiltradas,
          filtroStatus,
          userId: userData?.id,
          periodo: { de: periodoDe, ate: periodoAte },
        });
        return;
      }

      const controller = new AbortController();
      exportControllerRef.current = controller;
      const teto = TETO_EXPORTACAO_ROTAS;
      setExportacao({ formato, carregadas: 0, total: null });
      try {
        const { rotas: todas, total: totalDaBusca } = await buscarRotas({
          filtros,
          quantidade: teto,
          contar: true,
          signal: controller.signal,
          aoProgredir: (carregadas, totalDaLoja) => {
            if (!montadoRef.current) return;
            setExportacao({
              formato,
              carregadas,
              total: totalDaLoja === null ? null : Math.min(totalDaLoja, teto),
            });
          },
        });
        if (controller.signal.aborted) return;

        // Período sem rota: nada de arquivo vazio, só o aviso.
        if (todas.length === 0) {
          showToast(
            periodoDe === null && periodoAte === null
              ? 'Nenhuma rota com estes filtros'
              : 'Nenhuma rota no período',
            'info',
            5000,
          );
          return;
        }

        await gerar({
          rotas: ordenarRotas(todas, sortColumn, sortDirection),
          filtroStatus,
          userId: userData?.id,
          periodo: { de: periodoDe, ate: periodoAte },
        });

        if (totalDaBusca !== null && totalDaBusca > todas.length) {
          showToast(
            `Exportadas as ${formatarDecimal(todas.length, 0)} rotas mais recentes de ${formatarDecimal(totalDaBusca, 0)}. ` +
              'Use a busca ou o filtro para exportar as demais.',
            'info',
            8000,
          );
        }
      } catch (error) {
        if (foiCancelamento(error) || controller.signal.aborted) return;
        logger.error('Erro ao buscar rotas para exportar:', error);
        showToast('Não foi possível exportar as rotas.', 'error', 5000);
      } finally {
        if (exportControllerRef.current === controller) {
          exportControllerRef.current = null;
        }
        if (montadoRef.current) setExportacao(null);
      }
    },
    [
      filtros,
      rotasFiltradas,
      filtroStatus,
      periodoDe,
      periodoAte,
      userData?.id,
      sortColumn,
      sortDirection,
      showToast,
    ],
  );

  const exportarParaCSV = useCallback(() => exportar('csv'), [exportar]);
  const exportarParaXLSX = useCallback(() => exportar('xlsx'), [exportar]);

  // ============================================
  // HELPERS
  // ============================================

  const getStatusLabel = useCallback((status: RotaStatus | string): string => {
    return getRotaStatusLabel(status);
  }, []);

  const getStatusColor = useCallback(
    (status: RotaStatus | string): string => {
      return statusColorMap[status as RotaStatus] ?? defaultStatusColor;
    },
    [statusColorMap, defaultStatusColor],
  );

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    rotas,
    rotasFiltradas,
    total,
    temMais,
    carregandoMais,
    contagens,
    exportacao,
    loading,
    erroCarga,
    dadosDe,
    filtroStatus,
    searchQuery,
    periodo,
    userData,

    // State Setters
    setFiltroStatus,
    definirPeriodo,
    setSearchQuery,

    // Sorting
    sortColumn,
    sortDirection,
    handleSort,

    // Actions
    loadRotas,
    carregarMais,
    verDetalhes,
    exportarParaCSV,
    exportarParaXLSX,

    // Helpers
    getStatusLabel,
    getStatusColor,
  };
}
