import { STATUS_PARADA } from '@/types/rota';

import {
  ROUTE_STATUS_CONFIG,
  STOP_STATUS_CONFIG,
  coresPorStatusDaRota,
  getStatusColorKey,
  rotuloDoStatus,
} from '../statusConfig';

describe('rotuloDoStatus', () => {
  it.each([
    ['nao_executada', 'Não executada'],
    ['em_andamento', 'Em andamento'],
    ['pendente', 'Pendente'],
    ['concluida', 'Concluída'],
    ['cancelada', 'Cancelada'],
    ['pulada', 'Pulada'],
    ['CONCLUIDA', 'Concluída'],
    ['status_novo', 'status novo'],
  ])('%s → %s', (s, r) => expect(rotuloDoStatus(s)).toBe(r));
  it.each([undefined, null, ''])('%p → "-"', (s) =>
    expect(rotuloDoStatus(s)).toBe('-'),
  );
});

it('rota: a config cobre os 5 valores do CHECK rotas_status_check', () =>
  expect(Object.keys(ROUTE_STATUS_CONFIG).sort()).toEqual([
    'cancelada',
    'concluida',
    'em_andamento',
    'nao_executada',
    'pendente',
  ]));

it('parada: a config cobre os 4 status, inclusive em_andamento', () =>
  expect(Object.keys(STOP_STATUS_CONFIG).sort()).toEqual([
    'concluida',
    'em_andamento',
    'pendente',
    'pulada',
  ]));

it('coresPorStatusDaRota: nao_executada é error e em_andamento é info', () => {
  const cores = coresPorStatusDaRota((k) => `cor-${k}`);
  expect(cores).toEqual({
    pendente: 'cor-warning',
    em_andamento: 'cor-info',
    concluida: 'cor-success',
    cancelada: 'cor-error',
    nao_executada: 'cor-error',
  });
});

it('getStatusColorKey de em_andamento segue info (marcadores do mapa intactos)', () =>
  expect(getStatusColorKey('em_andamento')).toBe('info'));

it('STOP_STATUS_CONFIG tem exatamente STATUS_PARADA', () =>
  expect(Object.keys(STOP_STATUS_CONFIG).sort()).toEqual(
    [...STATUS_PARADA].sort(),
  ));
