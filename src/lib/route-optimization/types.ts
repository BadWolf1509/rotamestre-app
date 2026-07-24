/**
 * Types and constants for route optimization.
 */

/**
 * Limite operacional do RotaMestre.
 *
 * O backend atual usa uma instância própria do OSRM. O limite anterior de 23
 * vinha da antiga Google Directions API e ficou obsoleto após a migração.
 */
export const MAX_ROUTE_STOPS = 50;

/** Alias temporário para consumidores antigos. */
export const MAX_WAYPOINTS = MAX_ROUTE_STOPS;

/** Limite recomendado para melhor otimizacao (deixa margem para API) */
export const WAYPOINTS_RECOMENDADO = 40;

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
  /** True quando o OSRM falhou e o resultado é apenas uma estimativa. */
  isEstimated?: boolean;
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
