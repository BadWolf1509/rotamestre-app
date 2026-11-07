/**
 * Guarda única das duas listas de arrasto (Nova Entrega e modal Reordenar):
 * soltar sem mudar a ordem não faz nada; recusa ou falha ao aplicar devolve a
 * lista nativa à ordem do estado (resetToken); a rejeição não escapa.
 */
import { act, renderHook } from '@testing-library/react-native';

import { logger } from '@/lib/logger';

import { useSoltarNaLista } from '../useSoltarNaLista';

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const atual = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const trocada = [{ id: 'b' }, { id: 'a' }, { id: 'c' }];

beforeEach(() => jest.clearAllMocks());

describe('useSoltarNaLista', () => {
  it('ordem igual não chama aplicar nem remonta a lista', async () => {
    const aplicar = jest.fn();
    const { result } = renderHook(() =>
      useSoltarNaLista({ ordemAtual: atual, aplicar }),
    );

    await act(async () => {
      await result.current.onDragEnd([...atual]);
    });

    expect(aplicar).not.toHaveBeenCalled();
    expect(result.current.resetToken).toBe(0);
  });

  it('ordem nova é aplicada e, aceita, não remonta a lista', async () => {
    const aplicar = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useSoltarNaLista({ ordemAtual: atual, aplicar }),
    );

    await act(async () => {
      await result.current.onDragEnd(trocada);
    });

    expect(aplicar).toHaveBeenCalledWith(trocada);
    expect(result.current.resetToken).toBe(0);
  });

  it('aplicar devolvendo false (recusa) remonta a lista', async () => {
    const aplicar = jest.fn().mockReturnValue(false);
    const { result } = renderHook(() =>
      useSoltarNaLista({ ordemAtual: atual, aplicar }),
    );

    await act(async () => {
      await result.current.onDragEnd(trocada);
    });

    expect(result.current.resetToken).toBe(1);
  });

  it('aplicar rejeitando: remonta a lista, registra e não solta a rejeição', async () => {
    const aplicar = jest.fn().mockRejectedValue(new Error('rede'));
    const { result } = renderHook(() =>
      useSoltarNaLista({ ordemAtual: atual, aplicar }),
    );

    await act(async () => {
      await expect(result.current.onDragEnd(trocada)).resolves.toBeUndefined();
    });

    expect(result.current.resetToken).toBe(1);
    expect(logger.error).toHaveBeenCalled();
  });
});
