/**
 * Par sem rota na matriz do OSRM (G9).
 *
 * O `table` do OSRM devolve `null` no par que não tem rota de carro (ilha,
 * coordenada fora do extrato). Em JS, `null + 1000` vale 1000: o par
 * impossível saía DE GRAÇA e o TSP o preferia. Agora ele custa
 * `CUSTO_INALCANCAVEL`, a ordem com menos trechos impossíveis vence, e quando
 * toda ordem tem algum o resultado avisa (`sem_rota_entre_paradas`).
 */
import { clearCache, getOptimizedDirections } from '../osrm';
import { getDistanceMatrix } from '../osrm/table';
import { CUSTO_INALCANCAVEL, solveTSP } from '../osrm/tsp';

const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock('../logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));

function respostaTable(distances: (number | null)[][]) {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({
      code: 'Ok',
      distances,
      durations: distances.map((linha) =>
        linha.map((d) => (d === null ? null : d / 10)),
      ),
    }),
  };
}

function respostaRoute(paradas: number) {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({
      code: 'Ok',
      routes: [
        {
          geometry: 'polyline',
          distance: 30000,
          duration: 3000,
          legs: Array.from({ length: paradas + 1 }, () => ({
            distance: 10000,
            duration: 1000,
          })),
        },
      ],
    }),
  };
}

const ORIGEM = { latitude: 0, longitude: 0 };
const A = { latitude: 1, longitude: 1 };
const B = { latitude: 2, longitude: 2 };

beforeEach(() => {
  mockFetch.mockReset();
  clearCache();
});

describe('getDistanceMatrix', () => {
  it('par sem rota (null) vira custo inalcançável, não zero', async () => {
    mockFetch.mockResolvedValueOnce(
      respostaTable([
        [0, 1000],
        [null, 0],
      ]),
    );

    const matriz = await getDistanceMatrix([ORIGEM, A]);

    expect(matriz?.distances[1][0]).toBe(CUSTO_INALCANCAVEL);
    expect(matriz?.durations[1][0]).toBe(CUSTO_INALCANCAVEL);
    expect(matriz?.distances[0][1]).toBe(1000);
  });
});

describe('solveTSP', () => {
  const X = CUSTO_INALCANCAVEL;

  it('evita o trecho impossível quando há outra ordem', () => {
    // A→B não tem rota; B→A tem.
    const resultado = solveTSP(
      [
        [0, 1000, 5000],
        [1000, 0, X],
        [5000, 2000, 0],
      ],
      0,
    );
    expect(resultado.order).toEqual([2, 1]);
    expect(resultado.resolvida).toBe(true);
  });

  it('nenhuma ordem resolve quando uma parada está isolada', () => {
    const resultado = solveTSP(
      [
        [0, X, 5000],
        [X, 0, X],
        [5000, X, 0],
      ],
      0,
    );
    expect(resultado.resolvida).toBe(false);
  });

  it('a heurística (11+ paradas) também informa se resolveu', () => {
    const n = 13;
    const matriz = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 0 : 100 + i + j)),
    );
    expect(solveTSP(matriz, 0).resolvida).toBe(true);
    for (let i = 0; i < n; i++) {
      if (i !== 5) {
        matriz[5][i] = X;
        matriz[i][5] = X;
      }
    }
    expect(solveTSP(matriz, 0).resolvida).toBe(false);
  });
});

describe('getOptimizedDirections (rota circular)', () => {
  it('a ordem não passa pelo par sem rota', async () => {
    mockFetch
      .mockResolvedValueOnce(
        respostaTable([
          [0, 1000, 5000],
          [1000, 0, null], // A→B sem rota
          [5000, 2000, 0],
        ]),
      )
      .mockResolvedValueOnce(respostaRoute(2));

    const resultado = await getOptimizedDirections(ORIGEM, ORIGEM, [A, B]);

    // O→B→A→O; a ordem com A→B "de graça" seria [0, 1]
    expect(resultado?.ordem_otimizada).toEqual([1, 0]);
    expect(resultado?.sem_rota_entre_paradas).toBeFalsy();
  });

  it('avisa quando nenhuma ordem resolve', async () => {
    mockFetch
      .mockResolvedValueOnce(
        respostaTable([
          [0, null, 5000],
          [null, 0, null], // A isolada
          [5000, null, 0],
        ]),
      )
      .mockResolvedValueOnce(respostaRoute(2));

    const resultado = await getOptimizedDirections(ORIGEM, ORIGEM, [A, B]);

    expect(resultado?.sem_rota_entre_paradas).toBe(true);

    // A segunda chamada vem do cache: o aviso e a ordem do TSP vêm junto.
    const doCache = await getOptimizedDirections(ORIGEM, ORIGEM, [A, B]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(doCache?.sem_rota_entre_paradas).toBe(true);
    expect(doCache?.ordem_otimizada).toEqual(resultado?.ordem_otimizada);
  });
});
