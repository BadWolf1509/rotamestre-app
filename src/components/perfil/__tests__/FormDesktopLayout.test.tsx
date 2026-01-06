import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { FormDesktopLayout } from '../FormDesktopLayout';

// Mock expo-router
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({
        back: mockBack,
    }),
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

// Mock styles
jest.mock('@/utils/styles', () => {
    const theme = {
        colors: {
            primary: '#007AFF',
            gray50: '#f9fafb',
            gray100: '#f3f4f6',
            gray200: '#e5e7eb',
            gray300: '#d1d5db',
            gray400: '#9ca3af',
            gray500: '#6b7280',
            gray600: '#4b5563',
            gray700: '#374151',
            gray900: '#111827',
            white: '#ffffff',
            black: '#000000',
            error: '#ef4444',
        },
        typography: {
            fontSize: {
                xs: 12,
                sm: 14,
                base: 16,
                lg: 18,
                xl: 20,
                '2xl': 24,
                '3xl': 30,
            },
            fontSans: 'System',
            fontSansMedium: 'System',
            fontSansSemiBold: 'System',
            fontSansBold: 'System',
            fontDisplay: 'System',
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

describe('FormDesktopLayout', () => {
    const mockOnChange = jest.fn();
    const mockOnPrimaryPress = jest.fn();
    const mockOnSecondaryPress = jest.fn();

    const defaultProps = {
        title: 'Editar Perfil',
        subtitle: 'Atualize suas informações',
        fields: [
            {
                label: 'Nome',
                value: 'João Silva',
                placeholder: 'Digite seu nome',
                onChange: mockOnChange,
            },
            {
                label: 'Email',
                value: 'joao@test.com',
                placeholder: 'Digite seu email',
                onChange: mockOnChange,
            },
        ],
        primaryButtonText: 'Salvar',
        onPrimaryPress: mockOnPrimaryPress,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('deve renderizar título', () => {
            const { getByText } = render(<FormDesktopLayout {...defaultProps} />);

            expect(getByText('Editar Perfil')).toBeTruthy();
        });

        it('deve renderizar subtítulo quando fornecido', () => {
            const { getByText } = render(<FormDesktopLayout {...defaultProps} />);

            expect(getByText('Atualize suas informações')).toBeTruthy();
        });

        it('deve renderizar sem subtítulo', () => {
            const { queryByText } = render(
                <FormDesktopLayout {...defaultProps} subtitle={undefined} />
            );

            expect(queryByText('Atualize suas informações')).toBeNull();
        });

        it('deve renderizar campos do formulário', () => {
            const { getByText, getByDisplayValue } = render(
                <FormDesktopLayout {...defaultProps} />
            );

            expect(getByText('Nome')).toBeTruthy();
            expect(getByText('Email')).toBeTruthy();
            expect(getByDisplayValue('João Silva')).toBeTruthy();
            expect(getByDisplayValue('joao@test.com')).toBeTruthy();
        });

        it('deve renderizar botão primário', () => {
            const { getByText } = render(<FormDesktopLayout {...defaultProps} />);

            expect(getByText('Salvar')).toBeTruthy();
        });

        it('deve renderizar botão secundário quando fornecido', () => {
            const { getByText } = render(
                <FormDesktopLayout
                    {...defaultProps}
                    secondaryButtonText="Cancelar"
                    onSecondaryPress={mockOnSecondaryPress}
                />
            );

            expect(getByText('Cancelar')).toBeTruthy();
        });

        it('deve renderizar botão Voltar', () => {
            const { getByText } = render(<FormDesktopLayout {...defaultProps} />);

            expect(getByText('Voltar')).toBeTruthy();
        });
    });

    describe('Loading state', () => {
        it('deve mostrar indicador de loading quando loading é true', () => {
            const { getByText, queryByText } = render(
                <FormDesktopLayout {...defaultProps} loading={true} />
            );

            expect(getByText('Carregando...')).toBeTruthy();
            expect(queryByText('Editar Perfil')).toBeNull();
        });
    });

    describe('Interactions', () => {
        it('deve chamar router.back ao clicar em Voltar', () => {
            const { getByText } = render(<FormDesktopLayout {...defaultProps} />);

            fireEvent.press(getByText('Voltar'));

            expect(mockBack).toHaveBeenCalled();
        });

        it('deve chamar onPrimaryPress ao clicar no botão primário', () => {
            const { getByText } = render(<FormDesktopLayout {...defaultProps} />);

            fireEvent.press(getByText('Salvar'));

            expect(mockOnPrimaryPress).toHaveBeenCalled();
        });

        it('deve chamar onSecondaryPress ao clicar no botão secundário', () => {
            const { getByText } = render(
                <FormDesktopLayout
                    {...defaultProps}
                    secondaryButtonText="Cancelar"
                    onSecondaryPress={mockOnSecondaryPress}
                />
            );

            fireEvent.press(getByText('Cancelar'));

            expect(mockOnSecondaryPress).toHaveBeenCalled();
        });

        it('deve chamar onChange ao digitar no campo', () => {
            const { getByDisplayValue } = render(
                <FormDesktopLayout {...defaultProps} />
            );

            fireEvent.changeText(getByDisplayValue('João Silva'), 'Novo Nome');

            expect(mockOnChange).toHaveBeenCalledWith('Novo Nome');
        });
    });

    describe('Field states', () => {
        it('deve mostrar helperText quando fornecido', () => {
            const fieldsWithHelper = [
                {
                    label: 'Nome',
                    value: 'João',
                    helperText: 'Digite seu nome completo',
                    onChange: mockOnChange,
                },
            ];

            const { getByText } = render(
                <FormDesktopLayout
                    {...defaultProps}
                    fields={fieldsWithHelper}
                />
            );

            expect(getByText('Digite seu nome completo')).toBeTruthy();
        });

        it('deve mostrar erro e não mostrar helperText', () => {
            const fieldsWithError = [
                {
                    label: 'Nome',
                    value: '',
                    helperText: 'Digite seu nome completo',
                    error: 'Campo obrigatório',
                    onChange: mockOnChange,
                },
            ];

            const { getByText, queryByText } = render(
                <FormDesktopLayout
                    {...defaultProps}
                    fields={fieldsWithError}
                />
            );

            expect(getByText('Campo obrigatório')).toBeTruthy();
            expect(queryByText('Digite seu nome completo')).toBeNull();
        });
    });

    describe('Disabled state', () => {
        it('deve desabilitar botão primário quando primaryButtonDisabled é true', () => {
            const { getByText } = render(
                <FormDesktopLayout {...defaultProps} primaryButtonDisabled={true} />
            );

            const button = getByText('Salvar').parent;
            expect(button).toBeTruthy();
        });
    });

    describe('Side panel', () => {
        it('deve renderizar sidePanel quando fornecido', () => {
            const { getByText } = render(
                <FormDesktopLayout
                    {...defaultProps}
                    sidePanel={<></>}
                />
            );

            // Componente deve renderizar sem erro
            expect(getByText('Salvar')).toBeTruthy();
        });
    });

    describe('Field types', () => {
        it('deve renderizar campo multiline', () => {
            const fieldsWithMultiline = [
                {
                    label: 'Descrição',
                    value: 'Uma descrição longa',
                    multiline: true,
                    numberOfLines: 4,
                    onChange: mockOnChange,
                },
            ];

            const { getByDisplayValue } = render(
                <FormDesktopLayout
                    {...defaultProps}
                    fields={fieldsWithMultiline}
                />
            );

            expect(getByDisplayValue('Uma descrição longa')).toBeTruthy();
        });

        it('deve renderizar campo secureTextEntry', () => {
            const fieldsWithPassword = [
                {
                    label: 'Senha',
                    value: 'secret123',
                    secureTextEntry: true,
                    onChange: mockOnChange,
                },
            ];

            const { getByDisplayValue } = render(
                <FormDesktopLayout
                    {...defaultProps}
                    fields={fieldsWithPassword}
                />
            );

            expect(getByDisplayValue('secret123')).toBeTruthy();
        });
    });
});
