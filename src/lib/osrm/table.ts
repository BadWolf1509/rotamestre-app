/**
 * OSRM Table API — distance matrix.
 *
 * Returns road distances (meters) between all pairs of coordinates.
 * Used by the TSP solver to optimize route order by distance.
 */

import { logarFalha } from '@/lib/logarFalha';
import { logger } from '@/lib/logger';

import { getCacheKey, getFromCache, setCache, waitForRateLimit } from './cache';
import { OSRM_BASE_URL } from './config';
import { CUSTO_INALCANCAVEL } from './tsp';

import type { Coordinate, OSRMTableResponse } from './types';

const REQUEST_TIMEOUT = 10000; // 10s — self-hosted server is fast

export interface DistanceMatrix {
  distances: number[][];
  durations: number[][];
}

/**
 * `null` (par sem rota de carro) vira `CUSTO_INALCANCAVEL`. Sem isso, em JS
 * `null + 1000` vale 1000: o par impossível saía de graça e o TSP o preferia.
 */
function semNulos(matriz: (number | null)[][]): number[][] {
  return matriz.map((linha) =>
    linha.map((valor) =>
      typeof valor === 'number' && Number.isFinite(valor)
        ? valor
        : CUSTO_INALCANCAVEL,
    ),
  );
}

export async function getDistanceMatrix(
  coordinates: Coordinate[],
): Promise<DistanceMatrix | null> {
  if (coordinates.length < 2) return null;

  const cacheKey = getCacheKey('table', coordinates);
  const cached = getFromCache<DistanceMatrix>(cacheKey);
  if (cached) return cached;

  try {
    await waitForRateLimit();

    const coordsStr = coordinates
      .map((c) => `${c.longitude},${c.latitude}`)
      .join(';');

    const url = `${OSRM_BASE_URL}/table/v1/driving/${coordsStr}?annotations=distance,duration`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'RotaMestre/1.0 (https://app.rotamestre.tec.br)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM Table error: ${response.status}`);
    }

    const data: OSRMTableResponse = await response.json();

    if (data.code !== 'Ok' || !data.distances || !data.durations) {
      logger.warn('[OSRM Table] No matrix returned');
      return null;
    }

    const result: DistanceMatrix = {
      distances: semNulos(data.distances),
      durations: semNulos(data.durations),
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    logarFalha('[OSRM Table] Error fetching distance matrix', error);
    return null;
  }
}
