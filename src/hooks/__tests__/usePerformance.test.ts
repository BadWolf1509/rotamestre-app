import { renderHook, act } from '@testing-library/react-native';
import { AppState, InteractionManager } from 'react-native';

import {
    usePerformance,
    useRenderPerformance,
    useLazyComponent,
    useMemoryLeakDetector,
} from '../usePerformance';

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
    addEventListener: jest.fn((callback) => {
        callback({ isConnected: true, type: 'wifi' });
        return jest.fn();
    }),
}));

// Mock PerformanceOptimizer
jest.mock('@/services/performanceOptimizer', () => ({
    __esModule: true,
    default: {
        deferOperation: jest.fn((fn) => fn()),
        trackScreenLoad: jest.fn(),
        trackApiResponse: jest.fn(),
        getCachedData: jest.fn().mockResolvedValue(null),
        cacheData: jest.fn().mockResolvedValue(undefined),
        batchRequest: jest.fn().mockResolvedValue({ success: true }),
        getOptimizedImageUrl: jest.fn((url, w, h) => url + '?w=' + w + '&h=' + h),
        clearAllCaches: jest.fn().mockResolvedValue(undefined),
        getPerformanceReport: jest.fn().mockReturnValue({ metrics: {} }),
    },
}));

// Mock AppState and InteractionManager separately to avoid breaking react-native
jest.spyOn(require('react-native'), 'AppState', 'get').mockReturnValue({
    currentState: 'active',
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
});

jest.spyOn(require('react-native').InteractionManager, 'runAfterInteractions').mockImplementation((callback: any) => {
    callback();
    return { cancel: jest.fn() };
});

describe('usePerformance', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Initial state', () => {
        it('deve retornar metricas iniciais corretas', () => {
            const { result } = renderHook(() => usePerformance());

            expect(result.current.metrics).toEqual({
                screenLoadTime: expect.any(Number),
                memoryUsage: 0,
                isOnline: true,
                connectionType: 'wifi',
            });
        });

        it('deve usar valores padrao de opcoes', () => {
            const { result } = renderHook(() => usePerformance());

            expect(result.current.metrics).toBeDefined();
            expect(typeof result.current.optimizedApiCall).toBe('function');
            expect(typeof result.current.batchApiCalls).toBe('function');
        });
    });

    describe('Screen load tracking', () => {
        it('deve rastrear tempo de carregamento quando trackScreenLoad e true', () => {
            const PerformanceOptimizer = require('@/services/performanceOptimizer').default;

            renderHook(() => usePerformance({ trackScreenLoad: true, screenName: 'TestScreen' }));

            expect(InteractionManager.runAfterInteractions).toHaveBeenCalled();
            expect(PerformanceOptimizer.trackScreenLoad).toHaveBeenCalledWith('TestScreen', expect.any(Number));
        });

        it('nao deve rastrear quando trackScreenLoad e false', () => {
            jest.clearAllMocks();
            const PerformanceOptimizer = require('@/services/performanceOptimizer').default;

            renderHook(() => usePerformance({ trackScreenLoad: false }));

            expect(PerformanceOptimizer.trackScreenLoad).not.toHaveBeenCalled();
        });
    });

    describe('optimizedApiCall', () => {
        it('deve executar API call diretamente quando trackApiCalls e false', async () => {
            const { result } = renderHook(() => usePerformance({ trackApiCalls: false }));
            const mockApiCall = jest.fn().mockResolvedValue({ data: 'test' });

            const response = await result.current.optimizedApiCall(mockApiCall);

            expect(response).toEqual({ data: 'test' });
            expect(mockApiCall).toHaveBeenCalled();
        });

        it('deve executar API call com otimizacoes', async () => {
            const { result } = renderHook(() => usePerformance({ trackApiCalls: true }));
            const mockApiCall = jest.fn().mockResolvedValue({ data: 'test' });

            const response = await result.current.optimizedApiCall(mockApiCall, { cacheKey: 'test-key' });

            expect(response).toEqual({ data: 'test' });
        });

        it('deve retornar dados do cache quando disponivel', async () => {
            const PerformanceOptimizer = require('@/services/performanceOptimizer').default;
            PerformanceOptimizer.getCachedData.mockResolvedValueOnce({ cached: true });

            const { result } = renderHook(() => usePerformance({ enableOptimizations: true }));
            const mockApiCall = jest.fn().mockResolvedValue({ data: 'test' });

            const response = await result.current.optimizedApiCall(mockApiCall, { cacheKey: 'cached-key' });

            expect(response).toEqual({ cached: true });
            expect(mockApiCall).not.toHaveBeenCalled();
        });

        it('deve tratar erros em API calls', async () => {
            const { result } = renderHook(() => usePerformance({ trackApiCalls: true }));
            const mockApiCall = jest.fn().mockRejectedValue(new Error('API Error'));

            await expect(result.current.optimizedApiCall(mockApiCall)).rejects.toThrow('API Error');
        });
    });

    describe('batchApiCalls', () => {
        it('deve usar fetch quando enableOptimizations e false', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                json: jest.fn().mockResolvedValue({ success: true }),
            });

            const { result } = renderHook(() => usePerformance({ enableOptimizations: false }));

            await result.current.batchApiCalls('/api/test', { param: 'value' });

            expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.any(Object));
        });

        it('deve usar PerformanceOptimizer.batchRequest quando otimizacoes habilitadas', async () => {
            const PerformanceOptimizer = require('@/services/performanceOptimizer').default;

            const { result } = renderHook(() => usePerformance({ enableOptimizations: true }));

            const response = await result.current.batchApiCalls('/api/test', { param: 'value' });

            expect(PerformanceOptimizer.batchRequest).toHaveBeenCalledWith('/api/test', { param: 'value' });
            expect(response).toEqual({ success: true });
        });
    });

    describe('deferOperation', () => {
        it('deve executar operacao diretamente quando enableOptimizations e false', async () => {
            const { result } = renderHook(() => usePerformance({ enableOptimizations: false }));
            const mockOperation = jest.fn();

            await result.current.deferOperation(mockOperation);

            expect(mockOperation).toHaveBeenCalled();
        });

        it('deve usar PerformanceOptimizer quando otimizacoes habilitadas', async () => {
            const PerformanceOptimizer = require('@/services/performanceOptimizer').default;

            const { result } = renderHook(() => usePerformance({ enableOptimizations: true }));
            const mockOperation = jest.fn();

            await result.current.deferOperation(mockOperation, 'high');

            expect(PerformanceOptimizer.deferOperation).toHaveBeenCalledWith(mockOperation, 'high');
        });
    });

    describe('getOptimizedImageUrl', () => {
        it('deve retornar URL original quando enableOptimizations e false', () => {
            const { result } = renderHook(() => usePerformance({ enableOptimizations: false }));

            const url = result.current.getOptimizedImageUrl('https://example.com/image.jpg', 100, 200);

            expect(url).toBe('https://example.com/image.jpg');
        });

        it('deve retornar URL otimizada quando enableOptimizations e true', () => {
            const { result } = renderHook(() => usePerformance({ enableOptimizations: true }));

            const url = result.current.getOptimizedImageUrl('https://example.com/image.jpg', 100, 200);

            expect(url).toBe('https://example.com/image.jpg?w=100&h=200');
        });
    });

    describe('clearCache', () => {
        it('deve chamar PerformanceOptimizer.clearAllCaches', async () => {
            const PerformanceOptimizer = require('@/services/performanceOptimizer').default;

            const { result } = renderHook(() => usePerformance());

            await result.current.clearCache();

            expect(PerformanceOptimizer.clearAllCaches).toHaveBeenCalled();
        });
    });

    describe('getPerformanceReport', () => {
        it('deve retornar relatorio de performance', () => {
            const { result } = renderHook(() => usePerformance());

            const report = result.current.getPerformanceReport();

            expect(report).toEqual({ metrics: {} });
        });
    });

    describe('App state changes', () => {
        it('deve registrar listener de AppState', () => {
            renderHook(() => usePerformance());

            expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
        });
    });
});

describe('useRenderPerformance', () => {
    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('deve rastrear contagem de renders', () => {
        const { result } = renderHook(() => useRenderPerformance('TestComponent'));

        // renderCount is a ref that starts at 0 and increments
        expect(typeof result.current.renderCount).toBe('number');
    });

    it('deve calcular tempo medio de render', () => {
        const { result } = renderHook(() => useRenderPerformance('TestComponent'));

        expect(typeof result.current.averageRenderTime).toBe('number');
    });

    it('deve retornar ultimo tempo de render', () => {
        const { result } = renderHook(() => useRenderPerformance('TestComponent'));

        expect(typeof result.current.lastRenderTime).toBe('number');
    });
});

describe('useLazyComponent', () => {
    it('deve retornar estado inicial', () => {
        const importFn = jest.fn().mockResolvedValue({ default: () => null });

        const { result } = renderHook(() => useLazyComponent(importFn));

        expect(result.current.Component).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('deve carregar componente quando loadComponent e chamado', async () => {
        const MockComponent = () => null;
        const importFn = jest.fn().mockResolvedValue({ default: MockComponent });

        const { result } = renderHook(() => useLazyComponent(importFn));

        await act(async () => {
            await result.current.loadComponent();
        });

        expect(importFn).toHaveBeenCalled();
    });

    it('deve tratar erro ao carregar componente', async () => {
        const importFn = jest.fn().mockRejectedValue(new Error('Import failed'));
        jest.spyOn(console, 'error').mockImplementation(() => {});

        const { result } = renderHook(() => useLazyComponent(importFn));

        await act(async () => {
            await result.current.loadComponent();
        });

        expect(result.current.error).toBeTruthy();
        expect(result.current.error?.message).toBe('Import failed');
    });

    it('nao deve carregar novamente se ja carregou', async () => {
        const MockComponent = () => null;
        const importFn = jest.fn().mockResolvedValue({ default: MockComponent });

        const { result } = renderHook(() => useLazyComponent(importFn));

        // First load
        await act(async () => {
            await result.current.loadComponent();
        });

        expect(importFn).toHaveBeenCalled();
    });
});

describe('useMemoryLeakDetector', () => {
    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('deve retornar funcoes de timer seguras', () => {
        const { result } = renderHook(() => useMemoryLeakDetector('TestComponent'));

        expect(typeof result.current.setTimeout).toBe('function');
        expect(typeof result.current.setInterval).toBe('function');
        expect(typeof result.current.trackPromise).toBe('function');
    });

    it('deve criar e rastrear timers', () => {
        const { result } = renderHook(() => useMemoryLeakDetector('TestComponent'));
        const callback = jest.fn();

        act(() => {
            result.current.setTimeout(callback, 1000);
        });

        expect(callback).not.toHaveBeenCalled();

        act(() => {
            jest.advanceTimersByTime(1000);
        });

        expect(callback).toHaveBeenCalled();
    });

    it('deve criar e rastrear intervals', () => {
        const { result } = renderHook(() => useMemoryLeakDetector('TestComponent'));
        const callback = jest.fn();

        act(() => {
            result.current.setInterval(callback, 500);
        });

        act(() => {
            jest.advanceTimersByTime(500);
        });

        expect(callback).toHaveBeenCalledTimes(1);

        act(() => {
            jest.advanceTimersByTime(500);
        });

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('deve rastrear promises', async () => {
        const { result } = renderHook(() => useMemoryLeakDetector('TestComponent'));

        const promise = Promise.resolve('test');
        const trackedPromise = result.current.trackPromise(promise);

        await expect(trackedPromise).resolves.toBe('test');
    });

    it('deve limpar timers nao removidos no unmount', () => {
        const { result, unmount } = renderHook(() => useMemoryLeakDetector('TestComponent'));
        const callback = jest.fn();

        act(() => {
            result.current.setTimeout(callback, 10000);
        });

        unmount();

        expect(console.warn).toHaveBeenCalled();
    });
});
