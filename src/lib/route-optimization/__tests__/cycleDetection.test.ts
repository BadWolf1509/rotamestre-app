/**
 * Tests for cycle detection in stop dependencies.
 */

import { detectarCiclos } from "../cycleDetection";

import type { ParadaParaOtimizar } from "../types";

function makeParada(
  overrides: Partial<ParadaParaOtimizar> & { id: string },
): ParadaParaOtimizar {
  return {
    tipo: "entrega",
    endereco: `Rua ${overrides.id}`,
    latitude: -23.5,
    longitude: -46.6,
    ordem: 1,
    ...overrides,
  };
}

describe("detectarCiclos", () => {
  it("returns empty array when no dependencies exist", () => {
    const paradas = [
      makeParada({ id: "a", tipo: "retirada" }),
      makeParada({ id: "b", tipo: "entrega" }),
    ];

    expect(detectarCiclos(paradas)).toEqual([]);
  });

  it("returns empty array when dependencies are valid (no cycles)", () => {
    const paradas = [
      makeParada({ id: "r1", tipo: "retirada" }),
      makeParada({ id: "e1", tipo: "entrega", vinculo_parada_id: "r1" }),
    ];

    expect(detectarCiclos(paradas)).toEqual([]);
  });

  it("detects a simple two-node cycle (A→B→A)", () => {
    const paradas = [
      makeParada({ id: "a", vinculo_parada_id: "b" }),
      makeParada({ id: "b", vinculo_parada_id: "a" }),
    ];

    const ciclos = detectarCiclos(paradas);
    expect(ciclos.length).toBeGreaterThan(0);

    const ids = ciclos.flat();
    expect(ids).toContain("a");
    expect(ids).toContain("b");
  });

  it("detects a three-node cycle (A→B→C→A)", () => {
    const paradas = [
      makeParada({ id: "a", vinculo_parada_id: "b" }),
      makeParada({ id: "b", vinculo_parada_id: "c" }),
      makeParada({ id: "c", vinculo_parada_id: "a" }),
    ];

    const ciclos = detectarCiclos(paradas);
    expect(ciclos.length).toBeGreaterThan(0);
  });

  it("detects self-reference (A→A)", () => {
    const paradas = [makeParada({ id: "a", vinculo_parada_id: "a" })];

    const ciclos = detectarCiclos(paradas);
    expect(ciclos.length).toBeGreaterThan(0);
    expect(ciclos[0]).toContain("a");
  });

  it("does not report false positive when chain has no cycle", () => {
    const paradas = [
      makeParada({ id: "a", vinculo_parada_id: "b" }),
      makeParada({ id: "b", vinculo_parada_id: "c" }),
      makeParada({ id: "c", tipo: "retirada" }),
    ];

    expect(detectarCiclos(paradas)).toEqual([]);
  });

  it("handles empty paradas list", () => {
    expect(detectarCiclos([])).toEqual([]);
  });

  it("handles mixed: some with cycles, some without", () => {
    const paradas = [
      makeParada({ id: "r1", tipo: "retirada" }),
      makeParada({ id: "e1", vinculo_parada_id: "r1" }),
      // cycle
      makeParada({ id: "x", vinculo_parada_id: "y" }),
      makeParada({ id: "y", vinculo_parada_id: "x" }),
    ];

    const ciclos = detectarCiclos(paradas);
    expect(ciclos.length).toBeGreaterThan(0);

    const cycleIds = ciclos.flat();
    expect(cycleIds).toContain("x");
    expect(cycleIds).toContain("y");
    // r1/e1 should not be in any cycle
    expect(cycleIds).not.toContain("r1");
    expect(cycleIds).not.toContain("e1");
  });

  it("handles dangling reference (vinculo points to non-existent id)", () => {
    const paradas = [makeParada({ id: "a", vinculo_parada_id: "nonexistent" })];

    // Should not crash, no cycle since target doesn't exist in graph
    expect(detectarCiclos(paradas)).toEqual([]);
  });
});
