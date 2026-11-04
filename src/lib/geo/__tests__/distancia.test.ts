import { RAIO_MESMO_LOCAL_METROS } from '@/lib/route-optimization/agrupamento';

import { distanciaMetros, distanciaMetrosEntre } from '../distancia';

describe('distanciaMetrosEntre (Haversine)', () => {
  it('São Paulo → Rio', () => {
    expect(
      distanciaMetrosEntre(-23.5505, -46.6333, -22.9068, -43.1729),
    ).toBeCloseTo(360748.8249099, 4);
  });

  it('par a 30,17 m fica fora do raio de mesmo local', () => {
    const d = distanciaMetrosEntre(-23.5505, -46.6333, -23.5507, -46.6335);
    expect(d).toBeCloseTo(30.169319000331836, 9);
    expect(d).toBeGreaterThan(RAIO_MESMO_LOCAL_METROS);
  });

  it('João Pessoa, ~31 m', () => {
    expect(
      distanciaMetrosEntre(-7.1195, -34.845, -7.1197, -34.8452),
    ).toBeCloseTo(31.329660610544078, 9);
  });

  it('antípodas no equador', () => {
    expect(distanciaMetrosEntre(0, 0, 0, 180)).toBeCloseTo(
      20015086.79602057,
      4,
    );
  });

  it('mesmo ponto é zero', () => {
    expect(distanciaMetrosEntre(-23.5505, -46.6333, -23.5505, -46.6333)).toBe(
      0,
    );
  });

  it('é simétrica', () => {
    expect(distanciaMetrosEntre(-23.5505, -46.6333, -22.9068, -43.1729)).toBe(
      distanciaMetrosEntre(-22.9068, -43.1729, -23.5505, -46.6333),
    );
  });

  it('forma de objeto = forma de 4 números', () => {
    expect(
      distanciaMetros(
        { latitude: -23.5505, longitude: -46.6333 },
        { latitude: -22.9068, longitude: -43.1729 },
      ),
    ).toBe(distanciaMetrosEntre(-23.5505, -46.6333, -22.9068, -43.1729));
  });
});
