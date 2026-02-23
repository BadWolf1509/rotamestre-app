/**
 * Utility functions for route optimization display and filtering.
 */

import type { ParadaParaOtimizar } from './types';

/**
 * Formata a descricao de um vinculo para exibicao.
 */
export function formatarDescricaoVinculo(
  parada: ParadaParaOtimizar,
  todasParadas: ParadaParaOtimizar[]
): string | null {
  if (!parada.vinculo_parada_id) return null;

  const vinculada = todasParadas.find(p => p.id === parada.vinculo_parada_id);
  if (!vinculada) return null;

  return `Depende de: Retirada em ${vinculada.destinatario || vinculada.endereco}`;
}

/**
 * Encontra retiradas disponiveis para vincular a uma nova entrega.
 */
export function encontrarRetiradasDisponiveis(
  paradas: ParadaParaOtimizar[]
): ParadaParaOtimizar[] {
  return paradas.filter(p => p.tipo === 'retirada');
}
