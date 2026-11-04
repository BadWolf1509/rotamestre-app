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
import { readdirSync, readFileSync, statSync } from 'fs';
import { extname, join, relative, sep } from 'path';

const RAIZ = join(__dirname, '..', '..', '..', '..');
const DIRETORIOS = ['src', 'app'];
const EXTENSOES = new Set(['.ts', '.tsx']);
const FONTE_UNICA = 'src/lib/geo/distancia.ts';
const PADRAO = /\b6_?371_?000\b/;

function listarFontes(dir: string): string[] {
  const encontrados: string[] = [];

  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === '__tests__') continue;

    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      encontrados.push(...listarFontes(caminho));
    } else if (EXTENSOES.has(extname(nome)) && !nome.includes('.test.')) {
      encontrados.push(caminho);
    }
  }

  return encontrados;
}

describe('Haversine numa fonte só', () => {
  const fontes = DIRETORIOS.flatMap((d) => listarFontes(join(RAIZ, d)));

  it('acha os arquivos de fonte (senão a varredura passaria vazia)', () => {
    expect(fontes.length).toBeGreaterThan(100);
  });

  it('o raio da Terra em metros só aparece na fonte única', () => {
    const casam = fontes
      .filter((f) => PADRAO.test(readFileSync(f, 'utf8')))
      .map((f) => relative(RAIZ, f).split(sep).join('/'));

    expect(casam).toEqual([FONTE_UNICA]);
  });
});
