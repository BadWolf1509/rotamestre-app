/**
 * Guarda estática: o raio da Terra em metros (6371000) só pode aparecer na
 * fonte única da distância. Quem precisar de distância importa de
 * `@/lib/geo/distancia`; copiar a fórmula de novo reabre a divergência entre
 * cópias (o rastreamento e o otimizador chegaram a calcular com funções
 * diferentes).
 *
 * Limite: só enxerga a constante literal. Uma cópia com o raio vindo de outro
 * lugar passa batido — protege contra a forma como as quatro cópias nasceram.
 */
import { readFileSync } from 'fs';
import { join, relative, sep } from 'path';

import { exigirVolume, listarFontes } from '@/__tests__/helpers/fontes';

const RAIZ = join(__dirname, '..', '..', '..', '..');
const DIRETORIOS = ['src', 'app'];
const FONTE_UNICA = 'src/lib/geo/distancia.ts';
const PADRAO = /\b6_?371_?000\b/;

describe('Haversine numa fonte só', () => {
  const fontes = listarFontes({ pastas: DIRETORIOS });

  it('acha os arquivos de fonte (senão a varredura passaria vazia)', () => {
    expect(() => exigirVolume(fontes, 100)).not.toThrow();
  });

  it('o raio da Terra em metros só aparece na fonte única', () => {
    const casam = fontes
      .filter((f) => PADRAO.test(readFileSync(f, 'utf8')))
      .map((f) => relative(RAIZ, f).split(sep).join('/'));

    expect(casam).toEqual([FONTE_UNICA]);
  });
});
