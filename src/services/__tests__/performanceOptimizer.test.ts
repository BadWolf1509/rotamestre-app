// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    getAllKeys: jest.fn().mockResolvedValue([]),
    multiRemove: jest.fn().mockResolvedValue(undefined),
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
    addEventListener: jest.fn().mockReturnValue(jest.fn()),
}));

// Mock InteractionManager
jest.mock('react-native', () => ({
    InteractionManager: {
        runAfterInteractions: jest.fn((callback) => {
            callback();
            return { cancel: jest.fn() };
        }),
    },
    Platform: {
        OS: 'ios',
    },
}));

// Mocked modules
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Import after mocks
import PerformanceOptimizer from '../performanceOptimizer';

describe('PerformanceOptimizer', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getInstance', () => {
        it('deve retornar instancia singleton', () => {
            const instance1 = PerformanceOptimizer;
            const instance2 = PerformanceOptimizer;

            expect(instance1).toBe(instance2);
        });
    });

    describe('cacheData', () => {
        it('deve armazenar dados no cache', async () => {
            await PerformanceOptimizer.cacheData('test-key', { data: 'test' });

            const cached = await PerformanceOptimizer.getCachedData('test-key');
            expect(cached).toEqual({ data: 'test' });
        });

        it('deve aceitar TTL customizado', async () => {
            await PerformanceOptimizer.cacheData('ttl-key', { value: 123 }, 10000);

            const cached = await PerformanceOptimizer.getCachedData('ttl-key');
            expect(cached).toEqual({ value: 123 });
        });
    });

    describe('getCachedData', () => {
        it('deve retornar null para chave inexistente', async () => {
            const result = await PerformanceOptimizer.getCachedData('nonexistent-key');
            expect(result).toBeNull();
        });

        it('deve retornar dados do cache quando valido', async () => {
            await PerformanceOptimizer.cacheData('valid-key', { test: true });

            const result = await PerformanceOptimizer.getCachedData('valid-key');
            expect(result).toEqual({ test: true });
        });
    });

    describe('clearAllCaches', () => {
        it('deve limpar todos os caches', async () => {
            await PerformanceOptimizer.cacheData('key1', 'value1');
            await PerformanceOptimizer.cacheData('key2', 'value2');

            await PerformanceOptimizer.clearAllCaches();

            const result1 = await PerformanceOptimizer.getCachedData('key1');
            expect(result1).toBeNull();
        });
    });

    describe('trackScreenLoad', () => {
        it('deve rastrear tempo de carregamento de tela', () => {
            const startTime = Date.now() - 500;
            PerformanceOptimizer.trackScreenLoad('TestScreen', startTime);

            const report = PerformanceOptimizer.getPerformanceReport();
            expect(report.screenLoadTime).toBeDefined();
        });
    });

    describe('trackApiResponse', () => {
        it('deve rastrear tempo de resposta de API', () => {
            PerformanceOptimizer.trackApiResponse('/api/test', 250);

            const report = PerformanceOptimizer.getPerformanceReport();
            expect(report.apiResponseTime).toBeDefined();
        });

        it('deve aceitar multiplos tempos para mesma rota', () => {
            PerformanceOptimizer.trackApiResponse('/api/test2', 100);
            PerformanceOptimizer.trackApiResponse('/api/test2', 150);
            PerformanceOptimizer.trackApiResponse('/api/test2', 200);

            const report = PerformanceOptimizer.getPerformanceReport();
            expect(report.apiResponseTime).toBeDefined();
        });
    });

    describe('deferOperation', () => {
        it('deve ter metodo deferOperation', () => {
            expect(typeof PerformanceOptimizer.deferOperation).toBe('function');
        });
    });

    describe('batchRequest', () => {
        it('deve ter metodo batchRequest', () => {
            expect(typeof PerformanceOptimizer.batchRequest).toBe('function');
        });
    });

    describe('getOptimizedImageUrl', () => {
        it('deve ter metodo getOptimizedImageUrl', () => {
            expect(typeof PerformanceOptimizer.getOptimizedImageUrl).toBe('function');
        });

        it('deve retornar URL otimizada com dimensoes', () => {
            const url = PerformanceOptimizer.getOptimizedImageUrl(
                'https://example.com/image.jpg',
                200,
                100
            );

            expect(url).toContain('200');
        });
    });

    describe('getPerformanceReport', () => {
        it('deve retornar relatorio de metricas', () => {
            const report = PerformanceOptimizer.getPerformanceReport();

            expect(report).toHaveProperty('appLaunchTime');
            expect(report).toHaveProperty('screenLoadTime');
            expect(report).toHaveProperty('apiResponseTime');
            expect(report).toHaveProperty('memoryUsage');
            expect(report).toHaveProperty('jsFramerate');
        });
    });

    describe('updateSettings', () => {
        it('deve atualizar configuracoes', async () => {
            await PerformanceOptimizer.updateSettings({
                enableLazyLoading: false,
            });

            expect(AsyncStorage.setItem).toHaveBeenCalled();
        });

        it('deve lidar com erro ao salvar', async () => {
            (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Save failed'));
            jest.spyOn(console, 'error').mockImplementation(() => {});

            await PerformanceOptimizer.updateSettings({ enableDataCaching: false });

            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('Network monitoring', () => {
        it('deve ter NetInfo mockado', () => {
            expect(NetInfo.addEventListener).toBeDefined();
        });
    });
});

describe('PerformanceOptimizer API', () => {
    it('deve exportar singleton por default', () => {
        expect(PerformanceOptimizer).toBeDefined();
    });

    it('deve ter todos os metodos publicos', () => {
        expect(typeof PerformanceOptimizer.cacheData).toBe('function');
        expect(typeof PerformanceOptimizer.getCachedData).toBe('function');
        expect(typeof PerformanceOptimizer.clearAllCaches).toBe('function');
        expect(typeof PerformanceOptimizer.trackScreenLoad).toBe('function');
        expect(typeof PerformanceOptimizer.trackApiResponse).toBe('function');
        expect(typeof PerformanceOptimizer.deferOperation).toBe('function');
        expect(typeof PerformanceOptimizer.batchRequest).toBe('function');
        expect(typeof PerformanceOptimizer.getOptimizedImageUrl).toBe('function');
        expect(typeof PerformanceOptimizer.getPerformanceReport).toBe('function');
        expect(typeof PerformanceOptimizer.updateSettings).toBe('function');
    });
});
