/**
 * Contagem de paradas (total e concluídas) das rotas de uma lista.
 *
 * Por que existe: a Gestão de Rotas buscava TODAS as paradas da unidade e
 * contava no cliente. O PostgREST do Supabase corta qualquer resposta em
 * 1.000 linhas (max-rows), sem erro — lojas com 2.859 e 2.061 paradas viam
 * rotas com "0 paradas". Aqui a busca é só das rotas pedidas (`in`), em lotes
 * de ids (URL curta) e paginada por `range` até a página vir incompleta.
 *
 * Partida e chegada (`is_checkpoint = false`) não contam, como antes.
 * Erro em qualquer página é lançado: contador zerado em silêncio é mentira.
 */
import { supabase } from '@/lib/supabase';

export const TAMANHO_PAGINA = 1000;
const IDS_POR_LOTE = 50;

export interface ContagemParadas {
  total: number;
  concluidas: number;
}

export async function contarParadasDasRotas(
  rotaIds: string[],
  signal?: AbortSignal,
): Promise<Map<string, ContagemParadas>> {
  const contagem = new Map<string, ContagemParadas>();

  for (let i = 0; i < rotaIds.length; i += IDS_POR_LOTE) {
    const lote = rotaIds.slice(i, i + IDS_POR_LOTE);

    for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
      let consulta = supabase
        .from('paradas')
        .select('id, rota_id, status, is_checkpoint')
        .in('rota_id', lote)
        .order('id')
        .range(inicio, inicio + TAMANHO_PAGINA - 1);
      if (signal) consulta = consulta.abortSignal(signal);

      const { data, error } = await consulta;
      if (error) throw error;

      for (const parada of data ?? []) {
        if (parada.is_checkpoint === false) continue;
        const atual = contagem.get(parada.rota_id) ?? {
          total: 0,
          concluidas: 0,
        };
        atual.total++;
        if (parada.status === 'concluida') atual.concluidas++;
        contagem.set(parada.rota_id, atual);
      }

      if ((data?.length ?? 0) < TAMANHO_PAGINA) break;
    }
  }

  return contagem;
}
