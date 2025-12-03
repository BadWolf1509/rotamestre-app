import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { Sidebar } from '../Sidebar';

// Mock expo-router
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace,
    }),
    usePathname: () => '/gestor/inicio',
}));

// Mock auth service
jest.mock('@/lib/auth', () => ({
    authService: {
        signOut: jest.fn().mockResolvedValue(undefined),
    },
}));

// Mock ConfirmDialog
jest.mock('@/components/ConfirmDialog', () => ({
    ConfirmDialog: ({ visible, onConfirm, onCancel }: any) => {
        if (!visible) return null;
        const { View, TouchableOpacity, Text } = require('react-native');
        return (
            <View testID="confirm-dialog">
                <TouchableOpacity testID="confirm-btn" onPress={onConfirm}>
                    <Text>Confirmar</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="cancel-btn" onPress={onCancel}>
                    <Text>Cancelar</Text>
                </TouchableOpacity>
            </View>
        );
    },
}));

// Mock styles with useUnistyles
jest.mock('@/utils/styles', () => {
    const mockTheme = {
        colors: {
            white: '#fff',
            gray200: '#e5e7eb',
            gray500: '#6b7280',
            gray700: '#374151',
            primary: '#007AFF',
            secondary: '#f7a02a',
        },
        spacing: { sm: 8, md: 12, lg: 16, '2xl': 24 },
        typography: { xs: 12, sm: 14, fontSansMedium: 'System', fontSansSemiBold: 'System' },
        borderRadius: { lg: 12 },
        layout: { sidebarWidth: 280 },
    };
    return {
        useUnistyles: () => ({ theme: mockTheme }),
        StyleSheet: {
            create: (fn: any) => {
                return typeof fn === 'function' ? fn(mockTheme) : fn;
            },
        },
    };
});

describe('Sidebar', () => {
    const defaultProps = {
        onNavigate: jest.fn(),
        userData: {
            id: 'user-1',
            nome: 'Admin User',
            papel: 'gestor',
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('deve renderizar o logo', () => {
            const { toJSON } = render(<Sidebar {...defaultProps} />);

            expect(toJSON()).toBeTruthy();
        });

        it('deve renderizar Painel do Gestor', () => {
            const { getByText } = render(<Sidebar {...defaultProps} />);

            expect(getByText('Painel do Gestor')).toBeTruthy();
        });

        it('deve renderizar itens de navegação', () => {
            const { getByText } = render(<Sidebar {...defaultProps} />);

            expect(getByText('Início')).toBeTruthy();
            expect(getByText('Nova Rota')).toBeTruthy();
            expect(getByText('Gestão de Rotas')).toBeTruthy();
            expect(getByText('Incidentes')).toBeTruthy();
            expect(getByText('Motoristas')).toBeTruthy();
        });

        it('deve mostrar itens exclusivos de gestor', () => {
            const { getByText } = render(<Sidebar {...defaultProps} />);

            expect(getByText('Minha Unidade')).toBeTruthy();
            expect(getByText('Equipe')).toBeTruthy();
        });

        it('não deve mostrar itens exclusivos de gestor para motorista', () => {
            const props = {
                ...defaultProps,
                userData: { ...defaultProps.userData, papel: 'motorista' },
            };

            const { queryByText } = render(<Sidebar {...props} />);

            expect(queryByText('Minha Unidade')).toBeNull();
        });
    });

    describe('Navigation', () => {
        it('deve navegar para Início ao clicar', () => {
            const { getByText } = render(<Sidebar {...defaultProps} />);

            fireEvent.press(getByText('Início'));

            expect(mockPush).toHaveBeenCalledWith('/gestor/inicio');
            expect(defaultProps.onNavigate).toHaveBeenCalled();
        });

        it('deve navegar para Nova Rota ao clicar', () => {
            const { getByText } = render(<Sidebar {...defaultProps} />);

            fireEvent.press(getByText('Nova Rota'));

            expect(mockPush).toHaveBeenCalledWith('/gestor/nova-entrega');
        });

        it('deve navegar para Gestão de Rotas ao clicar', () => {
            const { getByText } = render(<Sidebar {...defaultProps} />);

            fireEvent.press(getByText('Gestão de Rotas'));

            expect(mockPush).toHaveBeenCalledWith('/gestor/gestao-rotas');
        });

        it('deve navegar para Incidentes ao clicar', () => {
            const { getByText } = render(<Sidebar {...defaultProps} />);

            fireEvent.press(getByText('Incidentes'));

            expect(mockPush).toHaveBeenCalledWith('/gestor/incidentes');
        });

        it('deve navegar para Motoristas ao clicar', () => {
            const { getByText } = render(<Sidebar {...defaultProps} />);

            fireEvent.press(getByText('Motoristas'));

            expect(mockPush).toHaveBeenCalledWith('/gestor/motoristas');
        });

        it('deve navegar para Minha Unidade ao clicar', () => {
            const { getByText } = render(<Sidebar {...defaultProps} />);

            fireEvent.press(getByText('Minha Unidade'));

            expect(mockPush).toHaveBeenCalledWith('/unidade');
        });

        it('deve navegar para Equipe ao clicar', () => {
            const { getByText } = render(<Sidebar {...defaultProps} />);

            fireEvent.press(getByText('Equipe'));

            expect(mockPush).toHaveBeenCalledWith('/unidade/equipe');
        });
    });

    describe('Icons', () => {
        it('deve mostrar Ionicons nos itens de navegação', () => {
            const { UNSAFE_getAllByType } = render(<Sidebar {...defaultProps} />);
            const { Ionicons } = require('@expo/vector-icons');

            // Sidebar agora usa Ionicons ao invés de emojis
            const icons = UNSAFE_getAllByType(Ionicons);
            expect(icons.length).toBeGreaterThan(0);
        });
    });

    describe('onNavigate callback', () => {
        it('deve chamar onNavigate quando item é clicado', () => {
            const onNavigate = jest.fn();

            const { getByText } = render(
                <Sidebar {...defaultProps} onNavigate={onNavigate} />
            );

            fireEvent.press(getByText('Início'));

            expect(onNavigate).toHaveBeenCalled();
        });

        it('não deve quebrar quando onNavigate não é fornecido', () => {
            const { getByText } = render(
                <Sidebar userData={defaultProps.userData} />
            );

            fireEvent.press(getByText('Início'));

            expect(mockPush).toHaveBeenCalledWith('/gestor/inicio');
        });
    });

    describe('userData handling', () => {
        it('não deve quebrar quando userData é undefined', () => {
            const { getByText } = render(<Sidebar />);

            expect(getByText('Início')).toBeTruthy();
        });

        it('deve filtrar itens baseado no papel do usuário', () => {
            const props = {
                ...defaultProps,
                userData: { papel: 'admin' },
            };

            const { queryByText } = render(<Sidebar {...props} />);

            // Admin não vê itens exclusivos de gestor
            expect(queryByText('Minha Unidade')).toBeNull();
        });
    });
});
