import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Guarda estática: as props do mapa vivem num tipo só (`MapaAdapterProps`, em
 * `@/types/parada-map`). Interface local em cada variante deixa prop nova
 * chegar a uma plataforma só, sem erro de tipo nem de teste.
 */
const VARIANTES = [
  'MapaAdapter.tsx',
  'MapaAdapter.web.tsx',
  'MapaMobile.web.tsx',
  'MapaWebMapLibre.tsx',
];

const INTERFACE_LOCAL =
  /interface\s+(MapaAdapterProps|MapaWebMapLibreProps|Parada)\b|type\s+StatusFilter\s*=/;

const lerVariante = (nome: string) =>
  readFileSync(join(__dirname, '..', nome), 'utf8');

describe('MapaAdapter: interface de props única', () => {
  it.each(VARIANTES)(
    '%s não declara a própria interface de props do mapa',
    (nome) => {
      expect(lerVariante(nome)).not.toMatch(INTERFACE_LOCAL);
    },
  );

  it.each(VARIANTES)(
    "%s importa MapaAdapterProps de '@/types/parada-map'",
    (nome) => {
      expect(lerVariante(nome)).toMatch(
        /import\s+type\s*\{[^}]*\bMapaAdapterProps\b[^}]*\}\s*from\s*'@\/types\/parada-map'/,
      );
    },
  );

  it('MapaAdapter.tsx repassa as props por spread ao MapaMobile', () => {
    expect(lerVariante('MapaAdapter.tsx')).toMatch(
      /<MapaMobile\s+\{\.\.\.props\}\s*\/>/,
    );
  });

  it('MapaAdapter.web.tsx repassa as props por spread ao MapaWebMapLibre', () => {
    expect(lerVariante('MapaAdapter.web.tsx')).toMatch(
      /<MapaWebMapLibre\s+\{\.\.\.props\}\s*\/>/,
    );
  });
});
