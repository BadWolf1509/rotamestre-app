/**
 * Tests for route validation (vinculos + route limits + coordinates).
 */

import { MAX_WAYPOINTS, WAYPOINTS_RECOMENDADO } from "../types";
import { validarVinculos, validarRotaParaOtimizacao } from "../validation";

import type { ParadaParaOtimizar } from "../types";

function makeParada(
  overrides: Partial<ParadaParaOtimizar> & { id: string },
): ParadaParaOtimizar {
  return {
    tipo: "entrega",
    endereco: `Rua ${overrides.id}`,
    latitude: -23.55,
    longitude: -46.63,
    ordem: 1,
    ...overrides,
  };
}

describe("validarVinculos", () => {
  it("returns no errors for stops without vinculos", () => {
    const paradas = [
      makeParada({ id: "1", tipo: "retirada" }),
      makeParada({ id: "2", tipo: "entrega" }),
    ];

    expect(validarVinculos(paradas)).toEqual([]);
  });

  it("returns no errors for valid vinculo (entrega → retirada)", () => {
    const paradas = [
      makeParada({ id: "r1", tipo: "retirada" }),
      makeParada({ id: "e1", tipo: "entrega", vinculo_parada_id: "r1" }),
    ];

    expect(validarVinculos(paradas)).toEqual([]);
  });

  it("reports error when vinculo references non-existent stop", () => {
    const paradas = [
      makeParada({ id: "e1", tipo: "entrega", vinculo_parada_id: "ghost" }),
    ];

    const erros = validarVinculos(paradas);
    expect(erros.length).toBeGreaterThanOrEqual(1);
    expect(erros.some((e) => e.includes("inexistente"))).toBe(true);
  });

  it("reports error when non-entrega has vinculo", () => {
    const paradas = [
      makeParada({ id: "r1", tipo: "retirada" }),
      makeParada({ id: "r2", tipo: "retirada", vinculo_parada_id: "r1" }),
    ];

    const erros = validarVinculos(paradas);
    expect(erros.some((e) => e.includes("Apenas entregas"))).toBe(true);
  });

  it("reports error when entrega is linked to non-retirada", () => {
    const paradas = [
      makeParada({ id: "e1", tipo: "entrega" }),
      makeParada({ id: "e2", tipo: "entrega", vinculo_parada_id: "e1" }),
    ];

    const erros = validarVinculos(paradas);
    expect(erros.some((e) => e.includes("vinculada a uma retirada"))).toBe(
      true,
    );
  });

  it("reports error for circular dependencies", () => {
    const paradas = [
      makeParada({ id: "a", vinculo_parada_id: "b" }),
      makeParada({ id: "b", vinculo_parada_id: "a" }),
    ];

    const erros = validarVinculos(paradas);
    expect(erros.some((e) => e.includes("circular"))).toBe(true);
  });

  it("handles empty paradas list", () => {
    expect(validarVinculos([])).toEqual([]);
  });

  it("returns multiple errors for multiple issues", () => {
    const paradas = [
      makeParada({ id: "r1", tipo: "retirada", vinculo_parada_id: "ghost" }),
      makeParada({
        id: "e1",
        tipo: "entrega",
        vinculo_parada_id: "nonexistent",
      }),
    ];

    const erros = validarVinculos(paradas);
    expect(erros.length).toBeGreaterThanOrEqual(2);
  });
});

describe("validarRotaParaOtimizacao", () => {
  it("returns valid for a simple correct route", () => {
    const paradas = [
      makeParada({ id: "1", tipo: "retirada" }),
      makeParada({ id: "2", tipo: "entrega" }),
    ];

    const result = validarRotaParaOtimizacao(paradas);
    expect(result.valido).toBe(true);
    expect(result.erros).toHaveLength(0);
    expect(result.avisos).toHaveLength(0);
  });

  it("returns error when waypoints exceed MAX_WAYPOINTS", () => {
    const paradas = Array.from({ length: MAX_WAYPOINTS + 1 }, (_, i) =>
      makeParada({ id: `p${i}`, tipo: "entrega" }),
    );

    const result = validarRotaParaOtimizacao(paradas);
    expect(result.valido).toBe(false);
    expect(result.erros.some((e) => e.includes("Limite"))).toBe(true);
  });

  it("returns warning when waypoints exceed recommended but under max", () => {
    const paradas = Array.from({ length: WAYPOINTS_RECOMENDADO + 1 }, (_, i) =>
      makeParada({ id: `p${i}`, tipo: "entrega" }),
    );

    const result = validarRotaParaOtimizacao(paradas);
    expect(result.valido).toBe(true);
    expect(result.avisos.length).toBeGreaterThan(0);
    expect(result.avisos.some((a) => a.includes("proxima do limite"))).toBe(
      true,
    );
  });

  it("returns error for stop with missing latitude", () => {
    const paradas = [makeParada({ id: "1", tipo: "entrega", latitude: 0 })];

    const result = validarRotaParaOtimizacao(paradas);
    expect(result.valido).toBe(false);
    expect(result.erros.some((e) => e.includes("coordenadas"))).toBe(true);
  });

  it("returns error for stop with missing longitude", () => {
    const paradas = [makeParada({ id: "1", tipo: "entrega", longitude: 0 })];

    const result = validarRotaParaOtimizacao(paradas);
    expect(result.valido).toBe(false);
    expect(result.erros.some((e) => e.includes("coordenadas"))).toBe(true);
  });

  it("combines vinculo errors and coordinate errors", () => {
    const paradas = [
      makeParada({
        id: "1",
        tipo: "entrega",
        vinculo_parada_id: "ghost",
        latitude: 0,
      }),
    ];

    const result = validarRotaParaOtimizacao(paradas);
    expect(result.valido).toBe(false);
    expect(result.erros.length).toBeGreaterThanOrEqual(2);
  });

  it("valid route at exactly WAYPOINTS_RECOMENDADO count", () => {
    const paradas = Array.from({ length: WAYPOINTS_RECOMENDADO }, (_, i) =>
      makeParada({ id: `p${i}`, tipo: "entrega" }),
    );

    const result = validarRotaParaOtimizacao(paradas);
    expect(result.valido).toBe(true);
    expect(result.avisos).toHaveLength(0);
  });

  it("valid route at exactly MAX_WAYPOINTS count", () => {
    const paradas = Array.from({ length: MAX_WAYPOINTS }, (_, i) =>
      makeParada({ id: `p${i}`, tipo: "entrega" }),
    );

    const result = validarRotaParaOtimizacao(paradas);
    expect(result.valido).toBe(true);
    // Should have warning since > WAYPOINTS_RECOMENDADO
    expect(result.avisos.length).toBeGreaterThan(0);
  });
});
