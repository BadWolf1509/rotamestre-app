/**
 * MainCard Utils - Helper functions for MainCard components
 */

/**
 * Formata tempo decorrido entre dois timestamps (ou desde start até agora)
 */
export function formatElapsedTime(startTime: number, endTime?: number): string {
  const end = endTime || Date.now();
  const elapsed = end - startTime;

  const hours = Math.floor(elapsed / (1000 * 60 * 60));
  const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}

/**
 * Formata tempo estimado baseado em minutos
 */
export function formatEstimatedTime(minutes: number | null): string {
  if (!minutes) return '--';

  if (minutes > 60) {
    return `~${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  }
  return `~${minutes} min`;
}

/**
 * Calcula taxa de sucesso das paradas
 */
export function calculateSuccessRate(
  paradas: Array<{ status: string; is_checkpoint?: boolean }>
): { concluidas: number; puladas: number; taxa: number } {
  const paradasReais = paradas.filter(p => p.is_checkpoint !== false);
  const concluidas = paradasReais.filter(p => p.status === 'concluida').length;
  const puladas = paradasReais.filter(p => p.status === 'pulada').length;
  const taxa = paradasReais.length > 0
    ? Math.round((concluidas / paradasReais.length) * 100)
    : 100;

  return { concluidas, puladas, taxa };
}

/**
 * Filtra apenas paradas reais (sem checkpoints)
 */
export function filterRealStops<T extends { is_checkpoint?: boolean }>(paradas: T[]): T[] {
  return paradas.filter(p => p.is_checkpoint !== false);
}
