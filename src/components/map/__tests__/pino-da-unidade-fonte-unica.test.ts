/**
 * Guarda estática: partida e chegada da rota saem de uma fonte só.
 *
 * Até 08/11/2026 cada um dos seis mapas desenhava a partida e a chegada a seu
 * modo — cinco desenhos para o mesmo ponto, a bandeira querendo dizer partida
 * num e chegada no outro, "I" verde e "F" vermelho no web — e, como as duas
 * saem do endereço da sede, um pino cobria o outro. Agora quem decide é
 * `pontosDaUnidade` e quem desenha é `PinoDaUnidade` (nativo) /
 * `criarElementoDoPinoDaUnidade` (web). Mapa novo que mostre a rota entra
 * nesta lista.
 */
import fs from 'fs';
import path from 'path';

const RAIZ = path.resolve(__dirname, '../../../..');

const MAPAS = [
  'src/components/MapaWebMapLibre.tsx',
  'src/components/MapaMobile.tsx',
  'src/components/motorista/home/MiniMap.tsx',
  'src/components/motorista/home/MiniMap.web.tsx',
  'src/components/motorista/NavigationMode.tsx',
  'src/components/motorista/NavigationMode.web.tsx',
];

/** Desenhos antigos de partida/chegada, cada um com o mapa que o tinha. */
const FORMAS_ANTIGAS: Array<[RegExp, string]> = [
  [/isPartida \? 'I' : 'F'/, "rótulo 'I'/'F' (mapa web)"],
  [/ordem === 0 \? 'location'/, "'location'/'flag' por ordem (mini-mapa)"],
  [/name="flag"/, 'bandeira inline (navegação nativa)'],
  [/name="home"/, 'casa inline (navegação nativa)'],
  [/Ponto de Partida|Ponto de Chegada/, 'título com emoji (popup web)'],
  [/M14\.4 6L14 4H5v17h2v-7h5\.6l\.4 2h7V6z/, 'SVG de bandeira inline'],
  [/M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z/, 'SVG de casa inline'],
];

const IMPORTA_A_FONTE = /from '@\/components\/map\/pontosDaUnidade'/;

describe('pino da unidade: fonte única nos seis mapas', () => {
  it.each(MAPAS)('%s usa pontosDaUnidade', (arquivo) => {
    const texto = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
    expect(texto).toMatch(IMPORTA_A_FONTE);
  });

  it.each(MAPAS)(
    '%s não desenha partida/chegada por conta própria',
    (arquivo) => {
      const texto = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
      const achadas = FORMAS_ANTIGAS.filter(([forma]) => forma.test(texto)).map(
        ([, nome]) => nome,
      );
      expect(achadas).toEqual([]);
    },
  );
});
