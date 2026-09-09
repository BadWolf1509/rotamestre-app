/**
 * Tests for route-status calculation functions
 *
 * Pure functions — no mocks needed
 */

import {
  getRouteStatus,
  getProgress,
  getCurrentStop,
  getNextStop,
  buildRouteData,
} from '../calculations';

import type { ParadaData, RouteData, RotaQueryRow } from '../types';

// Factory helpers
function makeRoute(overrides: Partial<RouteData> = {}): RouteData {
  return {
    id: 'route-1',
    status: 'pendente',
    unidade_nome: 'Unidade A',
    ...overrides,
  };
}

function makeParada(overrides: Partial<ParadaData> = {}): ParadaData {
  return {
    id: 'parada-1',
    endereco: 'Rua A, 100',
    ordem: 1,
    status: 'pendente',
    tipo: 'entrega',
    latitude: -23.5,
    longitude: -46.6,
    ...overrides,
  };
}

describe('getRouteStatus', () => {
  it('returns no-route when route is null', () => {
    expect(getRouteStatus(null, [])).toBe('no-route');
  });

  it('returns pending for pendente route', () => {
    const route = makeRoute({ status: 'pendente' });
    expect(getRouteStatus(route, [])).toBe('pending');
  });

  it('returns active when multiple stops are pending', () => {
    const route = makeRoute({ status: 'em_andamento' });
    const paradas = [
      makeParada({ id: 'p1', ordem: 1, status: 'pendente' }),
      makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
      makeParada({ id: 'p3', ordem: 3, status: 'pendente' }),
    ];
    expect(getRouteStatus(route, paradas)).toBe('active');
  });

  it('returns last-stop when only 1 stop is pending', () => {
    const route = makeRoute({ status: 'em_andamento' });
    const paradas = [
      makeParada({ id: 'p1', ordem: 1, status: 'concluida' }),
      makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
    ];
    expect(getRouteStatus(route, paradas)).toBe('last-stop');
  });

  it('returns last-stop when only 1 stop is em_andamento', () => {
    const route = makeRoute({ status: 'em_andamento' });
    const paradas = [
      makeParada({ id: 'p1', ordem: 1, status: 'concluida' }),
      makeParada({ id: 'p2', ordem: 2, status: 'em_andamento' }),
    ];
    expect(getRouteStatus(route, paradas)).toBe('last-stop');
  });

  it('returns ready-to-complete when all stops are done', () => {
    const route = makeRoute({ status: 'em_andamento' });
    const paradas = [
      makeParada({ id: 'p1', ordem: 1, status: 'concluida' }),
      makeParada({ id: 'p2', ordem: 2, status: 'concluida' }),
    ];
    expect(getRouteStatus(route, paradas)).toBe('ready-to-complete');
  });

  it('excludes checkpoints from pending count', () => {
    const route = makeRoute({ status: 'em_andamento' });
    const paradas = [
      makeParada({ id: 'cp1', ordem: 0, status: 'concluida', is_checkpoint: false }),
      makeParada({ id: 'p1', ordem: 1, status: 'concluida' }),
      makeParada({ id: 'p2', ordem: 2, status: 'concluida' }),
      makeParada({ id: 'cp2', ordem: 3, status: 'pendente', is_checkpoint: false }),
    ];
    // Only real stops matter — both real stops are concluida
    expect(getRouteStatus(route, paradas)).toBe('ready-to-complete');
  });

  it('returns completed for recently concluída route', () => {
    const route = makeRoute({
      status: 'concluida',
      concluida_em: new Date().toISOString(), // Just now
    });
    expect(getRouteStatus(route, [])).toBe('completed');
  });

  it('returns no-route for concluída route past 1h timeout', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const route = makeRoute({
      status: 'concluida',
      concluida_em: twoHoursAgo,
    });
    expect(getRouteStatus(route, [])).toBe('no-route');
  });

  it('returns completed when concluida_em is missing (no timeout check)', () => {
    const route = makeRoute({ status: 'concluida' });
    expect(getRouteStatus(route, [])).toBe('completed');
  });

  it('returns no-route for cancelada', () => {
    const route = makeRoute({ status: 'cancelada' });
    expect(getRouteStatus(route, [])).toBe('no-route');
  });

  it('returns no-route for nao_executada', () => {
    const route = makeRoute({ status: 'nao_executada' });
    expect(getRouteStatus(route, [])).toBe('no-route');
  });

  describe('custom now parameter (clock skew fix)', () => {
    const concluidaEm = '2026-03-01T10:00:00Z';
    const concluidaMs = new Date(concluidaEm).getTime();

    it('should use custom now param for celebration window', () => {
      const thirtyMinLater = concluidaMs + 30 * 60 * 1000;
      const route = makeRoute({ status: 'concluida', concluida_em: concluidaEm });
      expect(getRouteStatus(route, [], thirtyMinLater)).toBe('completed');
    });

    it('should expire celebration with custom now param after 1 hour', () => {
      const twoHoursLater = concluidaMs + 2 * 60 * 60 * 1000;
      const route = makeRoute({ status: 'concluida', concluida_em: concluidaEm });
      expect(getRouteStatus(route, [], twoHoursLater)).toBe('no-route');
    });

    it('should default to Date.now when no now param provided', () => {
      // Route completed just now — should still be in celebration window
      const route = makeRoute({
        status: 'concluida',
        concluida_em: new Date().toISOString(),
      });
      expect(getRouteStatus(route, [])).toBe('completed');
    });
  });
});

describe('getProgress', () => {
  it('returns zero progress for empty paradas', () => {
    expect(getProgress([])).toEqual({ completed: 0, total: 0, percentage: 0 });
  });

  it('calculates progress correctly', () => {
    const paradas = [
      makeParada({ id: 'p1', status: 'concluida' }),
      makeParada({ id: 'p2', status: 'concluida' }),
      makeParada({ id: 'p3', status: 'pendente' }),
    ];
    expect(getProgress(paradas)).toEqual({ completed: 2, total: 3, percentage: 67 });
  });

  it('excludes checkpoints from progress', () => {
    const paradas = [
      makeParada({ id: 'cp', status: 'concluida', is_checkpoint: false }),
      makeParada({ id: 'p1', status: 'concluida' }),
      makeParada({ id: 'p2', status: 'pendente' }),
    ];
    expect(getProgress(paradas)).toEqual({ completed: 1, total: 2, percentage: 50 });
  });

  it('returns 100% when all real stops are done', () => {
    const paradas = [
      makeParada({ id: 'p1', status: 'concluida' }),
      makeParada({ id: 'p2', status: 'concluida' }),
    ];
    expect(getProgress(paradas)).toEqual({ completed: 2, total: 2, percentage: 100 });
  });
});

describe('getCurrentStop', () => {
  it('returns null for empty paradas', () => {
    expect(getCurrentStop([])).toBeNull();
  });

  it('returns em_andamento stop over pendente', () => {
    const paradas = [
      makeParada({ id: 'p1', ordem: 1, status: 'em_andamento' }),
      makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
    ];
    expect(getCurrentStop(paradas)?.id).toBe('p1');
  });

  it('returns first pendente when no em_andamento', () => {
    const paradas = [
      makeParada({ id: 'p1', ordem: 1, status: 'concluida' }),
      makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
      makeParada({ id: 'p3', ordem: 3, status: 'pendente' }),
    ];
    expect(getCurrentStop(paradas)?.id).toBe('p2');
  });

  it('excludes checkpoints', () => {
    const paradas = [
      makeParada({ id: 'cp', ordem: 0, status: 'pendente', is_checkpoint: false }),
      makeParada({ id: 'p1', ordem: 1, status: 'pendente' }),
    ];
    expect(getCurrentStop(paradas)?.id).toBe('p1');
  });

  it('returns null when all stops done', () => {
    const paradas = [
      makeParada({ id: 'p1', ordem: 1, status: 'concluida' }),
      makeParada({ id: 'p2', ordem: 2, status: 'pulada' }),
    ];
    expect(getCurrentStop(paradas)).toBeNull();
  });

  it('respects ordem order regardless of array position', () => {
    const paradas = [
      makeParada({ id: 'p3', ordem: 3, status: 'pendente' }),
      makeParada({ id: 'p1', ordem: 1, status: 'pendente' }),
      makeParada({ id: 'p2', ordem: 2, status: 'concluida' }),
    ];
    expect(getCurrentStop(paradas)?.id).toBe('p1');
  });
});

describe('getNextStop', () => {
  it('returns null for empty paradas', () => {
    expect(getNextStop([])).toBeNull();
  });

  it('returns next pendente after current', () => {
    const paradas = [
      makeParada({ id: 'p1', ordem: 1, status: 'em_andamento' }),
      makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
      makeParada({ id: 'p3', ordem: 3, status: 'pendente' }),
    ];
    expect(getNextStop(paradas)?.id).toBe('p2');
  });

  it('returns null when no next pendente exists', () => {
    const paradas = [
      makeParada({ id: 'p1', ordem: 1, status: 'em_andamento' }),
      makeParada({ id: 'p2', ordem: 2, status: 'concluida' }),
    ];
    expect(getNextStop(paradas)).toBeNull();
  });

  it('returns null when current stop is last', () => {
    const paradas = [
      makeParada({ id: 'p1', ordem: 1, status: 'concluida' }),
      makeParada({ id: 'p2', ordem: 2, status: 'pendente' }),
    ];
    // Current = p2 (first pendente), no next pendente after it
    expect(getNextStop(paradas)).toBeNull();
  });

  it('skips non-pendente stops', () => {
    const paradas = [
      makeParada({ id: 'p1', ordem: 1, status: 'em_andamento' }),
      makeParada({ id: 'p2', ordem: 2, status: 'pulada' }),
      makeParada({ id: 'p3', ordem: 3, status: 'pendente' }),
    ];
    expect(getNextStop(paradas)?.id).toBe('p3');
  });
});

describe('buildRouteData', () => {
  it('builds from single-object unidades', () => {
    const row: RotaQueryRow = {
      id: 'r1',
      status: 'pendente',
      distancia_total: 15.5,
      tempo_total: 60,
      iniciada_em: '2026-02-08T08:00:00Z',
      concluida_em: null,
      created_at: '2026-02-07T12:00:00Z',
      data: '2026-02-08',
      unidades: { nome: 'WJX' },
    };

    const result = buildRouteData(row);

    expect(result.id).toBe('r1');
    expect(result.unidade_nome).toBe('WJX');
    expect(result.distancia_total).toBe(15.5);
    expect(result.concluida_em).toBeUndefined();
  });

  it('builds from array unidades', () => {
    const row: RotaQueryRow = {
      id: 'r2',
      status: 'concluida',
      distancia_total: null,
      tempo_total: null,
      iniciada_em: null,
      concluida_em: null,
      created_at: '2026-02-07T12:00:00Z',
      data: null,
      unidades: [{ nome: 'Unit Array' }],
    };

    const result = buildRouteData(row);

    expect(result.unidade_nome).toBe('Unit Array');
    expect(result.distancia_total).toBeUndefined();
    expect(result.data).toBeUndefined();
  });

  it('handles null unidades', () => {
    const row: RotaQueryRow = {
      id: 'r3',
      status: 'pendente',
      distancia_total: null,
      tempo_total: null,
      iniciada_em: null,
      concluida_em: null,
      created_at: '2026-02-07T12:00:00Z',
      data: null,
      unidades: null,
    };

    const result = buildRouteData(row);
    expect(result.unidade_nome).toBe('');
  });
});
