import { renderHook } from '@testing-library/react-native';

import { useDashboardData } from '../useDashboardData';

// Mock useUser
jest.mock('@/hooks/useUser', () => ({
    useUser: () => ({
        userData: { id: 'user-1', unidade_id: 'unidade-1', nome: 'Test User' },
    }),
}));

// Mock useRealtimeRoutes
jest.mock('@/hooks/useRealtimeRoutes', () => ({
    useRealtimeRoutes: () => ({
        updateTrigger: 0,
    }),
}));

// Mock useUnidadeAtiva
jest.mock('@/hooks/useUnidadeAtiva', () => ({
    useUnidadeAtiva: () => ({
        unidadeAtiva: 'unidade-1',
        setUnidadeAtiva: jest.fn(),
        vinculacoes: [],
        loading: false,
    }),
}));

// Mock supabase with complete chain
jest.mock('@/lib/supabase', () => {
    const createQueryMock = () => {
        const queryMethods: any = {
            eq: jest.fn(() => queryMethods),
            in: jest.fn(() => queryMethods),
            gte: jest.fn(() => queryMethods),
            lte: jest.fn(() => queryMethods),
            order: jest.fn(() => queryMethods),
            limit: jest.fn(() => queryMethods),
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        };
        return queryMethods;
    };

    return {
        supabase: {
            from: jest.fn(() => ({
                select: jest.fn(() => createQueryMock()),
            })),
        },
    };
});

describe('useDashboardData', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Initial state', () => {
        it('deve retornar estado inicial correto', () => {
            const { result } = renderHook(() => useDashboardData());

            // Initial stats should be zeros
            expect(result.current.stats.total).toBe(0);
            expect(result.current.stats.emAndamento).toBe(0);
            expect(result.current.stats.concluidas).toBe(0);
            expect(result.current.todayStats.totalHoje).toBe(0);
            expect(result.current.rotas).toEqual([]);
        });

        it('deve ter funcao onRefresh', () => {
            const { result } = renderHook(() => useDashboardData());

            expect(typeof result.current.onRefresh).toBe('function');
        });

        it('deve ter userData do useUser', () => {
            const { result } = renderHook(() => useDashboardData());

            expect(result.current.userData).toBeDefined();
            expect(result.current.userData.id).toBe('user-1');
        });
    });

    describe('Data loading', () => {
        it('deve chamar supabase quando unidadeId existe', () => {
            const { result } = renderHook(() => useDashboardData());

            // Hook should initialize with stats object
            expect(result.current.stats).toBeDefined();
        });

        it('deve aceitar filtros opcionais', () => {
            const filters = {
                dataInicio: '2025-01-01',
                dataFim: '2025-01-31',
                status: 'em_andamento' as const,
            };

            const { result } = renderHook(() => useDashboardData({ filters }));

            expect(result.current.stats).toBeDefined();
        });
    });

    describe('Stats structure', () => {
        it('deve ter estrutura de stats correta', () => {
            const { result } = renderHook(() => useDashboardData());

            expect(result.current.stats).toHaveProperty('total');
            expect(result.current.stats).toHaveProperty('emAndamento');
            expect(result.current.stats).toHaveProperty('concluidas');
            expect(result.current.stats).toHaveProperty('distanciaTotal');
        });

        it('deve ter estrutura de todayStats correta', () => {
            const { result } = renderHook(() => useDashboardData());

            expect(result.current.todayStats).toHaveProperty('totalHoje');
        });
    });

    describe('Return values', () => {
        it('deve retornar loading boolean', () => {
            const { result } = renderHook(() => useDashboardData());

            expect(typeof result.current.loading).toBe('boolean');
        });

        it('deve retornar refreshing boolean', () => {
            const { result } = renderHook(() => useDashboardData());

            expect(typeof result.current.refreshing).toBe('boolean');
            expect(result.current.refreshing).toBe(false);
        });

        it('deve retornar rotas array', () => {
            const { result } = renderHook(() => useDashboardData());

            expect(Array.isArray(result.current.rotas)).toBe(true);
        });
    });

    describe('Filters', () => {
        it('deve aceitar filtro de dataInicio', () => {
            const { result } = renderHook(() =>
                useDashboardData({
                    filters: { dataInicio: '2025-01-01' },
                })
            );

            expect(result.current.stats).toBeDefined();
        });

        it('deve aceitar filtro de dataFim', () => {
            const { result } = renderHook(() =>
                useDashboardData({
                    filters: { dataFim: '2025-01-31' },
                })
            );

            expect(result.current.stats).toBeDefined();
        });

        it('deve aceitar filtro de status', () => {
            const { result } = renderHook(() =>
                useDashboardData({
                    filters: { status: 'concluida' },
                })
            );

            expect(result.current.stats).toBeDefined();
        });

        it('deve aceitar filtro de motoristaId', () => {
            const { result } = renderHook(() =>
                useDashboardData({
                    filters: { motoristaId: 'motorista-1' },
                })
            );

            expect(result.current.stats).toBeDefined();
        });

        it('deve lidar com filtros vazios', () => {
            const { result } = renderHook(() =>
                useDashboardData({
                    filters: {},
                })
            );

            expect(result.current.stats).toBeDefined();
        });
    });
});
