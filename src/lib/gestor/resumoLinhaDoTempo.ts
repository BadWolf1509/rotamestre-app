/**
 * Resumo da linha do tempo de uma rota (contagem + último evento), usado pelo
 * rodapé colapsado do mapa-rota. Era escrito dentro de `TimelineCollapsible`,
 * com `: any` e sem olhar o `error` das consultas: uma falha (rede, RLS)
 * virava "0 eventos" sem rastro.
 */

import { supabase } from '@/lib/supabase';
import {
  isTimelineLogEvent,
  mapLogToTimelinePreview,
  type TimelinePreviewEvent,
} from '@/lib/utils';

/** Teto de logs lidos para contar: uma rota não chega perto disso. */
export const LIMITE_LOGS_DO_RESUMO = 1000;

export interface ResumoLinhaDoTempo {
  eventCount: number;
  lastEvent: TimelinePreviewEvent | null;
  /** Todos os eventos mapeados, para o cálculo de "novos" (não vistos). */
  eventos: TimelinePreviewEvent[];
}

interface LinhaLog {
  id: string;
  evento: string;
  timestamp: string;
}
interface LinhaParada {
  id: string;
  ordem: number;
  status: string;
  concluida_em: string | null;
  is_checkpoint: boolean | null;
}
interface LinhaIncidente {
  id: string;
  categoria: string;
  created_at: string;
}

/** Lança o primeiro erro das consultas (a tela mostra "indisponível"). */
export async function buscarResumoDaLinhaDoTempo(
  rotaId: string,
): Promise<ResumoLinhaDoTempo> {
  const [logsRes, paradasRes, incidentesRes] = await Promise.all([
    supabase
      .from('logs')
      .select('id, evento, timestamp')
      .eq('rota_id', rotaId)
      .order('timestamp', { ascending: false })
      .limit(LIMITE_LOGS_DO_RESUMO)
      .returns<LinhaLog[]>(),
    supabase
      .from('paradas')
      .select('id, ordem, status, concluida_em, is_checkpoint')
      .eq('rota_id', rotaId)
      .not('concluida_em', 'is', null)
      .returns<LinhaParada[]>(),
    supabase
      .from('incidentes')
      .select('id, categoria, created_at')
      .eq('rota_id', rotaId)
      .returns<LinhaIncidente[]>(),
  ]);

  const erro = logsRes.error ?? paradasRes.error ?? incidentesRes.error;
  if (erro) throw erro;

  const logsDaLinha = (logsRes.data ?? []).filter((log) =>
    isTimelineLogEvent(log.evento),
  );
  // Checkpoints (is_checkpoint === false) não são paradas reais.
  const paradas = (paradasRes.data ?? []).filter(
    (parada) => parada.is_checkpoint !== false && parada.concluida_em,
  );
  const incidentes = incidentesRes.data ?? [];

  const eventos: TimelinePreviewEvent[] = [];
  // Mapeia TODOS os logs da linha do tempo (e não só os 5 mais recentes antes
  // de filtrar): o "último evento" não pode ficar de fora porque os logs mais
  // novos eram de um tipo sem texto.
  for (const log of logsDaLinha) {
    const mapeado = mapLogToTimelinePreview(log);
    if (mapeado) eventos.push(mapeado);
  }
  for (const parada of paradas) {
    eventos.push({
      timestamp: parada.concluida_em as string,
      title: `Parada #${parada.ordem} ${parada.status === 'concluida' ? 'concluída' : 'pulada'}`,
      type: 'parada',
    });
  }
  for (const incidente of incidentes) {
    eventos.push({
      timestamp: incidente.created_at,
      title: 'Incidente registrado',
      type: 'incidente',
    });
  }

  eventos.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return {
    eventCount: logsDaLinha.length + paradas.length + incidentes.length,
    lastEvent: eventos[0] ?? null,
    eventos,
  };
}
