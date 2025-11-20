import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import PerformanceOptimizer from '../performanceOptimizer';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    getAllKeys: jest.fn(),
    multiGet: jest.fn(),
    multiRemove: jest.fn(),
    removeItem: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
    addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('react-native', () => ({
    InteractionManager: {
        runAfterInteractions: (callback: Function) => {
            callback();
            return { cancel: jest.fn() };
        },
    },
    Platform: {
        OS: 'ios',
    },
}));

// Mock global fetch
global.fetch = jest.fn();

describe('PerformanceOptimizer', () => {
    let optimizer: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock AsyncStorage.setItem to resolve
        (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

        // Get singleton instance
        optimizer = PerformanceOptimizer;

        // Reset internal state
        (optimizer as any).cache = new Map();
        (optimizer as any).pendingBatch = [];
        (optimizer as any).requestQueue = new Map();
    });

    describe('Cache Management', () => {
        it('deve armazenar dados no cache', async () => {
            const testData = { foo: 'bar' };
            await optimizer.cacheData('test-key', testData);

            const cached = await optimizer.getCachedData('test-key');
            expect(cached).toEqual(testData);
        });

        it('deve limpar todo o cache', async () => {
            (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(['cache_key1', 'cache_key2', 'other_key']);

            await optimizer.clearAllCaches();

            expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(['cache_key1', 'cache_key2']);
            expect((optimizer as any).cache.size).toBe(0);
        });
    });

    describe('Settings Management', () => {
        it('deve atualizar configurações', async () => {
            await optimizer.updateSettings({ enableBatchRequests: false });

            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                'performanceSettings',
                expect.stringContaining('enableBatchRequests')
            );
        });

        it('deve alternar otimizações específicas', async () => {
            optimizer.toggleOptimization('enableLazyLoading', false);

            expect(AsyncStorage.setItem).toHaveBeenCalled();
        });
    });

    describe('Performance Metrics', () => {
        it('deve rastrear tempo de carregamento de tela', () => {
            const startTime = Date.now() - 500;
            optimizer.trackScreenLoad('HomeScreen', startTime);

            const report = optimizer.getPerformanceReport();
            expect(report.screenLoadTime['HomeScreen']).toBeGreaterThan(0);
        });

        it('deve rastrear tempo de resposta da API', () => {
            optimizer.trackApiResponse('/api/users', 150);
            optimizer.trackApiResponse('/api/users', 200);

            const report = optimizer.getPerformanceReport();
            expect(report.apiResponseTime['/api/users']).toHaveLength(2);
            expect(report.apiResponseTime['/api/users']).toContain(150);
        });

        it('deve limitar métricas de API a 100 medições', () => {
            for (let i = 0; i < 150; i++) {
                optimizer.trackApiResponse('/api/test', i);
            }

            const report = optimizer.getPerformanceReport();
            expect(report.apiResponseTime['/api/test'].length).toBe(100);
        });
    });

    describe('Image Optimization', () => {
        it('deve otimizar URLs de imagem', () => {
            const url = 'https://example.com/image.jpg';
            const optimized = optimizer.getOptimizedImageUrl(url, 800, 600);

            expect(optimized).toContain('w=800');
            expect(optimized).toContain('h=600');
            expect(optimized).toContain('q=85');
            expect(optimized).toContain('fmt=webp');
        });

        it('deve retornar URL original se otimização desabilitada', () => {
            optimizer.toggleOptimization('enableImageOptimization', false);

            const url = 'https://example.com/image.jpg';
            const result = optimizer.getOptimizedImageUrl(url, 800, 600);

            expect(result).toBe(url);
        });

        it('deve adicionar parâmetros a URLs existentes', () => {
            const url = 'https://example.com/image.jpg?existing=param';
            const optimized = optimizer.getOptimizedImageUrl(url, 800);

            expect(optimized).toContain('existing=param');
            expect(optimized).toContain('&w=800');
        });
    });
});
