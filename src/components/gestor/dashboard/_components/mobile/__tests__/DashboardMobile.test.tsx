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
jest.mock('@/utils/styles', () => {
    const { defaultTheme } = require('@/utils/styles.base');
    const theme = defaultTheme;

    return {
        useUnistyles: () => ({ theme }),
        StyleSheet: {
            create: (fn: any) => (typeof fn === 'function' ? fn(theme) : fn),
        },
        defaultTheme: theme,
    };
});

// Mock RouteFilters
jest.mock('@/components/RouteFilters', () => ({
    RouteFilters: () => null,
}));

// Mock Toast
jest.mock('@/components/Toast', () => ({
    Toast: () => null,
}));

// Mock useMotoristas
jest.mock('@/hooks/useMotoristas', () => ({
    useMotoristas: () => ({
        motoristas: [],
        loading: false,
        error: null,
        refresh: jest.fn(),
    }),
}));

// Mock motivationalMessages
jest.mock('@/utils/motivationalMessages', () => ({
    getGreeting: () => 'Bom dia',
    getMotivationalMessage: () => 'Mensagem motivacional',
}));

// Mock color utils
jest.mock('@/utils/color', () => ({
    withOpacity: (color: string, _opacity: number) => color,
    boxShadow: () => '0px 0px 0px #000',
    dropShadow: () => 'drop-shadow(0px 0px 0px #000)',
    textShadow: () => '0px 0px 0px #000',
}));

// Mock EmptyState
jest.mock('@/components/EmptyState', () => ({
    EmptyState: ({ title, description, actionLabel, onActionPress }: any) => {
        const { Text, TouchableOpacity, View } = require('react-native');
        return (
            <View testID="empty-state">
                <Text>{title}</Text>
                <Text>{description}</Text>
                {actionLabel && onActionPress && (
                    <TouchableOpacity testID="empty-state-action" onPress={onActionPress}>
                        <Text>{actionLabel}</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    },
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
        kpis: {
            rotasMes: 45,
            kmMes: 1250.5,
            tempoMedioMinutos: 135,
            taxaSucesso: 98.5,
            rotasSemana: 12,
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

            // Phase 3: Time-based greeting with first name only + avatar
            expect(getByText(/Bom dia/)).toBeTruthy();
            expect(getByText(/Admin/)).toBeTruthy();
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
            const { getByText, getByTestId } = render(
                <DashboardMobile {...defaultProps} rotas={[]} />
            );

            expect(getByTestId('empty-state')).toBeTruthy();
            expect(getByText('Nenhuma rota cadastrada hoje')).toBeTruthy();
            expect(getByText('Crie sua primeira rota de entrega para começar')).toBeTruthy();
        });

        it('deve ter botão de ação no empty state', () => {
            const { getByTestId, getByText } = render(
                <DashboardMobile {...defaultProps} rotas={[]} />
            );

            expect(getByText('Nova Rota de Entrega')).toBeTruthy();
            fireEvent.press(getByTestId('empty-state-action'));
            expect(mockPush).toHaveBeenCalledWith('/gestor/nova-entrega');
        });
    });

    describe('Navigation', () => {
        it('deve navegar para nova entrega ao clicar no botão', () => {
            const { getByText } = render(<DashboardMobile {...defaultProps} />);

            fireEvent.press(getByText('Nova Rota'));

            expect(mockPush).toHaveBeenCalledWith('/gestor/nova-entrega');
        });

        it('deve navegar para motoristas ao clicar no botão', () => {
            const { getByText } = render(<DashboardMobile {...defaultProps} />);

            fireEvent.press(getByText('Motoristas'));

            expect(mockPush).toHaveBeenCalledWith('/gestor/motoristas');
        });

        it('deve navegar para gestão de rotas ao clicar no botão', () => {
            const { getByText } = render(<DashboardMobile {...defaultProps} />);

            fireEvent.press(getByText('Gestão'));

            expect(mockPush).toHaveBeenCalledWith('/gestor/gestao-rotas');
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

    describe('FlatList', () => {
        it('deve ter testID no FlatList', () => {
            const { getByTestId } = render(<DashboardMobile {...defaultProps} />);

            expect(getByTestId('dashboard-flat-list')).toBeTruthy();
        });
    });
});
