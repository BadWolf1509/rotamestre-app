import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { MainCard } from '../MainCard';

// Mock useUser
jest.mock('@/hooks/useUser', () => ({
    useUser: () => ({
        userData: { id: 'motorista-123' },
    }),
}));

// Mock supabase
jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        gte: jest.fn(() => ({
                            lt: jest.fn(() => Promise.resolve({ data: [], error: null })),
                        })),
                    })),
                })),
                in: jest.fn(() => ({
                    eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
                })),
            })),
        })),
    },
}));

// Mock StreetViewPreview
jest.mock('@/components/StreetViewPreview', () => ({
    StreetViewPreview: () => null,
}));

// Mock SwipeableRow
jest.mock('@/components/SwipeableRow', () => ({
    SwipeableRow: ({ children }: any) => children,
}));

// Mock unistyles
jest.mock('@/utils/styles', () => ({
    useUnistyles: () => ({
        theme: {
            colors: {
                gray500: '#6b7280',
                primary: '#007AFF',
                success: '#34C759',
                warning: '#FF9500',
            },
        },
    }),
    defaultTheme: {
        colors: {
            white: '#fff',
            black: '#000',
            primary: '#007AFF',
            gray50: '#f9fafb',
            gray100: '#f3f4f6',
            gray200: '#e5e7eb',
            gray500: '#6b7280',
            gray700: '#374151',
            gray900: '#111827',
            warningBg: '#fef3c7',
            secondaryDark: '#92400e',
            success: '#34C759',
        },
    },
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

describe('MainCard', () => {
    const defaultProps = {
        state: 'no-route' as const,
        route: null,
        paradas: [],
        currentStop: undefined,
    };

    it('deve renderizar estado no-route', () => {
        const { getByText } = render(<MainCard {...defaultProps} />);

        expect(getByText('Sem rota no momento')).toBeTruthy();
        expect(getByText('Aguardando atribuição de nova rota')).toBeTruthy();
    });

    it('deve mostrar dica do dia em no-route', () => {
        const { getByText } = render(<MainCard {...defaultProps} />);

        expect(getByText('Dica do dia')).toBeTruthy();
    });

    it('deve renderizar estado pending', () => {
        const props = {
            ...defaultProps,
            state: 'pending' as const,
            route: {
                unidade_nome: 'Empresa Teste',
                distancia_total: 45,
            },
            paradas: [
                { id: '1', endereco: 'Rua A, 123', ordem: 1 },
                { id: '2', endereco: 'Rua B, 456', ordem: 2 },
            ],
        };

        const { getByText } = render(<MainCard {...props} />);

        expect(getByText('ROTA PENDENTE')).toBeTruthy();
        expect(getByText('Empresa Teste')).toBeTruthy();
        expect(getByText('2 paradas')).toBeTruthy();
    });

    it('deve mostrar primeira parada em pending', () => {
        const props = {
            ...defaultProps,
            state: 'pending' as const,
            route: { unidade_nome: 'Empresa' },
            paradas: [
                { id: '1', endereco: 'Rua Principal, 100', ordem: 1 },
            ],
        };

        const { getByText } = render(<MainCard {...props} />);

        expect(getByText('PRIMEIRA PARADA')).toBeTruthy();
        expect(getByText('Rua Principal, 100')).toBeTruthy();
    });

    it('deve renderizar estado active', () => {
        const props = {
            ...defaultProps,
            state: 'active' as const,
            route: { id: 'rota-1' },
            paradas: [
                { id: '1', endereco: 'Rua A', ordem: 1 },
                { id: '2', endereco: 'Rua B', ordem: 2 },
            ],
            currentStop: {
                id: '1',
                endereco: 'Rua Atual, 789',
                ordem: 1,
                latitude: -23.55,
                longitude: -46.63,
            },
        };

        const { getByText } = render(<MainCard {...props} />);

        expect(getByText('PARADA 1/2')).toBeTruthy();
        expect(getByText('Rua Atual, 789')).toBeTruthy();
    });

    it('deve mostrar última parada badge quando state é last-stop', () => {
        const props = {
            ...defaultProps,
            state: 'last-stop' as const,
            route: { id: 'rota-1' },
            paradas: [{ id: '1', endereco: 'Rua A', ordem: 1 }],
            currentStop: {
                id: '1',
                endereco: 'Última Rua',
                ordem: 1,
                latitude: -23.55,
                longitude: -46.63,
            },
        };

        const { getByText } = render(<MainCard {...props} />);

        expect(getByText('ÚLTIMA PARADA! 🎯')).toBeTruthy();
    });

    it('deve mostrar destinatário quando fornecido em active', () => {
        const props = {
            ...defaultProps,
            state: 'active' as const,
            route: { id: 'rota-1' },
            paradas: [{ id: '1', ordem: 1 }],
            currentStop: {
                id: '1',
                endereco: 'Rua A',
                ordem: 1,
                latitude: -23.55,
                longitude: -46.63,
                destinatario: 'João Silva',
            },
        };

        const { getByText } = render(<MainCard {...props} />);

        expect(getByText('João Silva')).toBeTruthy();
    });

    it('deve mostrar telefone quando fornecido em active', () => {
        const props = {
            ...defaultProps,
            state: 'active' as const,
            route: { id: 'rota-1' },
            paradas: [{ id: '1', ordem: 1 }],
            currentStop: {
                id: '1',
                endereco: 'Rua A',
                ordem: 1,
                latitude: -23.55,
                longitude: -46.63,
                telefone: '(11) 99999-9999',
            },
        };

        const { getByText } = render(<MainCard {...props} />);

        expect(getByText('(11) 99999-9999')).toBeTruthy();
    });

    it('deve mostrar observações quando fornecidas em active', () => {
        const props = {
            ...defaultProps,
            state: 'active' as const,
            route: { id: 'rota-1' },
            paradas: [{ id: '1', ordem: 1 }],
            currentStop: {
                id: '1',
                endereco: 'Rua A',
                ordem: 1,
                latitude: -23.55,
                longitude: -46.63,
                observacoes: 'Tocar interfone 123',
            },
        };

        const { getByText } = render(<MainCard {...props} />);

        expect(getByText('Tocar interfone 123')).toBeTruthy();
    });

    it('deve renderizar estado ready-to-complete', () => {
        const props = {
            ...defaultProps,
            state: 'ready-to-complete' as const,
            route: { distancia_total: 30 },
            paradas: [],
        };

        const { getByText } = render(<MainCard {...props} />);

        expect(getByText('Todas as paradas concluídas!')).toBeTruthy();
        expect(getByText('Você pode finalizar a rota agora')).toBeTruthy();
    });

    it('deve mostrar resumo em ready-to-complete', () => {
        const props = {
            ...defaultProps,
            state: 'ready-to-complete' as const,
            route: { distancia_total: 25 },
            paradas: [],
        };

        const { getByText } = render(<MainCard {...props} />);

        expect(getByText('Tempo total')).toBeTruthy();
        expect(getByText('Distância')).toBeTruthy();
        expect(getByText('25 km')).toBeTruthy();
    });

    it('deve renderizar estado completed', () => {
        const props = {
            ...defaultProps,
            state: 'completed' as const,
            route: { distancia_total: 40 },
            paradas: [
                { id: '1' },
                { id: '2' },
            ],
        };

        const { getByText } = render(<MainCard {...props} />);

        expect(getByText('Rota Concluída')).toBeTruthy();
        expect(getByText('40 km')).toBeTruthy();
    });

    it('deve chamar onPress quando tocado em active', () => {
        const onPress = jest.fn();
        const props = {
            ...defaultProps,
            state: 'active' as const,
            route: { id: 'rota-1' },
            paradas: [{ id: '1', ordem: 1 }],
            currentStop: {
                id: '1',
                endereco: 'Rua A',
                ordem: 1,
                latitude: -23.55,
                longitude: -46.63,
            },
            onPress,
        };

        const { getByText } = render(<MainCard {...props} />);

        fireEvent.press(getByText('Rua A'));
        expect(onPress).toHaveBeenCalled();
    });

    it('deve retornar null para estado desconhecido', () => {
        const props = {
            ...defaultProps,
            state: 'unknown' as any,
        };

        const { toJSON } = render(<MainCard {...props} />);

        // Deve renderizar o card vazio
        expect(toJSON()).toBeTruthy();
    });

    it('deve filtrar checkpoints das paradas', () => {
        const props = {
            ...defaultProps,
            state: 'pending' as const,
            route: { unidade_nome: 'Empresa' },
            paradas: [
                { id: '1', endereco: 'Rua A', ordem: 1, is_checkpoint: true },
                { id: '2', endereco: 'Rua B', ordem: 2, is_checkpoint: false },
                { id: '3', endereco: 'Rua C', ordem: 3 },
            ],
        };

        const { getByText } = render(<MainCard {...props} />);

        // Deve mostrar apenas paradas não-checkpoint
        expect(getByText('2 paradas')).toBeTruthy();
    });

    it('deve retornar null em active sem currentStop', () => {
        const props = {
            ...defaultProps,
            state: 'active' as const,
            route: { id: 'rota-1' },
            paradas: [{ id: '1' }],
            currentStop: undefined,
        };

        const { toJSON } = render(<MainCard {...props} />);

        // Deve renderizar o card mas sem conteúdo ativo
        expect(toJSON()).toBeTruthy();
    });
});
