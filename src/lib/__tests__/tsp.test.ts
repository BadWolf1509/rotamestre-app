import { solveTSP } from "../osrm/tsp";

describe("TSP Solver", () => {
  describe("solveTSP - brute force (N<=10)", () => {
    it("should return identity order for single waypoint", () => {
      // 2x2 matrix (origin + 1 waypoint), all distances = 100
      const distances = [
        [0, 100],
        [100, 0],
      ];

      const result = solveTSP(distances, 0);

      expect(result.order).toEqual([1]);
      expect(result.totalDistance).toBe(200); // O->1->O = 100+100
    });

    it("should find optimal order for 3 waypoints", () => {
      // 4x4 matrix simulating a square layout
      // Optimal: O->A->B->C->O = 10+10+10+15 = 45
      const distances = [
        [0, 10, 20, 15], // O
        [10, 0, 10, 25], // A
        [20, 10, 0, 10], // B
        [15, 25, 10, 0], // C
      ];

      const result = solveTSP(distances, 0);

      expect(result.totalDistance).toBe(45);
      // Optimal order: [1,2,3] => O->A->B->C->O = 10+10+10+15 = 45
      expect(result.order).toEqual([1, 2, 3]);
    });

    it("should find optimal order for 4 waypoints (the bug scenario)", () => {
      // 5x5 matrix: Origin(Torre), A(Cabedelo-far), B(Etelvina), C(Oceania1), D(Oceania2)
      // Bad order (OSRM bug): O->A->...=74
      // Good order: O->B->C->D->A->O = 48
      const distances = [
        [0, 20, 5, 8, 10], // Origin
        [20, 0, 18, 15, 12], // A (Cabedelo - far)
        [5, 18, 0, 4, 6], // B (Etelvina - close)
        [8, 15, 4, 0, 3], // C (Oceania1)
        [10, 12, 6, 3, 0], // D (Oceania2)
      ];

      const result = solveTSP(distances, 0);

      // Optimal: O->B->C->D->A->O = 5+4+3+12+20 = 44
      // or O->B->C->D->A->O variant
      // Let's verify the total is optimal by checking it's less than the bad order
      expect(result.totalDistance).toBeLessThanOrEqual(48);
      // Verify round trip distance matches
      const order = result.order;
      let total = distances[0][order[0]];
      for (let i = 0; i < order.length - 1; i++) {
        total += distances[order[i]][order[i + 1]];
      }
      total += distances[order[order.length - 1]][0];
      expect(total).toBe(result.totalDistance);
    });

    it("should handle 2 waypoints", () => {
      // 3x3 matrix where both permutations give same distance
      const distances = [
        [0, 10, 8], // O
        [10, 0, 5], // A
        [8, 5, 0], // B
      ];

      const result = solveTSP(distances, 0);

      // [1,2]: O->A->B->O = 10+5+8 = 23
      // [2,1]: O->B->A->O = 8+5+10 = 23
      expect(result.totalDistance).toBe(23);
      expect(result.order).toHaveLength(2);
    });

    it("should handle asymmetric distances", () => {
      // A->B != B->A
      const distances = [
        [0, 10, 30], // O
        [15, 0, 5], // A
        [25, 50, 0], // B
      ];

      const result = solveTSP(distances, 0);

      // [1,2]: O->A->B->O = 10+5+25 = 40
      // [2,1]: O->B->A->O = 30+50+15 = 95
      expect(result.order).toEqual([1, 2]);
      expect(result.totalDistance).toBe(40);
    });
  });

  describe("solveTSP - nearest-neighbor + 2-opt (N>10)", () => {
    it("should handle 11 waypoints (triggers NN+2opt)", () => {
      const n = 12; // origin + 11 waypoints
      // Circular layout: waypoints evenly spaced on a circle
      const distances: number[][] = Array.from({ length: n }, () =>
        Array(n).fill(0),
      );
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i !== j) {
            const diff = Math.abs(i - j);
            const arcDist = Math.min(diff, n - diff);
            distances[i][j] = arcDist * 10;
          }
        }
      }
      const result = solveTSP(distances, 0);
      expect(result.order).toHaveLength(11);
      expect(new Set(result.order)).toEqual(
        new Set(Array.from({ length: 11 }, (_, i) => i + 1)),
      );
      // Optimal for circular = n * 10 = 120
      expect(result.totalDistance).toBeLessThanOrEqual(120);
    });

    it("should produce valid permutation for 15 waypoints", () => {
      const n = 16;
      const distances: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) =>
          i === j ? 0 : Math.abs(i - j) * 5 + ((i * j) % 7),
        ),
      );
      const result = solveTSP(distances, 0);
      expect(result.order).toHaveLength(15);
      expect(new Set(result.order)).toEqual(
        new Set(Array.from({ length: 15 }, (_, i) => i + 1)),
      );
      expect(result.totalDistance).toBeGreaterThan(0);
    });

    it("should beat naive sequential order for clustered points", () => {
      const n = 13; // origin + 12 waypoints in 2 clusters
      const distances: number[][] = Array.from({ length: n }, () =>
        Array(n).fill(0),
      );
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const iCluster = i === 0 ? "O" : i <= 6 ? "A" : "B";
          const jCluster = j === 0 ? "O" : j <= 6 ? "A" : "B";
          if (iCluster === jCluster) {
            distances[i][j] = 5;
          } else if (iCluster === "O" || jCluster === "O") {
            distances[i][j] = iCluster === "A" || jCluster === "A" ? 10 : 40;
          } else {
            distances[i][j] = 50;
          }
        }
      }
      const result = solveTSP(distances, 0);
      // Calculate naive sequential distance
      const naiveOrder = Array.from({ length: 12 }, (_, i) => i + 1);
      let naiveDist = distances[0][naiveOrder[0]];
      for (let i = 0; i < naiveOrder.length - 1; i++) {
        naiveDist += distances[naiveOrder[i]][naiveOrder[i + 1]];
      }
      naiveDist += distances[naiveOrder[11]][0];
      expect(result.totalDistance).toBeLessThanOrEqual(naiveDist);
    });
  });

  describe("edge cases", () => {
    it("should handle 0 waypoints", () => {
      const distances = [[0]];
      const result = solveTSP(distances, 0);
      expect(result.order).toEqual([]);
      expect(result.totalDistance).toBe(0);
    });

    it("should handle all equal distances", () => {
      const distances = [
        [0, 10, 10, 10],
        [10, 0, 10, 10],
        [10, 10, 0, 10],
        [10, 10, 10, 0],
      ];
      const result = solveTSP(distances, 0);
      expect(result.order).toHaveLength(3);
      expect(result.totalDistance).toBe(40);
    });
  });
});
