import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { useRealtimeRoutes } from '@/hooks/useRealtimeRoutes';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { getTodayISO, parseLocalDate, toLocalISODate } from '@/lib/dateUtils';
import { nomeMotoristaDaRota } from '@/lib/gestor/consultaRotas';
import { dadosDeTesteDoInicio } from '@/lib/gestor/dadosDeTeste';
import { buscarNomesForaDaLoja } from '@/lib/gestor/nomesMotoristasForaDaLoja';
import { logger } from '@/lib/logger';
import { resolverPeriodo, type IntervaloDatas } from '@/lib/periodo';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { StatusParada } from '@/types/rota';
import type { Usuario } from '@/types/usuario';

import { LIMITE_ROTAS_SEM_INICIO } from '../limiteDaLista';

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
  /** null = indisponível (a consulta falhou); a tela mostra "—", nunca 0. */
  rotasSemana: number | null;
  /** null = indisponível (a consulta do mês falhou). */
  rotasMes: number | null;
  taxaSucesso: number;
  /** null = indisponível (a consulta do mês falhou). */
  tempoMedioMinutos: number | null;
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
  /**
   * Estado de cada parada real (sem partida e chegada), na ordem de
   * `paradas.ordem`. Alimenta a linha de paradas da Início desktop.
   */
  paradas_status: StatusParada[];
}

export interface DashboardData {
  stats: Stats;
  todayStats: TodayStats;
  kpis: KPIs;
  rotas: RotaResumo[];
  /**
   * A lista sem início ("Todo o período") bateu no limite
   * (`LIMITE_ROTAS_SEM_INICIO`): a tela avisa que mostra só as mais recentes.
   */
  listaCortada: boolean;
  loading: boolean;
  refreshing: boolean;
  /** Erro da última carga (null = ok). */
  erroCarga: string | null;
  /** Com erro e dados anteriores na tela: de quando são (epoch ms). */
  dadosDe: number | null;
  onRefresh: () => Promise<void>;
  userData: Usuario | null;
}

export interface UseDashboardDataOptions {
  /**
   * Intervalo do período escolhido (`resolverPeriodo`). `null` = o período
   * lembrado ainda não carregou: nada é consultado e a tela segue carregando.
   */
  periodo: IntervaloDatas | null;
  filters?: {
    status?: string | null;
    motoristaId?: string | null;
  };
  /**
   * Busca o que só o mobile mostra: rotas da semana e do mês (KPIs), nomes do
   * destaque e o total de hoje. O desktop passa `false` e não paga essas
   * consultas. Padrão `true`; mudar o valor recarrega.
   */
  comKpis?: boolean;
}

// ============================================================================
// HELPERS - Funções utilitárias extraídas
// ============================================================================

/** Embed `usuarios` do PostgREST: objeto (muitos-para-um) ou lista. */
type EmbedNome = { nome?: unknown } | { nome?: unknown }[] | null | undefined;

/** Linha de `rotas` como as consultas do painel a trazem. */
interface LinhaRota {
  id: string;
  data: string;
  status: string;
  motorista_id: string | null;
  iniciada_em?: string | null;
  concluida_em?: string | null;
  distancia_total?: number | null;
  usuarios?: EmbedNome;
  paradas?:
    | {
        status: string;
        is_checkpoint?: boolean | null;
        ordem?: number | null;
      }[]
    | null;
}

/**
 * Calcula o tempo médio de conclusão das rotas em minutos
 */
function calcularTempoMedio(
  rotas: Pick<LinhaRota, 'status' | 'iniciada_em' | 'concluida_em'>[],
): number {
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
 * Encontra o motorista com mais rotas concluídas.
 * `nomesForaDaLoja`: rotaId → nome que a RPC da Migration 72 devolveu para o
 * motorista que a RLS esconde (`buscarNomesForaDaLoja`); sem ele, o rótulo é o
 * mesmo das listas (`nomeMotoristaDaRota`), nunca "Desconhecido".
 */
function encontrarMotoristaDestaque(
  rotas: Pick<LinhaRota, 'id' | 'status' | 'motorista_id' | 'usuarios'>[],
  nomesForaDaLoja: Map<string, string> = new Map(),
): { nome: string; rotasConcluidas: number } | null {
  const motoristasCount: Record<
    string,
    { visivel: string | null; foraDaLoja: string | null; count: number }
  > = {};

  rotas.forEach((rota) => {
    if (rota.status === 'concluida' && rota.motorista_id) {
      const m = (motoristasCount[rota.motorista_id] ??= {
        visivel: null,
        foraDaLoja: null,
        count: 0,
      });
      // O nome vem de qualquer rota do motorista: o visível ganha do da RPC.
      m.visivel ??= nomeDoEmbed(rota.usuarios);
      m.foraDaLoja ??= nomesForaDaLoja.get(rota.id) ?? null;
      m.count++;
    }
  });

  let motoristaDestaque: { nome: string; rotasConcluidas: number } | null =
    null;
  let maxRotas = 0;

  Object.entries(motoristasCount).forEach(([motoristaId, m]) => {
    if (m.count > maxRotas) {
      maxRotas = m.count;
      motoristaDestaque = {
        nome: nomeMotoristaDaRota(m.visivel, motoristaId, m.foraDaLoja),
        rotasConcluidas: m.count,
      };
    }
  });

  return motoristaDestaque;
}

/**
 * Processa os dados das rotas vindas do Supabase (com JOIN de paradas).
 * `nomesForaDaLoja`: rotaId → nome do motorista que a RLS esconde (Migration
 * 72, `buscarNomesForaDaLoja`).
 */
function processarRotasComParadas(
  rotasData: LinhaRota[],
  nomesForaDaLoja: Map<string, string>,
): RotaResumo[] {
  return rotasData.map((rota) => {
    // Filtra apenas paradas reais (checkpoints, não base), na ordem da rota.
    // O embed do PostgREST não garante ordem: ordena aqui por `ordem`.
    const paradasReais = (rota.paradas || [])
      .filter((parada) => parada.is_checkpoint !== false)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

    return {
      id: rota.id,
      data: rota.data,
      status: rota.status,
      motorista_nome: nomeMotoristaDaRota(
        nomeDoEmbed(rota.usuarios),
        rota.motorista_id,
        nomesForaDaLoja.get(rota.id),
      ),
      motorista_id: rota.motorista_id,
      total_paradas: paradasReais.length,
      paradas_concluidas: paradasReais.filter((p) => p.status === 'concluida')
        .length,
      distancia_total: rota.distancia_total || 0,
      // O CHECK de `paradas.status` só aceita os 4 de StatusParada.
      paradas_status: paradasReais.map((p) => p.status as StatusParada),
    };
  });
}

/**
 * Nome do embed `usuarios`. Sem tipos gerados do banco, o PostgREST-js infere
 * o embed como lista; o servidor manda objeto (muitos-para-um). Aceita os dois.
 */
function nomeDoEmbed(embed: EmbedNome): string | null {
  const nome = Array.isArray(embed) ? embed[0]?.nome : embed?.nome;
  return typeof nome === 'string' ? nome : null;
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

/**
 * Janela máxima à frente de hoje quando o período não tem fim. Todo atalho e o
 * personalizado têm fim, então isso só vale para "Todo o período". A consulta
 * carrega as paradas embutidas e o custo cresce com as rotas futuras; rota
 * agendada com mais de 60 dias é rara, e quem precisa escolhe um período.
 */
const JANELA_PERIODO_ABERTO_DIAS = 60;

function tetoDoPeriodoAberto(inicio: string): string {
  const base = parseLocalDate(inicio) ?? new Date();
  base.setDate(base.getDate() + JANELA_PERIODO_ABERTO_DIAS);
  return toLocalISODate(base);
}

interface FiltrosDaLista {
  unidadeId: string;
  de: string | null;
  ate: string | null;
  filtroStatus: string | null;
  filtroMotoristaId: string | null;
}

interface ListaDoPeriodo {
  rotas: RotaResumo[];
  /** Havia mais rotas que `LIMITE_ROTAS_SEM_INICIO` (só sem início). */
  cortada: boolean;
}

/**
 * Rotas do período/filtro COM paradas numa query só (JOIN). Com
 * `buscarTotalHoje`, é o que muda com um evento de rota/parada.
 */
async function buscarLista(f: FiltrosDaLista): Promise<ListaDoPeriodo> {
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
      paradas(id, status, is_checkpoint, ordem)
    `,
    )
    .eq('unidade_id', f.unidadeId);

  // Intervalo fechado em `data` (coluna `date`: comparação de texto
  // 'AAAA-MM-DD', sem `new Date`). Sem fim ("Todo o período"), vale a janela
  // fixa a partir de hoje (ou do início, se for futuro).
  if (f.de) query = query.gte('data', f.de);
  const inicioDoTeto = f.de && f.de > hoje ? f.de : hoje;
  query = query.lte('data', f.ate ?? tetoDoPeriodoAberto(inicioDoTeto));
  if (f.filtroStatus) query = query.eq('status', f.filtroStatus);
  if (f.filtroMotoristaId) {
    query = query.eq('motorista_id', f.filtroMotoristaId);
  }
  // Data mais nova primeiro e, no mesmo dia, a rota criada por último (como
  // era antes do período); `id` só desempata. O índice
  // `idx_rotas_unidade_data_id` (Migration 90) cobre a data.
  query = query
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  // Sem início, a lista não tem fim para trás: limite com aviso. Pede uma a
  // mais para saber se havia mais (exatamente 500 não é "cortada").
  const semInicio = f.de === null;
  if (semInicio) query = query.limit(LIMITE_ROTAS_SEM_INICIO + 1);

  const { data: rotasData, error: rotasError } = await query;
  if (rotasError) throw rotasError;
  const todas = rotasData || [];
  const cortada = semInicio && todas.length > LIMITE_ROTAS_SEM_INICIO;
  const linhas = cortada ? todas.slice(0, LIMITE_ROTAS_SEM_INICIO) : todas;
  // Só as rotas com o motorista escondido pela RLS vão à RPC (em geral,
  // nenhuma: sem chamada). Erro dela não derruba a lista (Map vazio).
  const nomesForaDaLoja = await buscarNomesForaDaLoja(
    linhas.map((r) => ({
      id: r.id,
      motorista_id: r.motorista_id,
      nomeVisivel: nomeDoEmbed(r.usuarios),
    })),
  );
  return {
    rotas: processarRotasComParadas(linhas, nomesForaDaLoja),
    cortada,
  };
}

/** Rotas de hoje da loja (ignora os filtros). null = a consulta falhou. */
async function buscarTotalHoje(unidadeId: string): Promise<number | null> {
  // Contagem HEAD: só o total, sem baixar as linhas.
  const { count, error } = await supabase
    .from('rotas')
    .select('id', { count: 'exact', head: true })
    .eq('unidade_id', unidadeId)
    .eq('data', getTodayISO());
  return !error && count !== null ? count : null;
}

// Estado de "nada carregado ainda" (e de "loja trocada"): objetos no módulo,
// compartilhados só como valor inicial/reset — nunca mutados.
const HOJE_VAZIO: TodayStats = { totalHoje: 0 };
const KPIS_VAZIO: KPIs = {
  rotasSemana: 0,
  rotasMes: 0,
  taxaSucesso: 0,
  tempoMedioMinutos: 0,
  totalParadas: 0,
  paradasConcluidas: 0,
  motoristaDestaque: null,
};

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

/**
 * Hook compartilhado para dados do dashboard
 * Usado tanto na versão mobile quanto desktop
 */
export function useDashboardData(
  options: UseDashboardDataOptions,
): DashboardData {
  const { periodo, filters, comKpis = true } = options;
  // Filtros e período por VALOR (primitivos), não pela identidade do objeto:
  // quem chama com `{ status }` literal (ou com o intervalo resolvido a cada
  // render) criaria um objeto novo a cada render, e como toda carga nova
  // roda, isso viraria recarga em laço.
  const periodoPronto = periodo !== null;
  const de = periodo?.de ?? null;
  const ate = periodo?.ate ?? null;
  const filtroStatus = filters?.status ?? null;
  const filtroMotoristaId = filters?.motoristaId ?? null;
  const { userData } = useUser();
  const { unidadeAtiva, loading: lojaCarregando } = useUnidadeAtiva();
  const unidadeId = unidadeAtiva;

  // Estados
  // null = a contagem falhou (a tela mostra "—", nunca 0).
  const [incidentesAbertos, setIncidentesAbertos] = useState<number | null>(0);
  const [todayStats, setTodayStats] = useState<TodayStats>(HOJE_VAZIO);
  const [kpis, setKpis] = useState<KPIs>(KPIS_VAZIO);
  const [rotas, setRotas] = useState<RotaResumo[]>([]);
  const [listaCortada, setListaCortada] = useState(false);
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
  // Loja da última carga iniciada: se mudou, o que está na tela é de OUTRA
  // loja (ver o reset em `fetchDashboardData`).
  const lojaDaCargaRef = useRef<string | null>(null);

  // ============================================================================
  // FUNÇÃO PRINCIPAL DE FETCH (extraída para eliminar duplicação)
  // ============================================================================
  const fetchDashboardData = useCallback(
    async (isRefresh = false) => {
      // Período lembrado ainda carregando: consultar agora seria pelo padrão.
      if (!mountedRef.current || !periodoPronto) return;

      const minhaLista = ++requisicaoListaRef.current;
      const minhaCompleta = ++requisicaoCompletaRef.current;
      const vigente = () =>
        mountedRef.current && minhaCompleta === requisicaoCompletaRef.current;
      // A lista desta carga ainda é a mais nova (nenhum evento depois dela).
      const listaVigente = () =>
        mountedRef.current && minhaLista === requisicaoListaRef.current;

      // Tudo o que é da loja anterior: lista, KPIs, contagens, erro, "dados
      // de HH:MM" e a marca da última carga boa. Uma função só para o "sem
      // loja" e a troca de loja zerarem o MESMO conjunto — o "sem loja"
      // zerava só parte e deixava KPIs e a hora da loja anterior para a
      // próxima (o `lojaDaCargaRef` nulo pulava o zerar da troca).
      const zerarDadosDaLoja = () => {
        cargaInicialFeitaRef.current = false;
        ultimaCargaOkRef.current = null;
        erroDoVivoRef.current = false;
        if (!mountedRef.current) return;
        setIncidentesAbertos(0);
        setTodayStats(HOJE_VAZIO);
        setKpis(KPIS_VAZIO);
        setRotas([]);
        setListaCortada(false);
        setErroCarga(null);
        setDadosDe(null);
      };

      // Sem loja: nada a mostrar, e nada da anterior fica.
      if (!unidadeId) {
        lojaDaCargaRef.current = null;
        zerarDadosDaLoja();
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
        return;
      }

      // Loja trocada: lista, KPIs, contagens e erro da anterior saem da tela e
      // a carga inicial volta a valer (tela de carregamento, não a "recarga"
      // discreta). Sem isso, um erro na carga da loja nova ofereceria os dados
      // da OUTRA loja como "dados de HH:MM". Só a carga completa zera: o
      // evento de realtime (`carregarAoVivo`) é sempre da loja vigente.
      if (lojaDaCargaRef.current !== unidadeId) {
        if (lojaDaCargaRef.current !== null && mountedRef.current) {
          zerarDadosDaLoja();
        }
        lojaDaCargaRef.current = unidadeId;
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

          const teste = dadosDeTesteDoInicio();
          setRotas(teste.rotas);
          setListaCortada(false);
          setIncidentesAbertos(teste.stats.incidentesAbertos ?? 0);
          setTodayStats(teste.todayStats);
          setKpis(teste.kpis);

          return;
        }

        const hoje = getTodayISO();

        // Lista e "hoje" (o que um evento também refaz), em paralelo com
        // incidentes e KPIs de semana/mês (só na carga completa).
        const listaPromise = buscarLista({
          unidadeId,
          de,
          ate,
          filtroStatus,
          filtroMotoristaId,
        });
        // "Hoje" só o mobile mostra (`comKpis`).
        const totalHojePromise = comKpis ? buscarTotalHoje(unidadeId) : null;
        // Rejeição tratada pelo `await` abaixo; isto só evita o aviso de
        // promessa rejeitada sem dono se a lista falhar antes.
        totalHojePromise?.catch(() => {});

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
        // refresh manual); eventos de realtime não refazem (DP-7). Fixos,
        // independentes do período escolhido: a semana começa na segunda, e
        // os dois vão só até hoje (não contam o futuro).
        // =====================================================================
        const inicioSemana =
          resolverPeriodo({ tipo: 'esta_semana' }, hoje).de ?? hoje;
        const inicioMes =
          resolverPeriodo({ tipo: 'este_mes' }, hoje).de ?? hoje;

        const kpisPromise = comKpis
          ? Promise.all([
              supabase
                .from('rotas')
                .select(
                  'id, status, iniciada_em, concluida_em, motorista_id, usuarios!motorista_id(nome)',
                )
                .eq('unidade_id', unidadeId)
                .gte('data', inicioSemana)
                .lte('data', hoje),
              supabase
                .from('rotas')
                .select(
                  'id, status, iniciada_em, concluida_em, motorista_id, usuarios!motorista_id(nome)',
                )
                .eq('unidade_id', unidadeId)
                .gte('data', inicioMes)
                .lte('data', hoje),
            ])
          : null;

        // Executar queries em paralelo
        // A lista aparece assim que chega, sem esperar o resto.
        const { rotas: rotasComDetalhes, cortada } = await listaPromise;
        // Um evento depois desta carga já trouxe lista mais nova: ela fica.
        if (listaVigente()) {
          setRotas(rotasComDetalhes);
          setListaCortada(cortada);
        }
        if (!vigente()) return;

        const [totalHoje, incidentes, kpisResult] = await Promise.all([
          totalHojePromise,
          incidentesPromise,
          kpisPromise,
        ]);
        if (listaVigente() && totalHoje !== null) {
          setTodayStats({ totalHoje });
        }

        if (!vigente()) return;

        setIncidentesAbertos(incidentes);

        // Sem KPIs (desktop): só os derivados da lista, que não custam consulta.
        // Os de semana/mês não foram medidos: indisponíveis (null), nunca 0.
        if (!kpisResult) {
          if (listaVigente()) {
            setKpis((anteriores) => ({
              ...anteriores,
              rotasSemana: null,
              rotasMes: null,
              tempoMedioMinutos: null,
              motoristaDestaque: null,
              ...kpisDaLista(rotasComDetalhes),
            }));
          }
        } else {
          // KPIs
          const [kpiSemana, kpiMes] = kpisResult;
          // Erro vira INDISPONÍVEL (null), nunca 0: "0 rotas" seria falso.
          // Mesmo modelo de `incidentesAbertos`.
          if (kpiSemana.error) {
            logger.warn(
              '[Dashboard] KPI da semana indisponível',
              kpiSemana.error,
            );
          }
          if (kpiMes.error) {
            logger.warn('[Dashboard] KPI do mês indisponível', kpiMes.error);
          }
          const rotasSemanaData = kpiSemana.error ? null : kpiSemana.data || [];
          const rotasMesData = kpiMes.error ? null : kpiMes.data || [];

          // Só as concluídas sem nome visível vão à RPC (em geral, nenhuma:
          // sem chamada). Erro dela vira Map vazio e o KPI mostra o rótulo
          // oculto.
          const nomesDestaque = rotasMesData
            ? await buscarNomesForaDaLoja(
                rotasMesData
                  .filter((r) => r.status === 'concluida')
                  .map((r) => ({
                    id: r.id,
                    motorista_id: r.motorista_id,
                    nomeVisivel: nomeDoEmbed(r.usuarios),
                  })),
              )
            : new Map<string, string>();
          if (!vigente()) return;

          const listaEhDestaCarga = listaVigente();
          setKpis((anteriores) => ({
            rotasSemana: rotasSemanaData ? rotasSemanaData.length : null,
            rotasMes: rotasMesData ? rotasMesData.length : null,
            tempoMedioMinutos: rotasMesData
              ? calcularTempoMedio(rotasMesData)
              : null,
            motoristaDestaque: rotasMesData
              ? encontrarMotoristaDestaque(rotasMesData, nomesDestaque)
              : null,
            // Com lista mais nova (evento), os derivados dela continuam
            // valendo.
            ...(listaEhDestaCarga
              ? kpisDaLista(rotasComDetalhes)
              : {
                  totalParadas: anteriores.totalParadas,
                  paradasConcluidas: anteriores.paradasConcluidas,
                  taxaSucesso: anteriores.taxaSucesso,
                }),
          }));
        }
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
    [
      unidadeId,
      periodoPronto,
      de,
      ate,
      filtroStatus,
      filtroMotoristaId,
      comKpis,
    ],
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
    if (
      !mountedRef.current ||
      !periodoPronto ||
      !unidadeId ||
      !isSupabaseConfigured
    ) {
      return;
    }
    const minhaLista = ++requisicaoListaRef.current;
    const vigente = () =>
      mountedRef.current && minhaLista === requisicaoListaRef.current;
    try {
      const [lista, totalHoje] = await Promise.all([
        buscarLista({
          unidadeId,
          de,
          ate,
          filtroStatus,
          filtroMotoristaId,
        }),
        comKpis ? buscarTotalHoje(unidadeId) : Promise.resolve(null),
      ]);
      if (!vigente()) return;
      setRotas(lista.rotas);
      setListaCortada(lista.cortada);
      if (totalHoje !== null) setTodayStats({ totalHoje });
      setKpis((anteriores) => ({
        ...anteriores,
        ...kpisDaLista(lista.rotas),
      }));
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
  }, [
    unidadeId,
    periodoPronto,
    de,
    ate,
    filtroStatus,
    filtroMotoristaId,
    comKpis,
  ]);

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

  const calculatedStats = useMemo<Stats>(
    () => ({
      total: rotas.length,
      emAndamento: rotas.filter((r) => r.status === 'em_andamento').length,
      concluidas: rotas.filter((r) => r.status === 'concluida').length,
      distanciaTotal: rotas.reduce((sum, r) => sum + r.distancia_total, 0),
      incidentesAbertos,
    }),
    [rotas, incidentesAbertos],
  );

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    stats: calculatedStats,
    todayStats,
    kpis,
    rotas,
    listaCortada,
    // Sem loja ou sem período resolvido ainda, a lista vazia não é resposta:
    // o vazio ("Nenhuma rota em ...") pintava antes da carga começar.
    loading: loading || lojaCarregando || !periodoPronto,
    refreshing,
    erroCarga,
    dadosDe,
    onRefresh,
    userData,
  };
}
