/**
 * Two-tier cache (memory Map + AsyncStorage) for route optimization results.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Coordenadas } from '@/types/endereco';

import { logger } from '../logger';

import type { CacheEntry, ParadaParaOtimizar, PersistedCache, ResultadoOtimizacao } from './types';

/** Chave para persistencia no AsyncStorage */
const CACHE_STORAGE_KEY = '@rotamestre/route-optimization-cache';

/** Versao do cache (incrementar se estrutura mudar) */
const CACHE_VERSION = 1;

/** Tempo de vida do cache em ms (24 horas) */
const CACHE_TTL = 24 * 60 * 60 * 1000;

/** Limite maximo de entradas no cache */
const MAX_CACHE_ENTRIES = 50;

/** Cache em memoria para resultados de otimizacao */
let optimizationCache = new Map<string, CacheEntry>();

/** Flag para indicar se cache foi carregado do storage */
let cacheLoaded = false;

/** Promise para aguardar carregamento inicial */
let loadingPromise: Promise<void> | null = null;

/**
 * Carrega cache do AsyncStorage (executado uma vez na inicializacao).
 */
async function carregarCacheDoStorage(): Promise<void> {
  if (cacheLoaded) return;

  if (loadingPromise) {
    await loadingPromise;
    return;
  }

  loadingPromise = (async () => {
    try {
      const stored = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
      if (stored) {
        const parsed: PersistedCache = JSON.parse(stored);

        if (parsed.version !== CACHE_VERSION) {
          logger.info('[RouteCache] Versao diferente, limpando cache antigo');
          await AsyncStorage.removeItem(CACHE_STORAGE_KEY);
          cacheLoaded = true;
          return;
        }

        const agora = Date.now();
        const entries = parsed.entries || {};

        for (const [key, entry] of Object.entries(entries)) {
          if (agora - entry.timestamp <= CACHE_TTL) {
            optimizationCache.set(key, entry);
          }
        }

        logger.info(`[RouteCache] Carregado do storage: ${optimizationCache.size} entradas validas`);
      }
    } catch (error) {
      logger.warn('[RouteCache] Erro ao carregar cache', error);
    } finally {
      cacheLoaded = true;
    }
  })();

  await loadingPromise;
}

/**
 * Persiste cache no AsyncStorage.
 */
async function persistirCacheNoStorage(): Promise<void> {
  try {
    const entries: Record<string, CacheEntry> = {};
    for (const [key, value] of optimizationCache) {
      entries[key] = value;
    }

    const data: PersistedCache = {
      entries,
      version: CACHE_VERSION,
    };

    await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    logger.warn('[RouteCache] Erro ao persistir cache', error);
  }
}

/**
 * Gera hash unico para uma configuracao de rota.
 */
export function gerarHashRota(
  origem: Coordenadas,
  paradas: ParadaParaOtimizar[],
  destino?: Coordenadas
): string {
  const origemStr = `${origem.latitude.toFixed(6)},${origem.longitude.toFixed(6)}`;
  const destinoStr = destino
    ? `${destino.latitude.toFixed(6)},${destino.longitude.toFixed(6)}`
    : origemStr;

  const paradasStr = paradas
    .map(p => `${p.id}:${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}:${p.vinculo_parada_id || ''}`)
    .sort()
    .join('|');

  return `${origemStr}>${paradasStr}>${destinoStr}`;
}

/**
 * Obtem resultado do cache se ainda valido.
 */
export async function obterDoCache(hash: string): Promise<ResultadoOtimizacao | null> {
  await carregarCacheDoStorage();

  const entry = optimizationCache.get(hash);
  if (!entry) return null;

  const agora = Date.now();
  if (agora - entry.timestamp > CACHE_TTL) {
    optimizationCache.delete(hash);
    persistirCacheNoStorage();
    return null;
  }

  return entry.resultado;
}

/**
 * Salva resultado no cache.
 */
export async function salvarNoCache(hash: string, resultado: ResultadoOtimizacao): Promise<void> {
  await carregarCacheDoStorage();

  // Limpar entradas expiradas
  const agora = Date.now();
  for (const [key, entry] of optimizationCache) {
    if (agora - entry.timestamp > CACHE_TTL) {
      optimizationCache.delete(key);
    }
  }

  // Se ainda cheio, remover mais antigas
  while (optimizationCache.size >= MAX_CACHE_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of optimizationCache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) optimizationCache.delete(oldestKey);
    else break;
  }

  optimizationCache.set(hash, {
    resultado,
    timestamp: Date.now(),
  });

  persistirCacheNoStorage();
}

/**
 * Limpa todo o cache de otimizacao.
 */
export async function limparCacheOtimizacao(): Promise<void> {
  optimizationCache.clear();
  await AsyncStorage.removeItem(CACHE_STORAGE_KEY);
  logger.info('[RouteCache] Cache limpo');
}

/**
 * Retorna estatisticas do cache.
 */
export async function estatisticasCache(): Promise<{ tamanho: number; entradas: string[] }> {
  await carregarCacheDoStorage();
  return {
    tamanho: optimizationCache.size,
    entradas: Array.from(optimizationCache.keys()),
  };
}

/**
 * Forca carregamento do cache (util para pre-aquecer).
 */
export async function precarregarCache(): Promise<void> {
  await carregarCacheDoStorage();
}
