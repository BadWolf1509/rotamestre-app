import { act, renderHook } from '@testing-library/react-native';
import React from 'react';

import { useDataTableState } from '../useDataTableState';

function montar(onSort?: (c: string, d: 'asc' | 'desc') => void) {
  // StrictMode roda o updater de setState duas vezes: efeito colateral dentro
  // dele (onSort, outro setState) dispara em dobro.
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <React.StrictMode>{children}</React.StrictMode>
  );
  return renderHook(
    () =>
      useDataTableState({
        data: [1, 2, 3],
        itemsPerPage: 10,
        pagination: false,
        onSort,
      }),
    { wrapper },
  );
}

describe('useDataTableState: ordenação', () => {
  it('primeiro clique em uma coluna ordena asc; o segundo na mesma alterna para desc', () => {
    const { result } = montar();

    act(() => result.current.handleSort('nome'));
    expect(result.current.sortColumn).toBe('nome');
    expect(result.current.sortDirection).toBe('asc');

    act(() => result.current.handleSort('nome'));
    expect(result.current.sortDirection).toBe('desc');

    act(() => result.current.handleSort('nome'));
    expect(result.current.sortDirection).toBe('asc');
  });

  it('trocar de coluna volta para asc', () => {
    const { result } = montar();

    act(() => result.current.handleSort('nome'));
    act(() => result.current.handleSort('nome'));
    expect(result.current.sortDirection).toBe('desc');

    act(() => result.current.handleSort('status'));
    expect(result.current.sortColumn).toBe('status');
    expect(result.current.sortDirection).toBe('asc');
  });

  it('onSort é chamado uma vez por clique, com a nova direção', () => {
    const onSort = jest.fn();
    const { result } = montar(onSort);

    act(() => result.current.handleSort('nome'));
    act(() => result.current.handleSort('nome'));

    expect(onSort).toHaveBeenCalledTimes(2);
    expect(onSort).toHaveBeenNthCalledWith(1, 'nome', 'asc');
    expect(onSort).toHaveBeenNthCalledWith(2, 'nome', 'desc');
  });

  it('clique repetido na mesma coluna, já com a tela atualizada, alterna a direção', () => {
    const onSort = jest.fn();
    const { result } = montar(onSort);

    act(() => result.current.handleSort('nome'));
    act(() => result.current.handleSort('nome'));
    act(() => result.current.handleSort('nome'));

    expect(onSort.mock.calls.map((c) => c[1])).toEqual(['asc', 'desc', 'asc']);
  });
});
