/**
 * Guarda estática: componentes e hooks só têm export nomeado.
 *
 * O `export default` sem importador dobrava a superfície (o knip contava como
 * "Duplicate exports") e escondia quem de fato usa o módulo. Esta lista é o
 * que sobrou de propósito: cada entrada tem importador do default.
 */
import fs from 'fs';
import path from 'path';

const RAIZ = path.resolve(__dirname, '../../..');
const PASTAS = ['src/components', 'src/hooks'];

const PERMITIDOS: Record<string, string> = {
  'src/components/CameraUpload.tsx':
    'barrel @/design-system: export { default as CameraUpload }',
  'src/components/MapaWebMapLibre.tsx': 'MapaAdapter.web importa o default',
  'src/components/Slider.tsx':
    'variante de plataforma; NavigationSettings importa o default',
  'src/components/Slider.web.tsx': 'idem',
};

const TEM_DEFAULT =
  /export\s+default\b|export\s*\{[^}]*\bdefault\b(?!\s+as)[^}]*\}/s;

function listar(dir: string): string[] {
  const saida: string[] = [];
  for (const entrada of fs.readdirSync(path.join(RAIZ, dir), {
    withFileTypes: true,
  })) {
    const rel = `${dir}/${entrada.name}`;
    if (entrada.isDirectory()) {
      if (entrada.name === '__tests__' || entrada.name === '__mocks__')
        continue;
      saida.push(...listar(rel));
    } else if (
      /\.(ts|tsx)$/.test(entrada.name) &&
      !/\.d\.ts$/.test(entrada.name)
    ) {
      saida.push(rel);
    }
  }
  return saida;
}

const arquivos = PASTAS.flatMap(listar);
const comDefault = (rel: string) =>
  TEM_DEFAULT.test(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));

describe('sem export default em componentes e hooks', () => {
  it('lê arquivos de verdade (a varredura não é vazia)', () => {
    expect(arquivos.length).toBeGreaterThan(100);
  });

  it('componentes e hooks não exportam default fora da lista', () => {
    const ofensores = arquivos.filter(
      (rel) => !(rel in PERMITIDOS) && comDefault(rel),
    );
    expect(ofensores).toEqual([]);
  });

  it('a lista não guarda arquivo que já não tem default', () => {
    const obsoletos = Object.keys(PERMITIDOS).filter((rel) => !comDefault(rel));
    expect(obsoletos).toEqual([]);
  });
});
