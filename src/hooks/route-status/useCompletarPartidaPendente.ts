/**
 * Conclui a partida que ficou pendente numa rota já em andamento.
 *
 * POR QUE EXISTE. O início da rota são três escritas separadas (rota →
 * partida → 1ª parada). Se a rede cai depois da primeira, a rota fica em
 * andamento com a partida pendente; quando a tela recarrega (rede de volta,
 * realtime), ela já mostra a rota em andamento e o botão Iniciar some — não
 * há mais toque que complete o passo 2, e a `finalizar_rota` só conclui a
 * chegada. O gestor via a partida "pendente" para sempre (caso real em
 * 19/10/2026).
 *
 * Alternativas: (a) RPC transacional `iniciar_rota` — fecha a janela de vez,
 * mas pede migration e não conserta as rotas que versões antigas deixarem
 * assim; (b) este reparo idempotente na carga confirmada. Ficou (b) no app;
 * (a) segue recomendada no banco.
 *
 * Só com a carga confirmada pelo banco e com o UPDATE condicionado a
 * `status = 'pendente'`. Gravou ou o servidor recusou: não tenta mais nesta
 * sessão (recusa não vira laço de escrita). Falha de rede: tenta de novo na
 * próxima carga confirmada.
 */
import { useEffect, useRef } from 'react';

import type { ParadaData, RouteData } from '@/context/route-status/types';
import { logger } from '@/lib/logger';
import { ehErroDefinitivo } from '@/lib/motorista/filaAcoesParada';
import { supabase } from '@/lib/supabase';

/**
 * 'gravou' (ou já estava concluída por outro caminho); 'rede' = sem resposta
 * definitiva (rede, sessão, 5xx), tenta de novo na próxima carga confirmada;
 * 'recusada' = o servidor recusou de verdade, não insiste nesta sessão.
 */
export type ResultadoConclusaoPartida = 'gravou' | 'rede' | 'recusada';

export type ConcluirPartida = (
  paradaId: string,
  concluidaEm: string,
) => Promise<ResultadoConclusaoPartida>;

export const concluirPartidaSupabase: ConcluirPartida = async (
  paradaId,
  concluidaEm,
) => {
  try {
    const { error } = await supabase
      .from('paradas')
      .update({ status: 'concluida', concluida_em: concluidaEm })
      .eq('id', paradaId)
      .eq('status', 'pendente');
    if (!error) return 'gravou';
    logger.warn('[RouteStatus] Falha ao concluir a partida pendente', error);
    return ehErroDefinitivo(error) ? 'recusada' : 'rede';
  } catch (erro) {
    logger.warn('[RouteStatus] Falha ao concluir a partida pendente', erro);
    return 'rede';
  }
};

interface Opcoes {
  route: RouteData | null;
  /** Paradas como vieram do banco (sem a sobreposição da fila). */
  paradas: ParadaData[];
  cargaConfirmada: boolean;
  loadActiveRoute: () => Promise<void>;
  concluirPartida?: ConcluirPartida;
}

export function useCompletarPartidaPendente({
  route,
  paradas,
  cargaConfirmada,
  loadActiveRoute,
  concluirPartida = concluirPartidaSupabase,
}: Opcoes): void {
  const tentadasRef = useRef(new Set<string>());
  const emVooRef = useRef(false);

  const partidaPendente =
    cargaConfirmada && route?.status === 'em_andamento'
      ? paradas.find(
          (p) =>
            p.is_checkpoint === false &&
            p.ordem === 0 &&
            p.status === 'pendente',
        )
      : undefined;
  const rotaId = route?.id;
  const iniciadaEm = route?.iniciada_em;
  const partidaId = partidaPendente?.id;

  useEffect(() => {
    if (!rotaId || !partidaId) return;
    if (tentadasRef.current.has(rotaId) || emVooRef.current) return;
    emVooRef.current = true;

    void (async () => {
      try {
        const resultado = await concluirPartida(
          partidaId,
          iniciadaEm ?? new Date().toISOString(),
        );
        // Falha de rede não conta: a próxima carga confirmada (que passa por
        // "carregando" e reabre este efeito) tenta de novo.
        if (resultado !== 'rede') tentadasRef.current.add(rotaId);
        if (resultado === 'gravou') await loadActiveRoute();
      } finally {
        emVooRef.current = false;
      }
    })();
  }, [rotaId, partidaId, iniciadaEm, concluirPartida, loadActiveRoute]);
}
