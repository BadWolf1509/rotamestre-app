/**
 * Pure calculation functions for RouteStatus
 */

import type { ParadaData, RouteData, RouteStatus, RotaQueryRow } from './types';

/**
 * Determines UI status based on route + paradas state.
 * Priority logic (active > completed) is handled by loadActiveRoute query order.
 * This function only maps DB status → UI state.
 */
export function getRouteStatus(
  route: RouteData | null,
  paradas: ParadaData[],
  now?: number
): RouteStatus {
  if (!route) return 'no-route';

  // Rotas pendentes SEMPRE aparecem (backend controla expiração via job 22:00)
  if (route.status === 'pendente') return 'pending';

  // Rotas em andamento SEMPRE aparecem
  if (route.status === 'em_andamento') {
    // Contar apenas paradas reais (excluindo checkpoints de partida/chegada)
    const pendingStops = paradas.filter(
      p =>
        p.is_checkpoint !== false &&
        (p.status === 'pendente' || p.status === 'em_andamento')
    );

    if (pendingStops.length === 0) return 'ready-to-complete';
    if (pendingStops.length === 1) return 'last-stop';
    return 'active';
  }

  // Rotas concluídas: aplicar timeout de 1h para celebração
  if (route.status === 'concluida') {
    if (route.concluida_em) {
      const concluidaEm = new Date(route.concluida_em).getTime();
      const currentTime = now ?? Date.now();
      const umaHoraMs = 60 * 60 * 1000;

      if (currentTime - concluidaEm > umaHoraMs) {
        return 'no-route';
      }
    }
    return 'completed';
  }

  // Status desconhecido ou expirado pelo backend (nao_executada, cancelada, etc)
  return 'no-route';
}

/** Calcula progresso (excluindo checkpoints de partida/chegada) */
export function getProgress(paradas: ParadaData[]) {
  const paradasReais = paradas.filter(p => p.is_checkpoint !== false);
  const completed = paradasReais.filter(p => p.status === 'concluida').length;
  const total = paradasReais.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { completed, total, percentage };
}

/** Pega a parada atual (próxima pendente, excluindo checkpoints) */
export function getCurrentStop(paradas: ParadaData[]): ParadaData | null {
  const orderedStops = paradas
    .filter(p => p.is_checkpoint !== false)
    .sort((a, b) => a.ordem - b.ordem);

  const inProgressStop = orderedStops.find(p => p.status === 'em_andamento');
  if (inProgressStop) return inProgressStop;

  return orderedStops.find(p => p.status === 'pendente') || null;
}

/** Pega a próxima parada após a atual (excluindo checkpoints) */
export function getNextStop(paradas: ParadaData[]): ParadaData | null {
  const orderedStops = paradas
    .filter(p => p.is_checkpoint !== false)
    .sort((a, b) => a.ordem - b.ordem);

  const currentStop = orderedStops.find(p => p.status === 'em_andamento')
    || orderedStops.find(p => p.status === 'pendente');

  if (!currentStop) return null;

  return orderedStops.find(
    p => p.status === 'pendente' && p.ordem > currentStop.ordem
  ) || null;
}

/** Build RouteData object from Supabase query row */
export function buildRouteData(rota: RotaQueryRow): RouteData {
  // Handle both single object and array cases from Supabase joins
  const unidadeNome = Array.isArray(rota.unidades)
    ? rota.unidades[0]?.nome || ''
    : rota.unidades?.nome || '';

  return {
    id: rota.id,
    status: rota.status,
    distancia_total: rota.distancia_total ?? undefined,
    tempo_total: rota.tempo_total ?? undefined,
    iniciada_em: rota.iniciada_em ?? undefined,
    concluida_em: rota.concluida_em ?? undefined,
    data: rota.data ?? undefined,
    created_at: rota.created_at,
    unidade_nome: unidadeNome,
  };
}
