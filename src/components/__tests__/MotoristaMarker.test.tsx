import { act, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { CORES_SOBRE_O_MAPA } from '@/components/motorista/home/miniMapCompartilhado';

import { MotoristaMarker } from '../MotoristaMarker';

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

// Mock supabase com todos os métodos encadeados
const mockLocation = {
    latitude: -23.5505,
    longitude: -46.6333,
    timestamp: new Date().toISOString(),
    velocidade: 30,
    precisao: 10,
    heading: 90,
};

let mockReturnData: any = { data: null, error: { code: 'PGRST116' } };

jest.mock('@/lib/supabase', () => {
    const createQueryMock = () => {
        const mock: any = {
            select: jest.fn(() => mock),
            eq: jest.fn(() => mock),
            order: jest.fn(() => mock),
            limit: jest.fn(() => mock),
            single: jest.fn(() => Promise.resolve(mockReturnData)),
            maybeSingle: jest.fn(() =>
                Promise.resolve(
                    mockReturnData.error?.code === 'PGRST116'
                        ? { data: null, error: null }
                        : mockReturnData,
                ),
            ),
        };
        return mock;
    };

    const createChannelMock = () => ({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnValue({}),
    });

    return {
        supabase: {
            from: jest.fn(() => createQueryMock()),
            channel: jest.fn(() => createChannelMock()),
            removeChannel: jest.fn(),
        },
    };
});

describe('MotoristaMarker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockReturnData = { data: null, error: { code: 'PGRST116' } };
    });

    const defaultProps = {
        rotaId: 'rota-123',
    };

    describe('Rendering', () => {
        it('deve retornar null quando não há localização', async () => {
            const { toJSON } = render(<MotoristaMarker {...defaultProps} />);

            await waitFor(() => {
                expect(toJSON()).toBeNull();
            });
        });

        it('deve renderizar marker quando há localização', async () => {
            mockReturnData = { data: mockLocation, error: null };

            const { findByTestId } = render(<MotoristaMarker {...defaultProps} />);

            const marker = await findByTestId('marker');
            expect(marker).toBeTruthy();
        });
    });

    describe('Nome do motorista', () => {
        it('deve usar nome padrão "Motorista" quando não fornecido', async () => {
            mockReturnData = { data: mockLocation, error: null };

            const { findByText } = render(<MotoristaMarker {...defaultProps} />);

            const nome = await findByText('Motorista');
            expect(nome).toBeTruthy();
        });

        it('deve mostrar nome do motorista quando fornecido', async () => {
            mockReturnData = { data: mockLocation, error: null };

            const { findByText } = render(
                <MotoristaMarker {...defaultProps} motoristaNome="João Silva" />
            );

            const nome = await findByText('João Silva');
            expect(nome).toBeTruthy();
        });
    });

    describe('Velocidade no callout', () => {
        it('deve mostrar velocidade quando disponível', async () => {
            mockReturnData = { data: { ...mockLocation, velocidade: 45 }, error: null };

            const { findByText } = render(<MotoristaMarker {...defaultProps} />);

            const speed = await findByText('45 km/h');
            expect(speed).toBeTruthy();
        });

        it('não deve mostrar velocidade quando null', async () => {
            mockReturnData = { data: { ...mockLocation, velocidade: null }, error: null };

            const { queryByText, findByTestId } = render(
                <MotoristaMarker {...defaultProps} />
            );

            await findByTestId('marker');
            expect(queryByText('km/h')).toBeNull();
        });
    });

    describe('Tempo desde atualização', () => {
        it('deve mostrar "agora" para atualização recente', async () => {
            mockReturnData = { data: mockLocation, error: null };

            const { findByText } = render(<MotoristaMarker {...defaultProps} />);

            const time = await findByText('agora');
            expect(time).toBeTruthy();
        });
    });

    describe('Idade da posição', () => {
        afterEach(() => {
            jest.useRealTimers();
        });

        it('mostra "há N min" e a idade anda sem posição nova', async () => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2026-10-24T10:30:00Z'));
            mockReturnData = {
                data: { ...mockLocation, timestamp: '2026-10-24T10:18:00Z' },
                error: null,
            };

            const { getByText } = render(<MotoristaMarker {...defaultProps} />);
            await act(async () => {});

            expect(getByText('há 12 min')).toBeTruthy();

            act(() => {
                jest.advanceTimersByTime(3 * 60_000);
            });
            expect(getByText('há 15 min')).toBeTruthy();
        });
    });

    describe('Cores sobre o mapa', () => {
        it('motorista parado (0 km/h) fica cinza, não azul de "sem dado"', async () => {
            mockReturnData = { data: { ...mockLocation, velocidade: 0 }, error: null };

            const { findByText } = render(<MotoristaMarker {...defaultProps} />);

            const velocidade = await findByText('0 km/h');
            expect(velocidade.props.style).toEqual(
                expect.arrayContaining([{ color: CORES_SOBRE_O_MAPA.pendente }]),
            );
        });
    });

    describe('Props', () => {
        it('deve aceitar realtime=false', async () => {
            mockReturnData = { data: mockLocation, error: null };

            const { findByTestId } = render(
                <MotoristaMarker {...defaultProps} realtime={false} />
            );

            const marker = await findByTestId('marker');
            expect(marker).toBeTruthy();
        });
    });

    describe('Error handling', () => {
        it('deve lidar com erro na consulta', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockReturnData = { data: null, error: { code: 'ERROR', message: 'Database error' } };

            const { toJSON } = render(<MotoristaMarker {...defaultProps} />);

            await waitFor(() => {
                expect(toJSON()).toBeNull();
            });

            consoleSpy.mockRestore();
        });
    });
});
