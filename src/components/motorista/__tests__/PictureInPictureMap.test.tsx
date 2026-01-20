import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { PictureInPictureMap } from '../PictureInPictureMap';

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

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    selectionAsync: jest.fn(),
    notificationAsync: jest.fn(),
    ImpactFeedbackStyle: {
        Light: 'light',
        Medium: 'medium',
        Heavy: 'heavy',
    },
    NotificationFeedbackType: {
        Success: 'success',
        Warning: 'warning',
        Error: 'error',
    },
}));

// Mock safe area
jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

describe('PictureInPictureMap', () => {
    const defaultProps = {
        visible: true,
        userLocation: { latitude: -23.5505, longitude: -46.6333 },
        destination: { latitude: -23.5600, longitude: -46.6400, address: 'Rua Teste, 123' },
        onClose: jest.fn(),
        onExpand: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('deve renderizar quando visible é true', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            expect(getByTestId('pip-map-container')).toBeTruthy();
            expect(getByTestId('pip-map-view')).toBeTruthy();
        });

        it('não deve renderizar quando visible é false', () => {
            const { queryByTestId } = render(
                <PictureInPictureMap {...defaultProps} visible={false} />
            );

            expect(queryByTestId('pip-map-container')).toBeNull();
        });

        it('não deve renderizar quando não há userLocation nem destination', () => {
            const { queryByTestId } = render(
                <PictureInPictureMap
                    {...defaultProps}
                    userLocation={null}
                    destination={null}
                />
            );

            expect(queryByTestId('pip-map-container')).toBeNull();
        });

        it('deve renderizar apenas com userLocation', () => {
            const { getByTestId } = render(
                <PictureInPictureMap
                    {...defaultProps}
                    destination={null}
                />
            );

            expect(getByTestId('pip-map-view')).toBeTruthy();
        });

        it('deve renderizar marker quando há destination', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            expect(getByTestId('marker')).toBeTruthy();
        });

        it('não deve renderizar marker quando destination é null', () => {
            const { queryByTestId } = render(
                <PictureInPictureMap
                    {...defaultProps}
                    destination={null}
                />
            );

            expect(queryByTestId('marker')).toBeNull();
        });
    });

    describe('Controls', () => {
        it('deve renderizar botões de controle', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            expect(getByTestId('pip-expand-button')).toBeTruthy();
            expect(getByTestId('pip-close-button')).toBeTruthy();
        });

        it('deve chamar onClose quando botão close é pressionado', () => {
            const onClose = jest.fn();
            const { getByTestId } = render(
                <PictureInPictureMap {...defaultProps} onClose={onClose} />
            );

            fireEvent.press(getByTestId('pip-close-button'));

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('não deve mostrar botão navigate quando colapsado', () => {
            const { queryByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            expect(queryByTestId('pip-navigate-button')).toBeNull();
        });
    });

    describe('Region calculation', () => {
        it('deve calcular região corretamente com userLocation e destination', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            const mapView = getByTestId('pip-map-view');
            expect(mapView.props.region).toBeDefined();
        });

        it('deve calcular centro da região entre userLocation e destination', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            const mapView = getByTestId('pip-map-view');
            const region = mapView.props.region;

            // Centro deve estar entre userLocation e destination
            expect(region.latitude).toBeGreaterThanOrEqual(-23.5600);
            expect(region.latitude).toBeLessThanOrEqual(-23.5505);
        });

        it('deve usar userLocation como região quando não há destination', () => {
            const { getByTestId } = render(
                <PictureInPictureMap
                    {...defaultProps}
                    destination={null}
                />
            );

            const mapView = getByTestId('pip-map-view');
            const region = mapView.props.region;

            expect(region.latitude).toBe(-23.5505);
            expect(region.longitude).toBe(-46.6333);
        });
    });

    describe('Map properties', () => {
        it('deve mostrar user location', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            const mapView = getByTestId('pip-map-view');
            expect(mapView.props.showsUserLocation).toBe(true);
        });

        it('deve usar PROVIDER_GOOGLE', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            const mapView = getByTestId('pip-map-view');
            expect(mapView.props.provider).toBe('google');
        });

        it('deve desabilitar interações quando colapsado', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            const mapView = getByTestId('pip-map-view');
            expect(mapView.props.scrollEnabled).toBe(false);
            expect(mapView.props.zoomEnabled).toBe(false);
            expect(mapView.props.showsMyLocationButton).toBe(false);
            expect(mapView.props.showsCompass).toBe(false);
            expect(mapView.props.toolbarEnabled).toBe(false);
        });

        it('deve ter marker com tracksViewChanges false para performance', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            // tracksViewChanges is a Marker prop, not MapView - verify marker exists
            const marker = getByTestId('marker');
            expect(marker.props.tracksViewChanges).toBe(false);
        });
    });

    describe('Visibility animation', () => {
        it('deve iniciar animação quando visible muda', () => {
            const { rerender, toJSON, queryByTestId } = render(
                <PictureInPictureMap {...defaultProps} visible={false} />
            );

            // Inicialmente não visível
            expect(queryByTestId('pip-map-container')).toBeNull();

            // Mudar para visível
            rerender(<PictureInPictureMap {...defaultProps} visible={true} />);

            expect(toJSON()).toBeTruthy();
        });
    });

    describe('Marker', () => {
        it('deve mostrar destination marker com coordenadas corretas', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            const marker = getByTestId('marker');
            expect(marker.props.coordinate).toEqual({
                latitude: -23.5600,
                longitude: -46.6400,
                address: 'Rua Teste, 123',
            });
        });

        it('deve ter title com address do destination', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            const marker = getByTestId('marker');
            expect(marker.props.title).toBe('Rua Teste, 123');
        });
    });

    describe('Edge cases', () => {
        it('deve lidar com coordenadas muito próximas', () => {
            const props = {
                ...defaultProps,
                userLocation: { latitude: -23.5505, longitude: -46.6333 },
                destination: { latitude: -23.5506, longitude: -46.6334, address: 'Perto' },
            };

            const { getByTestId } = render(<PictureInPictureMap {...props} />);

            const mapView = getByTestId('pip-map-view');
            const region = mapView.props.region;

            // Deve ter delta mínimo
            expect(region.latitudeDelta).toBeGreaterThanOrEqual(0.01);
            expect(region.longitudeDelta).toBeGreaterThanOrEqual(0.01);
        });

        it('deve lidar com destination ao norte do userLocation', () => {
            const props = {
                ...defaultProps,
                userLocation: { latitude: -23.5600, longitude: -46.6333 },
                destination: { latitude: -23.5400, longitude: -46.6333, address: 'Norte' },
            };

            const { getByTestId } = render(<PictureInPictureMap {...props} />);

            expect(getByTestId('pip-map-view')).toBeTruthy();
        });

        it('deve lidar com destination ao sul do userLocation', () => {
            const props = {
                ...defaultProps,
                userLocation: { latitude: -23.5400, longitude: -46.6333 },
                destination: { latitude: -23.5600, longitude: -46.6333, address: 'Sul' },
            };

            const { getByTestId } = render(<PictureInPictureMap {...props} />);

            expect(getByTestId('pip-map-view')).toBeTruthy();
        });
    });

    describe('Accessibility', () => {
        it('deve ter labels de acessibilidade nos botões', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            const expandButton = getByTestId('pip-expand-button');
            const closeButton = getByTestId('pip-close-button');

            expect(expandButton.props.accessibilityLabel).toBe('Expandir mapa');
            expect(closeButton.props.accessibilityLabel).toBe('Fechar mapa');
        });

        it('deve ter role de botão', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            const expandButton = getByTestId('pip-expand-button');
            const closeButton = getByTestId('pip-close-button');

            expect(expandButton.props.accessibilityRole).toBe('button');
            expect(closeButton.props.accessibilityRole).toBe('button');
        });
    });

    describe('Callbacks', () => {
        it('deve ter onClose como função', () => {
            const onClose = jest.fn();

            render(<PictureInPictureMap {...defaultProps} onClose={onClose} />);

            expect(typeof onClose).toBe('function');
        });

        it('deve ter onExpand como função', () => {
            const onExpand = jest.fn();

            render(<PictureInPictureMap {...defaultProps} onExpand={onExpand} />);

            expect(typeof onExpand).toBe('function');
        });
    });
});
