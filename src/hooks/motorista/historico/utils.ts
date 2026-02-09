/**
 * Utility functions for Historico screen
 */

import type { RotaHistorico } from './types';

/** Calculate total time between route start and completion */
export function calcularTempoTotal(rota: RotaHistorico): string | null {
  if (!rota.iniciada_em || !rota.concluida_em) return null;
  const inicio = new Date(rota.iniciada_em);
  const fim = new Date(rota.concluida_em);
  const diffMs = fim.getTime() - inicio.getTime();
  const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${diffHoras}h ${diffMinutos}min`;
}

/** Format minutes into human-readable time string */
export function formatarTempo(minutos: number): string {
  if (minutos === 0) return '-';
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  if (horas === 0) return `${mins}min`;
  return `${horas}h ${mins}min`;
}
