import { act, renderHook } from '@testing-library/react-native';

import { useHistoricoFilters } from '../useHistoricoFilters';

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

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('useHistoricoFilters', () => {
  const rotas: RotaHistorico[] = [
    makeRota({ id: '1', status: 'concluida', data: today() }),
    makeRota({ id: '2', status: 'pendente', data: today() }),
    makeRota({ id: '3', status: 'em_andamento', data: daysAgo(3) }),
    makeRota({ id: '4', status: 'concluida', data: daysAgo(10) }),
    makeRota({ id: '5', status: 'cancelada', data: daysAgo(40) }),
  ];

  describe('initial state', () => {
    it('defaults to "todos" for both filters', () => {
      const { result } = renderHook(() => useHistoricoFilters(rotas));
      expect(result.current.filtroStatus).toBe('todos');
      expect(result.current.filtroPeriodo).toBe('todos');
    });

    it('returns all routes when no filters applied', () => {
      const { result } = renderHook(() => useHistoricoFilters(rotas));
      expect(result.current.rotasFiltradas).toHaveLength(5);
    });
  });

  describe('status filter', () => {
    it('filters by "concluida"', () => {
      const { result } = renderHook(() => useHistoricoFilters(rotas));
      act(() => result.current.setFiltroStatus('concluida'));
      expect(result.current.rotasFiltradas).toHaveLength(2);
      expect(result.current.rotasFiltradas.every((r) => r.status === 'concluida')).toBe(true);
    });

    it('filters by "pendente"', () => {
      const { result } = renderHook(() => useHistoricoFilters(rotas));
      act(() => result.current.setFiltroStatus('pendente'));
      expect(result.current.rotasFiltradas).toHaveLength(1);
      expect(result.current.rotasFiltradas[0].id).toBe('2');
    });

    it('filters by "em_andamento"', () => {
      const { result } = renderHook(() => useHistoricoFilters(rotas));
      act(() => result.current.setFiltroStatus('em_andamento'));
      expect(result.current.rotasFiltradas).toHaveLength(1);
      expect(result.current.rotasFiltradas[0].id).toBe('3');
    });

    it('filters by "cancelada"', () => {
      const { result } = renderHook(() => useHistoricoFilters(rotas));
      act(() => result.current.setFiltroStatus('cancelada'));
      expect(result.current.rotasFiltradas).toHaveLength(1);
      expect(result.current.rotasFiltradas[0].id).toBe('5');
    });

    it('returns empty array when no matches', () => {
      const { result } = renderHook(() => useHistoricoFilters(rotas));
      act(() => result.current.setFiltroStatus('nao_executada'));
      expect(result.current.rotasFiltradas).toHaveLength(0);
    });

    it('resets to all when set back to "todos"', () => {
      const { result } = renderHook(() => useHistoricoFilters(rotas));
      act(() => result.current.setFiltroStatus('concluida'));
      expect(result.current.rotasFiltradas).toHaveLength(2);
      act(() => result.current.setFiltroStatus('todos'));
      expect(result.current.rotasFiltradas).toHaveLength(5);
    });
  });

  describe('period filter', () => {
    it('filters by "hoje" — only today routes', () => {
      const { result } = renderHook(() => useHistoricoFilters(rotas));
      act(() => result.current.setFiltroPeriodo('hoje'));
      expect(result.current.rotasFiltradas).toHaveLength(2);
      expect(result.current.rotasFiltradas.every((r) => r.data === today())).toBe(true);
    });

    it('filters by "semana" — routes from current week', () => {
      const { result } = renderHook(() => useHistoricoFilters(rotas));
      act(() => result.current.setFiltroPeriodo('semana'));
      // Today + 3 days ago should be within current week (at most)
      const filtered = result.current.rotasFiltradas;
      expect(filtered.length).toBeGreaterThanOrEqual(2);
      expect(filtered.length).toBeLessThanOrEqual(4);
    });

    it('filters by "mes" — routes from current month', () => {
      const { result } = renderHook(() => useHistoricoFilters(rotas));
      act(() => result.current.setFiltroPeriodo('mes'));
      // Today, 3 days ago, and possibly 10 days ago should be in the current month
      const filtered = result.current.rotasFiltradas;
      expect(filtered.length).toBeGreaterThanOrEqual(2);
    });

    it('resets to all when set back to "todos"', () => {
      const { result } = renderHook(() => useHistoricoFilters(rotas));
      act(() => result.current.setFiltroPeriodo('hoje'));
      expect(result.current.rotasFiltradas.length).toBeLessThan(5);
      act(() => result.current.setFiltroPeriodo('todos'));
      expect(result.current.rotasFiltradas).toHaveLength(5);
    });
  });

  describe('combined filters', () => {
    it('applies both status and period filters', () => {
      const { result } = renderHook(() => useHistoricoFilters(rotas));
      act(() => {
        result.current.setFiltroStatus('concluida');
        result.current.setFiltroPeriodo('hoje');
      });
      expect(result.current.rotasFiltradas).toHaveLength(1);
      expect(result.current.rotasFiltradas[0].id).toBe('1');
    });

    it('returns empty when filters eliminate all routes', () => {
      const { result } = renderHook(() => useHistoricoFilters(rotas));
      act(() => {
        result.current.setFiltroStatus('cancelada');
        result.current.setFiltroPeriodo('hoje');
      });
      expect(result.current.rotasFiltradas).toHaveLength(0);
    });
  });

  describe('empty input', () => {
    it('returns empty array for empty rotas', () => {
      const { result } = renderHook(() => useHistoricoFilters([]));
      expect(result.current.rotasFiltradas).toHaveLength(0);
    });

    it('returns empty even with filters applied on empty input', () => {
      const { result } = renderHook(() => useHistoricoFilters([]));
      act(() => result.current.setFiltroStatus('concluida'));
      expect(result.current.rotasFiltradas).toHaveLength(0);
    });
  });

  describe('invalid dates', () => {
    it('excludes routes with invalid date when period filter is active', () => {
      const rotasWithBadDate = [
        makeRota({ id: '1', data: 'invalid-date' }),
        makeRota({ id: '2', data: today() }),
      ];
      const { result } = renderHook(() => useHistoricoFilters(rotasWithBadDate));
      act(() => result.current.setFiltroPeriodo('hoje'));
      expect(result.current.rotasFiltradas).toHaveLength(1);
      expect(result.current.rotasFiltradas[0].id).toBe('2');
    });
  });

  describe('reactivity', () => {
    it('updates when rotas input changes', () => {
      const { result, rerender } = renderHook(
        ({ rotas: r }) => useHistoricoFilters(r),
        { initialProps: { rotas } },
      );
      expect(result.current.rotasFiltradas).toHaveLength(5);

      const newRotas = [rotas[0]];
      rerender({ rotas: newRotas });
      expect(result.current.rotasFiltradas).toHaveLength(1);
    });
  });
});
