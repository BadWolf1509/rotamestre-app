/**
 * Funções auxiliares compartilhadas pelo fluxo de Nova Entrega.
 */

import type {
  EnderecoUnidade,
  Parada,
  RouteDraftValidation,
} from '@/components/gestor/nova-entrega/types';
import { MAX_ROUTE_STOPS } from '@/lib/routeOptimization';
import { supabase } from '@/lib/supabase';
import type { GoogleDirectionsLeg } from '@/types/google-directions';

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

export interface ValidarRascunhoParams {
  paradas: Parada[];
  motoristaId: string;
  dataRota: string;
  enderecoUnidade: EnderecoUnidade | null;
}

const DISTANCIA_AVISO_KM = 150;
const DISTANCIA_CONFIRMACAO_KM = 300;

function hasValidCoordinates(value: {
  latitude?: number;
  longitude?: number;
}): boolean {
  return (
    typeof value.latitude === 'number' &&
    Number.isFinite(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    typeof value.longitude === 'number' &&
    Number.isFinite(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function generateUniqueId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function generateRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === 'x' ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    },
  );
}

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
 * Monta checkpoints e paradas. Coordenadas inválidas causam erro em vez de
 * serem descartadas silenciosamente.
 */
export function prepararParadasParaInserir({
  rotaId,
  paradas,
  enderecoUnidade,
  nomeUnidade,
}: PrepararParadasParams): ParadaParaInserir[] {
  if (!enderecoUnidade) {
    throw new Error('A unidade precisa ter um endereço de sede válido.');
  }

  if (!hasValidCoordinates(enderecoUnidade)) {
    throw new Error('A sede da unidade possui coordenadas inválidas.');
  }

  if (paradas.some((parada) => !hasValidCoordinates(parada))) {
    throw new Error('Todas as paradas precisam ter um endereço validado.');
  }

  const paradasParaInserir: ParadaParaInserir[] = [
    criarParadaCheckpoint({
      rotaId,
      tipo: 'retirada',
      enderecoUnidade,
      ordem: 0,
      nomeUnidade,
      observacoes: 'Ponto de partida',
    }),
  ];

  paradas.forEach((parada, index) => {
    paradasParaInserir.push({
      rota_id: rotaId,
      tipo: parada.tipo,
      endereco: parada.endereco,
      latitude: parada.latitude as number,
      longitude: parada.longitude as number,
      ordem: index + 1,
      destinatario: parada.destinatario,
      telefone: parada.telefone,
      observacoes: parada.observacoes || null,
      status: 'pendente',
      is_checkpoint: true,
      _temp_id: parada.id,
      _temp_vinculo_id: parada.vinculo_parada_id,
    });
  });

  paradasParaInserir.push(
    criarParadaCheckpoint({
      rotaId,
      tipo: 'entrega',
      enderecoUnidade,
      ordem: paradas.length + 1,
      nomeUnidade,
      observacoes: 'Ponto de chegada',
    }),
  );

  return paradasParaInserir;
}

/**
 * Compatibilidade para fluxos legados. O mapeamento usa `ordem`, não a ordem
 * incidental da resposta do banco, e cada erro de update é verificado.
 */
export async function atualizarVinculosParadas(
  paradasParaInserir: ParadaParaInserir[],
  paradasInseridas: { id: string; ordem: number }[],
): Promise<void> {
  if (!paradasParaInserir.some((parada) => parada._temp_vinculo_id)) return;

  const inseridasPorOrdem = new Map(
    paradasInseridas.map((parada) => [parada.ordem, parada.id]),
  );
  const tempIdToRealId: Record<string, string> = {};

  paradasParaInserir.forEach((parada) => {
    const realId = inseridasPorOrdem.get(parada.ordem);
    if (parada._temp_id && realId) tempIdToRealId[parada._temp_id] = realId;
  });

  const updates = paradasParaInserir.flatMap((parada) => {
    if (!parada._temp_vinculo_id) return [];
    const realVinculoId = tempIdToRealId[parada._temp_vinculo_id];
    const realParadaId = inseridasPorOrdem.get(parada.ordem);
    if (!realVinculoId || !realParadaId) return [];

    return [
      supabase
        .from('paradas')
        .update({ vinculo_parada_id: realVinculoId })
        .eq('id', realParadaId),
    ];
  });

  const resultados = await Promise.all(updates);
  const falha = resultados.find((resultado) => resultado.error);
  if (falha?.error) throw falha.error;
}

export function validarOrdemDependencias(paradas: Parada[]): string[] {
  const erros: string[] = [];
  const porId = new Map(
    paradas.map((parada, index) => [parada.id, { parada, index }]),
  );

  paradas.forEach((parada, index) => {
    if (!parada.vinculo_parada_id) return;

    const vinculada = porId.get(parada.vinculo_parada_id);
    if (!vinculada || vinculada.parada.tipo !== 'retirada') {
      erros.push(
        `A entrega "${parada.destinatario}" aponta para uma retirada inexistente.`,
      );
      return;
    }

    if (vinculada.index >= index) {
      erros.push(
        `A retirada de "${vinculada.parada.destinatario}" precisa ocorrer antes da entrega de "${parada.destinatario}".`,
      );
    }
  });

  return erros;
}

function normalizeComparable(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function encontrarParadaDuplicada(
  paradas: Parada[],
  candidata: { endereco: string; telefone: string },
  ignorarId?: string,
): Parada | null {
  const endereco = normalizeComparable(candidata.endereco);
  const telefone = candidata.telefone.replace(/\D/g, '');

  return (
    paradas.find((parada) => {
      if (parada.id === ignorarId) return false;
      const mesmoEndereco = normalizeComparable(parada.endereco) === endereco;
      const mesmoTelefone =
        telefone.length >= 10 &&
        parada.telefone.replace(/\D/g, '') === telefone;
      return mesmoEndereco || mesmoTelefone;
    }) ?? null
  );
}

export function distanceInMeters(
  parada: { latitude?: number; longitude?: number },
  coords?: { latitude: number; longitude: number },
): number {
  if (parada.latitude == null || parada.longitude == null || !coords) {
    return Number.POSITIVE_INFINITY;
  }

  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(coords.latitude - parada.latitude);
  const dLon = toRad(coords.longitude - parada.longitude);
  const lat1 = toRad(parada.latitude);
  const lat2 = toRad(coords.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function avaliarSanidadeGeografica(
  paradas: Parada[],
  enderecoUnidade: EnderecoUnidade | null,
): RouteDraftValidation['sanidadeGeografica'] {
  if (!enderecoUnidade) {
    return {
      maiorDistanciaKm: 0,
      paradasDistantes: [],
      requerConfirmacao: false,
    };
  }

  const distancias = paradas.map((parada) => ({
    parada,
    km: distanceInMeters(parada, enderecoUnidade) / 1000,
  }));
  const maiorDistanciaKm = distancias.reduce(
    (maior, item) => Math.max(maior, Number.isFinite(item.km) ? item.km : 0),
    0,
  );

  return {
    maiorDistanciaKm,
    paradasDistantes: distancias
      .filter((item) => item.km >= DISTANCIA_AVISO_KM)
      .map((item) => item.parada),
    requerConfirmacao: maiorDistanciaKm >= DISTANCIA_CONFIRMACAO_KM,
  };
}

export function validarRascunhoRota({
  paradas,
  motoristaId,
  dataRota,
  enderecoUnidade,
}: ValidarRascunhoParams): RouteDraftValidation {
  const erros: string[] = [];
  const avisos: string[] = [];

  if (paradas.length === 0) erros.push('Adicione pelo menos uma parada.');
  if (paradas.length > MAX_ROUTE_STOPS) {
    erros.push(`A rota aceita no máximo ${MAX_ROUTE_STOPS} paradas.`);
  }
  if (!motoristaId) erros.push('Selecione um motorista.');
  if (!enderecoUnidade) {
    erros.push('A unidade não possui uma sede geocodificada.');
  } else if (!hasValidCoordinates(enderecoUnidade)) {
    erros.push('A sede da unidade possui coordenadas inválidas.');
  }

  const hoje = new Date();
  const hojeLocal = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  if (!isValidCalendarDate(dataRota)) {
    erros.push('Informe uma data válida para a rota.');
  } else if (dataRota < hojeLocal) {
    erros.push('A data da rota não pode estar no passado.');
  }

  if (paradas.some((parada) => !hasValidCoordinates(parada))) {
    erros.push('Todas as paradas precisam ter um endereço validado.');
  }

  erros.push(...validarOrdemDependencias(paradas));

  const sanidadeGeografica = avaliarSanidadeGeografica(
    paradas,
    enderecoUnidade,
  );
  if (sanidadeGeografica.paradasDistantes.length > 0) {
    avisos.push(
      `${sanidadeGeografica.paradasDistantes.length} parada(s) estão a mais de ${DISTANCIA_AVISO_KM} km da base.`,
    );
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
    sanidadeGeografica,
  };
}

export function ordenarParadasPorRota(
  paradas: Parada[],
  ordemOtimizada: number[],
  legs?: GoogleDirectionsLeg[],
): Parada[] {
  if (ordemOtimizada?.length === paradas.length) {
    return ordemOtimizada.map((index) => paradas[index]);
  }

  if (legs?.length) {
    const utilizados = new Set<number>();
    const ordenadas: Parada[] = [];

    legs.forEach((leg, index) => {
      if (index === legs.length - 1) return;

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
      if (!utilizados.has(index)) ordenadas.push(parada);
    });

    if (ordenadas.length === paradas.length) return ordenadas;
  }

  return [...paradas];
}
