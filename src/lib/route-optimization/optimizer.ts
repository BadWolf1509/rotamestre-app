/**
 * Main route optimization function with dependency-aware ordering.
 *
 * Algorithm:
 * 1. Check cache to avoid duplicate API calls
 * 2. Validate waypoint limits and dependencies
 * 3. Group stops by dependency (pickup + linked deliveries)
 * 4. Treat each group as a "super-waypoint"
 * 5. Optimize order via OSRM (through googleMapsService wrapper)
 * 6. Expand groups preserving internal order (pickup always before deliveries)
 * 7. Save result to cache
 */

import { Coordenadas } from '@/types/endereco';

import { googleMapsService } from '../google';
import { logger } from '../logger';
import { gerarHashRota, obterDoCache, salvarNoCache } from './cache';
import { validarRotaParaOtimizacao } from './validation';

import type { ParadaParaOtimizar, ResultadoOtimizacao } from './types';

/**
 * Agrupa paradas por dependencia.
 * Retorna grupos onde cada grupo e [retirada, ...entregas_vinculadas]
 */
function agruparPorDependencia(paradas: ParadaParaOtimizar[]): {
  grupos: ParadaParaOtimizar[][];
  independentes: ParadaParaOtimizar[];
} {
  const grupos: ParadaParaOtimizar[][] = [];
  const independentes: ParadaParaOtimizar[] = [];
  const processados = new Set<string>();

  const retiradasComVinculos = new Map<string, ParadaParaOtimizar[]>();

  paradas.forEach(parada => {
    if (parada.vinculo_parada_id) {
      const vinculadas = retiradasComVinculos.get(parada.vinculo_parada_id) || [];
      vinculadas.push(parada);
      retiradasComVinculos.set(parada.vinculo_parada_id, vinculadas);
    }
  });

  paradas.forEach(parada => {
    if (processados.has(parada.id)) return;

    if (parada.tipo === 'retirada' && retiradasComVinculos.has(parada.id)) {
      const grupo = [parada, ...retiradasComVinculos.get(parada.id)!];
      grupos.push(grupo);
      grupo.forEach(p => processados.add(p.id));
    } else if (!parada.vinculo_parada_id && !processados.has(parada.id)) {
      independentes.push(parada);
      processados.add(parada.id);
    }
  });

  return { grupos, independentes };
}

/**
 * Otimiza a rota respeitando dependencias entre paradas.
 */
export async function otimizarRotaComDependencias(
  origem: Coordenadas,
  paradas: ParadaParaOtimizar[],
  destino?: Coordenadas,
  ignorarCache?: boolean
): Promise<ResultadoOtimizacao | null> {
  if (paradas.length === 0) {
    return {
      paradasOrdenadas: [],
      distanciaTotalMetros: 0,
      duracaoTotalSegundos: 0,
      polyline: '',
      ordemIndices: [],
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
    logger.error('[RouteOptimization] Validacao falhou', { erros: validacao.erros });
    return null;
  }

  if (validacao.avisos.length > 0) {
    logger.warn('[RouteOptimization] Avisos', { avisos: validacao.avisos });
  }

  const { grupos, independentes } = agruparPorDependencia(paradas);

  const representantes: ParadaParaOtimizar[] = [
    ...grupos.map(grupo => grupo[0]),
    ...independentes,
  ];

  const mapaRepresentantes = new Map<number, ParadaParaOtimizar[]>();
  grupos.forEach((grupo, idx) => {
    mapaRepresentantes.set(idx, grupo);
  });
  independentes.forEach((parada, idx) => {
    mapaRepresentantes.set(grupos.length + idx, [parada]);
  });

  const waypoints: Coordenadas[] = representantes.map(p => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  const destinoFinal = destino || origem;

  const resultado = await googleMapsService.getDirections(
    origem,
    destinoFinal,
    waypoints
  );

  if (!resultado) {
    logger.error('[RouteOptimization] Falha ao obter direcoes do Google');
    return null;
  }

  const ordemOtimizada = resultado.ordem_otimizada;
  const paradasOrdenadas: ParadaParaOtimizar[] = [];
  const ordemIndices: number[] = [];

  if (ordemOtimizada && ordemOtimizada.length > 0) {
    ordemOtimizada.forEach(idx => {
      const grupo = mapaRepresentantes.get(idx);
      if (grupo) {
        grupo.forEach(parada => {
          const idxOriginal = paradas.findIndex(p => p.id === parada.id);
          ordemIndices.push(idxOriginal);
          paradasOrdenadas.push(parada);
        });
      }
    });
  } else {
    [...grupos, ...independentes.map(p => [p])].forEach(grupo => {
      grupo.forEach(parada => {
        const idxOriginal = paradas.findIndex(p => p.id === parada.id);
        ordemIndices.push(idxOriginal);
        paradasOrdenadas.push(parada);
      });
    });
  }

  paradasOrdenadas.forEach((parada, idx) => {
    parada.ordem = idx + 1;
  });

  const resultadoFinal: ResultadoOtimizacao = {
    paradasOrdenadas,
    distanciaTotalMetros: resultado.distancia_total_metros,
    duracaoTotalSegundos: resultado.duracao_total_segundos,
    polyline: resultado.polyline,
    ordemIndices,
  };

  salvarNoCache(hashRota, resultadoFinal).then(() => {
    logger.debug('[RouteOptimization] Resultado salvo no cache');
  });

  return resultadoFinal;
}
