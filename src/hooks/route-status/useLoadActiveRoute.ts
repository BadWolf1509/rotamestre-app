/**
 * Carrega a rota ativa do motorista e é DONO desse estado.
 *
 * Prioridade: em_andamento > pendente > concluída (na última 1 h).
 *
 * Quatro regras, cada uma custou um defeito em campo (Onda C, 22/10/2026):
 *
 * 1. **Erro não é "sem rota".** Só a resposta do banco dizendo que não há
 *    linhas limpa a rota. Erro de consulta ou de rede preserva o que está na
 *    tela e vai para `error`; `atualizadoEm` diz de quando são os dados.
 *    Antes, uma queda de rede no meio da rota tirava a rota da tela.
 * 2. **Rota e paradas são aplicadas juntas**, depois das duas consultas. Se as
 *    paradas falham, nada é aplicado — com a lista vazia, `getRouteStatus`
 *    devolvia `ready-to-complete` e a rota podia ser finalizada.
 * 3. **Só a última chamada aplica.** Realtime, polling, ações e telas chamam
 *    isto concorrentemente; uma resposta atrasada não sobrescreve a nova.
 * 4. **Só a carga inicial liga `loading`.** Recarga é revalidação silenciosa:
 *    ligar `loading` trocava a aba Paradas por skeleton e desmontava modais.
 *    E as paradas que não mudaram (id + updated_at) mantêm a identidade, para
 *    não disparar efeitos a cada recarga.
 */

import { useCallback, useRef, useState } from 'react';

import { buildRouteData } from '@/context/route-status/calculations';
import type {
  ParadaData,
  RotaQueryRow,
  RouteData,
} from '@/context/route-status/types';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

interface UseLoadActiveRouteOptions {
  userLoading: boolean;
  motoristaId: string | undefined;
}

export interface EstadoDaRotaAtiva {
  route: RouteData | null;
  paradas: ParadaData[];
  pendingRoutesCount: number;
  /** Verdadeiro só até a primeira carga terminar (com sucesso ou erro). */
  loading: boolean;
  /** Erro da última recarga; os dados na tela são os de `atualizadoEm`. */
  error: Error | null;
  /** Epoch (ms) da última carga bem-sucedida; null se nunca carregou. */
  atualizadoEm: number | null;
  loadActiveRoute: () => Promise<void>;
}

const CAMPOS_DA_ROTA = `
  id,
  unidade_id,
  status,
  distancia_total,
  tempo_total,
  polyline,
  iniciada_em,
  concluida_em,
  created_at,
  data,
  unidades (nome)
`;

type Snapshot = {
  route: RouteData | null;
  paradas: ParadaData[];
  pendingRoutesCount: number;
};

/** Paradas que não mudaram (mesmo id e updated_at) mantêm o objeto anterior. */
export function preservarIdentidade(
  anteriores: ParadaData[],
  novas: ParadaData[],
): ParadaData[] {
  if (anteriores.length === 0) return novas;
  const porId = new Map(anteriores.map((p) => [p.id, p]));
  let todasIguais = anteriores.length === novas.length;

  const resultado = novas.map((nova, i) => {
    const antiga = porId.get(nova.id);
    const igual =
      antiga !== undefined &&
      antiga.updated_at !== undefined &&
      antiga.updated_at === nova.updated_at;
    if (!igual || anteriores[i] !== antiga) todasIguais = false;
    return igual ? antiga : nova;
  });

  return todasIguais ? anteriores : resultado;
}

function comoErro(valor: unknown): Error {
  if (valor instanceof Error) return valor;
  const mensagem =
    typeof valor === 'object' && valor !== null && 'message' in valor
      ? String((valor as { message: unknown }).message)
      : 'Falha ao carregar a rota';
  return new Error(mensagem);
}

async function buscarParadas(rotaId: string): Promise<ParadaData[]> {
  const { data, error } = await supabase
    .from('paradas')
    .select('*')
    .eq('rota_id', rotaId)
    .order('ordem');
  if (error) throw comoErro(error);
  return (data ?? []) as ParadaData[];
}

/** Consulta o banco. Lança em erro; devolve `route: null` só sem linhas. */
async function buscarSnapshot(motoristaId: string): Promise<Snapshot> {
  const { data: rotasAtivas, error: errorAtivas } = await supabase
    .from('rotas')
    .select(CAMPOS_DA_ROTA)
    .eq('motorista_id', motoristaId)
    .in('status', ['pendente', 'em_andamento'])
    .order('data', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(10);

  if (errorAtivas) throw comoErro(errorAtivas);

  const ativas = (rotasAtivas ?? []) as RotaQueryRow[];
  if (ativas.length > 0) {
    const emAndamento = ativas.find((r) => r.status === 'em_andamento');
    const pendentes = ativas.filter((r) => r.status === 'pendente');
    const selecionada = emAndamento || pendentes[0];
    const outrasPendentes = emAndamento
      ? pendentes.length
      : Math.max(0, pendentes.length - 1);

    const paradas = await buscarParadas(selecionada.id);
    return {
      route: buildRouteData(selecionada),
      paradas,
      pendingRoutesCount: outrasPendentes,
    };
  }

  // Sem rota ativa: a última concluída na última hora (celebração).
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: rotaConcluida, error: errorConcluida } = await supabase
    .from('rotas')
    .select(CAMPOS_DA_ROTA)
    .eq('motorista_id', motoristaId)
    .eq('status', 'concluida')
    .gte('concluida_em', umaHoraAtras)
    .order('concluida_em', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errorConcluida) throw comoErro(errorConcluida);

  if (rotaConcluida) {
    const concluida = rotaConcluida as RotaQueryRow;
    const paradas = await buscarParadas(concluida.id);
    return {
      route: buildRouteData(concluida),
      paradas,
      pendingRoutesCount: 0,
    };
  }

  return { route: null, paradas: [], pendingRoutesCount: 0 };
}

export function useLoadActiveRoute({
  userLoading,
  motoristaId,
}: UseLoadActiveRouteOptions): EstadoDaRotaAtiva {
  const [route, setRoute] = useState<RouteData | null>(null);
  const [paradas, setParadas] = useState<ParadaData[]>([]);
  const [pendingRoutesCount, setPendingRoutesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<number | null>(null);

  // Guarda de sequência: só a resposta da chamada mais recente é aplicada.
  const ultimaChamadaRef = useRef(0);

  const loadActiveRoute = useCallback(async () => {
    const chamada = ++ultimaChamadaRef.current;

    // Aguardar carregamento completo do userData antes de fazer queries
    if (userLoading || !motoristaId) {
      if (!userLoading && !motoristaId) {
        setRoute(null);
        setParadas([]);
        setPendingRoutesCount(0);
        setError(null);
        setLoading(false);
      }
      return;
    }

    try {
      const snapshot = await buscarSnapshot(motoristaId);
      if (chamada !== ultimaChamadaRef.current) return;

      // Tudo no mesmo tick: o React agrupa, e a tela nunca vê rota nova com
      // paradas velhas.
      setRoute(snapshot.route);
      setParadas((anteriores) =>
        preservarIdentidade(anteriores, snapshot.paradas),
      );
      setPendingRoutesCount(snapshot.pendingRoutesCount);
      setError(null);
      setAtualizadoEm(Date.now());
    } catch (erro) {
      if (chamada !== ultimaChamadaRef.current) return;
      // Crítico, mas com fallback: o estado anterior fica na tela, marcado
      // como desatualizado pelo `error`.
      logger.error('[RouteStatus] Erro ao carregar rota', erro);
      setError(comoErro(erro));
    } finally {
      if (chamada === ultimaChamadaRef.current) setLoading(false);
    }
  }, [userLoading, motoristaId]);

  return {
    route,
    paradas,
    pendingRoutesCount,
    loading,
    error,
    atualizadoEm,
    loadActiveRoute,
  };
}
