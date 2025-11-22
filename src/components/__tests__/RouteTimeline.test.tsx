import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { supabase } from '@/lib/supabase';

import { RouteTimeline } from '../RouteTimeline';


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
            created_at: '2023-01-01T10:00:00Z',
            detalhes: 'Início',
        },
    ];

    const mockParadas = [
        {
            id: 'p1',
            ordem: 1,
            endereco: 'Rua A',
            status: 'concluida',
            concluida_em: '2023-01-01T10:30:00Z',
        },
    ];

    const mockIncidentes = [
        {
            id: 'i1',
            categoria: 'accident',
            descricao: 'Acidente na via',
            created_at: '2023-01-01T10:15:00Z',
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock implementation based on table name
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'logs') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({ data: mockLogs }),
                };
            }
            if (table === 'paradas') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    not: jest.fn().mockResolvedValue({ data: mockParadas }),
                };
            }
            if (table === 'incidentes') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockResolvedValue({ data: mockIncidentes }),
                };
            }
            return {
                select: jest.fn().mockReturnThis(),
            };
        });
    });

    it('deve renderizar loading inicialmente', () => {
        const { getByText } = render(<RouteTimeline rotaId="123" />);
        expect(getByText('Carregando timeline...')).toBeTruthy();
    });

    it('deve renderizar eventos após carregamento', async () => {
        const { getByText, queryByText } = render(<RouteTimeline rotaId="123" />);

        await waitFor(() => {
            expect(queryByText('Carregando timeline...')).toBeNull();
        });

        expect(getByText('Rota Iniciada')).toBeTruthy();
        expect(getByText('Parada #1 Concluída')).toBeTruthy();
        expect(getByText('Acidente/Incidente')).toBeTruthy();
    });

    it('deve renderizar estado vazio se não houver eventos', async () => {
        // Mock empty responses
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'logs') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({ data: [] }),
                };
            }
            if (table === 'paradas') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    not: jest.fn().mockResolvedValue({ data: [] }),
                };
            }
            if (table === 'incidentes') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockResolvedValue({ data: [] }),
                };
            }
            return { select: jest.fn().mockReturnThis() };
        });

        const { getByText } = render(<RouteTimeline rotaId="123" />);

        await waitFor(() => {
            expect(getByText('Nenhum evento registrado')).toBeTruthy();
        });
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
