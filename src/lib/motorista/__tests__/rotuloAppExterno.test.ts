import { rotuloAppExterno } from '../rotuloAppExterno';

describe('rotuloAppExterno', () => {
  it.each([
    ['waze', 'Abrir no Waze'],
    ['google_maps', 'Abrir no Google Maps'],
    ['apple_maps', 'Abrir no Apple Maps'],
    ['default', 'Abrir no GPS'],
    [undefined, 'Abrir no GPS'],
  ] as const)('%s → %s', (app, rotulo) => {
    expect(rotuloAppExterno(app)).toBe(rotulo);
  });
});
