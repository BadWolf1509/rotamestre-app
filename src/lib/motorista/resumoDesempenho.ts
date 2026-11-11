/**
 * Totais de desempenho de um motorista (rotas, km, paradas, entregas).
 *
 * Por que existe: Desempenho e marcos buscavam as rotas do motorista e depois
 * `paradas ... .in('rota_id', todas)`. Com 393 rotas e 2.235 paradas, o
 * PostgREST corta a resposta em 1.000 linhas, sem erro, e a lista de ids passa
 * de 14 KB na URL. Os totais agora vêm somados do servidor pela RPC
 * `resumo_desempenho_motorista` (Migration 55): uma chamada, uma linha.
 *
 * Quem a RPC deixa ver é o mesmo que a RLS de `rotas` deixa: o próprio
 * motorista ativo (lojas com vínculo ativo) ou o gestor ativo, só com as
 * rotas das lojas dele.
 *
 * Período: `intervalo` (`p_de`/`p_ate`, Migration 90, já cortado em hoje pela
 * tela) ou `dias` = dias corridos para trás a partir de hoje, sobre
 * `rotas.data` (a coluna `date`); "hoje" é o dia em America/Sao_Paulo.
 *
 * Sem caminho de reserva (R-DB-1): a soma paginada no cliente, para quando a
 * RPC ainda não existisse no banco, saiu — a Migration 55 está aplicada, o
 * banco é único, e a reserva não acompanhava a regra da RPC. Qualquer erro
 * sobe: total zerado em silêncio é mentira.
 */
import type { IntervaloDatas } from '@/lib/periodo';
import { supabase } from '@/lib/supabase';

export const RPC_RESUMO_DESEMPENHO = 'resumo_desempenho_motorista';

export interface ResumoDesempenho {
  totalRotas: number;
  rotasConcluidas: number;
  rotasCanceladas: number;
  distanciaTotal: number;
  totalParadas: number;
  paradasConcluidas: number;
  paradasPuladas: number;
  /** Paradas concluídas dentro de rotas concluídas (base dos marcos). */
  entregasEmRotasConcluidas: number;
  /** Média da duração das rotas concluídas, em minutos; null sem base. */
  tempoMedioMinutos: number | null;
}

interface LinhaResumo {
  total_rotas: number | null;
  rotas_concluidas: number | null;
  rotas_canceladas: number | null;
  // `numeric` no banco: o PostgREST pode devolver como texto.
  distancia_total: number | string | null;
  total_paradas: number | null;
  paradas_concluidas: number | null;
  paradas_puladas: number | null;
  entregas_em_rotas_concluidas: number | null;
  // `numeric` no banco; null quando não há rota concluída com duração.
  tempo_medio_minutos?: number | string | null;
}

function numero(v: number | string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function numeroOuNulo(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function daLinha(linha: LinhaResumo | undefined): ResumoDesempenho {
  return {
    totalRotas: numero(linha?.total_rotas),
    rotasConcluidas: numero(linha?.rotas_concluidas),
    rotasCanceladas: numero(linha?.rotas_canceladas),
    distanciaTotal: numero(linha?.distancia_total),
    totalParadas: numero(linha?.total_paradas),
    paradasConcluidas: numero(linha?.paradas_concluidas),
    paradasPuladas: numero(linha?.paradas_puladas),
    entregasEmRotasConcluidas: numero(linha?.entregas_em_rotas_concluidas),
    tempoMedioMinutos: numeroOuNulo(linha?.tempo_medio_minutos),
  };
}

export interface OpcoesResumoDesempenho {
  /** Dias corridos para trás de hoje (quem ainda usa `p_dias`). */
  dias?: number | null;
  /** Intervalo fechado já cortado pela tela; com ele, `dias` é ignorado. */
  intervalo?: IntervaloDatas;
}

export async function buscarResumoDesempenho(
  motoristaId: string,
  opcoes: OpcoesResumoDesempenho = {},
): Promise<ResumoDesempenho> {
  const { dias = null, intervalo } = opcoes;
  // Com `intervalo` manda só p_de/p_ate (a RPC ignora p_dias nesse caso).
  const parametros = intervalo
    ? {
        p_motorista_id: motoristaId,
        p_de: intervalo.de,
        p_ate: intervalo.ate,
      }
    : { p_motorista_id: motoristaId, p_dias: dias };
  const { data, error } = await supabase.rpc(RPC_RESUMO_DESEMPENHO, parametros);
  if (error) throw error;

  // A RPC devolve RETURNS TABLE de uma linha só (agregado sem GROUP BY). O
  // cliente não tem tipos gerados, então o formato é declarado aqui.
  return daLinha((data as LinhaResumo[] | null)?.[0]);
}
