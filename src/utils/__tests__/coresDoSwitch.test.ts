import fs from 'fs';
import path from 'path';

import { coresDoSwitch } from '../coresDoSwitch';
import { darkTheme, defaultTheme } from '../styles.base';

/** Luminância relativa (WCAG) de um #rrggbb. */
function luminancia(hex: string): number {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe('coresDoSwitch', () => {
  it.each([
    ['claro', defaultTheme],
    ['escuro', darkTheme],
  ])(
    'no tema %s, o polegar ligado é claro e se destaca da trilha',
    (_, theme) => {
      const { thumbColor, trackColor } = coresDoSwitch(theme, true);
      // `theme.colors.white` vira #1a2029 no escuro: era o polegar escuro.
      expect(luminancia(thumbColor)).toBeGreaterThan(0.8);
      expect(contraste(thumbColor, trackColor.true)).toBeGreaterThanOrEqual(3);
    },
  );

  it.each([
    ['claro', defaultTheme],
    ['escuro', darkTheme],
  ])('no tema %s, o polegar desligado se destaca da trilha', (_, theme) => {
    const { thumbColor, trackColor } = coresDoSwitch(theme, false);
    expect(contraste(thumbColor, trackColor.false)).toBeGreaterThanOrEqual(1.3);
  });
});

/**
 * Guarda da classe: nenhum Switch tira o polegar de um token que se inverte
 * no tema escuro (`white`, `gray100`), como os 8 que existiam.
 */
describe('nenhum Switch com polegar de token invertido', () => {
  const raiz = path.resolve(__dirname, '../../..');
  const listar = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        return e.name === '__tests__' || e.name === 'node_modules'
          ? []
          : listar(p);
      }
      return /\.tsx$/.test(e.name) ? [p] : [];
    });

  it('thumbColor não usa theme.colors.white nem gray100', () => {
    const ofensores = [
      ...listar(path.join(raiz, 'src')),
      ...listar(path.join(raiz, 'app')),
    ]
      .filter((f) =>
        /thumbColor=\{[^}]*theme\.colors\.(white|gray100)/.test(
          fs.readFileSync(f, 'utf8').replace(/\s+/g, ' '),
        ),
      )
      .map((f) => path.relative(raiz, f));
    expect(ofensores).toEqual([]);
  });
});
