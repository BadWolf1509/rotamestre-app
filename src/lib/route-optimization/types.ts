/**
 * Types and constants for route optimization.
 */

/** Limite maximo de waypoints da Google Directions API (25 total - origem - destino) */
export const MAX_WAYPOINTS = 23;

/** Limite recomendado para melhor otimizacao (deixa margem para API) */
export const WAYPOINTS_RECOMENDADO = 20;

export interface ParadaParaOtimizar {
  id: string;
  tipo: 'entrega' | 'retirada';
  endereco: string;
  latitude: number;
  longitude: number;
  ordem: number;
  destinatario?: string;
  telefone?: string;
  observacoes?: string;
  /** ID da retirada que deve ser feita antes (apenas para entregas) */
  vinculo_parada_id?: string;
}

export interface ResultadoOtimizacao {
  /** Paradas na ordem otimizada respeitando dependencias */
  paradasOrdenadas: ParadaParaOtimizar[];
  /** Distancia total em metros */
  distanciaTotalMetros: number;
  /** Duracao total em segundos */
  duracaoTotalSegundos: number;
  /** Polyline codificada para desenhar no mapa */
  polyline: string;
  /** Ordem original dos indices apos otimizacao */
  ordemIndices: number[];
}

export interface ValidacaoRotaResult {
  valido: boolean;
  erros: string[];
  avisos: string[];
}

export interface CacheEntry {
  resultado: ResultadoOtimizacao;
  timestamp: number;
}

export interface PersistedCache {
  entries: Record<string, CacheEntry>;
  version: number;
}
