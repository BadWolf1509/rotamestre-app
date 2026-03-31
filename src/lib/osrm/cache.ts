/**
 * OSRM Cache & Rate Limiting
 *
 * In-memory cache with TTL and rate limiting for OSRM demo server.
 */

import type { Coordinate } from "./types";

// ============================================================================
// CONFIGURATION
// ============================================================================

export const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
export const MIN_REQUEST_INTERVAL = 100; // 100ms — self-hosted server supports 10 req/s

// ============================================================================
// STATE
// ============================================================================

const cache = new Map<string, { data: unknown; timestamp: number }>();
let lastRequestTime = 0;

// ============================================================================
// CACHE FUNCTIONS
// ============================================================================

export function getCacheKey(type: string, coords: Coordinate[]): string {
  const coordStr = coords
    .map((c) => `${c.latitude.toFixed(4)},${c.longitude.toFixed(4)}`)
    .join("|");
  return `${type}:${coordStr}`;
}

export function getFromCache<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  cache.delete(key);
  return null;
}

export function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });

  // Limpar cache antigo (max 100 entries)
  if (cache.size > 100) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

export async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest),
    );
  }

  lastRequestTime = Date.now();
}

// ============================================================================
// PUBLIC CACHE MANAGEMENT
// ============================================================================

/**
 * Limpa o cache manualmente
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Retorna estatisticas do cache
 */
export function getCacheStats(): { size: number; oldestEntry: number | null } {
  let oldest: number | null = null;

  cache.forEach((value) => {
    if (oldest === null || value.timestamp < oldest) {
      oldest = value.timestamp;
    }
  });

  return {
    size: cache.size,
    oldestEntry: oldest ? Date.now() - oldest : null,
  };
}
