/**
 * Contraste WCAG para testes: luminância relativa (WCAG 2.x) e composição de
 * uma cor translúcida sobre um fundo opaco, como o navegador desenha o
 * `rgba(...)` do selo soft.
 */

function canais(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function paraHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function luminancia(hex: string): number {
  const [r, g, b] = canais(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** `cor` com opacidade `alfa` desenhada sobre `fundo` (ambos #rrggbb). */
export function comporSobre(cor: string, fundo: string, alfa: number): string {
  const c = canais(cor);
  const f = canais(fundo);
  return paraHex(
    c.map((v, i) => Math.round(v * alfa + f[i] * (1 - alfa))) as [
      number,
      number,
      number,
    ],
  );
}
