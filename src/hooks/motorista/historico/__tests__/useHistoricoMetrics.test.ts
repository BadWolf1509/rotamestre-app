import { renderHook } from '@testing-library/react-native';

import { useHistoricoMetrics } from '../useHistoricoMetrics';

import type { RotaHistorico } from '../types';

function makeRota(overrides: Partial<RotaHistorico> = {}): RotaHistorico {
  return {
    id: '1',
    data: '2026-01-15',
    status: 'concluida',
    unidades: { nome: 'Unidade A' },
    ...overrides,
  };
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('useHistoricoMetrics', () => {
  describe('empty input', () => {
    it('returns zero metrics for empty array', () => {
      const { result } = renderHook(() => useHistoricoMetrics([]));
      expect(result.current).toEqual({
        rotasTotais: 0,
        rotasConcluidas: 0,
        rotasMes: 0,
        paradasTotais: 0,
        paradasConcluidas: 0,
        distanciaTotal: 0,
        tempoMedioMinutos: 0,
        taxaSucesso: 0,
      });
    });
  });

  describe('rotasTotais', () => {
    it('counts total routes', () => {
      const rotas = [makeRota({ id: '1' }), makeRota({ id: '2' }), makeRota({ id: '3' })];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.rotasTotais).toBe(3);
    });
  });

  describe('rotasConcluidas', () => {
    it('counts only routes with status concluida', () => {
      const rotas = [
        makeRota({ id: '1', status: 'concluida' }),
        makeRota({ id: '2', status: 'pendente' }),
        makeRota({ id: '3', status: 'concluida' }),
        makeRota({ id: '4', status: 'cancelada' }),
      ];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.rotasConcluidas).toBe(2);
    });

    it('returns 0 when none completed', () => {
      const rotas = [makeRota({ status: 'pendente' }), makeRota({ status: 'em_andamento' })];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.rotasConcluidas).toBe(0);
    });
  });

  describe('rotasMes', () => {
    it('counts routes from current month', () => {
      const rotas = [
        makeRota({ id: '1', data: todayISO() }),
        makeRota({ id: '2', data: todayISO() }),
        makeRota({ id: '3', data: '2024-01-01' }),
      ];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.rotasMes).toBe(2);
    });

    it('returns 0 when no routes in current month', () => {
      const rotas = [makeRota({ data: '2024-01-01' })];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.rotasMes).toBe(0);
    });
  });

  describe('paradas', () => {
    it('sums paradas_count and paradas_concluidas', () => {
      const rotas = [
        makeRota({ id: '1', paradas_count: 5, paradas_concluidas: 3 }),
        makeRota({ id: '2', paradas_count: 3, paradas_concluidas: 3 }),
      ];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.paradasTotais).toBe(8);
      expect(result.current.paradasConcluidas).toBe(6);
    });

    it('treats undefined paradas as 0', () => {
      const rotas = [makeRota({ paradas_count: undefined, paradas_concluidas: undefined })];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.paradasTotais).toBe(0);
      expect(result.current.paradasConcluidas).toBe(0);
    });
  });

  describe('distanciaTotal', () => {
    it('sums distances and rounds to 1 decimal', () => {
      const rotas = [
        makeRota({ id: '1', distancia_total: 12.34 }),
        makeRota({ id: '2', distancia_total: 5.67 }),
      ];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.distanciaTotal).toBe(18);
    });

    it('treats undefined distance as 0', () => {
      const rotas = [makeRota({ distancia_total: undefined })];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.distanciaTotal).toBe(0);
    });

    it('rounds correctly (e.g. 1.15 + 2.35 = 3.5)', () => {
      const rotas = [
        makeRota({ id: '1', distancia_total: 1.15 }),
        makeRota({ id: '2', distancia_total: 2.35 }),
      ];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.distanciaTotal).toBe(3.5);
    });
  });

  describe('tempoMedioMinutos', () => {
    it('calculates average time for routes with timestamps', () => {
      const rotas = [
        makeRota({
          id: '1',
          iniciada_em: '2026-01-15T08:00:00Z',
          concluida_em: '2026-01-15T10:00:00Z', // 120 min
        }),
        makeRota({
          id: '2',
          iniciada_em: '2026-01-15T08:00:00Z',
          concluida_em: '2026-01-15T09:00:00Z', // 60 min
        }),
      ];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.tempoMedioMinutos).toBe(90); // (120+60)/2
    });

    it('excludes routes without timestamps', () => {
      const rotas = [
        makeRota({ id: '1', iniciada_em: '2026-01-15T08:00:00Z', concluida_em: '2026-01-15T10:00:00Z' }),
        makeRota({ id: '2' }), // no timestamps
      ];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.tempoMedioMinutos).toBe(120);
    });

    it('excludes routes with duration >= 1440 min (24h)', () => {
      const rotas = [
        makeRota({
          id: '1',
          iniciada_em: '2026-01-15T08:00:00Z',
          concluida_em: '2026-01-17T08:00:00Z', // 48h → excluded
        }),
        makeRota({
          id: '2',
          iniciada_em: '2026-01-15T08:00:00Z',
          concluida_em: '2026-01-15T10:00:00Z', // 120 min
        }),
      ];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.tempoMedioMinutos).toBe(120);
    });

    it('excludes routes with negative duration', () => {
      const rotas = [
        makeRota({
          id: '1',
          iniciada_em: '2026-01-15T10:00:00Z',
          concluida_em: '2026-01-15T08:00:00Z', // negative
        }),
        makeRota({
          id: '2',
          iniciada_em: '2026-01-15T08:00:00Z',
          concluida_em: '2026-01-15T09:00:00Z', // 60 min
        }),
      ];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.tempoMedioMinutos).toBe(60);
    });

    it('returns 0 when no routes have valid time data', () => {
      const rotas = [makeRota({ id: '1' }), makeRota({ id: '2' })];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.tempoMedioMinutos).toBe(0);
    });

    it('rounds average to nearest integer', () => {
      const rotas = [
        makeRota({
          id: '1',
          iniciada_em: '2026-01-15T08:00:00Z',
          concluida_em: '2026-01-15T08:50:00Z', // 50 min
        }),
        makeRota({
          id: '2',
          iniciada_em: '2026-01-15T08:00:00Z',
          concluida_em: '2026-01-15T09:15:00Z', // 75 min
        }),
        makeRota({
          id: '3',
          iniciada_em: '2026-01-15T08:00:00Z',
          concluida_em: '2026-01-15T09:40:00Z', // 100 min
        }),
      ];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.tempoMedioMinutos).toBe(75); // (50+75+100)/3 = 75
    });
  });

  describe('taxaSucesso', () => {
    it('calculates success rate as percentage', () => {
      const rotas = [
        makeRota({ paradas_count: 10, paradas_concluidas: 8 }),
      ];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.taxaSucesso).toBe(80);
    });

    it('returns 100 when all stops completed', () => {
      const rotas = [
        makeRota({ paradas_count: 5, paradas_concluidas: 5 }),
      ];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.taxaSucesso).toBe(100);
    });

    it('returns 0 when no stops completed', () => {
      const rotas = [
        makeRota({ paradas_count: 5, paradas_concluidas: 0 }),
      ];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.taxaSucesso).toBe(0);
    });

    it('returns 0 when no stops at all', () => {
      const rotas = [makeRota({ paradas_count: 0, paradas_concluidas: 0 })];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.taxaSucesso).toBe(0);
    });

    it('rounds to nearest integer', () => {
      const rotas = [
        makeRota({ paradas_count: 3, paradas_concluidas: 1 }),
      ];
      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.taxaSucesso).toBe(33); // 1/3 = 33.33 → 33
    });
  });

  describe('reactivity', () => {
    it('recalculates when rotas change', () => {
      const initialRotas = [makeRota({ paradas_count: 5, paradas_concluidas: 5 })];
      const { result, rerender } = renderHook(
        ({ rotas }) => useHistoricoMetrics(rotas),
        { initialProps: { rotas: initialRotas } },
      );
      expect(result.current.rotasTotais).toBe(1);
      expect(result.current.taxaSucesso).toBe(100);

      const newRotas = [
        ...initialRotas,
        makeRota({ id: '2', paradas_count: 5, paradas_concluidas: 0, status: 'pendente' }),
      ];
      rerender({ rotas: newRotas });
      expect(result.current.rotasTotais).toBe(2);
      expect(result.current.taxaSucesso).toBe(50);
    });
  });

  describe('comprehensive scenario', () => {
    it('calculates all metrics correctly for mixed data', () => {
      const rotas = [
        makeRota({
          id: '1',
          status: 'concluida',
          data: todayISO(),
          paradas_count: 5,
          paradas_concluidas: 5,
          distancia_total: 15.5,
          iniciada_em: '2026-01-15T08:00:00Z',
          concluida_em: '2026-01-15T10:30:00Z', // 150 min
        }),
        makeRota({
          id: '2',
          status: 'concluida',
          data: daysAgoISO(5),
          paradas_count: 3,
          paradas_concluidas: 2,
          distancia_total: 8.3,
          iniciada_em: '2026-01-10T09:00:00Z',
          concluida_em: '2026-01-10T10:00:00Z', // 60 min
        }),
        makeRota({
          id: '3',
          status: 'pendente',
          data: '2024-06-01',
          paradas_count: 4,
          paradas_concluidas: 0,
          distancia_total: 0,
        }),
      ];

      const { result } = renderHook(() => useHistoricoMetrics(rotas));
      expect(result.current.rotasTotais).toBe(3);
      expect(result.current.rotasConcluidas).toBe(2);
      expect(result.current.paradasTotais).toBe(12);
      expect(result.current.paradasConcluidas).toBe(7);
      expect(result.current.distanciaTotal).toBe(23.8);
      expect(result.current.tempoMedioMinutos).toBe(105); // (150+60)/2
      expect(result.current.taxaSucesso).toBe(58); // 7/12 = 58.33 → 58
    });
  });
});
