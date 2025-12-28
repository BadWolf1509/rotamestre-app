import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { supabase } from '@/lib/supabase';

import { RouteTimeline } from '../RouteTimeline';

// Mock useTimelineLastSeen hook
jest.mock('@/hooks/useTimelineLastSeen', () => {
    const isNewEvent = jest.fn(() => false);
    const markAllAsSeen = jest.fn();
    const countNewEvents = jest.fn(() => 0);

    return {
        useTimelineLastSeen: () => ({
            isNewEvent,
            markAllAsSeen,
            countNewEvents,
            loading: false,
        }),
    };
});

// Mock utils functions
jest.mock('@/lib/utils', () => ({
    formatRelativeTime: (_timestamp: string) => 'há 5 min',
    getDateGroup: () => 'Hoje',
    calculateDurationBetween: () => '5 min',
    groupBy: <T, K extends string>(arr: T[], fn: (item: T) => K) => {
        return arr.reduce((acc, item) => {
            const key = fn(item);
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {} as Record<K, T[]>);
    },
    mapLogToTimelineEvent: (log: any) => {
        if (log.evento?.includes('iniciou')) {
            return {
                id: log.id,
                type: 'status_change',
                timestamp: log.timestamp || log.created_at,
                title: 'Rota Iniciada',
            description: log.detalhes?.info || 'Motorista iniciou a rota',
                icon: 'flag',
                colorKey: 'success',
            };
        }
        return null;
    },
    mapParadaToTimelineEvent: (parada: any) => ({
        id: parada.id,
        type: 'parada_update',
        timestamp: parada.concluida_em,
        title: `Parada #${parada.ordem} Concluída`,
        description: parada.endereco,
        icon: 'checkmark-circle',
        colorKey: 'success',
        hasPhoto: !!parada.foto_url,
    }),
    mapIncidenteToTimelineEvent: (incidente: any) => ({
        id: incidente.id,
        type: 'incidente',
        timestamp: incidente.created_at,
        title: 'Acidente/Incidente',
        description: incidente.descricao,
        icon: 'alert-circle',
        colorKey: 'error',
        isCritical: true,
        hasPhoto: !!incidente.foto_url,
    }),
}));

// Mock styles
jest.mock('@/utils/styles', () => {
    const theme = {
        colors: {
            white: '#fff',
            black: '#000',
            info: '#3b82f6',
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            purple: '#8b5cf6',
            blue500: '#3b82f6',
            gray50: '#f9fafb',
            gray100: '#f3f4f6',
            gray200: '#e5e7eb',
            gray300: '#d1d5db',
            gray500: '#6b7280',
            gray600: '#4b5563',
            gray900: '#111827',
            red50: '#fef2f2',
            red100: '#fee2e2',
            blue50: '#eff6ff',
            blue100: '#dbeafe',
        },
    };

    return {
        useUnistyles: () => ({
            theme,
        }),
        StyleSheet: {
            create: (fn: any) => {
                return typeof fn === 'function' ? fn(theme) : fn;
            },
        },
    };
});

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
    supabase: {
        channel: jest.fn().mockReturnThis(),
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
        removeChannel: jest.fn(),
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
    },
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

describe('RouteTimeline', () => {
    const mockLogs = [
        {
            id: '1',
            evento: 'Motorista iniciou a rota',
            timestamp: '2023-01-01T10:00:00Z',
            detalhes: { info: 'Início' },
        },
    ];

    const mockParadas = [
        {
            id: 'p1',
            ordem: 1,
            endereco: 'Rua A',
            status: 'concluida',
            concluida_em: '2023-01-01T10:30:00Z',
            is_checkpoint: false,
            foto_url: null,
        },
    ];

    const mockIncidentes = [
        {
            id: 'i1',
            categoria: 'accident',
            descricao: 'Acidente na via',
            created_at: '2023-01-01T10:15:00Z',
            foto_url: null,
        },
    ];

    const createChainMock = (resolveData: any) => {
        const mock: any = {};
        mock.select = jest.fn(() => mock);
        mock.eq = jest.fn(() => mock);
        mock.order = jest.fn(() => mock);
        mock.not = jest.fn(() => mock);
        mock.limit = jest.fn(() => Promise.resolve({ data: resolveData }));
        mock.range = jest.fn(() => Promise.resolve({ data: [] }));
        // Ensure that chained calls that don't have limit still resolve
        mock.then = (resolve: any) => Promise.resolve({ data: resolveData }).then(resolve);
        return mock;
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock implementation based on table name
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'logs') {
                return createChainMock(mockLogs);
            }
            if (table === 'paradas') {
                const mock = createChainMock(mockParadas);
                // Override not() to resolve directly for paradas query
                mock.not = jest.fn(() => Promise.resolve({ data: mockParadas }));
                return mock;
            }
            if (table === 'incidentes') {
                const mock = createChainMock(mockIncidentes);
                // Override eq() for incidentes to resolve directly
                mock.eq = jest.fn(() => Promise.resolve({ data: mockIncidentes }));
                return mock;
            }
            return createChainMock([]);
        });
    });

    it('deve renderizar skeleton loading inicialmente', () => {
        const { UNSAFE_getAllByType } = render(<RouteTimeline rotaId="123" />);
        const { View } = require('react-native');
        // Skeleton renderiza múltiplos View placeholders
        const views = UNSAFE_getAllByType(View);
        expect(views.length).toBeGreaterThan(5);
    });

    it('deve renderizar eventos após carregamento', async () => {
        const { getByText } = render(<RouteTimeline rotaId="123" />);

        await waitFor(() => {
            expect(getByText('Rota Iniciada')).toBeTruthy();
        }, { timeout: 5000 });

        expect(getByText('Parada #1 Concluída')).toBeTruthy();
        expect(getByText('Acidente/Incidente')).toBeTruthy();
    });

    it('deve renderizar estado vazio se não houver eventos', async () => {
        // Mock empty responses using the helper
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'logs') {
                return createChainMock([]);
            }
            if (table === 'paradas') {
                const mock = createChainMock([]);
                mock.not = jest.fn(() => Promise.resolve({ data: [] }));
                return mock;
            }
            if (table === 'incidentes') {
                const mock = createChainMock([]);
                mock.eq = jest.fn(() => Promise.resolve({ data: [] }));
                return mock;
            }
            return createChainMock([]);
        });

        const { getByText } = render(<RouteTimeline rotaId="123" />);

        await waitFor(() => {
            expect(getByText('Nenhum evento registrado')).toBeTruthy();
        }, { timeout: 5000 });
    });

    it('deve subscrever a realtime updates se realtime=true', async () => {
        render(<RouteTimeline rotaId="123" realtime={true} />);

        await waitFor(() => {
            expect(supabase.channel).toHaveBeenCalledWith('route-timeline-123');
            expect(supabase.channel('').subscribe).toHaveBeenCalled();
        });
    });

    it('não deve subscrever a realtime updates se realtime=false', async () => {
        render(<RouteTimeline rotaId="123" realtime={false} />);

        await waitFor(() => {
            expect(supabase.channel).not.toHaveBeenCalled();
        });
    });
});
