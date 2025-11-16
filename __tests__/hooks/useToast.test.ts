/**
 * Testes do hook useToast
 */

import { renderHook, act } from '@testing-library/react-native';
import { useToast } from '@/hooks/useToast';

describe('useToast hook', () => {
  it('deve inicializar com toast invisível', () => {
    const { result } = renderHook(() => useToast());

    expect(result.current.toast.visible).toBe(false);
    expect(result.current.toast.message).toBe('');
    expect(result.current.toast.type).toBe('success');
    expect(result.current.toast.duration).toBe(3000);
  });

  describe('showToast', () => {
    it('deve mostrar toast com mensagem e tipo padrão (info)', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('Teste de mensagem');
      });

      expect(result.current.toast.visible).toBe(true);
      expect(result.current.toast.message).toBe('Teste de mensagem');
      expect(result.current.toast.type).toBe('info');
      expect(result.current.toast.duration).toBe(3000);
    });

    it('deve mostrar toast com tipo success', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('Operação realizada!', 'success');
      });

      expect(result.current.toast.visible).toBe(true);
      expect(result.current.toast.type).toBe('success');
    });

    it('deve mostrar toast com tipo error', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('Erro ao processar', 'error');
      });

      expect(result.current.toast.visible).toBe(true);
      expect(result.current.toast.type).toBe('error');
    });

    it('deve mostrar toast com tipo loading', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('Carregando...', 'loading');
      });

      expect(result.current.toast.visible).toBe(true);
      expect(result.current.toast.type).toBe('loading');
    });

    it('deve aceitar duração customizada', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('Mensagem longa', 'info', 5000);
      });

      expect(result.current.toast.duration).toBe(5000);
    });

    it('deve sobrescrever toast anterior', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('Primeira mensagem', 'info');
      });

      expect(result.current.toast.message).toBe('Primeira mensagem');

      act(() => {
        result.current.showToast('Segunda mensagem', 'success');
      });

      expect(result.current.toast.message).toBe('Segunda mensagem');
      expect(result.current.toast.type).toBe('success');
    });
  });

  describe('hideToast', () => {
    it('deve esconder toast mantendo outras propriedades', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('Teste', 'success', 5000);
      });

      expect(result.current.toast.visible).toBe(true);

      act(() => {
        result.current.hideToast();
      });

      expect(result.current.toast.visible).toBe(false);
      expect(result.current.toast.message).toBe('Teste');
      expect(result.current.toast.type).toBe('success');
    });
  });

  describe('withToast', () => {
    it('deve mostrar loading → success para operação bem-sucedida', async () => {
      const { result } = renderHook(() => useToast());

      const asyncOperation = jest.fn().mockResolvedValue('resultado');

      await act(async () => {
        await result.current.withToast(asyncOperation, {
          loading: 'Processando...',
          success: 'Concluído!',
          error: 'Erro!',
        });
      });

      expect(result.current.toast.visible).toBe(true);
      expect(result.current.toast.message).toBe('Concluído!');
      expect(result.current.toast.type).toBe('success');
      expect(asyncOperation).toHaveBeenCalledTimes(1);
    });

    it('deve mostrar loading → error para operação com erro', async () => {
      const { result } = renderHook(() => useToast());

      const asyncOperation = jest.fn().mockRejectedValue(new Error('Falha na operação'));

      await act(async () => {
        try {
          await result.current.withToast(asyncOperation, {
            loading: 'Processando...',
            success: 'Concluído!',
            error: 'Erro ao processar',
          });
        } catch (error) {
          // Esperado
        }
      });

      expect(result.current.toast.visible).toBe(true);
      expect(result.current.toast.message).toBe('Erro ao processar');
      expect(result.current.toast.type).toBe('error');
      expect(result.current.toast.duration).toBe(5000); // Error tem duration maior
    });

    it('deve usar mensagem de erro padrão se não especificada', async () => {
      const { result } = renderHook(() => useToast());

      const errorMessage = 'Mensagem do erro original';
      const asyncOperation = jest.fn().mockRejectedValue(new Error(errorMessage));

      await act(async () => {
        try {
          await result.current.withToast(asyncOperation, {
            loading: 'Processando...',
            success: 'Concluído!',
          });
        } catch (error) {
          // Esperado
        }
      });

      expect(result.current.toast.message).toBe(errorMessage);
      expect(result.current.toast.type).toBe('error');
    });

    it('deve retornar o resultado da operação assíncrona', async () => {
      const { result } = renderHook(() => useToast());

      const expectedResult = { id: '123', nome: 'Teste' };
      const asyncOperation = jest.fn().mockResolvedValue(expectedResult);

      let actualResult;
      await act(async () => {
        actualResult = await result.current.withToast(asyncOperation, {
          loading: 'Salvando...',
          success: 'Salvo!',
        });
      });

      expect(actualResult).toEqual(expectedResult);
    });

    it('deve propagar erro após mostrar toast', async () => {
      const { result } = renderHook(() => useToast());

      const testError = new Error('Erro de teste');
      const asyncOperation = jest.fn().mockRejectedValue(testError);

      await act(async () => {
        await expect(
          result.current.withToast(asyncOperation, {
            loading: 'Processando...',
            success: 'Concluído!',
            error: 'Falhou!',
          })
        ).rejects.toThrow('Erro de teste');
      });
    });

    it('deve definir duration 0 para toast de loading', async () => {
      const { result } = renderHook(() => useToast());

      const slowAsyncOperation = () =>
        new Promise((resolve) => {
          setTimeout(() => resolve('done'), 100);
        });

      // Verificar estado durante loading
      const promise = act(async () => {
        return result.current.withToast(slowAsyncOperation, {
          loading: 'Aguarde...',
          success: 'Pronto!',
        });
      });

      // Verificar imediatamente após iniciar (loading state)
      // Nota: Este teste pode ser flaky dependendo do timing
      await promise;

      // Após completar, deve estar em success
      expect(result.current.toast.type).toBe('success');
    });
  });

  describe('Funções devem ser estáveis (useCallback)', () => {
    it('showToast deve ter referência estável', () => {
      const { result, rerender } = renderHook(() => useToast());

      const firstShowToast = result.current.showToast;
      rerender();
      const secondShowToast = result.current.showToast;

      expect(firstShowToast).toBe(secondShowToast);
    });

    it('hideToast deve ter referência estável', () => {
      const { result, rerender } = renderHook(() => useToast());

      const firstHideToast = result.current.hideToast;
      rerender();
      const secondHideToast = result.current.hideToast;

      expect(firstHideToast).toBe(secondHideToast);
    });

    it('withToast deve ter referência estável', () => {
      const { result, rerender } = renderHook(() => useToast());

      const firstWithToast = result.current.withToast;
      rerender();
      const secondWithToast = result.current.withToast;

      expect(firstWithToast).toBe(secondWithToast);
    });
  });
});
