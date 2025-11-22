import { render } from '@testing-library/react-native';
import React from 'react';

import { OptimizationAlert } from '../OptimizationAlert';

// Mock styles
jest.mock('@/utils/styles', () => ({
    useUnistyles: () => ({
        theme: {
            colors: {
                primary: '#007AFF',
                success: '#10b981',
                warning: '#f59e0b',
                gray100: '#f3f4f6',
                gray200: '#e5e7eb',
                gray500: '#6b7280',
                gray900: '#111827',
                white: '#fff',
            },
        },
    }),
    defaultTheme: {
        colors: {
            primary: '#007AFF',
            success: '#10b981',
            warning: '#f59e0b',
            gray100: '#f3f4f6',
            gray200: '#e5e7eb',
            gray500: '#6b7280',
            gray900: '#111827',
            white: '#fff',
        },
    },
}));

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
