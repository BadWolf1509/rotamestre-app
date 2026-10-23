/**
 * Guarda: o mapa flutuante (PiP) saiu do app e não volta por acidente.
 *
 * O PiP duplicava o mini-mapa da própria Início: um 2º mapa MapLibre e uma
 * chamada OSRM por tick de GPS, com metade das funções desligadas desde o fim
 * do Turn-by-Turn e gestos com defeito. O mini-mapa (expandir + tocar para
 * abrir a aba Mapa) cobre o uso. Reintroduzir o componente ou o botão
 * "Abrir mapa flutuante" no MiniMap deve ser decisão explícita — apagando
 * esta guarda —, não efeito colateral de um revert ou merge.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const RAIZ = join(__dirname, '..', '..', '..', '..', '..');
const ESTE_ARQUIVO = relative(RAIZ, __filename).replace(/\\/g, '/');

function listarFontes(dir: string): string[] {
  const abs = join(RAIZ, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((nome) => {
    const caminho = join(abs, nome);
    const rel = relative(RAIZ, caminho).replace(/\\/g, '/');
    if (statSync(caminho).isDirectory()) return listarFontes(rel);
    return /\.(ts|tsx)$/.test(nome) ? [rel] : [];
  });
}

describe('sem mapa flutuante (PiP)', () => {
  const fontes = [...listarFontes('src'), ...listarFontes('app')].filter(
    (f) => f !== ESTE_ARQUIVO,
  );

  it('nenhum arquivo de src/ ou app/ referencia PictureInPictureMap', () => {
    const comPiP = fontes.filter((f) =>
      readFileSync(join(RAIZ, f), 'utf8').includes('PictureInPictureMap'),
    );
    expect(comPiP).toEqual([]);
  });

  it('não existem os hooks do PiP', () => {
    expect(existsSync(join(RAIZ, 'src/hooks/navigation/pip'))).toBe(false);
    expect(existsSync(join(RAIZ, 'src/hooks/usePiPPosition.ts'))).toBe(false);
  });

  it.each([
    'src/components/motorista/home/MiniMap.tsx',
    'src/components/motorista/home/MiniMap.web.tsx',
  ])('%s não tem a prop onOpenPiP nem o botão flutuante', (arquivo) => {
    const codigo = readFileSync(join(RAIZ, arquivo), 'utf8');
    expect(codigo).not.toMatch(/onOpenPiP/);
    expect(codigo).not.toMatch(/Abrir mapa flutuante/);
  });
});
