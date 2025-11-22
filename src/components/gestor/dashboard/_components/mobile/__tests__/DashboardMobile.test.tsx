import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { DashboardMobile } from '../DashboardMobile';

// Mock expo-router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

// Mock supabase
jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        order: jest.fn(() => Promise.resolve({ data: [], error: null })),
                    })),
                })),
            })),
        })),
    },
}));

// Mock useToast
jest.mock('@/hooks/useToast', () => ({
    useToast: () => ({
        toast: { visible: false, message: '', type: 'success' },
        hideToast: jest.fn(),
    }),
}));

// Mock styles
jest.mock('@/utils/styles', () => ({
    useUnistyles: () => ({
        theme: {
            colors: {
                primaryDark: '#1e5aa8',
                secondary: '#f59e0b',
                success: '#10b981',
                purple: '#8b5cf6',
                error: '#ef4444',
                gray50: '#f9fafb',
                white: '#fff',
                gray200: '#e5e7eb',
                gray300: '#d1d5db',
                gray500: '#6b7280',
                gray700: '#374151',
                gray900: '#111827',
                primary: '#007AFF',
            },
            spacing: {
                sm: 8,
                md: 12,
                lg: 16,
                xl: 20,
                '2xl': 24,
                '3xl': 32,
            },
            typography: {
                sm: 14,
                base: 16,
                lg: 18,
                '3xl': 30,
                xs: 12,
                fontDisplay: 'System',
                fontSansSemiBold: 'System',
            },
            borderRadius: {
                lg: 12,
            },
        },
    }),
    StyleSheet: {
        create: (fn: any) => {
            const theme = {
                colors: {
                    gray50: '#f9fafb',
                    gray200: '#e5e7eb',
                    gray300: '#d1d5db',
                    gray500: '#6b7280',
                    gray700: '#374151',
                    gray900: '#111827',
                    white: '#fff',
                    primary: '#007AFF',
                },
                spacing: { sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32 },
                typography: { sm: 14, base: 16, lg: 18, '3xl': 30, fontDisplay: 'System', fontSansSemiBold: 'System' },
                borderRadius: { lg: 12 },
            };
            return typeof fn === 'function' ? fn(theme) : fn;
        },
    },
}));

// Mock RouteFilters
jest.mock('@/components/RouteFilters', () => ({
    RouteFilters: () => null,
}));

// Mock Toast
jest.mock('@/components/Toast', () => ({
    Toast: () => null,
}));

// Mock RotaCard
jest.mock('../../shared/RotaCard', () => ({
    RotaCard: ({ rota, onPress }: any) => {
        const { Text, TouchableOpacity } = require('react-native');
        return (
            <TouchableOpacity testID={`rota-card-${rota.id}`} onPress={onPress}>
                <Text>{rota.motorista_nome}</Text>
            </TouchableOpacity>
        );
    },
}));

// Mock StatsCard
jest.mock('../../shared/StatsCard', () => ({
    StatsCard: ({ value, label }: any) => {
        const { Text, View } = require('react-native');
        return (
            <View testID={`stats-${label}`}>
                <Text>{value}</Text>
                <Text>{label}</Text>
            </View>
        );
    },
}));

describe('DashboardMobile', () => {
    const defaultProps = {
        stats: {
            total: 10,
            emAndamento: 3,
            concluidas: 5,
            pendentes: 2,
            distanciaTotal: 150.5,
            incidentesAbertos: 2,
        },
        todayStats: {
            totalHoje: 8,
        },
        rotas: [
            { id: 'rota-1', motorista_nome: 'João Silva', status: 'em_andamento' },
            { id: 'rota-2', motorista_nome: 'Maria Santos', status: 'pendente' },
        ],
        loading: false,
        refreshing: false,
        onRefresh: jest.fn(),
        userData: {
            id: 'user-1',
            nome: 'Admin User',
            unidade_id: 'unidade-1',
            unidades: { nome: 'WJX Locações' },
        },
        filters: {},
        onFiltersChange: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('deve mostrar loading quando loading=true', () => {
            const { getByText } = render(
                <DashboardMobile {...defaultProps} loading={true} />
            );

            expect(getByText('Carregando início...')).toBeTruthy();
        });

        it('deve renderizar header com nome do usuário', () => {
            const { getByText } = render(<DashboardMobile {...defaultProps} />);

            expect(getByText('Olá, Admin User!')).toBeTruthy();
        });

        it('deve renderizar nome da unidade', () => {
            const { getByText } = render(<DashboardMobile {...defaultProps} />);

            expect(getByText('WJX Locações')).toBeTruthy();
        });

        it('deve renderizar stats cards', () => {
            const { getByTestId } = render(<DashboardMobile {...defaultProps} />);

            expect(getByTestId('stats-Total Hoje')).toBeTruthy();
            expect(getByTestId('stats-Em Andamento')).toBeTruthy();
            expect(getByTestId('stats-Concluídas')).toBeTruthy();
            expect(getByTestId('stats-km Total')).toBeTruthy();
        });

        it('deve renderizar rotas cards', () => {
            const { getByTestId } = render(<DashboardMobile {...defaultProps} />);

            expect(getByTestId('rota-card-rota-1')).toBeTruthy();
            expect(getByTestId('rota-card-rota-2')).toBeTruthy();
        });
    });

    describe('Empty state', () => {
        it('deve mostrar empty state quando não há rotas', () => {
            const { getByText } = render(
                <DashboardMobile {...defaultProps} rotas={[]} />
            );

            expect(getByText('Nenhuma rota cadastrada hoje')).toBeTruthy();
            expect(getByText('Crie sua primeira rota de entrega')).toBeTruthy();
        });
    });

    describe('Navigation', () => {
        it('deve navegar para nova entrega ao clicar no botão', () => {
            const { getByText } = render(<DashboardMobile {...defaultProps} />);

            fireEvent.press(getByText('+ Nova Rota de Entrega'));

            expect(mockPush).toHaveBeenCalledWith('/gestor/nova-entrega');
        });

        it('deve navegar para motoristas ao clicar no botão', () => {
            const { getByText } = render(<DashboardMobile {...defaultProps} />);

            fireEvent.press(getByText('👥 Gerenciar Motoristas'));

            expect(mockPush).toHaveBeenCalledWith('/gestor/motoristas');
        });

        it('deve navegar para histórico ao clicar no botão', () => {
            const { getByText } = render(<DashboardMobile {...defaultProps} />);

            fireEvent.press(getByText('📋 Ver Histórico'));

            expect(mockPush).toHaveBeenCalledWith('/gestor/historico');
        });

        it('deve navegar para incidentes ao clicar no stats card', () => {
            const { getByTestId } = render(<DashboardMobile {...defaultProps} />);

            // O card de incidentes é clicável
            fireEvent.press(getByTestId('stats-Incidentes Abertos'));

            expect(mockPush).toHaveBeenCalledWith('/gestor/incidentes');
        });

        it('deve navegar para mapa-rota ao clicar em uma rota', () => {
            const { getByTestId } = render(<DashboardMobile {...defaultProps} />);

            fireEvent.press(getByTestId('rota-card-rota-1'));

            expect(mockPush).toHaveBeenCalledWith('/gestor/mapa-rota?id=rota-1');
        });
    });

    describe('Seções', () => {
        it('deve mostrar seção Ações Rápidas', () => {
            const { getByText } = render(<DashboardMobile {...defaultProps} />);

            expect(getByText('Ações Rápidas')).toBeTruthy();
        });

        it('deve mostrar seção Rotas de Hoje', () => {
            const { getByText } = render(<DashboardMobile {...defaultProps} />);

            expect(getByText('Rotas de Hoje')).toBeTruthy();
        });
    });

    describe('Stats values', () => {
        it('deve mostrar valor total hoje', () => {
            const { getByText } = render(<DashboardMobile {...defaultProps} />);

            expect(getByText('8')).toBeTruthy(); // todayStats.totalHoje
        });

        it('deve mostrar valor em andamento', () => {
            const { getByText } = render(<DashboardMobile {...defaultProps} />);

            expect(getByText('3')).toBeTruthy(); // stats.emAndamento
        });

        it('deve mostrar valor concluídas', () => {
            const { getByText } = render(<DashboardMobile {...defaultProps} />);

            expect(getByText('5')).toBeTruthy(); // stats.concluidas
        });

        it('deve mostrar distância formatada', () => {
            const { getByText } = render(<DashboardMobile {...defaultProps} />);

            expect(getByText('150.5')).toBeTruthy(); // stats.distanciaTotal.toFixed(1)
        });
    });

    describe('ScrollView', () => {
        it('deve ter testID no ScrollView', () => {
            const { getByTestId } = render(<DashboardMobile {...defaultProps} />);

            expect(getByTestId('dashboard-scroll-view')).toBeTruthy();
        });
    });
});
