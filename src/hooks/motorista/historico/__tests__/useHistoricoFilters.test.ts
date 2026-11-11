import { act, renderHook } from '@testing-library/react-native';

import { useHistoricoFilters } from '../useHistoricoFilters';

jest.mock('@/lib/dateUtils', () => ({
  ...jest.requireActual('@/lib/dateUtils'),
  getTodayISO: () => '2026-11-10',
}));
jest.mock('@/hooks/usePeriodoLembrado', () => {
  const { useState } = require('react');
  return {
    usePeriodoLembrado: () => {
      const [periodo, definirPeriodo] = useState({ tipo: 'este_mes' });
      return { periodo, definirPeriodo, carregado: true };
    },
  };
});

describe('useHistoricoFilters', () => {
  it('padrão: Este mês inteiro (sem corte em hoje) e status "todos"', () => {
    const { result } = renderHook(() => useHistoricoFilters());
    expect(result.current.filtroStatus).toBe('todos');
    expect(result.current.de).toBe('2026-11-01');
    expect(result.current.ate).toBe('2026-11-30');
    expect(result.current.textoDoPeriodo).toBe('Este mês (01/11 a 30/11)');
    expect(result.current.carregado).toBe(true);
  });

  it('trocar o período muda de/ate; o status não mexe no período', () => {
    const { result } = renderHook(() => useHistoricoFilters());
    act(() => result.current.definirPeriodo({ tipo: 'hoje' }));
    expect(result.current.de).toBe('2026-11-10');
    expect(result.current.ate).toBe('2026-11-10');

    act(() => result.current.setFiltroStatus('cancelada'));
    expect(result.current.filtroStatus).toBe('cancelada');
    expect(result.current.de).toBe('2026-11-10');
  });

  it('Todo o período: de e ate nulos', () => {
    const { result } = renderHook(() => useHistoricoFilters());
    act(() => result.current.definirPeriodo({ tipo: 'todo' }));
    expect(result.current.de).toBeNull();
    expect(result.current.ate).toBeNull();
  });
});
