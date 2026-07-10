import { googleMapsService } from '../google';
import { clearCache } from '../osrm';

// Mock fetch global
const mockFetch = jest.fn();
global.fetch = mockFetch;

/**
 * Helper para criar mock de resposta OSRM Route API
 */
function createOSRMRouteResponse(options: {
  distance: number;
  duration: number;
  geometry?: string;
  legs?: Array<{ distance: number; duration: number }>;
}) {
  const legs = options.legs || [
    { distance: options.distance, duration: options.duration },
  ];
  return {
    code: 'Ok',
    routes: [
      {
        distance: options.distance,
        duration: options.duration,
        geometry: options.geometry || 'encoded_polyline',
        legs: legs.map((leg) => ({
          distance: leg.distance,
          duration: leg.duration,
          steps: [],
        })),
      },
    ],
    waypoints: [
      { location: [0, 0], waypoint_index: 0 },
      { location: [1, 1], waypoint_index: 1 },
    ],
  };
}

// Helper para criar mock de resposta OSRM Trip API (rota circular/otimizada)
// Mantido comentado para referência futura caso seja necessário testar rotas circulares otimizadas
// function createOSRMTripResponse(options: {...}) {...}

describe('googleMapsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCache(); // Limpar cache do OSRM entre testes
  });

  describe('getDirections (OSRM - gratuito!)', () => {
    it('deve retornar rota e detalhes usando OSRM', async () => {
      // Mock OSRM Route API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(
          createOSRMRouteResponse({
            distance: 1000,
            duration: 600,
            geometry: 'encoded_polyline',
          }),
        ),
      });

      const result = await googleMapsService.getDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
      );

      expect(result).not.toBeNull();
      expect(result?.distancia_total_metros).toBe(1000);
      expect(result?.legs).toHaveLength(1);

      // Verificar que usou OSRM (osrm.rotamestre.tec.br)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('osrm.rotamestre.tec.br'),
        expect.any(Object),
      );
    });

    it('deve retornar fallback Haversine quando OSRM falha (graceful degradation)', async () => {
      // OSRM retorna código de erro
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: 'NoRoute',
          routes: [],
        }),
      });

      const result = await googleMapsService.getDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
      );

      // OSRM usa Haversine fallback, nunca retorna null
      expect(result).not.toBeNull();
      expect(result?.distancia_total_metros).toBeGreaterThan(0); // Haversine estimate
    });

    it('deve retornar fallback Haversine quando não há rotas', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: 'Ok',
          routes: [],
        }),
      });

      const result = await googleMapsService.getDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
      );

      // Haversine fallback
      expect(result).not.toBeNull();
      expect(result?.distancia_total_metros).toBeGreaterThan(0);
    });

    it('deve usar OSRM Route API para rotas não-circulares', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(
          createOSRMRouteResponse({
            distance: 3000,
            duration: 900,
            legs: [
              { distance: 1000, duration: 300 },
              { distance: 2000, duration: 600 },
            ],
          }),
        ),
      });

      const waypoints = [{ latitude: 0.5, longitude: 0.5 }];

      await googleMapsService.getDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 2, longitude: 2 }, // Destino diferente da origem
        waypoints,
      );

      // OSRM Route API usa GET
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('osrm.rotamestre.tec.br/route/v1/driving'),
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    it('deve retornar ordem dos waypoints para rota não otimizada', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(
          createOSRMRouteResponse({
            distance: 1000,
            duration: 300,
            legs: [
              { distance: 333, duration: 100 },
              { distance: 333, duration: 100 },
              { distance: 334, duration: 100 },
            ],
          }),
        ),
      });

      const result = await googleMapsService.getDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 3, longitude: 3 },
        [
          { latitude: 1, longitude: 1 },
          { latitude: 2, longitude: 2 },
        ],
      );

      // Para rota simples (não circular), a ordem é a mesma da entrada
      expect(result?.ordem_otimizada).toEqual([0, 1]);
    });

    it('deve somar distâncias de múltiplas legs corretamente', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(
          createOSRMRouteResponse({
            distance: 4500,
            duration: 1350,
            legs: [
              { distance: 1000, duration: 300 },
              { distance: 2000, duration: 600 },
              { distance: 1500, duration: 450 },
            ],
          }),
        ),
      });

      const result = await googleMapsService.getDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 3, longitude: 3 },
        [
          { latitude: 1, longitude: 1 },
          { latitude: 2, longitude: 2 },
        ],
      );

      expect(result?.distancia_total_metros).toBe(4500);
      expect(result?.duracao_total_segundos).toBe(1350);
      expect(result?.legs).toHaveLength(3);
    });

    it('deve usar OSRM GET request (gratuito vs Google POST pago)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(
          createOSRMRouteResponse({
            distance: 1000,
            duration: 300,
          }),
        ),
      });

      await googleMapsService.getDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
      );

      // OSRM usa GET, não POST
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('osrm.rotamestre.tec.br'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('deve retornar array vazio para ordem_otimizada quando não há waypoints', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(
          createOSRMRouteResponse({
            distance: 1000,
            duration: 300,
          }),
        ),
      });

      const result = await googleMapsService.getDirections(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
      );

      expect(result?.ordem_otimizada).toEqual([]);
    });

    it('deve mapear corretamente as informações de cada leg', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(
          createOSRMRouteResponse({
            distance: 5000,
            duration: 900,
          }),
        ),
      });

      const result = await googleMapsService.getDirections(
        { latitude: -23.5505, longitude: -46.6333 },
        { latitude: -23.5615, longitude: -46.6561 },
      );

      // OSRM não retorna endereços formatados - usa strings vazias
      expect(result?.legs[0].distancia_metros).toBe(5000);
      expect(result?.legs[0].duracao_segundos).toBe(900);
      expect(result?.legs[0].coordenadas_inicio).toBeDefined();
      expect(result?.legs[0].coordenadas_fim).toBeDefined();
    });
  });
});
