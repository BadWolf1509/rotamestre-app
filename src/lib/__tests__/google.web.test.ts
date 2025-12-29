import { Platform } from 'react-native';

import {
  googleMapsService,
  getCoordinates,
  decodePolyline,
  encodePolyline,
  mergePolylines,
} from '../google';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

const mockInvoke = require('@/lib/supabase').supabase.functions.invoke as jest.Mock;

describe('google maps helpers', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('getCoordinates trata erro de fetch', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const result = await getCoordinates('Rua Teste');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('geocodeAddress trata erro de fetch', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const result = await googleMapsService.geocodeAddress('Rua Teste');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('reverseGeocode trata erro de fetch', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const result = await googleMapsService.reverseGeocode({ latitude: 1, longitude: 2 });

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('getDirectionsWithError usa edge function no web', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'web',
      configurable: true,
    });

    const polyline = encodePolyline([
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 },
    ]);

    mockInvoke.mockResolvedValueOnce({
      data: {
        routes: [
          {
            duration: '60s',
            distanceMeters: 1000,
            polyline: { encodedPolyline: polyline },
            legs: [
              {
                duration: '60s',
                distanceMeters: 1000,
                startLocation: { latLng: { latitude: 0, longitude: 0 } },
                endLocation: { latLng: { latitude: 1, longitude: 1 } },
              },
            ],
          },
        ],
      },
      error: null,
    });

    const result = await googleMapsService.getDirectionsWithError(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 }
    );

    expect(result.success).toBe(true);
    expect(result.data?.distancia_total_metros).toBe(1000);
  });

  it('getDirectionsWithError retorna falha quando invoke retorna erro', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'web',
      configurable: true,
    });

    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: new Error('invoke error'),
    });

    const result = await googleMapsService.getDirectionsWithError(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 }
    );

    expect(result.success).toBe(false);
  });

  it('getDirectionsSequentialWithError agrega segmentos no web', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'web',
      configurable: true,
    });

    const polyline = encodePolyline([
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 },
    ]);

    mockInvoke
      .mockResolvedValueOnce({
        data: {
          routes: [
            {
              duration: '60s',
              distanceMeters: 1000,
              polyline: { encodedPolyline: polyline },
              legs: [
                {
                  duration: '60s',
                  distanceMeters: 1000,
                  startLocation: { latLng: { latitude: 0, longitude: 0 } },
                  endLocation: { latLng: { latitude: 1, longitude: 1 } },
                },
              ],
            },
          ],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          routes: [],
        },
        error: null,
      });

    const result = await googleMapsService.getDirectionsSequentialWithError(
      { latitude: 0, longitude: 0 },
      { latitude: 2, longitude: 2 },
      [{ latitude: 1, longitude: 1 }]
    );

    expect(result.success).toBe(true);
    expect(result.data?.legs).toHaveLength(1);
  });

  it('getDirectionsWithError trata AbortError', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'ios',
      configurable: true,
    });

    mockFetch.mockRejectedValueOnce({ name: 'AbortError' });

    const result = await googleMapsService.getDirectionsWithError(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 }
    );

    expect(result.success).toBe(false);
  });

  it('getDirectionsWithError trata TypeError', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'ios',
      configurable: true,
    });

    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

    const result = await googleMapsService.getDirectionsWithError(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 }
    );

    expect(result.success).toBe(false);
  });

  it('getDirectionsSequential usa fetch no mobile', async () => {
    Object.defineProperty(Platform, 'OS', {
      get: () => 'ios',
      configurable: true,
    });

    const responseA = {
      routes: [
        {
          duration: '60s',
          distanceMeters: 1000,
          polyline: { encodedPolyline: encodePolyline([{ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 1 }]) },
          legs: [
            {
              duration: '60s',
              distanceMeters: 1000,
              startLocation: { latLng: { latitude: 0, longitude: 0 } },
              endLocation: { latLng: { latitude: 1, longitude: 1 } },
            },
          ],
        },
      ],
    };

    const responseB = {
      routes: [
        {
          duration: '60s',
          distanceMeters: 1000,
          polyline: { encodedPolyline: encodePolyline([{ latitude: 1, longitude: 1 }, { latitude: 2, longitude: 2 }]) },
          legs: [
            {
              duration: '60s',
              distanceMeters: 1000,
              startLocation: { latLng: { latitude: 1, longitude: 1 } },
              endLocation: { latLng: { latitude: 2, longitude: 2 } },
            },
          ],
        },
      ],
    };

    mockFetch
      .mockResolvedValueOnce({ json: jest.fn().mockResolvedValue(responseA) })
      .mockResolvedValueOnce({ json: jest.fn().mockResolvedValue(responseB) });

    const result = await googleMapsService.getDirectionsSequential(
      { latitude: 0, longitude: 0 },
      { latitude: 2, longitude: 2 },
      [{ latitude: 1, longitude: 1 }]
    );

    expect(result).not.toBeNull();
    expect(result?.legs).toHaveLength(2);
  });

  it('getDirectionsSequentialWithError trata erro de fetch', async () => {
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

    expect(result.success).toBe(false);
  });
});
