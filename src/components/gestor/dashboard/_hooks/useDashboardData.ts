import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { useRealtimeRoutes } from '@/hooks/useRealtimeRoutes';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { getTodayISO, toLocalISODate } from '@/lib/dateUtils';
import { logger } from '@/lib/logger';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface Stats {
  total: number;
  emAndamento: number;
  concluidas: number;
  distanciaTotal: number;
  /** null = indisponível (a contagem falhou); a tela mostra "—". */
  incidentesAbertos?: number | null;
}

export interface TodayStats {
  totalHoje: number;
}

export interface KPIs {
  rotasSemana: number;
  rotasMes: number;
  taxaSucesso: number;
  tempoMedioMinutos: number;
  totalParadas: number;
  paradasConcluidas: number;
  motoristaDestaque: {
    nome: string;
    rotasConcluidas: number;
  } | null;
}

export interface RotaResumo {
  id: string;
  data: string;
  status: string;
  motorista_nome: string;
  motorista_id: string | null;
  total_paradas: number;
  paradas_concluidas: number;
  distancia_total: number;
}

export interface DashboardData {
  stats: Stats;
  todayStats: TodayStats;
  kpis: KPIs;
  rotas: RotaResumo[];
  loading: boolean;
  refreshing: boolean;
  /** Erro da última carga (null = ok). */
  erroCarga: string | null;
  /** Com erro e dados anteriores na tela: de quando são (epoch ms). */
  dadosDe: number | null;
  onRefresh: () => Promise<void>;
  userData: any;
}

export interface UseDashboardDataOptions {
  filters?: {
    status?: string | null;
    dataInicio?: Date | null;
    dataFim?: Date | null;
    motoristaId?: string | null;
  };
}

// ============================================================================
// HELPERS - Funções utilitárias extraídas
// ============================================================================

/**
 * Valida e formata uma data para string ISO (YYYY-MM-DD)
 */
function formatDateToISO(date: Date | null | undefined): string | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return null;
  return toLocalISODate(parsed);
}

/**
 * Calcula o tempo médio de conclusão das rotas em minutos
 */
function calcularTempoMedio(rotas: any[]): number {
  let tempoTotalMinutos = 0;
  let rotasComTempo = 0;

  rotas.forEach((rota) => {
    if (rota.status === 'concluida' && rota.iniciada_em && rota.concluida_em) {
      const inicio = new Date(rota.iniciada_em);
      const fim = new Date(rota.concluida_em);
      const diffMinutos = (fim.getTime() - inicio.getTime()) / (1000 * 60);
      // Ignora tempos inválidos (negativos ou maiores que 24h)
      if (diffMinutos > 0 && diffMinutos < 1440) {
        tempoTotalMinutos += diffMinutos;
        rotasComTempo++;
      }
    }
  });

  return rotasComTempo > 0 ? Math.round(tempoTotalMinutos / rotasComTempo) : 0;
}

/**
 * Encontra o motorista com mais rotas concluídas
 */
function encontrarMotoristaDestaque(
  rotas: any[],
): { nome: string; rotasConcluidas: number } | null {
  const motoristasCount: Record<string, { nome: string; count: number }> = {};

  rotas.forEach((rota) => {
    if (rota.status === 'concluida' && rota.motorista_id) {
      const nome = rota.usuarios?.nome || 'Desconhecido';
      if (!motoristasCount[rota.motorista_id]) {
        motoristasCount[rota.motorista_id] = { nome, count: 0 };
      }
      motoristasCount[rota.motorista_id].count++;
    }
  });

  let motoristaDestaque: { nome: string; rotasConcluidas: number } | null =
    null;
  let maxRotas = 0;

  Object.values(motoristasCount).forEach((m) => {
    if (m.count > maxRotas) {
      maxRotas = m.count;
      motoristaDestaque = { nome: m.nome, rotasConcluidas: m.count };
    }
  });

  return motoristaDestaque;
}

/**
 * Processa os dados das rotas vindas do Supabase (com JOIN de paradas)
 */
function processarRotasComParadas(rotasData: any[]): RotaResumo[] {
  return rotasData.map((rota) => {
    // Filtra apenas paradas reais (checkpoints, não base)
    const paradasReais = (rota.paradas || []).filter(
      (parada: any) => parada.is_checkpoint !== false,
    );

    return {
      id: rota.id,
      data: rota.data,
      status: rota.status,
      motorista_nome: rota.usuarios?.nome || 'Sem motorista',
      motorista_id: rota.motorista_id,
      total_paradas: paradasReais.length,
      paradas_concluidas: paradasReais.filter(
        (p: any) => p.status === 'concluida',
      ).length,
      distancia_total: rota.distancia_total || 0,
    };
  });
}

/** Paradas e taxa de sucesso: derivados da lista, acompanham cada evento. */
function kpisDaLista(
  rotas: RotaResumo[],
): Pick<KPIs, 'totalParadas' | 'paradasConcluidas' | 'taxaSucesso'> {
  const totalParadas = rotas.reduce((sum, r) => sum + r.total_paradas, 0);
  const paradasConcluidas = rotas.reduce(
    (sum, r) => sum + r.paradas_concluidas,
    0,
  );
  return {
    totalParadas,
    paradasConcluidas,
    taxaSucesso:
      totalParadas > 0
        ? Math.round((paradasConcluidas / totalParadas) * 100)
        : 0,
  };
}

interface FiltrosDaLista {
  unidadeId: string;
  dataInicioStr: string | null;
  dataFimStr: string | null;
  filtroStatus: string | null;
  filtroMotoristaId: string | null;
}

/**
 * Rotas do período/filtro COM paradas numa query só (JOIN). Com
 * `buscarTotalHoje`, é o que muda com um evento de rota/parada.
 */
async function buscarLista(f: FiltrosDaLista): Promise<RotaResumo[]> {
  const hoje = getTodayISO();
  let query = supabase
    .from('rotas')
    .select(
      `
      id,
      data,
      status,
      distancia_total,
      motorista_id,
      usuarios!motorista_id(nome),
      paradas(id, status, is_checkpoint)
    `,
    )
    .eq('unidade_id', f.unidadeId);

  // Aplicar filtros de data
  if (!f.dataInicioStr && !f.dataFimStr) {
    // Por padrão, só as rotas de HOJE. Era `gte(hoje)` sem limite
    // superior: "hoje" incluía as rotas já agendadas para amanhã.
    query = query.eq('data', hoje);
  } else {
    query = query.gte('data', f.dataInicioStr ?? hoje);
    if (f.dataFimStr) {
      query = query.lte('data', f.dataFimStr);
    }
  }
  if (f.filtroStatus) query = query.eq('status', f.filtroStatus);
  if (f.filtroMotoristaId) {
    query = query.eq('motorista_id', f.filtroMotoristaId);
  }
  query = query.order('created_at', { ascending: false });

  const { data: rotasData, error: rotasError } = await query;
  if (rotasError) throw rotasError;
  return processarRotasComParadas(rotasData || []);
}

/** Rotas de hoje da loja (ignora os filtros). null = a consulta falhou. */
async function buscarTotalHoje(unidadeId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('rotas')
    .select('id')
    .eq('unidade_id', unidadeId)
    .eq('data', getTodayISO());
  return !error && data ? data.length : null;
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

/**
 * Hook compartilhado para dados do dashboard
 * Usado tanto na versão mobile quanto desktop
 */
export function useDashboardData(
  options: UseDashboardDataOptions = {},
): DashboardData {
  const { filters } = options;
  // Filtros por VALOR (primitivos), não pela identidade do objeto: quem
  // chama com `{ status }` literal criaria um objeto novo a cada render, e
  // como toda carga nova agora roda, isso viraria recarga em laço.
  const dataInicioStr = formatDateToISO(filters?.dataInicio);
  const dataFimStr = formatDateToISO(filters?.dataFim);
  const filtroStatus = filters?.status ?? null;
  const filtroMotoristaId = filters?.motoristaId ?? null;
  const { userData } = useUser();
  const { unidadeAtiva } = useUnidadeAtiva();
  const unidadeId = unidadeAtiva;

  // Estados
  const [stats, setStats] = useState<Stats>({
    total: 0,
    emAndamento: 0,
    concluidas: 0,
    distanciaTotal: 0,
  });
  const [todayStats, setTodayStats] = useState<TodayStats>({ totalHoje: 0 });
  const [kpis, setKpis] = useState<KPIs>({
    rotasSemana: 0,
    rotasMes: 0,
    taxaSucesso: 0,
    tempoMedioMinutos: 0,
    totalParadas: 0,
    paradasConcluidas: 0,
    motoristaDestaque: null,
  });
  const [rotas, setRotas] = useState<RotaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [dadosDe, setDadosDe] = useState<number | null>(null);
  const ultimaCargaOkRef = useRef<number | null>(null);
  // O erro na tela veio de um evento (carga ao vivo), não da carga completa.
  const erroDoVivoRef = useRef(false);

  // Refs para controle de execução
  // Contador de requisição: toda carga nova roda (troca de filtro/unidade com
  // outra em voo não é mais descartada) e só a MAIS RECENTE escreve no
  // estado — a resposta velha que chega depois é ignorada. Antes, um
  // `loadingRef` fazia a nova carga simplesmente não rodar.
  //
  // Dois contadores (DP-7): a carga ao vivo (evento de realtime) só refaz a
  // lista e o "hoje", então só disputa com a lista da carga completa. Com um
  // contador só, um evento no meio da carga completa descartaria os KPIs
  // dela, que o evento não refaz.
  const requisicaoListaRef = useRef(0);
  const requisicaoCompletaRef = useRef(0);
  const mountedRef = useRef(true);
  // `loading` desmonta a página inteira: DesktopPageLayout e DashboardMobile
  // retornam só o spinner quando ele é true. Por isso ele vale apenas para a
  // carga inicial; recarga por filtro sinaliza via `refreshing`, que preserva a
  // árvore. Mesma regra do useGestaoRotas ("only show loading if no cache").
  const cargaInicialFeitaRef = useRef(false);

  // ============================================================================
  // FUNÇÃO PRINCIPAL DE FETCH (extraída para eliminar duplicação)
  // ============================================================================
  const fetchDashboardData = useCallback(
    async (isRefresh = false) => {
      if (!mountedRef.current) return;

      const minhaLista = ++requisicaoListaRef.current;
      const minhaCompleta = ++requisicaoCompletaRef.current;
      const vigente = () =>
        mountedRef.current && minhaCompleta === requisicaoCompletaRef.current;
      // A lista desta carga ainda é a mais nova (nenhum evento depois dela).
      const listaVigente = () =>
        mountedRef.current && minhaLista === requisicaoListaRef.current;

      // Se não há unidade, limpar dados
      if (!unidadeId) {
        if (mountedRef.current) {
          setStats({
            total: 0,
            emAndamento: 0,
            concluidas: 0,
            distanciaTotal: 0,
          });
          setTodayStats({ totalHoje: 0 });
          setRotas([]);
          setLoading(false);
          setRefreshing(false);
        }
        return;
      }

      try {
        if (mountedRef.current) {
          if (isRefresh || cargaInicialFeitaRef.current) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }
        }

        // MOCK DATA FOR E2E/CI
        if (!isSupabaseConfigured) {
          logger.warn('[Dashboard] Mocking data for E2E/CI');
          await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate delay

          if (!vigente()) return;

          const mockRotas: RotaResumo[] = [
            {
              id: 'rota-1',
              data: new Date().toISOString(),
              status: 'em_andamento',
              motorista_nome: 'Motorista Teste 1',
              motorista_id: 'mot-1',
              total_paradas: 10,
              paradas_concluidas: 4,
              distancia_total: 15.5,
            },
            {
              id: 'rota-2',
              data: new Date().toISOString(),
              status: 'concluida',
              motorista_nome: 'Motorista Teste 2',
              motorista_id: 'mot-2',
              total_paradas: 8,
              paradas_concluidas: 8,
              distancia_total: 12.0,
            },
            {
              id: 'rota-3',
              data: new Date().toISOString(),
              status: 'pendente',
              motorista_nome: 'Sem motorista',
              motorista_id: null,
              total_paradas: 5,
              paradas_concluidas: 0,
              distancia_total: 8.2,
            },
          ];

          setRotas(mockRotas);
          setStats({
            total: 3,
            emAndamento: 1,
            concluidas: 1,
            distanciaTotal: 35.7,
            incidentesAbertos: 1,
          });
          setTodayStats({ totalHoje: 3 });
          setKpis({
            rotasSemana: 15,
            rotasMes: 45,
            taxaSucesso: 95,
            tempoMedioMinutos: 45,
            totalParadas: 150,
            paradasConcluidas: 142,
            motoristaDestaque: {
              nome: 'Motorista Teste 2',
              rotasConcluidas: 20,
            },
          });

          return;
        }

        const hoje = getTodayISO();

        // Lista e "hoje" (o que um evento também refaz), em paralelo com
        // incidentes e KPIs de semana/mês (só na carga completa).
        const listaPromise = buscarLista({
          unidadeId,
          dataInicioStr,
          dataFimStr,
          filtroStatus,
          filtroMotoristaId,
        });
        const totalHojePromise = buscarTotalHoje(unidadeId);
        // Rejeição tratada pelo `await` abaixo; isto só evita o aviso de
        // promessa rejeitada sem dono se a lista falhar antes.
        totalHojePromise.catch(() => {});

        // =====================================================================
        // BUSCAR INCIDENTES ABERTOS (em paralelo com outras queries)
        // =====================================================================
        // Pela LOJA GRAVADA NO INCIDENTE (`unidade_id`, Migration 43), não
        // pelos motoristas da loja: motorista que atende duas lojas levava
        // os incidentes da outra loja junto — inclusive os sem rota.
        const incidentesPromise = (async () => {
          const { count, error } = await supabase
            .from('incidentes')
            .select('id', { count: 'exact', head: true })
            .eq('unidade_id', unidadeId)
            .eq('status', 'aberto');
          // Erro vira INDISPONÍVEL (null), nunca 0: "0 incidentes abertos" é
          // uma afirmação, e seria falsa.
          if (error) {
            logger.warn(
              '[Dashboard] contagem de incidentes indisponível',
              error,
            );
            return null;
          }
          return count || 0;
        })();

        // =====================================================================
        // BUSCAR KPIS (semana e mês) - só na carga completa (inicial, filtro,
        // refresh manual); eventos de realtime não refazem (DP-7)
        // =====================================================================
        const agora = new Date();
        const inicioSemana = new Date(agora);
        inicioSemana.setDate(agora.getDate() - agora.getDay());
        const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

        const kpisPromise = Promise.all([
          supabase
            .from('rotas')
            .select(
              'id, status, iniciada_em, concluida_em, motorista_id, usuarios!motorista_id(nome)',
            )
            .eq('unidade_id', unidadeId)
            .gte('data', toLocalISODate(inicioSemana))
            .lte('data', hoje),
          supabase
            .from('rotas')
            .select(
              'id, status, iniciada_em, concluida_em, motorista_id, usuarios!motorista_id(nome)',
            )
            .eq('unidade_id', unidadeId)
            .gte('data', toLocalISODate(inicioMes))
            .lte('data', hoje),
        ]);

        // Executar queries em paralelo
        // A lista aparece assim que chega, sem esperar o resto.
        const rotasComDetalhes = await listaPromise;
        // Um evento depois desta carga já trouxe lista mais nova: ela fica.
        if (listaVigente()) setRotas(rotasComDetalhes);
        if (!vigente()) return;

        const [totalHoje, incidentesAbertos, kpisResult] = await Promise.all([
          totalHojePromise,
          incidentesPromise,
          kpisPromise,
        ]);
        if (listaVigente() && totalHoje !== null) {
          setTodayStats({ totalHoje });
        }

        if (!vigente()) return;

        // Calcular estatísticas
        const statsData: Stats = {
          total: rotasComDetalhes.length,
          emAndamento: rotasComDetalhes.filter(
            (r) => r.status === 'em_andamento',
          ).length,
          concluidas: rotasComDetalhes.filter((r) => r.status === 'concluida')
            .length,
          distanciaTotal: rotasComDetalhes.reduce(
            (sum, r) => sum + r.distancia_total,
            0,
          ),
          incidentesAbertos,
        };

        setStats(statsData);

        // KPIs
        const [kpiSemana, kpiMes] = kpisResult;
        const rotasSemanaData = kpiSemana.data || [];
        const rotasMesData = kpiMes.data || [];

        const listaEhDestaCarga = listaVigente();
        setKpis((anteriores) => ({
          rotasSemana: rotasSemanaData.length,
          rotasMes: rotasMesData.length,
          tempoMedioMinutos: calcularTempoMedio(rotasMesData),
          motoristaDestaque: encontrarMotoristaDestaque(rotasMesData),
          // Com lista mais nova (evento), os derivados dela continuam valendo.
          ...(listaEhDestaCarga
            ? kpisDaLista(rotasComDetalhes)
            : {
                totalParadas: anteriores.totalParadas,
                paradasConcluidas: anteriores.paradasConcluidas,
                taxaSucesso: anteriores.taxaSucesso,
              }),
        }));
        setErroCarga(null);
        setDadosDe(null);
        erroDoVivoRef.current = false;
        ultimaCargaOkRef.current = Date.now();
      } catch (error) {
        logger.error('Erro ao carregar dashboard:', error);
        if (vigente()) {
          // Os dados anteriores (se houver) ficam na tela, com o horário.
          setErroCarga('Não foi possível carregar o painel.');
          setDadosDe(ultimaCargaOkRef.current);
        }
      } finally {
        // Marca fora do `if`: a tentativa aconteceu, então a próxima
        // passagem é recarga, não carga inicial.
        cargaInicialFeitaRef.current = true;
        // Só a carga mais recente encerra os indicadores: a velha que
        // termina depois não pode apagar o "atualizando" da nova.
        if (vigente()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [unidadeId, dataInicioStr, dataFimStr, filtroStatus, filtroMotoristaId],
  );

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Cleanup ao desmontar
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Carregar dados quando unidadeId ou filters mudam
  useEffect(() => {
    fetchDashboardData(false);
  }, [fetchDashboardData]);

  // ============================================================================
  // CARGA AO VIVO (evento de realtime, já com debounce em useRealtimeRoutes)
  // ============================================================================
  // Rota/parada mudou: refaz só a lista e o "hoje" (e os KPIs que derivam da
  // lista). Antes cada evento rodava as 5 consultas, inclusive as de KPI da
  // semana e do mês — as mais pesadas, e que um evento quase não muda (DP-7).
  const carregarAoVivo = useCallback(async () => {
    if (!mountedRef.current || !unidadeId || !isSupabaseConfigured) return;
    const minhaLista = ++requisicaoListaRef.current;
    const vigente = () =>
      mountedRef.current && minhaLista === requisicaoListaRef.current;
    try {
      const [lista, totalHoje] = await Promise.all([
        buscarLista({
          unidadeId,
          dataInicioStr,
          dataFimStr,
          filtroStatus,
          filtroMotoristaId,
        }),
        buscarTotalHoje(unidadeId),
      ]);
      if (!vigente()) return;
      setRotas(lista);
      if (totalHoje !== null) setTodayStats({ totalHoje });
      setKpis((anteriores) => ({ ...anteriores, ...kpisDaLista(lista) }));
      // Só apaga o erro que um evento causou: o da carga completa (KPIs,
      // incidentes) continua até ela dar certo.
      if (erroDoVivoRef.current) {
        erroDoVivoRef.current = false;
        setErroCarga(null);
        setDadosDe(null);
      }
      ultimaCargaOkRef.current = Date.now();
    } catch (error) {
      logger.error('Erro ao atualizar dashboard (evento):', error);
      if (vigente()) {
        erroDoVivoRef.current = true;
        setErroCarga('Não foi possível carregar o painel.');
        setDadosDe(ultimaCargaOkRef.current);
      }
    }
  }, [unidadeId, dataInicioStr, dataFimStr, filtroStatus, filtroMotoristaId]);

  // Realtime: Escutar mudanças em rotas e paradas
  useRealtimeRoutes({
    enabled: !!unidadeId,
    onRouteUpdate: () => {
      void carregarAoVivo();
    },
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const onRefresh = useCallback(async () => {
    await fetchDashboardData(true);
  }, [fetchDashboardData]);

  // ============================================================================
  // MEMOIZAÇÃO
  // ============================================================================

  const calculatedStats = useMemo<Stats>(() => {
    if (rotas.length === 0) {
      return {
        total: 0,
        emAndamento: 0,
        concluidas: 0,
        distanciaTotal: 0,
        incidentesAbertos:
          stats.incidentesAbertos === null
            ? null
            : stats.incidentesAbertos || 0,
      };
    }

    return {
      total: rotas.length,
      emAndamento: rotas.filter((r) => r.status === 'em_andamento').length,
      concluidas: rotas.filter((r) => r.status === 'concluida').length,
      distanciaTotal: rotas.reduce((sum, r) => sum + r.distancia_total, 0),
      incidentesAbertos:
        stats.incidentesAbertos === null ? null : stats.incidentesAbertos || 0,
    };
  }, [rotas, stats.incidentesAbertos]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    stats: calculatedStats,
    todayStats,
    kpis,
    rotas,
    loading,
    refreshing,
    erroCarga,
    dadosDe,
    onRefresh,
    userData,
  };
}
