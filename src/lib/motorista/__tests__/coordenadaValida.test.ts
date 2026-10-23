import { temCoordenadaValida } from '../coordenadaValida';

describe('temCoordenadaValida', () => {
  it.each([
    [-23.55, -46.63],
    [0, 0],
    [90, 180],
    [-90, -180],
  ])('aceita (%p, %p)', (latitude, longitude) => {
    expect(temCoordenadaValida({ latitude, longitude })).toBe(true);
  });

  it.each([
    [NaN, -46.63],
    [-23.55, NaN],
    [-100, -46.63],
    [-23.55, -200],
    [Infinity, 0],
    [null, -46.63],
    [-23.55, undefined],
  ])('recusa (%p, %p)', (latitude, longitude) => {
    expect(
      temCoordenadaValida({
        latitude: latitude as number,
        longitude: longitude as number,
      }),
    ).toBe(false);
  });
});
