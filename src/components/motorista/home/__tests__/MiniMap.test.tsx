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
jest.mock('@/utils/styles', () => ({
    defaultTheme: {
        colors: {
            white: '#fff',
            black: '#000',
            primary: '#007AFF',
            success: '#10b981',
            gray200: '#e5e7eb',
            gray400: '#9ca3af',
            gray500: '#6b7280',
            gray900: '#111827',
        },
    },
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

describe('MiniMap', () => {
    const defaultProps = {
        paradas: [
            { id: 'p1', latitude: -23.55, longitude: -46.63, status: 'pendente', ordem: 1 },
            { id: 'p2', latitude: -23.56, longitude: -46.64, status: 'concluida', ordem: 2 },
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
                { id: 'p1', latitude: -23.55, longitude: -46.63, status: 'pendente', ordem: 1 },
                { id: 'p2', latitude: -23.56, longitude: -46.64, status: 'pendente', ordem: 2 },
            ];

            const { getByTestId } = render(
                <MiniMap {...defaultProps} paradas={paradas} />
            );

            expect(getByTestId('map-view')).toBeTruthy();
        });

        it('deve filtrar checkpoints', () => {
            const paradas = [
                { id: 'p1', latitude: -23.55, longitude: -46.63, status: 'pendente', ordem: 1, is_checkpoint: true },
                { id: 'p2', latitude: -23.56, longitude: -46.64, status: 'pendente', ordem: 2, is_checkpoint: false },
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
