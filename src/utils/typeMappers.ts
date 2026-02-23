/**
 * Type mapping utilities for converting between structurally similar
 * but nominally different types (ParadaData <-> Parada).
 *
 * These exist because ParadaData (RouteStatusContext) and Parada
 * (ParadaCard.types) have slightly different shapes. A full unification
 * of the 14+ Parada interfaces is planned for a future PR.
 */

import type { Parada, ParadaStatus, ParadaTipo } from '@/components/motorista/ParadaCard';
import type { ParadaData } from '@/context/RouteStatusContext';

/**
 * Converts a ParadaData (from RouteStatusContext) to a Parada (for ParadaCard).
 */
export function toParada(data: ParadaData): Parada {
  return {
    id: data.id,
    endereco: data.endereco,
    latitude: data.latitude,
    longitude: data.longitude,
    ordem: data.ordem,
    status: data.status as ParadaStatus,
    tipo: data.tipo as ParadaTipo,
    destinatario: data.destinatario,
    telefone: data.telefone,
    observacoes: data.observacoes,
    concluidaEm: data.concluida_em,
    is_checkpoint: data.is_checkpoint,
  };
}

/**
 * Converts a Parada (from ParadaCard) back to ParadaData (for RouteStatusContext).
 */
export function toParadaData(parada: Parada): ParadaData {
  return {
    id: parada.id,
    endereco: parada.endereco,
    latitude: parada.latitude,
    longitude: parada.longitude,
    ordem: parada.ordem,
    status: parada.status,
    tipo: parada.tipo,
    destinatario: parada.destinatario,
    telefone: parada.telefone,
    observacoes: parada.observacoes,
    concluida_em: parada.concluidaEm,
    is_checkpoint: parada.is_checkpoint,
  };
}
