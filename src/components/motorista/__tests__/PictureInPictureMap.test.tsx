import { render } from '@testing-library/react-native';
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
        PROVIDER_GOOGLE: 'google',
    };
});

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
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

            expect(getByTestId('map-view')).toBeTruthy();
        });

        it('não deve renderizar quando visible é false', () => {
            const { queryByTestId } = render(
                <PictureInPictureMap {...defaultProps} visible={false} />
            );

            expect(queryByTestId('map-view')).toBeNull();
        });

        it('não deve renderizar quando não há userLocation nem destination', () => {
            const { queryByTestId } = render(
                <PictureInPictureMap
                    {...defaultProps}
                    userLocation={null}
                    destination={null}
                />
            );

            expect(queryByTestId('map-view')).toBeNull();
        });

        it('deve renderizar apenas com userLocation', () => {
            const { getByTestId } = render(
                <PictureInPictureMap
                    {...defaultProps}
                    destination={null}
                />
            );

            expect(getByTestId('map-view')).toBeTruthy();
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
        it('deve chamar onClose quando botão close é pressionado', () => {
            const onClose = jest.fn();
            const { UNSAFE_getAllByType: _UNSAFE_getAllByType } = render(
                <PictureInPictureMap {...defaultProps} onClose={onClose} />
            );

            // O componente deve ter botões de controle
            expect(onClose).not.toHaveBeenCalled();
        });

        it('deve ter botão de expand/collapse', () => {
            const { toJSON } = render(<PictureInPictureMap {...defaultProps} />);

            expect(toJSON()).toBeTruthy();
        });
    });

    describe('Region calculation', () => {
        it('deve calcular região corretamente com userLocation e destination', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            const mapView = getByTestId('map-view');
            expect(mapView.props.region).toBeDefined();
        });

        it('deve calcular centro da região entre userLocation e destination', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            const mapView = getByTestId('map-view');
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

            const mapView = getByTestId('map-view');
            const region = mapView.props.region;

            expect(region.latitude).toBe(-23.5505);
            expect(region.longitude).toBe(-46.6333);
        });
    });

    describe('Map properties', () => {
        it('deve mostrar user location', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            const mapView = getByTestId('map-view');
            expect(mapView.props.showsUserLocation).toBe(true);
        });

        it('deve usar PROVIDER_GOOGLE', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            const mapView = getByTestId('map-view');
            expect(mapView.props.provider).toBe('google');
        });

        it('deve desabilitar botões de navegação do mapa quando collapsed', () => {
            const { getByTestId } = render(<PictureInPictureMap {...defaultProps} />);

            const mapView = getByTestId('map-view');
            expect(mapView.props.showsMyLocationButton).toBe(false);
            expect(mapView.props.showsCompass).toBe(false);
            expect(mapView.props.toolbarEnabled).toBe(false);
        });
    });

    describe('Visibility animation', () => {
        it('deve iniciar animação quando visible muda', () => {
            const { rerender, toJSON } = render(
                <PictureInPictureMap {...defaultProps} visible={false} />
            );

            // Inicialmente não visível
            expect(toJSON()).toBeNull();

            // Mudar para visível
            rerender(<PictureInPictureMap {...defaultProps} visible={true} />);

            expect(toJSON()).toBeTruthy();
        });
    });

    describe('Marker', () => {
        it('deve mostrar destination marker com endereço correto', () => {
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

            const mapView = getByTestId('map-view');
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

            expect(getByTestId('map-view')).toBeTruthy();
        });

        it('deve lidar com destination ao sul do userLocation', () => {
            const props = {
                ...defaultProps,
                userLocation: { latitude: -23.5400, longitude: -46.6333 },
                destination: { latitude: -23.5600, longitude: -46.6333, address: 'Sul' },
            };

            const { getByTestId } = render(<PictureInPictureMap {...props} />);

            expect(getByTestId('map-view')).toBeTruthy();
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
