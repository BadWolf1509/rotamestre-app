import { renderHook, act } from '@testing-library/react-native';

import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it('deve retornar o valor inicial imediatamente', () => {
        const { result } = renderHook(() => useDebounce('initial', 500));
        expect(result.current).toBe('initial');
    });

    it('deve debounce o valor após delay especificado', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'initial', delay: 500 } }
        );

        expect(result.current).toBe('initial');

        // Atualizar valor
        rerender({ value: 'updated', delay: 500 });

        // Valor ainda não deve ter mudado
        expect(result.current).toBe('initial');

        // Avançar tempo parcialmente
        act(() => {
            jest.advanceTimersByTime(300);
        });

        // Ainda não deve ter mudado
        expect(result.current).toBe('initial');

        // Completar o delay
        act(() => {
            jest.advanceTimersByTime(200);
        });

        // Agora deve ter atualizado
        expect(result.current).toBe('updated');
    });

    it('deve cancelar timeout anterior ao receber novo valor', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'initial', delay: 500 } }
        );

        // Primeira atualização
        rerender({ value: 'first', delay: 500 });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        // Segunda atualização antes do primeiro timeout completar
        rerender({ value: 'second', delay: 500 });

        // Completar o tempo do primeiro timeout (que deveria ter sido cancelado)
        act(() => {
            jest.advanceTimersByTime(200);
        });

        // Ainda deve ser 'initial' porque o primeiro timeout foi cancelado
        expect(result.current).toBe('initial');

        // Completar o segundo timeout
        act(() => {
            jest.advanceTimersByTime(300);
        });

        // Agora deve ser 'second'
        expect(result.current).toBe('second');
    });

    it('deve funcionar com delay de 0ms', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'initial', delay: 0 } }
        );

        rerender({ value: 'immediate', delay: 0 });

        act(() => {
            jest.advanceTimersByTime(0);
        });

        expect(result.current).toBe('immediate');
    });

    it('deve funcionar com diferentes tipos de valores', () => {
        // Teste com número
        const { result: numberResult, rerender: numberRerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 0, delay: 500 } }
        );

        numberRerender({ value: 42, delay: 500 });

        act(() => {
            jest.advanceTimersByTime(500);
        });

        expect(numberResult.current).toBe(42);

        // Teste com objeto
        const { result: objectResult, rerender: objectRerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: { name: 'test' }, delay: 500 } }
        );

        const newValue = { name: 'updated' };
        objectRerender({ value: newValue, delay: 500 });

        act(() => {
            jest.advanceTimersByTime(500);
        });

        expect(objectResult.current).toEqual(newValue);
    });

    it('deve limpar timeout ao desmontar', () => {
        const { unmount } = renderHook(() => useDebounce('value', 500));

        // Desmontar antes do timeout completar
        unmount();

        // Não deve haver timers pendentes
        expect(jest.getTimerCount()).toBe(0);
    });

    it('deve lidar com múltiplas atualizações rápidas', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'initial', delay: 500 } }
        );

        // Simular digitação rápida
        rerender({ value: 'a', delay: 500 });
        act(() => {
            jest.advanceTimersByTime(100);
        });

        rerender({ value: 'ab', delay: 500 });
        act(() => {
            jest.advanceTimersByTime(100);
        });

        rerender({ value: 'abc', delay: 500 });
        act(() => {
            jest.advanceTimersByTime(100);
        });

        rerender({ value: 'abcd', delay: 500 });

        // Ainda deve ser initial
        expect(result.current).toBe('initial');

        // Completar o último timeout
        act(() => {
            jest.advanceTimersByTime(500);
        });

        // Deve pular para o último valor
        expect(result.current).toBe('abcd');
    });
});
