/**
 * Tests for the main route optimization function.
 */

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock cache
jest.mock('../cache', () => ({
  gerarHashRota: jest.fn(() => 'mock-hash'),
  obterDoCache: jest.fn(() => null),
  salvarNoCache: jest.fn(() => Promise.resolve()),
}));

// Mock validation
jest.mock('../validation', () => ({
  validarRotaParaOtimizacao: jest.fn(() => ({
    valido: true,
    erros: [],
    avisos: [],
  })),
}));

// Mock googleMapsService
const mockGetDirections = jest.fn();
const mockGetDirectionsSequential = jest.fn();
jest.mock('../../google', () => ({
  googleMapsService: {
    getDirections: (...args: any[]) => mockGetDirections(...args),
    getDirectionsSequential: (...args: any[]) =>
      mockGetDirectionsSequential(...args),
  },
}));

import { logger } from '@/lib/logger';

import { obterDoCache, salvarNoCache } from '../cache';
import { otimizarRotaComDependencias } from '../optimizer';
import { validarRotaParaOtimizacao } from '../validation';

import type { ParadaParaOtimizar, ResultadoOtimizacao } from '../types';

function makeParada(
  overrides: Partial<ParadaParaOtimizar> & { id: string },
): ParadaParaOtimizar {
  return {
    tipo: 'entrega',
    endereco: `Rua ${overrides.id}`,
    latitude: -23.55,
    longitude: -46.63,
    ordem: 1,
    ...overrides,
  };
}

const mockOrigem = { latitude: -23.55, longitude: -46.63 };

function mockDirectionsResponse(ordemOtimizada?: number[]) {
  return {
    distancia_total_metros: 5000,
    duracao_total_segundos: 1200,
    polyline: 'encoded_polyline',
    ordem_otimizada: ordemOtimizada || [0, 1],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDirections.mockResolvedValue(mockDirectionsResponse());
  (obterDoCache as jest.Mock).mockResolvedValue(null);
  (salvarNoCache as jest.Mock).mockResolvedValue(undefined);
  (validarRotaParaOtimizacao as jest.Mock).mockReturnValue({
    valido: true,
    erros: [],
    avisos: [],
  });
});

describe('otimizarRotaComDependencias', () => {
  describe('empty and edge cases', () => {
    it('returns empty result for empty paradas', async () => {
      const result = await otimizarRotaComDependencias(mockOrigem, []);

      expect(result).toEqual({
        paradasOrdenadas: [],
        distanciaTotalMetros: 0,
        duracaoTotalSegundos: 0,
        polyline: '',
        ordemIndices: [],
        isEstimated: false,
      });
      expect(mockGetDirections).not.toHaveBeenCalled();
    });

    it('returns null when validation fails', async () => {
      (validarRotaParaOtimizacao as jest.Mock).mockReturnValue({
        valido: false,
        erros: ['Too many waypoints'],
        avisos: [],
      });

      const paradas = [makeParada({ id: '1' })];
      const result = await otimizarRotaComDependencias(mockOrigem, paradas);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    it('returns null when getDirections fails', async () => {
      mockGetDirections.mockResolvedValue(null);

      const paradas = [makeParada({ id: '1' })];
      const result = await otimizarRotaComDependencias(mockOrigem, paradas);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('cache behavior', () => {
    it('returns cached result on cache hit', async () => {
      const cachedResult: ResultadoOtimizacao = {
        paradasOrdenadas: [],
        distanciaTotalMetros: 999,
        duracaoTotalSegundos: 99,
        polyline: 'cached',
        ordemIndices: [],
      };
      (obterDoCache as jest.Mock).mockResolvedValue(cachedResult);

      const paradas = [makeParada({ id: '1' })];
      const result = await otimizarRotaComDependencias(mockOrigem, paradas);

      expect(result).toBe(cachedResult);
      expect(mockGetDirections).not.toHaveBeenCalled();
    });

    it('skips cache when ignorarCache is true', async () => {
      const cachedResult: ResultadoOtimizacao = {
        paradasOrdenadas: [],
        distanciaTotalMetros: 999,
        duracaoTotalSegundos: 99,
        polyline: 'cached',
        ordemIndices: [],
      };
      (obterDoCache as jest.Mock).mockResolvedValue(cachedResult);

      const paradas = [makeParada({ id: '1' })];
      mockGetDirections.mockResolvedValue(mockDirectionsResponse([0]));

      const result = await otimizarRotaComDependencias(
        mockOrigem,
        paradas,
        undefined,
        true,
      );

      expect(obterDoCache).not.toHaveBeenCalled();
      expect(mockGetDirections).toHaveBeenCalled();
      expect(result).not.toBe(cachedResult);
    });

    it('saves result to cache after successful optimization', async () => {
      const paradas = [makeParada({ id: '1' })];
      mockGetDirections.mockResolvedValue(mockDirectionsResponse([0]));

      await otimizarRotaComDependencias(mockOrigem, paradas);

      expect(salvarNoCache).toHaveBeenCalledWith(
        'mock-hash',
        expect.objectContaining({
          distanciaTotalMetros: 5000,
        }),
      );
    });
  });

  describe('simple route (no dependencies)', () => {
    it('optimizes single stop route', async () => {
      const paradas = [makeParada({ id: '1' })];
      mockGetDirections.mockResolvedValue(mockDirectionsResponse([0]));

      const result = await otimizarRotaComDependencias(mockOrigem, paradas);

      expect(result).not.toBeNull();
      expect(result!.paradasOrdenadas).toHaveLength(1);
      expect(result!.distanciaTotalMetros).toBe(5000);
      expect(result!.duracaoTotalSegundos).toBe(1200);
    });

    it('optimizes multi-stop route without dependencies', async () => {
      const paradas = [
        makeParada({ id: '1', latitude: -23.55, longitude: -46.63 }),
        makeParada({ id: '2', latitude: -23.56, longitude: -46.64 }),
        makeParada({ id: '3', latitude: -23.57, longitude: -46.65 }),
      ];
      mockGetDirections.mockResolvedValue(mockDirectionsResponse([2, 0, 1]));

      const result = await otimizarRotaComDependencias(mockOrigem, paradas);

      expect(result).not.toBeNull();
      expect(result!.paradasOrdenadas).toHaveLength(3);
      // Reordered according to [2,0,1]
      expect(result!.paradasOrdenadas[0].id).toBe('3');
      expect(result!.paradasOrdenadas[1].id).toBe('1');
      expect(result!.paradasOrdenadas[2].id).toBe('2');
    });

    it('sets correct ordem (1-based) on optimized stops', async () => {
      // Pontos distintos: no mesmo ponto as duas viram uma visita só.
      const paradas = [
        makeParada({ id: '1' }),
        makeParada({ id: '2', latitude: -23.56, longitude: -46.64 }),
      ];
      mockGetDirections.mockResolvedValue(mockDirectionsResponse([1, 0]));

      const result = await otimizarRotaComDependencias(mockOrigem, paradas);

      expect(result!.paradasOrdenadas[0].ordem).toBe(1);
      expect(result!.paradasOrdenadas[1].ordem).toBe(2);
    });
  });

  describe('dependency grouping', () => {
    it('keeps pickup before linked delivery', async () => {
      const paradas = [
        makeParada({ id: 'r1', tipo: 'retirada' }),
        makeParada({ id: 'e1', tipo: 'entrega', vinculo_parada_id: 'r1' }),
      ];
      // grupo [r1, e1] = index 0, no independentes
      mockGetDirections.mockResolvedValue(mockDirectionsResponse([0]));

      const result = await otimizarRotaComDependencias(mockOrigem, paradas);

      expect(result).not.toBeNull();
      const ids = result!.paradasOrdenadas.map((p) => p.id);
      const r1Idx = ids.indexOf('r1');
      const e1Idx = ids.indexOf('e1');
      expect(r1Idx).toBeLessThan(e1Idx);
    });

    it('keeps multiple deliveries after their shared pickup', async () => {
      const paradas = [
        makeParada({ id: 'r1', tipo: 'retirada' }),
        makeParada({ id: 'e1', tipo: 'entrega', vinculo_parada_id: 'r1' }),
        makeParada({ id: 'e2', tipo: 'entrega', vinculo_parada_id: 'r1' }),
      ];
      mockGetDirections.mockResolvedValue(mockDirectionsResponse([0]));

      const result = await otimizarRotaComDependencias(mockOrigem, paradas);

      expect(result).not.toBeNull();
      const ids = result!.paradasOrdenadas.map((p) => p.id);
      expect(ids[0]).toBe('r1');
      // Both deliveries come after pickup
      expect(ids.indexOf('e1')).toBeGreaterThan(ids.indexOf('r1'));
      expect(ids.indexOf('e2')).toBeGreaterThan(ids.indexOf('r1'));
    });

    it('handles mixed dependent and independent stops', async () => {
      const paradas = [
        makeParada({ id: 'r1', tipo: 'retirada' }),
        makeParada({ id: 'e1', tipo: 'entrega', vinculo_parada_id: 'r1' }),
        // Pontos distintos de r1/e1: no mesmo ponto entrariam na mesma visita.
        makeParada({
          id: 'ind1',
          tipo: 'entrega',
          latitude: -23.56,
          longitude: -46.64,
        }),
        makeParada({
          id: 'ind2',
          tipo: 'entrega',
          latitude: -23.57,
          longitude: -46.65,
        }),
      ];
      // grupo [r1,e1]=idx0, ind1=idx1, ind2=idx2
      mockGetDirections.mockResolvedValue(mockDirectionsResponse([1, 0, 2]));

      const result = await otimizarRotaComDependencias(mockOrigem, paradas);

      expect(result).not.toBeNull();
      // ind1 first (idx 1), then grupo [r1,e1] (idx 0), then ind2 (idx 2)
      expect(result!.paradasOrdenadas[0].id).toBe('ind1');
      expect(result!.paradasOrdenadas[1].id).toBe('r1');
      expect(result!.paradasOrdenadas[2].id).toBe('e1');
      expect(result!.paradasOrdenadas[3].id).toBe('ind2');
    });
  });

  describe('paradas no mesmo ponto', () => {
    const PONTO = { latitude: -23.55, longitude: -46.63 };
    const OUTRO = { latitude: -23.6, longitude: -46.7 };

    it('manda o ponto repetido ao TSP uma vez só e expande entrega → retirada', async () => {
      const paradas = [
        makeParada({ id: 'r1', tipo: 'retirada', ...PONTO }),
        makeParada({ id: 'a', tipo: 'entrega', ...OUTRO }),
        makeParada({ id: 'e1', tipo: 'entrega', ...PONTO }),
      ];
      // visitas = [[e1, r1], [a]]; o TSP põe a visita 1 primeiro.
      mockGetDirections.mockResolvedValue(mockDirectionsResponse([1, 0]));

      const result = await otimizarRotaComDependencias(mockOrigem, paradas);

      expect(mockGetDirections.mock.calls[0][2]).toHaveLength(2);
      expect(result!.paradasOrdenadas.map((p) => p.id)).toEqual([
        'a',
        'e1',
        'r1',
      ]);
      expect(result!.ordemIndices).toEqual([1, 2, 0]);
      // Visita num ponto só: a distância do TSP já é a real.
      expect(mockGetDirectionsSequential).not.toHaveBeenCalled();
    });

    it('vínculo sobreposto a um local sai Y … entrega → X', async () => {
      const paradas = [
        makeParada({ id: 'x', tipo: 'retirada', ...PONTO }),
        makeParada({
          id: 'e',
          tipo: 'entrega',
          vinculo_parada_id: 'y',
          ...PONTO,
        }),
        makeParada({ id: 'y', tipo: 'retirada', ...OUTRO }),
      ];
      mockGetDirections.mockResolvedValue(mockDirectionsResponse([0]));
      mockGetDirectionsSequential.mockResolvedValue({
        distancia_total_metros: 9000,
        duracao_total_segundos: 1500,
        polyline: 'sequencial',
        ordem_otimizada: [],
        legs: [],
      });

      const result = await otimizarRotaComDependencias(mockOrigem, paradas);

      expect(result!.paradasOrdenadas.map((p) => p.id)).toEqual([
        'y',
        'e',
        'x',
      ]);
      expect(result!.paradasOrdenadas.map((p) => p.ordem)).toEqual([1, 2, 3]);
    });

    it('mede distância e traçado com todas as paradas quando a visita cruza endereços', async () => {
      // A visita [y, e, x] começa em OUTRO e termina em PONTO; o TSP só viu
      // OUTRO. A distância tem de vir da rota com as três paradas.
      const paradas = [
        makeParada({ id: 'x', tipo: 'retirada', ...PONTO }),
        makeParada({
          id: 'e',
          tipo: 'entrega',
          vinculo_parada_id: 'y',
          ...PONTO,
        }),
        makeParada({ id: 'y', tipo: 'retirada', ...OUTRO }),
      ];
      mockGetDirections.mockResolvedValue(mockDirectionsResponse([0]));
      mockGetDirectionsSequential.mockResolvedValue({
        distancia_total_metros: 9000,
        duracao_total_segundos: 1500,
        polyline: 'sequencial',
        ordem_otimizada: [],
        legs: [],
      });

      const result = await otimizarRotaComDependencias(mockOrigem, paradas);

      expect(mockGetDirectionsSequential).toHaveBeenCalledWith(
        mockOrigem,
        mockOrigem,
        [OUTRO, PONTO, PONTO].map((c) => expect.objectContaining(c)),
      );
      expect(result!.distanciaTotalMetros).toBe(9000);
      expect(result!.duracaoTotalSegundos).toBe(1500);
      expect(result!.polyline).toBe('sequencial');
    });

    it('fica com a distância do TSP se a rota completa falhar', async () => {
      const paradas = [
        makeParada({ id: 'r1', tipo: 'retirada', ...OUTRO }),
        makeParada({
          id: 'e1',
          tipo: 'entrega',
          vinculo_parada_id: 'r1',
          ...PONTO,
        }),
      ];
      mockGetDirections.mockResolvedValue(mockDirectionsResponse([0]));
      mockGetDirectionsSequential.mockResolvedValue(null);

      const result = await otimizarRotaComDependencias(mockOrigem, paradas);

      expect(result!.paradasOrdenadas.map((p) => p.id)).toEqual(['r1', 'e1']);
      expect(result!.distanciaTotalMetros).toBe(5000);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[RouteOptimization]'),
        expect.anything(),
      );
    });
  });

  describe('API integration', () => {
    it('passes correct waypoints to getDirections', async () => {
      const paradas = [
        makeParada({ id: '1', latitude: -23.55, longitude: -46.63 }),
        makeParada({ id: '2', latitude: -23.56, longitude: -46.64 }),
      ];
      mockGetDirections.mockResolvedValue(mockDirectionsResponse([0, 1]));

      await otimizarRotaComDependencias(mockOrigem, paradas);

      expect(mockGetDirections).toHaveBeenCalledWith(
        mockOrigem,
        mockOrigem, // destino defaults to origem
        expect.arrayContaining([
          expect.objectContaining({ latitude: -23.55, longitude: -46.63 }),
          expect.objectContaining({ latitude: -23.56, longitude: -46.64 }),
        ]),
      );
    });

    it('uses custom destino when provided', async () => {
      const destino = { latitude: -23.6, longitude: -46.7 };
      const paradas = [makeParada({ id: '1' })];
      mockGetDirections.mockResolvedValue(mockDirectionsResponse([0]));

      await otimizarRotaComDependencias(mockOrigem, paradas, destino);

      expect(mockGetDirections).toHaveBeenCalledWith(
        mockOrigem,
        destino,
        expect.any(Array),
      );
    });

    it('falls back to original order when no ordem_otimizada', async () => {
      const paradas = [makeParada({ id: '1' }), makeParada({ id: '2' })];
      mockGetDirections.mockResolvedValue({
        distancia_total_metros: 5000,
        duracao_total_segundos: 1200,
        polyline: 'poly',
        ordem_otimizada: [],
      });

      const result = await otimizarRotaComDependencias(mockOrigem, paradas);

      expect(result).not.toBeNull();
      expect(result!.paradasOrdenadas.map((p) => p.id)).toEqual(['1', '2']);
    });
  });

  describe('validation warnings', () => {
    it('logs warnings but still proceeds', async () => {
      (validarRotaParaOtimizacao as jest.Mock).mockReturnValue({
        valido: true,
        erros: [],
        avisos: ['Close to waypoint limit'],
      });

      const paradas = [makeParada({ id: '1' })];
      mockGetDirections.mockResolvedValue(mockDirectionsResponse([0]));

      const result = await otimizarRotaComDependencias(mockOrigem, paradas);

      expect(result).not.toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
