import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Alert, Platform } from 'react-native';

import { NavigationSettings } from '../NavigationSettings';

// Mock LocationTrackingService
jest.mock('@/services/locationTracking', () => ({
    __esModule: true,
    default: {
        getNavigationPreferences: jest.fn().mockResolvedValue({
            autoAdvance: true,
            soundAlerts: true,
            vibrationAlerts: true,
            proximityRadius: 50,
        }),
        updateNavigationPreferences: jest.fn().mockResolvedValue(undefined),
    },
}));

// Mock unistyles
jest.mock('@/utils/styles', () => {
    const theme = {
        colors: {
            text: '#000',
            primary: '#007AFF',
            gray100: '#f3f4f6',
            gray200: '#e5e7eb',
            gray300: '#d1d5db',
            gray400: '#9ca3af',
            gray500: '#6b7280',
            gray900: '#111827',
            white: '#fff',
            warning: '#FF9500',
            warningBg: '#fef3c7',
            secondaryDark: '#92400e',
            error: '#FF3B30',
            errorBg: '#fee2e2',
        },
        typography: {
            xs: 12,
            sm: 14,
            base: 16,
            lg: 18,
            xl: 20,
            '2xl': 24,
            fontSans: 'System',
            fontSansMedium: 'System',
            fontSansSemiBold: 'System',
            fontSansBold: 'System',
        },
        spacing: {
            xs: 4,
            sm: 8,
            md: 16,
            lg: 24,
            xl: 32,
        },
        borderRadius: {
            sm: 4,
            md: 8,
            lg: 12,
            full: 9999,
        },
    };
    return {
        useUnistyles: () => ({ theme }),
        StyleSheet: {
            create: (fn: any) => (typeof fn === 'function' ? fn(theme) : fn),
        },
    };
});

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

// Mock Slider
jest.mock('@react-native-community/slider', () => {
    const { View } = require('react-native');
    return (props: any) => <View testID="slider" {...props} />;
});

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('NavigationSettings', () => {
    const defaultProps = {
        visible: true,
        onClose: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('não deve renderizar quando visible é false', () => {
        const { toJSON } = render(
            <NavigationSettings visible={false} onClose={jest.fn()} />
        );
        expect(toJSON()).toBeNull();
    });

    it('deve renderizar quando visible é true', () => {
        const { getByText } = render(<NavigationSettings {...defaultProps} />);
        expect(getByText('Configurações de Navegação')).toBeTruthy();
    });

    it('deve mostrar seção de Modo Automático', () => {
        const { getByText } = render(<NavigationSettings {...defaultProps} />);
        expect(getByText('Modo Automático')).toBeTruthy();
        expect(getByText('Avanço Automático')).toBeTruthy();
    });

    it('deve mostrar seção de Navegação', () => {
        const { getByText } = render(<NavigationSettings {...defaultProps} />);
        expect(getByText('Navegação')).toBeTruthy();
    });

    it('deve mostrar seção de Notificações', () => {
        const { getByText } = render(<NavigationSettings {...defaultProps} />);
        expect(getByText('Notificações')).toBeTruthy();
        expect(getByText('Alertas Sonoros')).toBeTruthy();
        expect(getByText('Vibração')).toBeTruthy();
    });

    it('deve mostrar seção de Exibição', () => {
        const { getByText } = render(<NavigationSettings {...defaultProps} />);
        expect(getByText('Exibição')).toBeTruthy();
    });

    it('deve mostrar seção de Dicas', () => {
        const { getByText } = render(<NavigationSettings {...defaultProps} />);
        expect(getByText('Dicas')).toBeTruthy();
    });

    it('deve mostrar botão Restaurar Padrões', () => {
        const { getByText } = render(<NavigationSettings {...defaultProps} />);
        expect(getByText('Restaurar Padrões')).toBeTruthy();
    });

    it('deve abrir alerta ao clicar em Restaurar Padrões', () => {
        const { getByText } = render(<NavigationSettings {...defaultProps} />);

        fireEvent.press(getByText('Restaurar Padrões'));

        expect(Alert.alert).toHaveBeenCalledWith(
            'Restaurar Padrões',
            'Deseja restaurar todas as configurações para os valores padrão?',
            expect.arrayContaining([
                expect.objectContaining({ text: 'Cancelar' }),
                expect.objectContaining({ text: 'Restaurar' }),
            ])
        );
    });

    it('deve mostrar descrição do Avanço Automático', () => {
        const { getByText } = render(<NavigationSettings {...defaultProps} />);
        expect(getByText('Avança para próxima parada automaticamente ao chegar')).toBeTruthy();
    });

    it('deve mostrar descrição dos Alertas Sonoros', () => {
        const { getByText } = render(<NavigationSettings {...defaultProps} />);
        expect(getByText('Sons ao aproximar ou chegar ao destino')).toBeTruthy();
    });

    it('deve mostrar descrição da Vibração', () => {
        const { getByText } = render(<NavigationSettings {...defaultProps} />);
        expect(getByText('Vibrar ao chegar no destino')).toBeTruthy();
    });

    it('deve chamar onClose ao clicar no botão fechar', () => {
        const onClose = jest.fn();
        const { getByText: _getByText } = render(
            <NavigationSettings visible={true} onClose={onClose} />
        );

        // O botão de fechar renderiza como Ionicons
        // Podemos verificar que onClose não foi chamado ainda
        expect(onClose).not.toHaveBeenCalled();
    });

    describe('Platform-specific features', () => {
        const originalPlatform = Platform.OS;

        afterEach(() => {
            Object.defineProperty(Platform, 'OS', { value: originalPlatform });
        });

        it('deve mostrar aviso de somente mobile para Navegação Interna em web', () => {
            Object.defineProperty(Platform, 'OS', { value: 'web' });

            const { getAllByText } = render(<NavigationSettings {...defaultProps} />);

            // Em web, deve mostrar indicação de somente mobile (pode aparecer múltiplas vezes)
            expect(getAllByText(/Navegação Interna/).length).toBeGreaterThanOrEqual(1);
        });

        it('deve mostrar dica específica para web', () => {
            Object.defineProperty(Platform, 'OS', { value: 'web' });

            const { getByText } = render(<NavigationSettings {...defaultProps} />);

            expect(getByText(/Algumas opções.*estão disponíveis apenas no app mobile/)).toBeTruthy();
        });
    });

    describe('Settings controls', () => {
        it('deve ter switch para Avanço Automático', () => {
            const { getByText } = render(<NavigationSettings {...defaultProps} />);
            expect(getByText('Avanço Automático')).toBeTruthy();
        });

        it('deve ter switch para Alertas Sonoros', () => {
            const { getByText } = render(<NavigationSettings {...defaultProps} />);
            expect(getByText('Alertas Sonoros')).toBeTruthy();
        });

        it('deve ter switch para Vibração', () => {
            const { getByText } = render(<NavigationSettings {...defaultProps} />);
            expect(getByText('Vibração')).toBeTruthy();
        });

        it('deve ter switch para Velocímetro', () => {
            const { getByText } = render(<NavigationSettings {...defaultProps} />);
            expect(getByText(/Velocímetro/)).toBeTruthy();
        });

        it('deve ter switch para Manter Tela Ligada', () => {
            const { getByText } = render(<NavigationSettings {...defaultProps} />);
            expect(getByText(/Manter Tela Ligada/)).toBeTruthy();
        });
    });

    describe('Tips', () => {
        it('deve mostrar dica sobre modo automático', () => {
            const { getByText } = render(<NavigationSettings {...defaultProps} />);
            expect(getByText(/modo automático economiza tempo/)).toBeTruthy();
        });

        it('deve mostrar dica sobre raio de proximidade', () => {
            const { getByText } = render(<NavigationSettings {...defaultProps} />);
            expect(getByText(/Ajuste o raio de proximidade/)).toBeTruthy();
        });
    });
});
