import { Platform } from 'react-native';

import {
  googleMapsService,
  decodePolyline,
  encodePolyline,
  mergePolylines,
} from '../google';
import { clearCache } from '../osrm';

// Mock de fetch global para OSRM
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Nota: Supabase invoke não é mais usado para directions (migrado para OSRM gratuito)
// O mock abaixo é mantido apenas para compatibilidade caso outros métodos usem

/**
 * Helper para criar mock de resposta OSRM
 */
function createOSRMRouteResponse(options: {
    distance: number;
    duration: number;
    geometry?: string;
}) {
    return {
        code: 'Ok',
        routes: [{
            distance: options.distance,
            duration: options.duration,
            geometry: options.geometry || 'encoded_polyline',
            legs: [{
                distance: options.distance,
                duration: options.duration,
                steps: [],
            }],
        }],
        waypoints: [
            { location: [0, 0], waypoint_index: 0 },
            { location: [1, 1], waypoint_index: 1 },
        ],
    };
}

describe('google maps helpers', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    clearCache(); // Limpar cache do OSRM entre testes
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      get: () => originalPlatform,
      configurable: true,
    });
  });

  it('encode e decode preservam coordenadas', () => {
    const points = [
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ];

    const encoded = encodePolyline(points);
    const decoded = decodePolyline(encoded);

    expect(decoded).toHaveLength(points.length);
    expect(decoded[0].latitude).toBeCloseTo(points[0].latitude, 5);
    expect(decoded[0].longitude).toBeCloseTo(points[0].longitude, 5);
    expect(decoded[2].latitude).toBeCloseTo(points[2].latitude, 5);
  });

  it('mergePolylines remove ponto duplicado e ignora vazios', () => {
    const polylineA = encodePolyline([
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 },
    ]);
    const polylineB = encodePolyline([
      { latitude: 1, longitude: 1 },
      { latitude: 2, longitude: 2 },
    ]);

    const merged = mergePolylines([polylineA, '', polylineB]);
    const mergedPoints = decodePolyline(merged);

    expect(mergedPoints).toHaveLength(3);
  });

  it('getDirectionsWithError usa OSRM (gratuito!) no web', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'web',
      configurable: true,
    });

    // OSRM usa fetch diretamente, não edge function
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(createOSRMRouteResponse({
        distance: 1000,
        duration: 60,
        geometry: 'encoded_polyline',
      })),
    });

    const result = await googleMapsService.getDirectionsWithError(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 }
    );

    expect(result.success).toBe(true);
    expect(result.data?.distancia_total_metros).toBe(1000);

    // Verificar que usou OSRM
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('router.project-osrm.org'),
      expect.any(Object)
    );
  });

  it('getDirectionsWithError usa Haversine fallback quando OSRM falha (graceful degradation)', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'web',
      configurable: true,
    });

    // OSRM falha
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ code: 'NoRoute', routes: [] }),
    });

    const result = await googleMapsService.getDirectionsWithError(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 }
    );

    // OSRM usa Haversine fallback - nunca retorna falha completa
    expect(result.success).toBe(true);
    expect(result.data?.distancia_total_metros).toBeGreaterThan(0); // Haversine estimate
  });

  it('getDirectionsSequentialWithError agrega segmentos no web usando OSRM', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'web',
      configurable: true,
    });

    // OSRM Route API para rota sequencial
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(createOSRMRouteResponse({
        distance: 1000,
        duration: 60,
      })),
    });

    const result = await googleMapsService.getDirectionsSequentialWithError(
      { latitude: 0, longitude: 0 },
      { latitude: 2, longitude: 2 },
      [{ latitude: 1, longitude: 1 }]
    );

    expect(result.success).toBe(true);
  });

  it('getDirectionsWithError usa Haversine fallback em AbortError (graceful degradation)', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'ios',
      configurable: true,
    });

    mockFetch.mockRejectedValueOnce({ name: 'AbortError' });

    const result = await googleMapsService.getDirectionsWithError(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 }
    );

    // OSRM usa Haversine fallback - sempre retorna sucesso com dados estimados
    expect(result.success).toBe(true);
    expect(result.data?.distancia_total_metros).toBeGreaterThan(0);
  });

  it('getDirectionsWithError usa Haversine fallback em TypeError (graceful degradation)', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'ios',
      configurable: true,
    });

    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

    const result = await googleMapsService.getDirectionsWithError(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 }
    );

    // OSRM usa Haversine fallback - sempre retorna sucesso com dados estimados
    expect(result.success).toBe(true);
    expect(result.data?.distancia_total_metros).toBeGreaterThan(0);
  });

  it('getDirectionsSequential usa OSRM no mobile (gratuito!)', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'ios',
      configurable: true,
    });

    // OSRM Route API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        code: 'Ok',
        routes: [{
          distance: 2000,
          duration: 120,
          geometry: 'encoded_polyline',
          legs: [
            { distance: 1000, duration: 60, steps: [] },
            { distance: 1000, duration: 60, steps: [] },
          ],
        }],
        waypoints: [
          { location: [0, 0], waypoint_index: 0 },
          { location: [1, 1], waypoint_index: 1 },
          { location: [2, 2], waypoint_index: 2 },
        ],
      }),
    });

    const result = await googleMapsService.getDirectionsSequential(
      { latitude: 0, longitude: 0 },
      { latitude: 2, longitude: 2 },
      [{ latitude: 1, longitude: 1 }]
    );

    expect(result).not.toBeNull();
    expect(result?.legs).toHaveLength(2);

    // Verificar que usou OSRM
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('router.project-osrm.org'),
      expect.any(Object)
    );
  });

  it('getDirectionsSequentialWithError usa Haversine fallback em erro de fetch', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'ios',
      configurable: true,
    });

    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

    const result = await googleMapsService.getDirectionsSequentialWithError(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 },
      []
    );

    // OSRM usa Haversine fallback - sempre retorna sucesso com dados estimados
    expect(result.success).toBe(true);
    expect(result.data?.distancia_total_metros).toBeGreaterThan(0);
  });
});
