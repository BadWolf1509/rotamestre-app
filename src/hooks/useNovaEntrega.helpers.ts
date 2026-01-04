/**
 * Funções auxiliares para o hook useNovaEntrega
 * Extraídas para melhor organização e testabilidade
 */

import type {
  Parada,
  EnderecoUnidade,
} from '@/components/gestor/nova-entrega/types';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { GoogleDirectionsLeg } from '@/types/google-directions';

// ============================================================================
// Interfaces
// ============================================================================

export interface ParadaParaInserir {
  rota_id: string;
  tipo: 'entrega' | 'retirada';
  endereco: string;
  latitude: number;
  longitude: number;
  ordem: number;
  destinatario: string | null;
  telefone: string | null;
  observacoes: string | null;
  status: 'pendente';
  is_checkpoint?: boolean;
  _temp_id?: string;
  _temp_vinculo_id?: string;
}

export interface CriarParadaCheckpointParams {
  rotaId: string;
  tipo: 'retirada' | 'entrega';
  enderecoUnidade: EnderecoUnidade;
  ordem: number;
  nomeUnidade: string;
  observacoes: string;
}

export interface PrepararParadasParams {
  rotaId: string;
  paradas: Parada[];
  enderecoUnidade: EnderecoUnidade | null;
  nomeUnidade: string;
}

// ============================================================================
// Funções auxiliares
// ============================================================================

/**
 * Gera um ID único temporário para paradas antes de serem salvas no banco
 */
export function generateUniqueId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Cria uma parada de checkpoint (partida ou chegada)
 */
export function criarParadaCheckpoint({
  rotaId,
  tipo,
  enderecoUnidade,
  ordem,
  nomeUnidade,
  observacoes,
}: CriarParadaCheckpointParams): ParadaParaInserir {
  return {
    rota_id: rotaId,
    tipo,
    endereco: enderecoUnidade.endereco,
    latitude: enderecoUnidade.latitude,
    longitude: enderecoUnidade.longitude,
    ordem,
    destinatario: nomeUnidade,
    telefone: null,
    observacoes,
    status: 'pendente',
    is_checkpoint: false,
  };
}

/**
 * Prepara o array de paradas para inserção no banco
 */
export function prepararParadasParaInserir({
  rotaId,
  paradas,
  enderecoUnidade,
  nomeUnidade,
}: PrepararParadasParams): ParadaParaInserir[] {
  const paradasParaInserir: ParadaParaInserir[] = [];

  // Adicionar ponto de partida (checkpoint)
  if (enderecoUnidade) {
    paradasParaInserir.push(
      criarParadaCheckpoint({
        rotaId,
        tipo: 'retirada',
        enderecoUnidade,
        ordem: 0,
        nomeUnidade,
        observacoes: 'Ponto de partida',
      })
    );
  }

  // Adicionar paradas do usuário
  paradas.forEach((p, index) => {
    // Validar coordenadas antes de inserir
    if (p.latitude == null || p.longitude == null) {
      logger.warn(`[NovaEntrega] Parada ${p.id} sem coordenadas válidas, ignorando`);
      return;
    }

    paradasParaInserir.push({
      rota_id: rotaId,
      tipo: p.tipo,
      endereco: p.endereco,
      latitude: p.latitude,
      longitude: p.longitude,
      ordem: index + 1,
      destinatario: p.destinatario,
      telefone: p.telefone,
      observacoes: p.observacoes || null,
      status: 'pendente',
      _temp_id: p.id,
      _temp_vinculo_id: p.vinculo_parada_id,
    });
  });

  // Adicionar ponto de chegada (checkpoint)
  if (enderecoUnidade) {
    paradasParaInserir.push(
      criarParadaCheckpoint({
        rotaId,
        tipo: 'entrega',
        enderecoUnidade,
        ordem: paradas.length + 1,
        nomeUnidade,
        observacoes: 'Ponto de chegada',
      })
    );
  }

  return paradasParaInserir;
}

/**
 * Atualiza vínculos entre paradas após inserção
 */
export async function atualizarVinculosParadas(
  paradasParaInserir: ParadaParaInserir[],
  paradasInseridas: { id: string; ordem: number }[]
): Promise<void> {
  const temVinculos = paradasParaInserir.some((p) => p._temp_vinculo_id);
  if (!temVinculos) return;

  // Mapear IDs temporários para IDs reais
  const tempIdToRealId: Record<string, string> = {};
  paradasParaInserir.forEach((p, index) => {
    if (p._temp_id && paradasInseridas[index]) {
      tempIdToRealId[p._temp_id] = paradasInseridas[index].id;
    }
  });

  // Criar promises de atualização
  const updatePromises = paradasParaInserir
    .map((p, index) => {
      if (p._temp_vinculo_id && tempIdToRealId[p._temp_vinculo_id]) {
        const realVinculoId = tempIdToRealId[p._temp_vinculo_id];
        const realParadaId = paradasInseridas[index]?.id;

        if (realParadaId) {
          return supabase
            .from('paradas')
            .update({ vinculo_parada_id: realVinculoId })
            .eq('id', realParadaId);
        }
      }
      return null;
    })
    .filter(Boolean);

  if (updatePromises.length > 0) {
    await Promise.all(updatePromises);
  }
}

/**
 * Calcula distância em metros usando fórmula de Haversine
 */
export function distanceInMeters(
  parada: { latitude?: number; longitude?: number },
  coords?: { latitude: number; longitude: number }
): number {
  if (
    parada.latitude == null ||
    parada.longitude == null ||
    !coords
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(coords.latitude - parada.latitude);
  const dLon = toRad(coords.longitude - parada.longitude);

  const lat1 = toRad(parada.latitude);
  const lat2 = toRad(coords.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Ordena paradas de acordo com a rota otimizada
 */
export function ordenarParadasPorRota(
  paradas: Parada[],
  ordemOtimizada: number[],
  legs?: GoogleDirectionsLeg[]
): Parada[] {
  if (ordemOtimizada?.length === paradas.length) {
    return ordemOtimizada.map((index) => paradas[index]);
  }

  if (legs?.length) {
    const utilizados = new Set<number>();
    const ordenadas: Parada[] = [];

    legs.forEach((leg, idx) => {
      if (idx === legs.length - 1) return;

      let melhorIndex = -1;
      let menorDistancia = Number.POSITIVE_INFINITY;

      paradas.forEach((parada, paradaIndex) => {
        if (utilizados.has(paradaIndex)) return;
        const distancia = distanceInMeters(parada, leg.coordenadas_fim);
        if (distancia < menorDistancia) {
          menorDistancia = distancia;
          melhorIndex = paradaIndex;
        }
      });

      if (melhorIndex !== -1) {
        ordenadas.push(paradas[melhorIndex]);
        utilizados.add(melhorIndex);
      }
    });

    paradas.forEach((parada, index) => {
      if (!utilizados.has(index)) {
        ordenadas.push(parada);
        utilizados.add(index);
      }
    });

    if (ordenadas.length === paradas.length) {
      return ordenadas;
    }
  }

  return [...paradas];
}
