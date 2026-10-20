import type { ParadaData } from '@/context/route-status/types';

import {
  agruparPorLocal,
  chegouPelaParadaAnterior,
  paradasDaVisita,
} from '../visitaNoLocal';

const LAT = -7.115;
const LON = -34.861;
const M25 = 0.000225; // ~25 m de latitude
const M40 = 0.00036; // ~40 m de latitude
const LONGE = 0.01; // ~1,1 km

function parada(
  ordem: number,
  extra: Partial<ParadaData> & { dLat?: number } = {},
): ParadaData {
  const { dLat = 0, ...resto } = extra;
  return {
    id: `p${ordem}`,
    endereco: `Rua ${ordem}`,
    ordem,
    status: 'pendente',
    tipo: 'entrega',
    latitude: LAT + dLat,
    longitude: LON,
    ...resto,
  };
}

const ordens = (ps: Array<{ ordem: number }>) => ps.map((p) => p.ordem);

describe('paradasDaVisita', () => {
  it('junta entrega e retirada no mesmo ponto', () => {
    const ps = [parada(3), parada(4, { tipo: 'retirada' })];
    expect(ordens(paradasDaVisita(ps, ps[0]))).toEqual([3, 4]);
  });

  it('não junta retirada a 40 m', () => {
    const ps = [parada(3), parada(4, { dLat: M40 })];
    expect(ordens(paradasDaVisita(ps, ps[0]))).toEqual([3]);
  });

  it('junta três serviços no mesmo ponto', () => {
    const ps = [parada(3), parada(4), parada(5)];
    expect(ordens(paradasDaVisita(ps, ps[0]))).toEqual([3, 4, 5]);
  });

  it('para quando o ponto repete sem ser consecutivo', () => {
    const ps = [parada(3), parada(4, { dLat: LONGE }), parada(5)];
    expect(ordens(paradasDaVisita(ps, ps[0]))).toEqual([3]);
  });

  it('para na parada já concluída', () => {
    const ps = [parada(3), parada(4, { status: 'concluida' }), parada(5)];
    expect(ordens(paradasDaVisita(ps, ps[0]))).toEqual([3]);
  });

  it('inclui parada em andamento', () => {
    const ps = [parada(3), parada(4, { status: 'em_andamento' })];
    expect(ordens(paradasDaVisita(ps, ps[0]))).toEqual([3, 4]);
  });

  it('ignora checkpoints e respeita a ordem mesmo com lista embaralhada', () => {
    const ps = [
      parada(5),
      parada(4, { is_checkpoint: false }),
      parada(3),
      parada(4),
    ];
    expect(ordens(paradasDaVisita(ps, parada(3)))).toEqual([3, 4, 5]);
  });
});

describe('chegouPelaParadaAnterior', () => {
  it('true quando a anterior concluída é no mesmo ponto', () => {
    const ps = [parada(3, { status: 'concluida' }), parada(4)];
    expect(chegouPelaParadaAnterior(ps, ps[1])).toBe(true);
  });

  it('false quando a anterior foi pulada (pulo pode ser remoto)', () => {
    const ps = [parada(3, { status: 'pulada' }), parada(4)];
    expect(chegouPelaParadaAnterior(ps, ps[1])).toBe(false);
  });

  it('false quando a anterior está pendente', () => {
    const ps = [parada(3), parada(4)];
    expect(chegouPelaParadaAnterior(ps, ps[1])).toBe(false);
  });

  it('false quando a anterior está a 40 m', () => {
    const ps = [parada(3, { status: 'concluida', dLat: M40 }), parada(4)];
    expect(chegouPelaParadaAnterior(ps, ps[1])).toBe(false);
  });

  it('false na primeira parada', () => {
    const ps = [parada(3)];
    expect(chegouPelaParadaAnterior(ps, ps[0])).toBe(false);
  });

  it('checkpoint de partida não conta como anterior', () => {
    const ps = [
      parada(0, { status: 'concluida', is_checkpoint: false }),
      parada(1),
    ];
    expect(chegouPelaParadaAnterior(ps, ps[1])).toBe(false);
  });
});

describe('agruparPorLocal', () => {
  const ids = (grupos: Array<Array<{ id: string }>>) =>
    grupos.map((g) => g.map((p) => p.id));

  it('agrupa as do mesmo ponto e separa a distante', () => {
    const ps = [parada(3), parada(4), parada(5, { dLat: LONGE })];
    expect(ids(agruparPorLocal(ps))).toEqual([['p3', 'p4'], ['p5']]);
  });

  it('agrupa paradas não consecutivas do mesmo ponto', () => {
    const ps = [parada(3), parada(5, { dLat: LONGE }), parada(7)];
    expect(ids(agruparPorLocal(ps))).toEqual([['p3', 'p7'], ['p5']]);
  });

  it('coordenada nula vira grupo próprio', () => {
    const ps = [
      { id: 'a', ordem: 1, latitude: LAT, longitude: LON },
      { id: 'b', ordem: 2, latitude: null, longitude: LON },
      { id: 'c', ordem: 3, latitude: LAT, longitude: LON },
    ];
    expect(ids(agruparPorLocal(ps))).toEqual([['a', 'c'], ['b']]);
  });

  it('0,0 vira grupo próprio, mesmo duas vezes', () => {
    const ps = [
      { id: 'a', ordem: 1, latitude: 0, longitude: 0 },
      { id: 'b', ordem: 2, latitude: 0, longitude: 0 },
    ];
    expect(ids(agruparPorLocal(ps))).toEqual([['a'], ['b']]);
  });

  it('mede da âncora, não do vizinho', () => {
    const ps = [
      parada(1),
      parada(2, { dLat: M25 }),
      parada(3, { dLat: 2 * M25 }),
    ];
    expect(ids(agruparPorLocal(ps))).toEqual([['p1', 'p2'], ['p3']]);
  });

  it('ordena grupos e membros por ordem', () => {
    const ps = [parada(7), parada(5, { dLat: LONGE }), parada(3)];
    expect(ids(agruparPorLocal(ps))).toEqual([['p3', 'p7'], ['p5']]);
  });
});
