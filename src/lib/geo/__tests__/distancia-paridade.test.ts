import { distanceInMeters } from '@/hooks/useNovaEntrega.helpers';
import { calculateHaversineDistance } from '@/lib/osrm/fallback';
import { calculateDistance } from '@/lib/routeGeometry';

import { distanciaMetrosEntre } from '../distancia';

const PARES: [string, number, number, number, number][] = [
  ['São Paulo → Rio', -23.5505, -46.6333, -22.9068, -43.1729],
  ['par a 30 m', -23.5505, -46.6333, -23.5507, -46.6335],
  ['João Pessoa', -7.1195, -34.845, -7.1197, -34.8452],
  ['antípodas', 0, 0, 0, 180],
  ['mesmo ponto', -23.5505, -46.6333, -23.5505, -46.6333],
];

describe('cópias e alias da fonte única', () => {
  // As duas são alias da fonte única: a identidade é a garantia. Comparar o
  // resultado numérico seria tautológico e não pegaria uma cópia que voltasse
  // a divergir com a mesma resposta nos pares de teste.
  it('calculateHaversineDistance é a própria fonte única', () => {
    expect(calculateHaversineDistance).toBe(distanciaMetrosEntre);
  });

  it('calculateDistance (routeGeometry) é a própria fonte única', () => {
    expect(calculateDistance).toBe(distanciaMetrosEntre);
  });

  it.each(PARES)('distanceInMeters: %s', (_n, a, b, c, d) => {
    expect(
      distanceInMeters(
        { latitude: a, longitude: b },
        { latitude: c, longitude: d },
      ),
    ).toBeCloseTo(distanciaMetrosEntre(a, b, c, d), 9);
  });

  it('distanceInMeters sem coordenada continua infinita', () => {
    expect(distanceInMeters({}, { latitude: 0, longitude: 0 })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});
