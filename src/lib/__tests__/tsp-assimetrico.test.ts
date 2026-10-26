/**
 * TSP com matriz assimétrica (a do OSRM: distância por estrada, que muda com
 * mão única e conversões). Inverter um trecho do percurso também inverte o
 * sentido de cada aresta interna, então o ganho do 2-opt não sai só das duas
 * arestas das pontas.
 *
 * `matrizOsrmAssimetrica11.json` é uma matriz `table` real do OSRM de
 * produção (origem + 11 endereços de paradas reais). Com o delta simétrico, o
 * 2-opt girava em ciclo nela e travava a thread (varredura de 26/10/2026).
 */
import { solveTSP } from '../osrm/tsp';
import matrizReal from './fixtures/matrizOsrmAssimetrica11.json';

function distanciaDoPercurso(d: number[][], ordem: number[]): number {
  let total = d[0][ordem[0]];
  for (let i = 0; i < ordem.length - 1; i++) total += d[ordem[i]][ordem[i + 1]];
  return total + d[ordem[ordem.length - 1]][0];
}

function vizinhoMaisProximo(d: number[][]): number[] {
  const restantes = new Set(d.map((_, i) => i).filter((i) => i !== 0));
  const ordem: number[] = [];
  let atual = 0;
  while (restantes.size > 0) {
    let melhor = -1;
    for (const p of restantes) {
      if (melhor === -1 || d[atual][p] < d[atual][melhor]) melhor = p;
    }
    ordem.push(melhor);
    restantes.delete(melhor);
    atual = melhor;
  }
  return ordem;
}

/** Ótimo exato por busca exaustiva com poda (referência para conferir o solver). */
function otimoPorBuscaExaustiva(d: number[][]): number {
  const pontos = d.map((_, i) => i).filter((i) => i !== 0);
  let melhor = Infinity;
  const usados = new Array<boolean>(d.length).fill(false);
  const percorre = (atual: number, faltam: number, custo: number) => {
    if (custo >= melhor) return;
    if (faltam === 0) {
      melhor = Math.min(melhor, custo + d[atual][0]);
      return;
    }
    for (const p of pontos) {
      if (usados[p]) continue;
      usados[p] = true;
      percorre(p, faltam - 1, custo + d[atual][p]);
      usados[p] = false;
    }
  };
  percorre(0, pontos.length, 0);
  return melhor;
}

/** PRNG com semente (mulberry32), para o teste ser reprodutível. */
function geradorComSemente(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pontos num plano com a distância "de estrada" até 30% maior num sentido. */
function matrizAssimetricaAleatoria(
  n: number,
  aleatorio: () => number,
): number[][] {
  const pts = Array.from({ length: n }, () => [
    aleatorio() * 20000,
    aleatorio() * 20000,
  ]);
  return pts.map((a, i) =>
    pts.map((b, j) =>
      i === j
        ? 0
        : Math.round(
            Math.hypot(a[0] - b[0], a[1] - b[1]) * (1 + aleatorio() * 0.3),
          ),
    ),
  );
}

describe('solveTSP com matriz assimétrica', () => {
  it('termina na matriz real do OSRM onde o 2-opt entrava em ciclo', () => {
    const d = matrizReal as number[][];
    const resultado = solveTSP(d, 0);

    expect([...resultado.order].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 11 }, (_, i) => i + 1),
    );
    expect(resultado.totalDistance).toBeCloseTo(
      distanciaDoPercurso(d, resultado.order),
      6,
    );
    expect(resultado.totalDistance).toBeLessThanOrEqual(
      distanciaDoPercurso(d, vizinhoMaisProximo(d)),
    );
  });

  it('nunca devolve percurso mais longo que o vizinho mais próximo de partida (11 a 40 locais)', () => {
    const aleatorio = geradorComSemente(2610);
    for (let caso = 0; caso < 300; caso++) {
      const locais = 11 + Math.floor(aleatorio() * 30);
      const d = matrizAssimetricaAleatoria(locais + 1, aleatorio);
      const resultado = solveTSP(d, 0);

      expect(resultado.order).toHaveLength(locais);
      expect(new Set(resultado.order).size).toBe(locais);
      expect(resultado.totalDistance).toBe(
        distanciaDoPercurso(d, resultado.order),
      );
      expect(resultado.totalDistance).toBeLessThanOrEqual(
        distanciaDoPercurso(d, vizinhoMaisProximo(d)),
      );
    }
  });

  it('acha o ótimo exato até 10 locais (assimétrica)', () => {
    const aleatorio = geradorComSemente(42);
    for (const locais of [3, 5, 7, 8, 9, 10]) {
      for (let caso = 0; caso < 3; caso++) {
        const d = matrizAssimetricaAleatoria(locais + 1, aleatorio);
        const resultado = solveTSP(d, 0);
        expect(resultado.totalDistance).toBe(otimoPorBuscaExaustiva(d));
        expect(resultado.totalDistance).toBe(
          distanciaDoPercurso(d, resultado.order),
        );
      }
    }
  });
});
