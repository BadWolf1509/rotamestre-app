/**
 * TSP (Travelling Salesman Problem) solver for route optimization.
 *
 * Exato até 10 locais (força bruta até 7, Held-Karp de 8 a 10) e
 * vizinho-mais-próximo + 2-opt acima disso.
 *
 * A matriz vem do OSRM (distância por estrada) e é ASSIMÉTRICA: ida e volta
 * entre dois pontos diferem por mão única e conversões. Tudo aqui calcula o
 * custo pelo sentido real de cada trecho.
 */

/**
 * Custo do par sem rota de carro (`null` na matriz do OSRM), em metros. Finito
 * de propósito: com `Infinity` toda ordem com um trecho impossível empataria
 * e o 2-opt faria `Infinity - Infinity` (NaN). Assim a ordem com MENOS trechos
 * impossíveis vence, e um total acima dele diz que nenhuma ordem resolve.
 * 1e9 m × dezenas de trechos segue muito abaixo de 2^53.
 */
export const CUSTO_INALCANCAVEL = 1e9;

/**
 * Até quantos locais a força bruta (Heap) roda: 7! = 5.040 permutações. Acima
 * disso o fatorial explode (10! = 3,6 milhões, segundos no Hermes, que não
 * tem JIT) e o ótimo sai pelo Held-Karp.
 */
const LIMITE_FORCA_BRUTA = 7;

/** Até quantos locais o ótimo exato sai pelo Held-Karp (2^10 × 10² passos). */
const LIMITE_EXATO = 10;

/**
 * Teto de passadas do 2-opt. Com o ganho calculado pelo sentido real das
 * arestas, cada inversão aceita encurta o percurso de verdade, então o laço
 * termina sozinho (medido: até 13 passadas com 40 locais). O teto é só rede de
 * segurança: a conta roda síncrona na thread da interface.
 */
const MAX_PASSADAS_2OPT = 200;

export interface TSPResult {
  /** Ordered indices of waypoints (excludes origin) */
  order: number[];
  /** Total round-trip distance (origin -> waypoints -> origin) */
  totalDistance: number;
  /** false = a melhor ordem ainda passa por um par sem rota (nenhuma resolve). */
  resolvida: boolean;
}

type ResultadoDaBusca = Omit<TSPResult, 'resolvida'>;

/**
 * Calculate total round-trip distance: origin -> order[0] -> order[1] -> ... -> origin
 */
function tourDistance(
  distances: number[][],
  origin: number,
  order: number[],
): number {
  if (order.length === 0) return 0;

  let total = distances[origin][order[0]];
  for (let i = 0; i < order.length - 1; i++) {
    total += distances[order[i]][order[i + 1]];
  }
  total += distances[order[order.length - 1]][origin];
  return total;
}

/**
 * Brute-force TSP using Heap's algorithm for permutation generation.
 * Guarantees optimal solution. Only feasible for small N.
 */
function bruteForceTSP(
  distances: number[][],
  origin: number,
  waypoints: number[],
): ResultadoDaBusca {
  const n = waypoints.length;

  if (n === 0) return { order: [], totalDistance: 0 };
  if (n === 1) {
    return {
      order: [waypoints[0]],
      totalDistance: tourDistance(distances, origin, [waypoints[0]]),
    };
  }

  let bestOrder = [...waypoints];
  let bestDist = tourDistance(distances, origin, bestOrder);

  // Heap's algorithm - generates all permutations in-place
  const arr = [...waypoints];
  const c = new Array(n).fill(0);
  let i = 0;

  while (i < n) {
    if (c[i] < i) {
      if (i % 2 === 0) {
        // swap arr[0] and arr[i]
        const tmp = arr[0];
        arr[0] = arr[i];
        arr[i] = tmp;
      } else {
        // swap arr[c[i]] and arr[i]
        const tmp = arr[c[i]];
        arr[c[i]] = arr[i];
        arr[i] = tmp;
      }

      const dist = tourDistance(distances, origin, arr);
      if (dist < bestDist) {
        bestDist = dist;
        bestOrder = [...arr];
      }

      c[i]++;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }

  return { order: bestOrder, totalDistance: bestDist };
}

/**
 * Ótimo exato por programação dinâmica (Held-Karp): O(n²·2ⁿ). Com 10 locais
 * são ~100 mil passos, contra os ~40 milhões da força bruta. Vale para matriz
 * assimétrica (cada trecho é lido no sentido em que é percorrido).
 */
function heldKarpTSP(
  distances: number[][],
  origin: number,
  waypoints: number[],
): ResultadoDaBusca {
  const n = waypoints.length;
  const totalMascaras = 1 << n;
  // custo[mascara * n + ultimo]: menor custo saindo da origem, visitando os
  // locais da máscara e terminando em `ultimo` (que está na máscara).
  const custo = new Float64Array(totalMascaras * n).fill(Infinity);
  const anterior = new Int8Array(totalMascaras * n).fill(-1);

  for (let k = 0; k < n; k++) {
    custo[(1 << k) * n + k] = distances[origin][waypoints[k]];
  }

  for (let mascara = 1; mascara < totalMascaras; mascara++) {
    for (let ultimo = 0; ultimo < n; ultimo++) {
      if (!(mascara & (1 << ultimo))) continue;
      const atual = custo[mascara * n + ultimo];
      if (atual === Infinity) continue;
      for (let proximo = 0; proximo < n; proximo++) {
        if (mascara & (1 << proximo)) continue;
        const nova = mascara | (1 << proximo);
        const candidato =
          atual + distances[waypoints[ultimo]][waypoints[proximo]];
        if (candidato < custo[nova * n + proximo]) {
          custo[nova * n + proximo] = candidato;
          anterior[nova * n + proximo] = ultimo;
        }
      }
    }
  }

  const cheia = totalMascaras - 1;
  let melhorUltimo = 0;
  let melhorTotal = Infinity;
  for (let ultimo = 0; ultimo < n; ultimo++) {
    const total =
      custo[cheia * n + ultimo] + distances[waypoints[ultimo]][origin];
    if (total < melhorTotal) {
      melhorTotal = total;
      melhorUltimo = ultimo;
    }
  }

  const ordem: number[] = [];
  let mascara = cheia;
  let ultimo = melhorUltimo;
  while (ultimo !== -1) {
    ordem.push(waypoints[ultimo]);
    const antes = anterior[mascara * n + ultimo];
    mascara &= ~(1 << ultimo);
    ultimo = antes;
  }
  ordem.reverse();

  // Total recalculado pela ordem, para bater com tourDistance ao centavo.
  return {
    order: ordem,
    totalDistance: tourDistance(distances, origin, ordem),
  };
}

/**
 * 2-opt local search: inverte trechos enquanto o percurso REAL encurtar.
 *
 * Inverter o trecho [i..j] troca as duas arestas das pontas E percorre cada
 * aresta interna no sentido oposto. Em matriz assimétrica o ganho só sai certo
 * somando as internas nos dois sentidos — a fórmula das pontas (a do TSP
 * simétrico) aceitava inversões que não encurtavam e o laço girava em ciclo.
 * As somas internas são acumuladas ao avançar `j`, então cada par custa O(1).
 */
function twoOpt(
  distances: number[][],
  origin: number,
  order: number[],
): number[] {
  const result = [...order];
  const n = result.length;
  let improved = true;
  let passadas = 0;

  while (improved && passadas < MAX_PASSADAS_2OPT) {
    improved = false;
    passadas++;
    for (let i = 0; i < n - 1; i++) {
      const prevI = i === 0 ? origin : result[i - 1];
      // Soma das arestas internas de [i..j] no sentido atual e no invertido.
      let internaIda = 0;
      let internaVolta = 0;
      for (let j = i + 1; j < n; j++) {
        internaIda += distances[result[j - 1]][result[j]];
        internaVolta += distances[result[j]][result[j - 1]];
        const nextJ = j === n - 1 ? origin : result[j + 1];

        const antes =
          distances[prevI][result[i]] +
          internaIda +
          distances[result[j]][nextJ];
        const depois =
          distances[prevI][result[j]] +
          internaVolta +
          distances[result[i]][nextJ];

        if (depois - antes < -0.01) {
          let left = i;
          let right = j;
          while (left < right) {
            const tmp = result[left];
            result[left] = result[right];
            result[right] = tmp;
            left++;
            right--;
          }
          // O trecho agora corre ao contrário: as somas trocam de papel.
          const tmp = internaIda;
          internaIda = internaVolta;
          internaVolta = tmp;
          improved = true;
        }
      }
    }
  }

  return result;
}

/**
 * Nearest-neighbor heuristic + 2-opt improvement.
 * Good approximation for larger instances.
 */
function nearestNeighborWith2Opt(
  distances: number[][],
  origin: number,
  waypoints: number[],
): ResultadoDaBusca {
  const remaining = new Set(waypoints);
  const order: number[] = [];
  let current = origin;

  // Build initial tour greedily
  while (remaining.size > 0) {
    let nearest = -1;
    let nearestDist = Infinity;
    for (const wp of remaining) {
      if (distances[current][wp] < nearestDist) {
        nearestDist = distances[current][wp];
        nearest = wp;
      }
    }
    order.push(nearest);
    remaining.delete(nearest);
    current = nearest;
  }

  // Improve with 2-opt
  const improved = twoOpt(distances, origin, order);

  return {
    order: improved,
    totalDistance: tourDistance(distances, origin, improved),
  };
}

/**
 * Solve TSP for a distance matrix.
 *
 * @param distances - NxN matrix where distances[i][j] = road distance from node i to j
 * @param originIndex - Index of the origin node (typically 0)
 * @returns Optimal (or near-optimal) visit order and total round-trip distance
 */
export function solveTSP(
  distances: number[][],
  originIndex: number,
): TSPResult {
  const n = distances.length;
  const waypoints: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i !== originIndex) waypoints.push(i);
  }

  if (waypoints.length === 0) {
    return { order: [], totalDistance: 0, resolvida: true };
  }

  let busca: ResultadoDaBusca;
  if (waypoints.length <= LIMITE_FORCA_BRUTA) {
    busca = bruteForceTSP(distances, originIndex, waypoints);
  } else if (waypoints.length <= LIMITE_EXATO) {
    busca = heldKarpTSP(distances, originIndex, waypoints);
  } else {
    busca = nearestNeighborWith2Opt(distances, originIndex, waypoints);
  }

  return { ...busca, resolvida: busca.totalDistance < CUSTO_INALCANCAVEL };
}
