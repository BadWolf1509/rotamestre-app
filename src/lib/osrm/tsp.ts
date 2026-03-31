/**
 * TSP (Travelling Salesman Problem) solver for route optimization.
 *
 * Uses brute-force for small instances (<=10 waypoints) and
 * nearest-neighbor + 2-opt heuristic for larger ones.
 */

export interface TSPResult {
  /** Ordered indices of waypoints (excludes origin) */
  order: number[];
  /** Total round-trip distance (origin -> waypoints -> origin) */
  totalDistance: number;
}

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
): TSPResult {
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
 * Calculate the change in distance from reversing segment [i..j] in the order.
 * Returns negative value if the reversal improves the tour.
 */
function twoOptDelta(
  distances: number[][],
  origin: number,
  order: number[],
  i: number,
  j: number,
): number {
  const n = order.length;
  const prevI = i === 0 ? origin : order[i - 1];
  const nextJ = j === n - 1 ? origin : order[j + 1];

  // Current edges: prevI -> order[i] and order[j] -> nextJ
  const oldDist = distances[prevI][order[i]] + distances[order[j]][nextJ];
  // New edges after reversal: prevI -> order[j] and order[i] -> nextJ
  const newDist = distances[prevI][order[j]] + distances[order[i]][nextJ];

  return newDist - oldDist;
}

/**
 * 2-opt local search: iteratively reverse segments to reduce total distance.
 * Returns improved order.
 */
function twoOpt(
  distances: number[][],
  origin: number,
  order: number[],
): number[] {
  const result = [...order];
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 0; i < result.length - 1; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const delta = twoOptDelta(distances, origin, result, i, j);
        if (delta < -0.01) {
          // Reverse segment [i..j]
          let left = i;
          let right = j;
          while (left < right) {
            const tmp = result[left];
            result[left] = result[right];
            result[right] = tmp;
            left++;
            right--;
          }
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
): TSPResult {
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
    return { order: [], totalDistance: 0 };
  }

  // Brute-force threshold: up to 10 waypoints (11x11 matrix)
  if (waypoints.length < 11) {
    return bruteForceTSP(distances, originIndex, waypoints);
  }

  return nearestNeighborWith2Opt(distances, originIndex, waypoints);
}
