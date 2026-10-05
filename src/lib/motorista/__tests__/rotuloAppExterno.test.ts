import { rotuloAppExterno } from '../rotuloAppExterno';

describe('rotuloAppExterno', () => {
  it.each([
    ['waze', 'Waze'],
    ['google_maps', 'Google Maps'],
    ['apple_maps', 'Apple Maps'],
    ['default', 'Abrir no GPS'],
    [undefined, 'Abrir no GPS'],
  ] as const)('%s → %s', (app, rotulo) => {
    expect(rotuloAppExterno(app)).toBe(rotulo);
  });

  /**
   * O botão divide a linha com "Pular" e "Concluir". "Abrir no Google Maps"
   * quebrou em duas linhas num moto g15 (05/10/2026) e empurrou o ícone para
   * fora do botão; "Abrir no GPS" é o maior que coube.
   */
  it.each(['waze', 'google_maps', 'apple_maps', 'default'] as const)(
    '%s cabe no botão (até 12 caracteres)',
    (app) => {
      expect(rotuloAppExterno(app).length).toBeLessThanOrEqual(12);
    },
  );
});
