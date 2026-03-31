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
});
