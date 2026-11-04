/**
 * Type mapping utilities for converting between structurally similar
 * but nominally different types (ParadaData -> Parada).
 *
 * Só existe o sentido ParadaData -> Parada. O inverso perdia todo campo que o
 * card não carrega (`foto_url`, `updated_at`...): quem tem uma `Parada` e
 * precisa do ParadaData busca pelo id no contexto.
 *
 * These exist because ParadaData (RouteStatusContext) and Parada
 * (ParadaCard.types) have slightly different shapes. A full unification
 * of the 14+ Parada interfaces is planned for a future PR.
 */

import type {
  Parada,
  ParadaStatus,
  ParadaTipo,
} from '@/components/motorista/ParadaCard';
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
    observacao_pulo: data.observacao_pulo,
    concluidaEm: data.concluida_em,
    is_checkpoint: data.is_checkpoint,
  };
}
