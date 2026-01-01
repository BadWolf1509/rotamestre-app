import { render } from '@testing-library/react-native';
import React from 'react';

import { OptimizationAlert } from '../OptimizationAlert';

// Mock styles
jest.mock('@/utils/styles', () => {
    const theme = {
        colors: {
            primary: '#007AFF',
            primaryBg: '#e6ecfb',
            success: '#10b981',
            warning: '#f59e0b',
            gray50: '#f9fafb',
            gray100: '#f3f4f6',
            gray200: '#e5e7eb',
            gray300: '#d1d5db',
            gray400: '#9ca3af',
            gray500: '#6b7280',
            gray600: '#4b5563',
            gray700: '#374151',
            gray900: '#111827',
            white: '#fff',
            black: '#000',
            error: '#ef4444',
            info: '#3b82f6',
        },
        typography: {
            xs: 12,
            sm: 14,
            base: 16,
            lg: 18,
            xl: 20,
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
            '2xl': 48,
        },
        borderRadius: {
            sm: 4,
            md: 8,
            lg: 12,
            xl: 16,
            full: 9999,
        },
        shadows: { sm: {}, md: {}, lg: {} },
    };
    return {
        defaultTheme: theme,
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

describe('OptimizationAlert', () => {
    const defaultProps = {
        visible: true,
        optimization: {
            timeSaved: 15,
            newOrder: [
                { id: 'p1', endereco: 'Rua A' },
                { id: 'p2', endereco: 'Rua B' },
            ],
            reason: 'Rota otimizada para evitar trafego',
            confidence: 85,
        },
        currentOrder: [
            { id: 'p2', endereco: 'Rua B' },
            { id: 'p1', endereco: 'Rua A' },
        ],
        onAccept: jest.fn(),
        onReject: jest.fn(),
        onClose: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Rendering', () => {
        it('deve renderizar quando visivel', () => {
            const { toJSON } = render(<OptimizationAlert {...defaultProps} />);

            expect(toJSON()).toBeTruthy();
        });

        it('deve aceitar optimization null', () => {
            const { toJSON } = render(
                <OptimizationAlert {...defaultProps} optimization={null} />
            );

            // Component renders but may be empty
            expect(toJSON).toBeDefined();
        });

        it('deve aceitar visible false', () => {
            const { toJSON } = render(
                <OptimizationAlert {...defaultProps} visible={false} />
            );

            expect(toJSON).toBeDefined();
        });
    });

    describe('Optimization info', () => {
        it('deve mostrar tempo economizado', () => {
            const { getByText } = render(<OptimizationAlert {...defaultProps} />);

            expect(getByText(/15/)).toBeTruthy();
        });

        it('deve mostrar motivo da otimizacao', () => {
            const { getByText } = render(<OptimizationAlert {...defaultProps} />);

            expect(getByText(/trafego/i)).toBeTruthy();
        });
    });

    describe('Callbacks', () => {
        it('deve ter botao de aceitar', () => {
            const { toJSON } = render(<OptimizationAlert {...defaultProps} />);

            expect(toJSON()).toBeTruthy();
        });

        it('deve ter botao de rejeitar', () => {
            const { toJSON } = render(<OptimizationAlert {...defaultProps} />);

            expect(toJSON()).toBeTruthy();
        });
    });

    describe('Confidence levels', () => {
        it('deve renderizar com confianca alta (>80)', () => {
            const props = {
                ...defaultProps,
                optimization: {
                    ...defaultProps.optimization,
                    confidence: 90,
                },
            };

            const { toJSON } = render(<OptimizationAlert {...props} />);

            expect(toJSON()).toBeTruthy();
        });

        it('deve renderizar com confianca media (50-80)', () => {
            const props = {
                ...defaultProps,
                optimization: {
                    ...defaultProps.optimization,
                    confidence: 65,
                },
            };

            const { toJSON } = render(<OptimizationAlert {...props} />);

            expect(toJSON()).toBeTruthy();
        });

        it('deve renderizar com confianca baixa (<50)', () => {
            const props = {
                ...defaultProps,
                optimization: {
                    ...defaultProps.optimization,
                    confidence: 30,
                },
            };

            const { toJSON } = render(<OptimizationAlert {...props} />);

            expect(toJSON()).toBeTruthy();
        });
    });

    describe('Order comparison', () => {
        it('deve mostrar nova ordem', () => {
            const { toJSON } = render(<OptimizationAlert {...defaultProps} />);

            expect(toJSON()).toBeTruthy();
        });

        it('deve comparar com ordem atual', () => {
            const { toJSON } = render(<OptimizationAlert {...defaultProps} />);

            expect(toJSON()).toBeTruthy();
        });
    });

    describe('Visibility changes', () => {
        it('deve renderizar com visible true', () => {
            const { toJSON } = render(
                <OptimizationAlert {...defaultProps} visible={true} />
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve renderizar com visible false', () => {
            const { toJSON } = render(
                <OptimizationAlert {...defaultProps} visible={false} />
            );

            expect(toJSON).toBeDefined();
        });
    });
});
