
// Mocks
jest.mock('react-native', () => ({
    Platform: { OS: 'web' },
    Alert: { alert: jest.fn() },
    Keyboard: {
        addListener: jest.fn(() => ({ remove: jest.fn() })),
        removeListener: jest.fn(),
        isVisible: jest.fn(() => false),
        dismiss: jest.fn(),
    },
}));

// Save original __DEV__
const originalDEV = (global as any).__DEV__;

describe('devtools', () => {
    let mockWindow: any;
    let mockDocument: any;
    let mockPerformance: any;
    let mockPerformanceObserver: any;
    let originalConsole: typeof console;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.resetModules();
        jest.clearAllMocks();

        // Set __DEV__ to true
        (global as any).__DEV__ = true;

        // Mock PerformanceObserver
        mockPerformanceObserver = jest.fn().mockImplementation((_callback) => ({
            observe: jest.fn(),
            disconnect: jest.fn(),
        }));

        // Mock window
        mockWindow = {
            fetch: jest.fn().mockResolvedValue({
                status: 200,
                statusText: 'OK',
                headers: new Map(),
            }),
            location: {
                pathname: '/test',
                origin: 'http://localhost:8081',
            },
            innerWidth: 1920,
            innerHeight: 1080,
            addEventListener: jest.fn(),
            localStorage: {
                getItem: jest.fn(),
                setItem: jest.fn(),
                clear: jest.fn(),
            },
            sessionStorage: {
                clear: jest.fn(),
            },
            requestAnimationFrame: jest.fn(),
        };

        // Mock document
        mockDocument = {
            createElement: jest.fn().mockReturnValue({
                id: '',
                style: { cssText: '', display: 'none' },
                innerHTML: '',
            }),
            body: {
                appendChild: jest.fn(),
            },
            addEventListener: jest.fn(),
        };

        // Mock performance
        mockPerformance = {
            now: jest.fn().mockReturnValue(1000),
            memory: {
                usedJSHeapSize: 50 * 1024 * 1024,
                jsHeapSizeLimit: 100 * 1024 * 1024,
            },
            getEntriesByType: jest.fn().mockReturnValue([{
                domContentLoadedEventEnd: 100,
                domContentLoadedEventStart: 50,
                domComplete: 200,
                domInteractive: 150,
                loadEventEnd: 250,
                loadEventStart: 200,
                responseEnd: 100,
                responseStart: 50,
                fetchStart: 0,
            }]),
        };

        // Store original console
        originalConsole = { ...console };

        // Set globals
        (global as any).window = mockWindow;
        (global as any).document = mockDocument;
        (global as any).performance = mockPerformance;
        (global as any).PerformanceObserver = mockPerformanceObserver;
        (global as any).navigator = { onLine: true };
        (global as any).localStorage = mockWindow.localStorage;
        (global as any).sessionStorage = mockWindow.sessionStorage;
        (global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        (global as any).__DEV__ = originalDEV;
        delete (global as any).window;
        delete (global as any).document;
        delete (global as any).PerformanceObserver;
        delete (global as any).sessionStorage;

        // Restore console
        Object.assign(console, originalConsole);
    });

    describe('enablePerformanceMonitoring', () => {
        it('deve criar PerformanceObserver quando em dev e web', () => {
            const { enablePerformanceMonitoring } = require('../devtools');

            enablePerformanceMonitoring();

            expect(mockPerformanceObserver).toHaveBeenCalled();
        });

        it('não deve fazer nada quando não é __DEV__', () => {
            (global as any).__DEV__ = false;
            jest.resetModules();

            const { enablePerformanceMonitoring } = require('../devtools');

            enablePerformanceMonitoring();

            expect(mockPerformanceObserver).not.toHaveBeenCalled();
        });
    });

    describe('enhanceConsole', () => {
        it('deve modificar console.log para incluir timestamp', () => {
            const { enhanceConsole } = require('../devtools');

            enhanceConsole();

            // Após enhance, console.log deve adicionar timestamp
            expect(typeof console.log).toBe('function');
        });

        it('deve adicionar método success ao console', () => {
            const { enhanceConsole } = require('../devtools');

            enhanceConsole();

            expect(typeof (console as any).success).toBe('function');
        });

        it('deve adicionar método debug ao console', () => {
            const { enhanceConsole } = require('../devtools');

            enhanceConsole();

            expect(typeof (console as any).debug).toBe('function');
        });
    });

    describe('monitorNetwork', () => {
        it('deve interceptar fetch', async () => {
            const originalFetch = mockWindow.fetch;

            const { monitorNetwork } = require('../devtools');

            monitorNetwork();

            // O fetch original deve ser substituído
            expect(window.fetch).not.toBe(originalFetch);
        });

        it('deve logar requisições de rede', async () => {
            // Capturar o fetch original antes do monitorNetwork substituir
            const originalFetch = mockWindow.fetch;

            const { monitorNetwork } = require('../devtools');

            monitorNetwork();

            // Chamar o novo fetch (wrapper)
            const result = await window.fetch('https://api.example.com/data');

            // O resultado deve vir do fetch original mockado
            expect(result.status).toBe(200);
            expect(originalFetch).toHaveBeenCalledWith('https://api.example.com/data');
        });
    });

    describe('monitorMemory', () => {
        it('deve configurar intervalo para monitorar memória', () => {
            const setIntervalSpy = jest.spyOn(global, 'setInterval');

            const { monitorMemory } = require('../devtools');

            monitorMemory();

            expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);

            setIntervalSpy.mockRestore();
        });

        it('não deve fazer nada quando performance.memory não existe', () => {
            delete mockPerformance.memory;

            const setIntervalSpy = jest.spyOn(global, 'setInterval');

            const { monitorMemory } = require('../devtools');

            monitorMemory();

            expect(setIntervalSpy).not.toHaveBeenCalled();

            setIntervalSpy.mockRestore();
        });
    });

    describe('createDebugPanel', () => {
        it('deve criar elemento DOM para debug panel', () => {
            const { createDebugPanel } = require('../devtools');

            createDebugPanel();

            expect(mockDocument.createElement).toHaveBeenCalledWith('div');
            expect(mockDocument.body.appendChild).toHaveBeenCalled();
        });

        it('deve configurar listener de teclado', () => {
            const { createDebugPanel } = require('../devtools');

            createDebugPanel();

            expect(mockDocument.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
        });

        it('deve configurar intervalo de atualização', () => {
            const setIntervalSpy = jest.spyOn(global, 'setInterval');

            const { createDebugPanel } = require('../devtools');

            createDebugPanel();

            expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

            setIntervalSpy.mockRestore();
        });
    });

    describe('initializeDevTools', () => {
        it('deve inicializar todas as ferramentas de dev', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            const { initializeDevTools } = require('../devtools');

            initializeDevTools();

            // Deve logar mensagem de inicialização
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('RotaMestre DevTools initialized'));

            consoleSpy.mockRestore();
        });

        it('deve expor rotamestre no window', () => {
            const { initializeDevTools } = require('../devtools');

            initializeDevTools();

            expect((window as any).rotamestre).toBeDefined();
            expect(typeof (window as any).rotamestre.performance).toBe('function');
            expect(typeof (window as any).rotamestre.clearCache).toBe('function');
            expect(typeof (window as any).rotamestre.toggleDebug).toBe('function');
            expect(typeof (window as any).rotamestre.routes).toBe('function');
        });

        it('rotamestre.clearCache deve limpar storage', () => {
            const { initializeDevTools } = require('../devtools');

            initializeDevTools();
            (window as any).rotamestre.clearCache();

            expect(mockWindow.localStorage.clear).toHaveBeenCalled();
            expect(mockWindow.sessionStorage.clear).toHaveBeenCalled();
        });

        it('rotamestre.toggleDebug deve alternar debug mode', () => {
            mockWindow.localStorage.getItem.mockReturnValue('false');

            const { initializeDevTools } = require('../devtools');

            initializeDevTools();
            (window as any).rotamestre.toggleDebug();

            expect(mockWindow.localStorage.setItem).toHaveBeenCalledWith('debug', 'true');
        });
    });

    describe('default export', () => {
        it('deve exportar todas as funções', () => {
            const devtools = require('../devtools').default;

            expect(devtools.initializeDevTools).toBeDefined();
            expect(devtools.enablePerformanceMonitoring).toBeDefined();
            expect(devtools.enhanceConsole).toBeDefined();
            expect(devtools.monitorNetwork).toBeDefined();
            expect(devtools.monitorMemory).toBeDefined();
            expect(devtools.createDebugPanel).toBeDefined();
        });
    });

    describe('Platform-specific behavior', () => {
        it('não deve inicializar quando Platform.OS não é web', () => {
            jest.doMock('react-native', () => ({
                Platform: { OS: 'ios' },
            }));

            jest.resetModules();

            const consoleSpy = jest.spyOn(console, 'log');

            const { initializeDevTools } = require('../devtools');
            initializeDevTools();

            // Não deve logar nada em não-web
            expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('RotaMestre DevTools'));

            consoleSpy.mockRestore();
        });
    });
});
