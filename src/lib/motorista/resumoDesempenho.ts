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
 * Período: `dias` = dias corridos para trás a partir de hoje, sobre
 * `rotas.data` (a coluna `date`). Na RPC, "hoje" é o dia em America/Sao_Paulo;
 * no caminho de reserva, o dia local do aparelho (`toLocalISODate`).
 *
 * Caminho de reserva: se a RPC ainda não existe no banco (app novo publicado
 * antes da migration; PGRST202 do PostgREST ou 42883 do Postgres), soma no
 * cliente com paginação — as rotas por `range` e as paradas em lotes de ids
 * (`contarParadasDasRotas`). Mais requisições, mesmos totais. Qualquer outro
 * erro sobe: total zerado em silêncio é mentira.
 */
import { toLocalISODate } from '@/lib/dateUtils';
import {
  contarParadasDasRotas,
  TAMANHO_PAGINA,
} from '@/lib/gestor/contarParadasDasRotas';
import { logger } from '@/lib/logger';
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
}

const CODIGOS_FUNCAO_AUSENTE = new Set(['PGRST202', '42883']);

function numero(v: number | string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
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
  };
}

export async function buscarResumoDesempenho(
  motoristaId: string,
  dias: number | null,
): Promise<ResumoDesempenho> {
  const { data, error } = await supabase.rpc(RPC_RESUMO_DESEMPENHO, {
    p_motorista_id: motoristaId,
    p_dias: dias,
  });

  // A RPC devolve RETURNS TABLE de uma linha só (agregado sem GROUP BY). O
  // cliente não tem tipos gerados, então o formato é declarado aqui.
  if (!error) return daLinha((data as LinhaResumo[] | null)?.[0]);

  if (!CODIGOS_FUNCAO_AUSENTE.has(error.code)) throw error;

  logger.warn(
    '[Desempenho] RPC de resumo ausente no banco; somando no cliente',
    error,
  );
  return resumoPeloCliente(motoristaId, dias);
}

type RotaResumo = { id: string; status: string; distancia_total: number | null };

async function resumoPeloCliente(
  motoristaId: string,
  dias: number | null,
): Promise<ResumoDesempenho> {
  let desde: string | null = null;
  if (dias !== null) {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    desde = toLocalISODate(d);
  }

  const rotas: RotaResumo[] = [];
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    let consulta = supabase
      .from('rotas')
      .select('id, status, distancia_total')
      .eq('motorista_id', motoristaId);
    if (desde) consulta = consulta.gte('data', desde);

    const { data, error } = await consulta
      .order('id')
      .range(inicio, inicio + TAMANHO_PAGINA - 1);
    if (error) throw error;

    const pagina: RotaResumo[] = data ?? [];
    rotas.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) break;
  }

  const contagem = await contarParadasDasRotas(rotas.map((r) => r.id));

  const resumo: ResumoDesempenho = {
    totalRotas: rotas.length,
    rotasConcluidas: 0,
    rotasCanceladas: 0,
    distanciaTotal: 0,
    totalParadas: 0,
    paradasConcluidas: 0,
    paradasPuladas: 0,
    entregasEmRotasConcluidas: 0,
  };
  for (const rota of rotas) {
    const c = contagem.get(rota.id);
    resumo.distanciaTotal += numero(rota.distancia_total);
    if (rota.status === 'concluida') resumo.rotasConcluidas++;
    if (rota.status === 'cancelada') resumo.rotasCanceladas++;
    if (!c) continue;
    resumo.totalParadas += c.total;
    resumo.paradasConcluidas += c.concluidas;
    resumo.paradasPuladas += c.puladas;
    if (rota.status === 'concluida') resumo.entregasEmRotasConcluidas += c.concluidas;
  }
  return resumo;
}
