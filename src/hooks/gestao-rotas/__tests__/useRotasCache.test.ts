/**
 * Cache da Gestão de Rotas: uma chave por loja e período (o padrão da tela é
 * "Este mês", e a lista de um período não pode abrir a tela de outro).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook } from '@testing-library/react-native';

import { useRotasCache } from '../useRotasCache';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const chave = (periodo?: { de: string | null; ate: string | null }) =>
  renderHook(() =>
    useRotasCache({ unidadeId: 'u1', periodo }),
  ).result.current.getCacheKey();

describe('useRotasCache — chave por período', () => {
  it('mantém o prefixo da limpeza de conta e separa loja e período', () => {
    const novembro = chave({ de: '2026-11-01', ate: '2026-11-30' });
    const outubro = chave({ de: '2026-10-01', ate: '2026-10-31' });
    const todo = chave({ de: null, ate: null });

    expect(novembro).toBe('gestao_rotas_cache_u1_2026-11-01_2026-11-30');
    expect(todo).toBe('gestao_rotas_cache_u1_todo');
    expect(chave()).toBe(todo);
    expect(new Set([novembro, outubro, todo]).size).toBe(3);
  });

  it('lê e grava na chave do período; outro período não enxerga o cache', async () => {
    const dados = [{ id: 'r1' }];
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (k: string) =>
      k === 'gestao_rotas_cache_u1_2026-11-01_2026-11-30'
        ? JSON.stringify({ data: dados, timestamp: 1 })
        : null,
    );
    const novembro = renderHook(() =>
      useRotasCache({
        unidadeId: 'u1',
        periodo: { de: '2026-11-01', ate: '2026-11-30' },
      }),
    ).result.current;
    const outubro = renderHook(() =>
      useRotasCache({
        unidadeId: 'u1',
        periodo: { de: '2026-10-01', ate: '2026-10-31' },
      }),
    ).result.current;

    expect((await novembro.loadFromCache())?.data).toEqual(dados);
    expect(await outubro.loadFromCache()).toBeNull();

    await outubro.saveToCache([]);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'gestao_rotas_cache_u1_2026-10-01_2026-10-31',
      expect.any(String),
    );
  });
});
