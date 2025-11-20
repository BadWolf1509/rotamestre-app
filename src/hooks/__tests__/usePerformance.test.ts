import { renderHook, act } from '@testing-library/react-hooks';
import { usePerformance } from '../usePerformance';

describe('usePerformance', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('deve inicializar com métricas vazias', () => {
        const { result } = renderHook(() => usePerformance('TestComponent'));

        expect(result.current.metrics).toEqual({});
        expect(result.current.getMetric('any-metric')).toBeUndefined();
    });

    it('deve iniciar e finalizar medição de métrica', () => {
        const { result } = renderHook(() => usePerformance('TestComponent'));

        act(() => {
            result.current.startMetric('render');
        });

        act(() => {
            jest.advanceTimersByTime(100);
        });

        act(() => {
            result.current.endMetric('render');
        });

        const metric = result.current.getMetric('render');
        expect(metric).toBeDefined();
        expect(metric).toBeGreaterThanOrEqual(100);
    });

    it('deve retornar undefined para métrica não iniciada', () => {
        const { result } = renderHook(() => usePerformance('TestComponent'));

        act(() => {
            result.current.endMetric('non-existent');
        });

        expect(result.current.getMetric('non-existent')).toBeUndefined();
    });

    it('deve logar warning se endMetric for chamado sem startMetric', () => {
        const warnSpy = jest.spyOn(console, 'warn');
        const { result } = renderHook(() => usePerformance('TestComponent'));

        act(() => {
            result.current.endMetric('not-started');
        });

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('endMetric called without startMetric')
        );
    });

    it('deve medir múltiplas métricas simultaneamente', () => {
        const { result } = renderHook(() => usePerformance('TestComponent'));

        act(() => {
            result.current.startMetric('metric1');
            result.current.startMetric('metric2');
        });

        act(() => {
            jest.advanceTimersByTime(50);
        });

        act(() => {
            result.current.endMetric('metric1');
        });

        act(() => {
            jest.advanceTimersByTime(50);
        });

        act(() => {
            result.current.endMetric('metric2');
        });

        const metric1 = result.current.getMetric('metric1');
        const metric2 = result.current.getMetric('metric2');

        expect(metric1).toBeGreaterThanOrEqual(50);
        expect(metric1).toBeLessThan(100);
        expect(metric2).toBeGreaterThanOrEqual(100);
    });

    it('deve resetar métricas', () => {
        const { result } = renderHook(() => usePerformance('TestComponent'));

        act(() => {
            result.current.startMetric('test');
        });

        act(() => {
            jest.advanceTimersByTime(100);
        });

        act(() => {
            result.current.endMetric('test');
        });

        expect(result.current.getMetric('test')).toBeDefined();

        act(() => {
            result.current.resetMetrics();
        });

        expect(result.current.metrics).toEqual({});
        expect(result.current.getMetric('test')).toBeUndefined();
    });

    it('deve logar métricas no console', () => {
        const logSpy = jest.spyOn(console, 'log');
        const { result } = renderHook(() => usePerformance('TestComponent'));

        act(() => {
            result.current.startMetric('render');
        });

        act(() => {
            jest.advanceTimersByTime(100);
        });

        act(() => {
            result.current.endMetric('render');
        });

        act(() => {
            result.current.logMetrics();
        });

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('TestComponent'),
            expect.any(Object)
        );
    });

    it('deve limpar métricas pendentes ao desmontar', () => {
        const { result, unmount } = renderHook(() => usePerformance('TestComponent'));

        act(() => {
            result.current.startMetric('test1');
            result.current.startMetric('test2');
        });

        unmount();

        // Não deve haver timers ou state pendentes
        expect(jest.getTimerCount()).toBe(0);
    });
});
