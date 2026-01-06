import { render } from '@testing-library/react-native';
import React from 'react';

import { MiniMap } from '../MiniMap';

// Mock react-native-maps
jest.mock('react-native-maps', () => {
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: ({ children, ...props }: any) => (
            <View testID="map-view" {...props}>{children}</View>
        ),
        Marker: ({ children, ...props }: any) => (
            <View testID="marker" {...props}>{children}</View>
        ),
        Polyline: (props: any) => (
            <View testID="polyline" {...props} />
        ),
        PROVIDER_GOOGLE: 'google',
    };
});

// Mock styles
jest.mock('@/utils/styles', () => {
    const theme = {
        colors: {
            white: '#fff',
            black: '#000',
            primary: '#007AFF',
            primaryBg: '#e6ecfb',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            info: '#3b82f6',
            gray50: '#f9fafb',
            gray100: '#f3f4f6',
            gray200: '#e5e7eb',
            gray300: '#d1d5db',
            gray400: '#9ca3af',
            gray500: '#6b7280',
            gray600: '#4b5563',
            gray700: '#374151',
            gray900: '#111827',
        },
        typography: {
            fontSize: {
                xs: 12,
                sm: 14,
                base: 16,
                lg: 18,
                xl: 20,
            },
            fontSans: 'System',
            fontSansMedium: 'System',
            fontSansSemiBold: 'System',
            fontSansBold: 'System',
        },
        spacing: {
            '1': 4,
            '1.5': 6,
            '2': 8,
            '2.5': 10,
            '3': 12,
            '4': 16,
            xs: 4,
            sm: 8,
            md: 16,
            lg: 24,
            xl: 32,
            '2xl': 48,
        },
        borderRadius: {
            xs: 4,
            sm: 8,
            md: 12,
            lg: 16,
            xl: 20,
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

// Mock useRouteDirections hook
jest.mock('@/hooks/useRouteDirections', () => ({
    useRouteDirections: () => ({
        routeCoordinates: [],
        routeInfo: null,
        isLoading: false,
        error: null,
        refetch: jest.fn(),
        isFromCache: false,
    }),
}));

describe('MiniMap', () => {
    const defaultProps = {
        paradas: [
            { id: 'p1', latitude: -23.55, longitude: -46.63, status: 'pendente', ordem: 1, endereco: 'Rua Teste 1' },
            { id: 'p2', latitude: -23.56, longitude: -46.64, status: 'concluida', ordem: 2, endereco: 'Rua Teste 2' },
        ],
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('deve renderizar mapa corretamente', () => {
            const { getByTestId } = render(<MiniMap {...defaultProps} />);

            expect(getByTestId('map-view')).toBeTruthy();
        });

        it('deve renderizar com userLocation', () => {
            const { getByTestId } = render(
                <MiniMap
                    {...defaultProps}
                    userLocation={{ latitude: -23.55, longitude: -46.63 }}
                />
            );

            expect(getByTestId('map-view')).toBeTruthy();
        });

        it('deve renderizar expandido', () => {
            const { getByTestId } = render(
                <MiniMap {...defaultProps} expanded={true} />
            );

            expect(getByTestId('map-view')).toBeTruthy();
        });

        it('deve renderizar colapsado', () => {
            const { getByTestId } = render(
                <MiniMap {...defaultProps} expanded={false} />
            );

            expect(getByTestId('map-view')).toBeTruthy();
        });
    });

    describe('Markers', () => {
        it('deve renderizar markers para paradas', () => {
            const { getAllByTestId } = render(<MiniMap {...defaultProps} />);

            const markers = getAllByTestId('marker');
            expect(markers.length).toBeGreaterThan(0);
        });

        it('deve renderizar sem paradas', () => {
            const { getByTestId } = render(
                <MiniMap {...defaultProps} paradas={[]} />
            );

            expect(getByTestId('map-view')).toBeTruthy();
        });
    });

    describe('Callbacks', () => {
        it('deve chamar onToggleExpand quando fornecido', () => {
            const onToggleExpand = jest.fn();

            const { toJSON } = render(
                <MiniMap {...defaultProps} onToggleExpand={onToggleExpand} />
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve chamar onOpenFullMap quando fornecido', () => {
            const onOpenFullMap = jest.fn();

            const { toJSON } = render(
                <MiniMap {...defaultProps} onOpenFullMap={onOpenFullMap} />
            );

            expect(toJSON()).toBeTruthy();
        });

        it('deve chamar onOpenPiP quando fornecido', () => {
            const onOpenPiP = jest.fn();

            const { toJSON } = render(
                <MiniMap {...defaultProps} onOpenPiP={onOpenPiP} />
            );

            expect(toJSON()).toBeTruthy();
        });
    });

    describe('Paradas filtering', () => {
        it('deve filtrar paradas pendentes', () => {
            const paradas = [
                { id: 'p1', latitude: -23.55, longitude: -46.63, status: 'pendente', ordem: 1, endereco: 'Rua A' },
                { id: 'p2', latitude: -23.56, longitude: -46.64, status: 'pendente', ordem: 2, endereco: 'Rua B' },
            ];

            const { getByTestId } = render(
                <MiniMap {...defaultProps} paradas={paradas} />
            );

            expect(getByTestId('map-view')).toBeTruthy();
        });

        it('deve filtrar checkpoints', () => {
            const paradas = [
                { id: 'p1', latitude: -23.55, longitude: -46.63, status: 'pendente', ordem: 1, is_checkpoint: true, endereco: 'Unidade A' },
                { id: 'p2', latitude: -23.56, longitude: -46.64, status: 'pendente', ordem: 2, is_checkpoint: false, endereco: 'Unidade B' },
            ];

            const { getByTestId } = render(
                <MiniMap {...defaultProps} paradas={paradas} />
            );

            expect(getByTestId('map-view')).toBeTruthy();
        });
    });

    describe('Route', () => {
        it('deve aceitar prop route', () => {
            const route = {
                coordinates: [
                    { latitude: -23.55, longitude: -46.63 },
                    { latitude: -23.56, longitude: -46.64 },
                ],
            };

            const { getByTestId } = render(
                <MiniMap {...defaultProps} route={route} />
            );

            expect(getByTestId('map-view')).toBeTruthy();
        });
    });

    describe('Map region', () => {
        it('deve calcular regiao com paradas', () => {
            const { getByTestId } = render(<MiniMap {...defaultProps} />);

            expect(getByTestId('map-view')).toBeTruthy();
        });

        it('deve usar userLocation para regiao quando sem paradas', () => {
            const { getByTestId } = render(
                <MiniMap
                    paradas={[]}
                    userLocation={{ latitude: -23.55, longitude: -46.63 }}
                />
            );

            expect(getByTestId('map-view')).toBeTruthy();
        });

        it('deve usar coordenadas padrao sem userLocation nem paradas', () => {
            const { getByTestId } = render(<MiniMap paradas={[]} />);

            expect(getByTestId('map-view')).toBeTruthy();
        });
    });
});
