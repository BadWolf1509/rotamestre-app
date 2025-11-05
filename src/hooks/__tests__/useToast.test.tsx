import { renderHook, act } from '@testing-library/react-native';
import { useToast } from '../useToast';

describe('useToast Hook', () => {
  it('deve inicializar com toast invisível', () => {
    const { result } = renderHook(() => useToast());

    expect(result.current.toast.visible).toBe(false);
    expect(result.current.toast.message).toBe('');
    expect(result.current.toast.type).toBe('success');
  });

  it('deve mostrar toast de sucesso', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Operação realizada!', 'success');
    });

    expect(result.current.toast.visible).toBe(true);
    expect(result.current.toast.message).toBe('Operação realizada!');
    expect(result.current.toast.type).toBe('success');
  });

  it('deve mostrar toast de erro', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Algo deu errado', 'error');
    });

    expect(result.current.toast.visible).toBe(true);
    expect(result.current.toast.message).toBe('Algo deu errado');
    expect(result.current.toast.type).toBe('error');
  });

  it('deve mostrar toast de warning', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Atenção!', 'warning');
    });

    expect(result.current.toast.visible).toBe(true);
    expect(result.current.toast.message).toBe('Atenção!');
    expect(result.current.toast.type).toBe('warning');
  });

  it('deve ocultar toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Mensagem', 'success');
    });

    expect(result.current.toast.visible).toBe(true);

    act(() => {
      result.current.hideToast();
    });

    expect(result.current.toast.visible).toBe(false);
  });

  it('deve aceitar duration customizada', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Mensagem', 'success', 5000);
    });

    expect(result.current.toast.duration).toBe(5000);
  });

  it('deve usar duration padrão quando não especificada', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Mensagem', 'success');
    });

    // Duration padrão é 3000ms
    expect(result.current.toast.duration).toBe(3000);
  });

  it('deve substituir toast anterior ao mostrar novo', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Primeira mensagem', 'success');
    });

    expect(result.current.toast.message).toBe('Primeira mensagem');

    act(() => {
      result.current.showToast('Segunda mensagem', 'error');
    });

    expect(result.current.toast.message).toBe('Segunda mensagem');
    expect(result.current.toast.type).toBe('error');
  });
});
