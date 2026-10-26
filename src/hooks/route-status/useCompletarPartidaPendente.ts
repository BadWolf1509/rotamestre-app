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
 * Uma tentativa por rota (falha não vira laço de escrita), só com a carga
 * confirmada pelo banco e com o UPDATE condicionado a `status = 'pendente'`.
 */
import { useEffect, useRef } from 'react';

import type { ParadaData, RouteData } from '@/context/route-status/types';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

/** Devolve true quando gravou (ou já estava concluída por outro caminho). */
export type ConcluirPartida = (
  paradaId: string,
  concluidaEm: string,
) => Promise<boolean>;

export const concluirPartidaSupabase: ConcluirPartida = async (
  paradaId,
  concluidaEm,
) => {
  const { error } = await supabase
    .from('paradas')
    .update({ status: 'concluida', concluida_em: concluidaEm })
    .eq('id', paradaId)
    .eq('status', 'pendente');
  if (error) {
    logger.warn('[RouteStatus] Falha ao concluir a partida pendente', error);
    return false;
  }
  return true;
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
    if (tentadasRef.current.has(rotaId)) return;
    tentadasRef.current.add(rotaId);

    void (async () => {
      const gravou = await concluirPartida(
        partidaId,
        iniciadaEm ?? new Date().toISOString(),
      );
      if (gravou) await loadActiveRoute();
    })();
  }, [rotaId, partidaId, iniciadaEm, concluirPartida, loadActiveRoute]);
}
