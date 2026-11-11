/**
 * Utility functions for Historico screen
 */

import { formatarDuracao } from '@/lib/motorista/formatarDuracao';

import type { RotaHistorico } from './types';

/** Calculate total time between route start and completion */
export function calcularTempoTotal(rota: RotaHistorico): string | null {
  if (!rota.iniciada_em || !rota.concluida_em) return null;
  return formatarDuracao(
    new Date(rota.concluida_em).getTime() -
      new Date(rota.iniciada_em).getTime(),
  );
}

/** Format minutes into human-readable time string */
export function formatarTempo(minutos: number | null): string {
  if (minutos === null) return '—';
  if (minutos === 0) return '-';
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  if (horas === 0) return `${mins}min`;
  return `${horas}h ${mins}min`;
}
