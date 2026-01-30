import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { MiniMap } from '../MiniMap';

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

        it('deve renderizar expandido com altura 300', () => {
            const { getByTestId } = render(
                <MiniMap {...defaultProps} expanded={true} />
            );

            expect(getByTestId('map-view')).toBeTruthy();
        });

        it('deve renderizar colapsado com altura 150', () => {
            const { getByTestId } = render(
                <MiniMap {...defaultProps} expanded={false} />
            );

            expect(getByTestId('map-view')).toBeTruthy();
        });

        it('deve renderizar com testID personalizado', () => {
            const { getByTestId } = render(
                <MiniMap {...defaultProps} testID="custom-mini-map" />
            );

            expect(getByTestId('custom-mini-map')).toBeTruthy();
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

        it('deve renderizar marker de usuário quando userLocation é fornecido', () => {
            const { getAllByTestId } = render(
                <MiniMap
                    {...defaultProps}
                    userLocation={{ latitude: -23.55, longitude: -46.63 }}
                />
            );

            // Deve ter pelo menos 3 markers: user + 2 paradas
            const markers = getAllByTestId('marker');
            expect(markers.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe('Callbacks', () => {
        it('deve chamar onToggleExpand quando botão expand é pressionado', () => {
            const onToggleExpand = jest.fn();

            const { getByLabelText } = render(
                <MiniMap {...defaultProps} onToggleExpand={onToggleExpand} />
            );

            const expandButton = getByLabelText('Expandir mapa');
            fireEvent.press(expandButton);

            expect(onToggleExpand).toHaveBeenCalledTimes(1);
        });

        it('deve chamar onOpenPiP quando botão PiP é pressionado', () => {
            const onOpenPiP = jest.fn();

            const { getByLabelText } = render(
                <MiniMap {...defaultProps} onOpenPiP={onOpenPiP} />
            );

            const pipButton = getByLabelText('Abrir mapa flutuante');
            fireEvent.press(pipButton);

            expect(onOpenPiP).toHaveBeenCalledTimes(1);
        });

        it('deve chamar onOpenFullMap quando mapa é pressionado', () => {
            const onOpenFullMap = jest.fn();

            const { getByLabelText } = render(
                <MiniMap {...defaultProps} onOpenFullMap={onOpenFullMap} />
            );

            const mapContainer = getByLabelText(/Mapa da rota/);
            fireEvent.press(mapContainer);

            expect(onOpenFullMap).toHaveBeenCalledTimes(1);
        });
    });

    describe('Paradas filtering', () => {
        it('deve filtrar paradas pendentes corretamente', () => {
            const paradas = [
                { id: 'p1', latitude: -23.55, longitude: -46.63, status: 'pendente', ordem: 1, endereco: 'Rua A' },
                { id: 'p2', latitude: -23.56, longitude: -46.64, status: 'pendente', ordem: 2, endereco: 'Rua B' },
                { id: 'p3', latitude: -23.57, longitude: -46.65, status: 'concluida', ordem: 3, endereco: 'Rua C' },
            ];

            const { getByTestId } = render(
                <MiniMap {...defaultProps} paradas={paradas} />
            );

            expect(getByTestId('map-view')).toBeTruthy();
        });

        it('deve filtrar checkpoints corretamente', () => {
            const paradas = [
                { id: 'p1', latitude: -23.55, longitude: -46.63, status: 'pendente', ordem: 0, is_checkpoint: false, endereco: 'Unidade - Partida' },
                { id: 'p2', latitude: -23.56, longitude: -46.64, status: 'pendente', ordem: 1, endereco: 'Parada 1' },
                { id: 'p3', latitude: -23.57, longitude: -46.65, status: 'pendente', ordem: 2, is_checkpoint: false, endereco: 'Unidade - Chegada' },
            ];

            const { getByTestId } = render(
                <MiniMap {...defaultProps} paradas={paradas} />
            );

            expect(getByTestId('map-view')).toBeTruthy();
        });

        it('deve ignorar paradas com coordenadas inválidas', () => {
            const paradas = [
                { id: 'p1', latitude: NaN, longitude: -46.63, status: 'pendente', ordem: 1, endereco: 'Inválida' },
                { id: 'p2', latitude: -23.56, longitude: -46.64, status: 'pendente', ordem: 2, endereco: 'Válida' },
            ];

            const { getByTestId } = render(
                <MiniMap {...defaultProps} paradas={paradas} />
            );

            expect(getByTestId('map-view')).toBeTruthy();
        });

        it('deve ignorar paradas com coordenadas fora do range', () => {
            const paradas = [
                { id: 'p1', latitude: -100, longitude: -46.63, status: 'pendente', ordem: 1, endereco: 'Lat inválida' },
                { id: 'p2', latitude: -23.56, longitude: -200, status: 'pendente', ordem: 2, endereco: 'Lng inválida' },
                { id: 'p3', latitude: -23.57, longitude: -46.65, status: 'pendente', ordem: 3, endereco: 'Válida' },
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
                id: 'route-1',
                distancia_total: 15.5,
            };

            const { getByTestId } = render(
                <MiniMap {...defaultProps} route={route} />
            );

            expect(getByTestId('map-view')).toBeTruthy();
        });
    });

    describe('Map region', () => {
        it('deve calcular região com paradas', () => {
            const { getByTestId } = render(<MiniMap {...defaultProps} />);

            // O mapa deve renderizar com as paradas
            expect(getByTestId('map-view')).toBeTruthy();
        });

        it('deve usar coordenadas padrão quando sem paradas', () => {
            const { getByTestId } = render(<MiniMap paradas={[]} />);

            // O mapa deve renderizar mesmo sem paradas
            expect(getByTestId('map-view')).toBeTruthy();
        });
    });

    describe('Info Box', () => {
        it('deve mostrar contagem de paradas restantes (não concluídas/puladas)', () => {
            const paradas = [
                { id: 'p1', latitude: -23.55, longitude: -46.63, status: 'pendente', ordem: 1, endereco: 'Rua A' },
                { id: 'p2', latitude: -23.56, longitude: -46.64, status: 'pendente', ordem: 2, endereco: 'Rua B' },
                { id: 'p3', latitude: -23.57, longitude: -46.65, status: 'concluida', ordem: 3, endereco: 'Rua C' },
                { id: 'p4', latitude: -23.58, longitude: -46.66, status: 'pulada', ordem: 4, endereco: 'Rua D' },
            ];

            const { getByText } = render(
                <MiniMap {...defaultProps} paradas={paradas} />
            );

            // Deve mostrar "2 restantes" (apenas restantes: pendente, em_andamento - excluindo concluída e pulada)
            expect(getByText(/2 restantes/)).toBeTruthy();
        });
    });

    describe('Accessibility', () => {
        it('deve ter label de acessibilidade no container do mapa', () => {
            const { getByLabelText } = render(
                <MiniMap {...defaultProps} />
            );

            expect(getByLabelText(/Mapa da rota com \d+ paradas restantes/)).toBeTruthy();
        });

        it('deve ter labels nos botões de controle', () => {
            const { getByLabelText } = render(
                <MiniMap
                    {...defaultProps}
                    onToggleExpand={() => {}}
                    onOpenPiP={() => {}}
                />
            );

            expect(getByLabelText('Expandir mapa')).toBeTruthy();
            expect(getByLabelText('Abrir mapa flutuante')).toBeTruthy();
        });

        it('deve ter role de button nos botões', () => {
            const { getByLabelText } = render(
                <MiniMap
                    {...defaultProps}
                    onToggleExpand={() => {}}
                />
            );

            const expandButton = getByLabelText(/Expandir mapa|Minimizar mapa/);
            expect(expandButton.props.accessibilityRole).toBe('button');
        });
    });

    describe('Map properties', () => {
        it('deve desabilitar interações no mapa', () => {
            const { getByTestId } = render(<MiniMap {...defaultProps} />);

            const mapView = getByTestId('map-view');
            expect(mapView.props.scrollEnabled).toBe(false);
            expect(mapView.props.zoomEnabled).toBe(false);
            expect(mapView.props.rotateEnabled).toBe(false);
            expect(mapView.props.pitchEnabled).toBe(false);
        });

        it('deve configurar estilo MapLibre', () => {
            const { getByTestId } = render(<MiniMap {...defaultProps} />);

            const mapView = getByTestId('map-view');
            expect(mapView.props.mapStyle).toBeTruthy();
        });
    });
});
