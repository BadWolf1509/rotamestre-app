/**
 * Guarda estática: "é partida/chegada da unidade" tem um só predicado.
 *
 * No banco a semântica de `paradas.is_checkpoint` é invertida: `false` marca
 * os pontos da unidade e `true`/ausente é parada de entrega. Cinco lugares dos
 * mapas refaziam essa comparação à mão (qualquer deles errado inverte pino e
 * contagem sem erro algum). Agora quem decide é `ehPontoDaUnidade`, em
 * `pontosDaUnidade.ts`. O escopo é o dos mapas; o resto do app ainda compara
 * direto e entra aqui quando for migrado.
 */
import fs from 'fs';
import path from 'path';

const RAIZ = path.resolve(__dirname, '../../../..');

const ARQUIVOS = [
  'src/components/MapaWebMapLibre.tsx',
  'src/components/MapaMobile.tsx',
  'src/components/motorista/home/MiniMap.tsx',
  'src/components/motorista/home/MiniMap.web.tsx',
  'src/components/motorista/NavigationMode.tsx',
  'src/components/motorista/NavigationMode.web.tsx',
  'src/components/map/hooks/useParadaFiltering.ts',
  'src/hooks/navigation/useNavigationModeLogic.ts',
];

/** `is_checkpoint === false`, `!== false`, `== false`, `!= false`. */
const COMPARACAO_A_MAO = /is_checkpoint\s*[!=]==?\s*false/;

describe('ponto da unidade: predicado único nos mapas', () => {
  it.each(ARQUIVOS)('%s não compara is_checkpoint com false', (arquivo) => {
    const texto = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
    expect(texto).not.toMatch(COMPARACAO_A_MAO);
  });

  it('o predicado vive em pontosDaUnidade.ts', () => {
    const texto = fs.readFileSync(
      path.join(RAIZ, 'src/components/map/pontosDaUnidade.ts'),
      'utf8',
    );
    expect(texto).toMatch(COMPARACAO_A_MAO);
  });
});
