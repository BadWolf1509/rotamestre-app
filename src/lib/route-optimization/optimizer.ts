/**
 * Main route optimization function with dependency-aware ordering.
 *
 * Algorithm:
 * 1. Check cache to avoid duplicate API calls
 * 2. Validate waypoint limits and dependencies
 * 3. Group stops into visits (same location + pickup/linked deliveries),
 *    see `agrupamento.ts`
 * 4. Treat each visit as a "super-waypoint" (its first stop goes to the TSP)
 * 5. Optimize order via OSRM (through googleMapsService wrapper)
 * 6. Expand visits preserving internal order (pickup before linked
 *    deliveries; at the same location, delivery before pickup)
 * 7. If a visit spans more than one location, re-measure distance/polyline
 *    with every stop (the TSP only saw the visit's first stop)
 * 8. Save result to cache
 */

import { Coordenadas } from '@/types/endereco';

import { googleMapsService } from '../google';
import { logger } from '../logger';
import {
  RAIO_MESMO_LOCAL_METROS,
  agruparParadasEmVisitas,
  expandirOrdemDasVisitas,
} from './agrupamento';
import { gerarHashRota, obterDoCache, salvarNoCache } from './cache';
import { validarRotaParaOtimizacao } from './validation';
import { calculateHaversineDistance } from '../osrm/fallback';

import type { ParadaParaOtimizar, ResultadoOtimizacao } from './types';

/**
 * Rota na ordem já decidida, com todas as paradas. Falha aqui não desfaz a
 * otimização. Na prática o OSRM sem otimizar quase nunca devolve null: a falha
 * vira estimativa em linha reta (`is_estimated`), que a revisão da rota
 * bloqueia até recalcular. Só no null raro fica a medida do TSP, que subestima
 * o trecho entre endereços.
 */
async function medirRotaCompleta(
  origem: Coordenadas,
  destino: Coordenadas,
  paradasOrdenadas: ParadaParaOtimizar[],
) {
  try {
    const rota = await googleMapsService.getDirectionsSequential(
      origem,
      destino,
      paradasOrdenadas.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      })),
    );
    if (!rota) {
      logger.warn(
        '[RouteOptimization] Rota completa indisponivel; distancia do TSP mantida',
        { paradas: paradasOrdenadas.length },
      );
    } else if (rota.is_estimated === true) {
      logger.warn(
        '[RouteOptimization] Rota completa saiu como estimativa em linha reta',
        { paradas: paradasOrdenadas.length },
      );
    }
    return rota;
  } catch (error) {
    logger.warn(
      '[RouteOptimization] Falha ao medir a rota completa; distancia do TSP mantida',
      error,
    );
    return null;
  }
}

/**
 * Otimiza a rota respeitando dependencias entre paradas.
 */
export async function otimizarRotaComDependencias(
  origem: Coordenadas,
  paradas: ParadaParaOtimizar[],
  destino?: Coordenadas,
  ignorarCache?: boolean,
): Promise<ResultadoOtimizacao | null> {
  if (paradas.length === 0) {
    return {
      paradasOrdenadas: [],
      distanciaTotalMetros: 0,
      duracaoTotalSegundos: 0,
      polyline: '',
      ordemIndices: [],
      isEstimated: false,
    };
  }

  const hashRota = gerarHashRota(origem, paradas, destino);

  if (!ignorarCache) {
    const resultadoCache = await obterDoCache(hashRota);
    if (resultadoCache) {
      logger.debug('[RouteOptimization] Resultado obtido do cache');
      return resultadoCache;
    }
  }

  const validacao = validarRotaParaOtimizacao(paradas);
  if (!validacao.valido) {
    logger.error('[RouteOptimization] Validacao falhou', {
      erros: validacao.erros,
    });
    return null;
  }

  if (validacao.avisos.length > 0) {
    logger.warn('[RouteOptimization] Avisos', { avisos: validacao.avisos });
  }

  const visitas = agruparParadasEmVisitas(paradas);

  const waypoints: Coordenadas[] = visitas.map(([representante]) => ({
    latitude: representante.latitude,
    longitude: representante.longitude,
  }));

  const destinoFinal = destino || origem;

  const resultado = await googleMapsService.getDirections(
    origem,
    destinoFinal,
    waypoints,
  );

  if (!resultado) {
    logger.error('[RouteOptimization] Falha ao obter direcoes do Google');
    return null;
  }

  const ordemIndices = expandirOrdemDasVisitas(
    visitas,
    paradas,
    resultado.ordem_otimizada,
  );
  const paradasOrdenadas = ordemIndices.map((i) => paradas[i]);

  paradasOrdenadas.forEach((parada, idx) => {
    parada.ordem = idx + 1;
  });

  // O TSP só viu o primeiro ponto de cada visita. Numa visita que cruza
  // endereços (retirada num lugar, entrega vinculada em outro), a distância e
  // o traçado dele deixam de fora o trecho até as entregas — refaz a rota com
  // todas as paradas, na ordem decidida. Visita num ponto só não precisa: dois
  // membros do mesmo local distam no máximo 2× o raio (ambos estão no raio da
  // âncora), e o representante nem sempre é a âncora.
  const metricas = visitas.some((visita) =>
    visita.some(
      (p) =>
        calculateHaversineDistance(
          visita[0].latitude,
          visita[0].longitude,
          p.latitude,
          p.longitude,
        ) >
        2 * RAIO_MESMO_LOCAL_METROS,
    ),
  )
    ? await medirRotaCompleta(origem, destinoFinal, paradasOrdenadas)
    : null;
  const medida = metricas ?? resultado;

  const resultadoFinal: ResultadoOtimizacao = {
    paradasOrdenadas,
    distanciaTotalMetros: medida.distancia_total_metros,
    duracaoTotalSegundos: medida.duracao_total_segundos,
    polyline: medida.polyline,
    ordemIndices,
    // Estimada se a ordem OU a medida veio do fallback: medir de verdade uma
    // ordem decidida sobre distâncias em linha reta não a torna confirmável.
    isEstimated:
      resultado.is_estimated === true || medida.is_estimated === true,
    ...(resultado.sem_rota_entre_paradas ? { semRotaEntreParadas: true } : {}),
  };

  salvarNoCache(hashRota, resultadoFinal).then(() => {
    logger.debug('[RouteOptimization] Resultado salvo no cache');
  });

  return resultadoFinal;
}
