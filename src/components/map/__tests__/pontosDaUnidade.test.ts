/**
 * Partida e chegada da rota: um pino de sede quando coincidem.
 *
 * As 362 rotas dos últimos 90 dias (medido em 08/11/2026) saem e voltam ao
 * mesmo ponto — o único campo "Endereço da sede". Os dois pinos caíam um
 * sobre o outro e o da chegada escondia o da partida.
 */
import { distanciaMetros } from '@/lib/geo/distancia';

import {
  ehPontoDaUnidade,
  ESPEC_DO_PONTO,
  pontoQueContem,
  pontosDaUnidade,
  pontosDaUnidadeForaDoDestino,
  rotuloAcessivelDoPonto,
} from '../pontosDaUnidade';

const LAT = -7.1153;
const LNG = -34.8641;

function ponto(
  id: string,
  ordem: number,
  latitude: number | null = LAT,
  longitude: number | null = LNG,
) {
  return {
    id,
    ordem,
    latitude,
    longitude,
    endereco: 'Av. Epitácio Pessoa, 1000',
  };
}

describe('pontosDaUnidade', () => {
  it('sede quando partida e chegada coincidem', () => {
    const partida = ponto('p0', 0);
    const chegada = ponto('c9', 9);

    expect(pontosDaUnidade([partida, chegada])).toEqual([
      { tipo: 'sede', ponto: partida, membros: [partida, chegada] },
    ]);
  });

  it('a 29 m é sede, a 31 m são dois pinos', () => {
    const partida = ponto('p0', 0);
    const a29 = ponto('c9', 9, LAT + 0.00026);
    const a31 = ponto('c9', 9, LAT + 0.00028);
    // Confere que os deslocamentos medem o que o nome diz.
    const origem = { latitude: LAT, longitude: LNG };
    expect(
      distanciaMetros(origem, { latitude: LAT + 0.00026, longitude: LNG }),
    ).toBeLessThan(30);
    expect(
      distanciaMetros(origem, { latitude: LAT + 0.00028, longitude: LNG }),
    ).toBeGreaterThan(30);

    expect(pontosDaUnidade([partida, a29]).map((p) => p.tipo)).toEqual([
      'sede',
    ]);
    expect(pontosDaUnidade([partida, a31]).map((p) => p.tipo)).toEqual([
      'partida',
      'chegada',
    ]);
  });

  it('dois pontos distantes: partida e chegada, cada um com o seu', () => {
    const partida = ponto('p0', 0);
    const chegada = ponto('c9', 9, LAT + 0.01);

    expect(pontosDaUnidade([partida, chegada])).toEqual([
      { tipo: 'partida', ponto: partida, membros: [partida] },
      { tipo: 'chegada', ponto: chegada, membros: [chegada] },
    ]);
  });

  it('a ordem decide quem é partida, não a posição no array', () => {
    const partida = ponto('p0', 0);
    const chegada = ponto('c9', 9, LAT + 0.01);

    expect(
      pontosDaUnidade([chegada, partida]).map((p) => [p.tipo, p.ponto.id]),
    ).toEqual([
      ['partida', 'p0'],
      ['chegada', 'c9'],
    ]);
  });

  it('só a partida: um pino de partida', () => {
    const partida = ponto('p0', 0);
    expect(pontosDaUnidade([partida])).toEqual([
      { tipo: 'partida', ponto: partida, membros: [partida] },
    ]);
  });

  it('sem pontos: nenhum pino', () => {
    expect(pontosDaUnidade([])).toEqual([]);
  });

  it('ponto sem coordenada não vira pino fantasma', () => {
    const partida = ponto('p0', 0);
    const chegadaSemCoord = ponto('c9', 9, null, null);

    expect(pontosDaUnidade([partida, chegadaSemCoord])).toEqual([
      { tipo: 'partida', ponto: partida, membros: [partida] },
    ]);
  });

  it('pontoQueContem acha a sede pelo id da chegada', () => {
    const partida = ponto('p0', 0);
    const chegada = ponto('c9', 9);
    const pontos = pontosDaUnidade([partida, chegada]);

    expect(pontoQueContem(pontos, 'c9')?.tipo).toBe('sede');
    expect(pontoQueContem(pontos, 'p0')?.tipo).toBe('sede');
    expect(pontoQueContem(pontos, 'outra')).toBeUndefined();
  });

  it('textos da sede e rótulo acessível', () => {
    expect(ESPEC_DO_PONTO.sede.titulo).toBe('Sede da unidade');
    expect(ESPEC_DO_PONTO.sede.subtitulo).toBe('Partida e chegada da rota');
    expect(ESPEC_DO_PONTO.sede.ionicon).toBe('home');
    expect(ESPEC_DO_PONTO.partida.ionicon).toBe('flag');
    expect(ESPEC_DO_PONTO.chegada.ionicon).toBe('location');

    const [sede] = pontosDaUnidade([ponto('p0', 0), ponto('c9', 9)]);
    expect(rotuloAcessivelDoPonto(sede)).toBe(
      'Sede da unidade, Av. Epitácio Pessoa, 1000',
    );
  });
});

describe('pontosDaUnidadeForaDoDestino (navegação)', () => {
  const partida = ponto('p0', 0);
  const chegada = ponto('c9', 9);

  it('destino comum: a sede aparece', () => {
    expect(
      pontosDaUnidadeForaDoDestino(partida, chegada, 'p1').map((p) => p.tipo),
    ).toEqual(['sede']);
  });

  // Voltando à sede, ela já é o destino desenhado. Tirar só a chegada
  // deixaria a partida no mesmo ponto — um 2º alvo sobre o destino.
  it('destino = chegada na sede: nenhum pino', () => {
    expect(pontosDaUnidadeForaDoDestino(partida, chegada, 'c9')).toEqual([]);
  });

  it('destino = chegada distante: fica só a partida', () => {
    const longe = ponto('c9', 9, LAT + 0.01);
    expect(
      pontosDaUnidadeForaDoDestino(partida, longe, 'c9').map((p) => p.tipo),
    ).toEqual(['partida']);
  });

  it('sem pontos de unidade: nenhum pino', () => {
    expect(pontosDaUnidadeForaDoDestino(null, undefined, 'p1')).toEqual([]);
  });
});

// A semântica é INVERTIDA no banco: `is_checkpoint = false` marca partida e
// chegada da unidade; `true`/ausente é parada de entrega. Esta tabela fixa o
// que o código faz hoje (`!== false` = parada real) — mudar aqui muda os seis
// mapas ao mesmo tempo.
describe('ehPontoDaUnidade', () => {
  it.each([
    [false, true],
    [true, false],
    [undefined, false],
    [null, false],
  ])('is_checkpoint %p → ponto da unidade: %p', (is_checkpoint, esperado) => {
    expect(ehPontoDaUnidade({ is_checkpoint })).toBe(esperado);
  });

  it('objeto sem o campo é parada real', () => {
    expect(ehPontoDaUnidade({})).toBe(false);
  });
});
