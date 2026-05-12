import { renderHook } from '@testing-library/react-native';

import { useParadaFiltering } from '../useParadaFiltering';

const withCoords = (
  id: string,
  opts: Partial<Parameters<typeof useParadaFiltering>[0][0]> = {},
) => ({
  id,
  endereco: `Rua ${id}`,
  latitude: -23.55,
  longitude: -46.63,
  status: 'pendente',
  ordem: 1,
  is_checkpoint: false,
  ...opts,
});

const noCoords = (id: string) => ({
  id,
  endereco: `Rua ${id}`,
  latitude: null,
  longitude: null,
  status: 'pendente',
  ordem: 1,
});

describe('useParadaFiltering', () => {
  it('paradasComCoord excludes paradas without coordinates', () => {
    const paradas = [withCoords('p1'), noCoords('p2')] as any;
    const { result } = renderHook(() => useParadaFiltering(paradas));
    expect(result.current.paradasComCoord).toHaveLength(1);
    expect(result.current.paradasComCoord[0].id).toBe('p1');
  });

  it('hasParadasComCoordenadas is false when no coords', () => {
    const { result } = renderHook(() =>
      useParadaFiltering([noCoords('p1')] as any),
    );
    expect(result.current.hasParadasComCoordenadas).toBe(false);
  });

  it('hasParadasComCoordenadas is true when coords present', () => {
    const { result } = renderHook(() =>
      useParadaFiltering([withCoords('p1')] as any),
    );
    expect(result.current.hasParadasComCoordenadas).toBe(true);
  });

  it('checkpoints contains only is_checkpoint=false entries', () => {
    const cp = withCoords('cp1', { is_checkpoint: false });
    const real = withCoords('p1', { is_checkpoint: undefined });
    const { result } = renderHook(() => useParadaFiltering([cp, real] as any));
    expect(result.current.checkpoints).toHaveLength(1);
    expect(result.current.checkpoints[0].id).toBe('cp1');
  });

  it('paradasReais contains non-checkpoint entries', () => {
    const cp = withCoords('cp1', { is_checkpoint: false });
    const real = withCoords('p1', { is_checkpoint: undefined });
    const { result } = renderHook(() => useParadaFiltering([cp, real] as any));
    expect(result.current.paradasReais).toHaveLength(1);
    expect(result.current.paradasReais[0].id).toBe('p1');
  });

  it('paradasFiltradas returns all when statusFilter=all', () => {
    const paradas = [
      withCoords('p1', { status: 'pendente', is_checkpoint: undefined }),
      withCoords('p2', { status: 'concluida', is_checkpoint: undefined }),
    ] as any;
    const { result } = renderHook(() => useParadaFiltering(paradas, 'all'));
    expect(result.current.paradasFiltradas).toHaveLength(2);
  });

  it('paradasFiltradas filters by status when not all', () => {
    const paradas = [
      withCoords('p1', { status: 'pendente', is_checkpoint: undefined }),
      withCoords('p2', { status: 'concluida', is_checkpoint: undefined }),
    ] as any;
    const { result } = renderHook(() =>
      useParadaFiltering(paradas, 'pendente' as any),
    );
    expect(result.current.paradasFiltradas).toHaveLength(1);
    expect(result.current.paradasFiltradas[0].id).toBe('p1');
  });

  it('returns empty arrays when paradas is empty', () => {
    const { result } = renderHook(() => useParadaFiltering([]));
    expect(result.current.paradasComCoord).toHaveLength(0);
    expect(result.current.paradasReais).toHaveLength(0);
    expect(result.current.paradasFiltradas).toHaveLength(0);
    expect(result.current.checkpoints).toHaveLength(0);
    expect(result.current.hasParadasComCoordenadas).toBe(false);
  });
});
