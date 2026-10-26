/**
 * `decodePolyline` com o `@mapbox/polyline` REAL.
 *
 * O `jest.setup.js` mocka o pacote globalmente (`decode` devolve sempre
 * `[[0,0],[1,1]]`), então o teste de `osrm.test.ts` só prova que o resultado
 * tem o formato certo, não que decodifica. A rota inteira do app (mapa,
 * navegação, `rotas.polyline`) depende da precisão 5 e da ordem [lat, lng]:
 * trocar a precisão para 6 desloca a rota ~10x no mapa sem nenhum teste falhar.
 */
jest.unmock('@mapbox/polyline');

import { decodePolyline } from '../osrm';

// Exemplo canônico da documentação do formato (precisão 5).
const CODIFICADA = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

describe('decodePolyline (decodificador real)', () => {
  it('decodifica com precisão 5, na ordem latitude/longitude', () => {
    const pontos = decodePolyline(CODIFICADA);

    expect(pontos).toHaveLength(3);
    expect(pontos[0].latitude).toBeCloseTo(38.5, 5);
    expect(pontos[0].longitude).toBeCloseTo(-120.2, 5);
    expect(pontos[1].latitude).toBeCloseTo(40.7, 5);
    expect(pontos[1].longitude).toBeCloseTo(-120.95, 5);
    expect(pontos[2].latitude).toBeCloseTo(43.252, 5);
    expect(pontos[2].longitude).toBeCloseTo(-126.453, 5);
  });

  it('entrada vazia devolve lista vazia', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});
