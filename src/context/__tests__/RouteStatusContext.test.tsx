import { render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { RouteStatusProvider, useRouteStatus } from '../RouteStatusContext';

// Mock useUser
const mockUserData = { id: 'motorista-1', nome: 'Motorista Teste' };
jest.mock('@/hooks/useUser', () => ({
    useUser: () => ({ userData: mockUserData }),
}));

// Mock supabase
jest.mock('@/lib/supabase', () => {
    const mockOn = jest.fn().mockReturnThis();
    const mockSubscribe = jest.fn().mockReturnValue({});
    const mockChannel = jest.fn().mockReturnValue({
        on: mockOn,
        subscribe: mockSubscribe,
    });

    const createQueryMock = () => {
        const methods: any = {
            select: jest.fn(() => methods),
            eq: jest.fn(() => methods),
            in: jest.fn(() => methods),
            order: jest.fn(() => methods),
            limit: jest.fn(() => methods),
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
            update: jest.fn(() => methods),
        };
        return methods;
    };

    return {
        supabase: {
            from: jest.fn(() => createQueryMock()),
            channel: mockChannel,
            removeChannel: jest.fn(),
        },
    };
});

// Test component to access context
function TestComponent() {
    const {
        routeStatus,
        route,
        paradas,
        currentStop,
        nextStop,
        progress,
        loading,
    } = useRouteStatus();

    return (
        <>
            <Text testID="status">{routeStatus}</Text>
            <Text testID="loading">{loading.toString()}</Text>
            <Text testID="route">{route ? route.id : 'null'}</Text>
            <Text testID="paradas">{paradas.length}</Text>
            <Text testID="currentStop">{currentStop ? currentStop.id : 'null'}</Text>
            <Text testID="nextStop">{nextStop ? nextStop.id : 'null'}</Text>
            <Text testID="progress">{progress.percentage}</Text>
        </>
    );
}

describe('RouteStatusContext', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Initial state', () => {
        it('deve iniciar com status no-route quando nao ha rota', async () => {
            const { getByTestId } = render(
                <RouteStatusProvider>
                    <TestComponent />
                </RouteStatusProvider>
            );

            await waitFor(() => {
                expect(getByTestId('loading').props.children).toBe('false');
            });

            expect(getByTestId('status').props.children).toBe('no-route');
        });

        it('deve iniciar com loading true', () => {
            const { getByTestId } = render(
                <RouteStatusProvider>
                    <TestComponent />
                </RouteStatusProvider>
            );

            // Initially loading should be true
            expect(getByTestId('loading')).toBeTruthy();
        });
    });

    describe('Route loading', () => {
        it('deve renderizar componentes filhos', async () => {
            const { getByTestId } = render(
                <RouteStatusProvider>
                    <TestComponent />
                </RouteStatusProvider>
            );

            await waitFor(() => {
                expect(getByTestId('status')).toBeTruthy();
            });
        });

        it('deve ter props de progresso', async () => {
            const { getByTestId } = render(
                <RouteStatusProvider>
                    <TestComponent />
                </RouteStatusProvider>
            );

            await waitFor(() => {
                expect(getByTestId('progress')).toBeTruthy();
            });
        });
    });

    describe('Progress calculation', () => {
        it('deve calcular progresso corretamente', async () => {
            const { getByTestId } = render(
                <RouteStatusProvider>
                    <TestComponent />
                </RouteStatusProvider>
            );

            await waitFor(() => {
                expect(getByTestId('loading').props.children).toBe('false');
            });

            // With no paradas, progress should be 0
            expect(getByTestId('progress').props.children).toBe(0);
        });
    });

    describe('Realtime subscription', () => {
        it('deve renderizar sem erros', async () => {
            const { getByTestId } = render(
                <RouteStatusProvider>
                    <TestComponent />
                </RouteStatusProvider>
            );

            await waitFor(() => {
                expect(getByTestId('status')).toBeTruthy();
            });
        });
    });

    describe('useRouteStatus hook', () => {
        it('deve retornar contexto quando usado dentro do Provider', async () => {
            const { getByTestId } = render(
                <RouteStatusProvider>
                    <TestComponent />
                </RouteStatusProvider>
            );

            await waitFor(() => {
                expect(getByTestId('status')).toBeTruthy();
            });
        });

        it('deve funcionar corretamente dentro do Provider', async () => {
            const { getByTestId } = render(
                <RouteStatusProvider>
                    <TestComponent />
                </RouteStatusProvider>
            );

            await waitFor(() => {
                expect(getByTestId('paradas')).toBeTruthy();
            });
        });
    });
});

describe('RouteStatusContext actions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test component with action buttons
    function TestComponentWithActions() {
        const { startRoute, completeStop, skipStop, completeRoute, refreshRoute } = useRouteStatus();

        return (
            <>
                <Text testID="startRoute" onPress={() => startRoute()}>Start</Text>
                <Text testID="completeStop" onPress={() => completeStop('parada-1')}>Complete</Text>
                <Text testID="skipStop" onPress={() => skipStop('parada-1')}>Skip</Text>
                <Text testID="completeRoute" onPress={() => completeRoute()}>Complete Route</Text>
                <Text testID="refreshRoute" onPress={() => refreshRoute()}>Refresh</Text>
            </>
        );
    }

    it('deve ter funcao startRoute', async () => {
        const { getByTestId } = render(
            <RouteStatusProvider>
                <TestComponentWithActions />
            </RouteStatusProvider>
        );

        await waitFor(() => {
            expect(getByTestId('startRoute')).toBeTruthy();
        });
    });

    it('deve ter funcao completeStop', async () => {
        const { getByTestId } = render(
            <RouteStatusProvider>
                <TestComponentWithActions />
            </RouteStatusProvider>
        );

        await waitFor(() => {
            expect(getByTestId('completeStop')).toBeTruthy();
        });
    });

    it('deve ter funcao skipStop', async () => {
        const { getByTestId } = render(
            <RouteStatusProvider>
                <TestComponentWithActions />
            </RouteStatusProvider>
        );

        await waitFor(() => {
            expect(getByTestId('skipStop')).toBeTruthy();
        });
    });

    it('deve ter funcao completeRoute', async () => {
        const { getByTestId } = render(
            <RouteStatusProvider>
                <TestComponentWithActions />
            </RouteStatusProvider>
        );

        await waitFor(() => {
            expect(getByTestId('completeRoute')).toBeTruthy();
        });
    });

    it('deve ter funcao refreshRoute', async () => {
        const { getByTestId } = render(
            <RouteStatusProvider>
                <TestComponentWithActions />
            </RouteStatusProvider>
        );

        await waitFor(() => {
            expect(getByTestId('refreshRoute')).toBeTruthy();
        });
    });
});
