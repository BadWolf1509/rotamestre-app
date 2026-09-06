/**
 * Guarda contra a divergência que causou o bug dos tiles marcados.
 *
 * Em 31/08/2026 o mapa do motorista no Android renderizava tiles com
 * "API KEY REQUIRED" atravessado. A causa não foi o mapa nativo estar
 * quebrado: era o **web usar OpenFreeMap e o nativo usar Carto**, assimetria
 * que ninguém tinha escrito em lugar nenhum. Quando a Carto passou a exigir
 * chave, só um dos dois lados quebrou — e quebrou em silêncio, porque o
 * endpoint respondia 200 com a marca d'água em vez de erro.
 *
 * NENHUM CHECK PEGAVA. O e2e de mapa roda só a build web e afirma que o mapa
 * *monta*, não o que ele mostra; e nada em CI executa o mapa nativo. Este
 * arquivo fecha a parte que dá para fechar de forma barata e determinística: a
 * fonte de tiles é **uma só**, e ninguém pode reintroduzir outra num dos lados
 * sem quebrar o CI.
 *
 * O QUE ELE NÃO PEGA, e vale saber: tile com marca d'água chega como 200 com
 * PNG válido. Nenhuma asserção automática distingue isso de um tile bom sem
 * análise de imagem. Se a fonte atual degradar do mesmo jeito, este teste
 * continua verde — ele protege contra divergência, não contra o provedor mudar
 * de política.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { OPENFREEMAP_STYLE_URL } from '../maplibre';

const RAIZ = join(__dirname, '..', '..', '..');

/** Onde o literal de endpoint PODE aparecer. Fonte única. */
const ARQUIVO_FONTE = 'src/lib/maplibre.ts';

/** Todo componente que desenha mapa, nos dois lados da plataforma. */
const COMPONENTES_NATIVOS = [
  'src/components/MapaMobile.tsx',
  'src/components/motorista/home/MiniMap.tsx',
  'src/components/motorista/NavigationMode.tsx',
  'src/components/motorista/PictureInPictureMap.tsx',
  'src/components/motorista/TurnByTurnNavigation.tsx',
];

const COMPONENTES_WEB = [
  'src/components/MapaWebMapLibre.tsx',
  'src/components/motorista/home/MiniMap.web.tsx',
];

/**
 * Hosts de tile/estilo conhecidos. A lista existe para o teste falhar quando
 * alguém apontar um componente para outro provedor — inclusive um que exija
 * chave, que é o caminho de volta ao bug.
 */
const HOSTS_DE_TILE =
  /(tiles\.openfreemap\.org|basemaps\.cartocdn\.com|api\.mapbox\.com|api\.maptiler\.com|tile\.openstreetmap\.org|tiles\.stadiamaps\.com)/;

function ler(caminho: string) {
  return readFileSync(join(RAIZ, caminho), 'utf8');
}

describe('fonte de tiles é única entre web e nativo', () => {
  it('a constante aponta para OpenFreeMap', () => {
    expect(OPENFREEMAP_STYLE_URL).toBe(
      'https://tiles.openfreemap.org/styles/liberty',
    );
  });

  it.each(COMPONENTES_NATIVOS)(
    '%s consome a constante, sem endpoint embutido',
    (caminho) => {
      const fonte = ler(caminho);
      expect(fonte).toContain('OPENFREEMAP_STYLE_URL');
      expect(fonte).not.toMatch(HOSTS_DE_TILE);
    },
  );

  it.each(COMPONENTES_WEB)(
    '%s passa pelo helper do web, sem endpoint embutido',
    (caminho) => {
      const fonte = ler(caminho);
      expect(fonte).toContain('getOpenFreeMapStyle');
      // O host não pode aparecer nem em comentário: comentário desatualizado
      // apontando para outro provedor é como a assimetria se disfarça.
      expect(fonte).not.toMatch(HOSTS_DE_TILE);
    },
  );

  it('o helper do web importa a MESMA constante do nativo, não a sua própria', () => {
    // Este é o coração da guarda. Enquanto `openFreeMapStyle.ts` importar de
    // `@/lib/maplibre`, web e nativo não têm como divergir — que é exatamente o
    // que aconteceu quando cada lado tinha o seu próprio endereço.
    const helper = ler('src/lib/openFreeMapStyle.ts');
    expect(helper).toMatch(
      /import\s*\{[^}]*OPENFREEMAP_STYLE_URL[^}]*\}\s*from\s*'@\/lib\/maplibre'/,
    );
    expect(helper).not.toMatch(HOSTS_DE_TILE);
  });

  it('só o arquivo-fonte contém literal de endpoint', () => {
    expect(ler(ARQUIVO_FONTE)).toMatch(HOSTS_DE_TILE);
  });
});

/**
 * Atribuição é obrigação de licença, não enfeite. Os tiles vêm de
 * OpenFreeMap/OpenMapTiles sobre dados do OpenStreetMap, e a ODbL exige o
 * crédito visível onde o dado é mostrado.
 *
 * Em 05/09/2026 o mapa **web** exibia "MapLibre | OpenFreeMap © OpenMapTiles
 * Data from OpenStreetMap" e os **seis** componentes nativos passavam
 * `attribution={false}`. A assimetria é a mesma família do bug dos tiles: um
 * lado certo, o outro não, e ninguém tinha escrito isso em lugar nenhum.
 */
describe('mapa nativo credita a fonte dos tiles', () => {
  it('nenhum componente nativo desliga a atribuição', () => {
    const infratores = COMPONENTES_NATIVOS.filter((caminho) =>
      /attribution=\{false\}/.test(ler(caminho)),
    );

    expect(infratores).toEqual([]);
  });
});
