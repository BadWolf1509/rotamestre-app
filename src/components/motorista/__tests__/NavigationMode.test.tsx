import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { NavigationMode } from '../NavigationMode';

// Mock expo-location
jest.mock('expo-location', () => ({
    watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
    requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    Accuracy: {
        BestForNavigation: 6,
    },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn(),
}));

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

// Mock navigation lib
jest.mock('@/lib/navigation', () => ({
    abrirNavegacao: jest.fn(),
}));

// Mock LocationTrackingService
jest.mock('@/services/locationTracking', () => ({
    __esModule: true,
    default: {
        startTracking: jest.fn().mockResolvedValue(true),
        stopTracking: jest.fn().mockResolvedValue(undefined),
    },
}));

// Mock styles
jest.mock('@/utils/styles', () => ({
    defaultTheme: {
        colors: {
            white: '#fff',
            black: '#000',
            primary: '#007AFF',
            gray200: '#e5e7eb',
            gray400: '#9ca3af',
            gray500: '#6b7280',
            gray900: '#111827',
            success: '#10b981',
            warning: '#f59e0b',
            warningBg: '#fef3c7',
            secondaryDark: '#92400e',
            error: '#ef4444',
        },
    },
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

// Mock NavigationSettings
jest.mock('../NavigationSettings', () => ({
    NavigationSettings: () => null,
}));

// Mock TurnByTurnNavigation
jest.mock('../TurnByTurnNavigation', () => ({
    TurnByTurnNavigation: () => null,
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('NavigationMode', () => {
    const defaultProps = {
        currentStop: {
            id: 'stop-1',
            rota_id: 'rota-1',
            endereco: 'Rua Destino, 456',
            latitude: -23.5600,
            longitude: -46.6400,
            ordem: 1,
        },
        nextStop: {
            id: 'stop-2',
            endereco: 'Próxima Rua, 789',
            latitude: -23.5700,
            longitude: -46.6500,
            ordem: 2,
        },
        paradas: [
            { id: 'stop-1', endereco: 'Rua Destino, 456', latitude: -23.5600, longitude: -46.6400, ordem: 1, status: 'pendente' },
            { id: 'stop-2', endereco: 'Próxima Rua, 789', latitude: -23.5700, longitude: -46.6500, ordem: 2, status: 'pendente' },
        ],
        onComplete: jest.fn(),
        onSkip: jest.fn(),
        onExit: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('deve retornar null quando currentStop é null', () => {
            const { toJSON } = render(
                <NavigationMode {...defaultProps} currentStop={null} />
            );

            expect(toJSON()).toBeNull();
        });

        it('deve renderizar o mapa quando currentStop existe', () => {
            const { getByTestId } = render(<NavigationMode {...defaultProps} />);

            expect(getByTestId('map-view')).toBeTruthy();
        });

        it('deve renderizar marker de destino', () => {
            const { getAllByTestId } = render(<NavigationMode {...defaultProps} />);

            const markers = getAllByTestId('marker');
            expect(markers.length).toBeGreaterThan(0);
        });
    });

    describe('Complete stop', () => {
        it('deve mostrar Alert de confirmação ao completar', () => {
            const { getByText } = render(<NavigationMode {...defaultProps} />);

            const completeButton = getByText('Concluir');
            fireEvent.press(completeButton);

            expect(Alert.alert).toHaveBeenCalledWith(
                'Confirmar Entrega',
                expect.stringContaining('Rua Destino, 456'),
                expect.any(Array)
            );
        });

        it('deve chamar onComplete quando confirmado', () => {
            const { getByText } = render(<NavigationMode {...defaultProps} />);

            const completeButton = getByText('Concluir');
            fireEvent.press(completeButton);

            // Simular confirmação no Alert
            const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
            const confirmButton = alertCall[2].find((btn: any) => btn.text === 'Confirmar');
            confirmButton.onPress();

            expect(defaultProps.onComplete).toHaveBeenCalled();
        });
    });

    describe('Skip stop', () => {
        it('deve mostrar Alert de confirmação ao pular', () => {
            const { getByText } = render(<NavigationMode {...defaultProps} />);

            const skipButton = getByText('Pular');
            fireEvent.press(skipButton);

            expect(Alert.alert).toHaveBeenCalledWith(
                'Pular Parada',
                expect.stringContaining('Rua Destino, 456'),
                expect.any(Array)
            );
        });

        it('deve chamar onSkip quando confirmado', () => {
            const { getByText } = render(<NavigationMode {...defaultProps} />);

            const skipButton = getByText('Pular');
            fireEvent.press(skipButton);

            // Simular confirmação no Alert
            const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
            const skipConfirm = alertCall[2].find((btn: any) => btn.text === 'Pular');
            skipConfirm.onPress();

            expect(defaultProps.onSkip).toHaveBeenCalled();
        });
    });

    describe('Open in maps', () => {
        it('deve abrir navegação externa quando botão pressionado', () => {
            const { abrirNavegacao } = require('@/lib/navigation');

            const { getByText } = render(<NavigationMode {...defaultProps} />);

            const mapsButton = getByText('Abrir no Maps');
            fireEvent.press(mapsButton);

            expect(abrirNavegacao).toHaveBeenCalledWith({
                latitude: -23.5600,
                longitude: -46.6400,
                endereco: 'Rua Destino, 456',
            });
        });
    });

    describe('Info panel', () => {
        it('deve mostrar parada atual', () => {
            const { getByText } = render(<NavigationMode {...defaultProps} />);

            expect(getByText('Rua Destino, 456')).toBeTruthy();
        });

        it('deve mostrar número da parada', () => {
            const { getByText } = render(<NavigationMode {...defaultProps} />);

            expect(getByText('PARADA 1/2')).toBeTruthy();
        });

        it('deve mostrar hint da próxima parada', () => {
            const { getByText } = render(<NavigationMode {...defaultProps} />);

            expect(getByText(/Próxima:/)).toBeTruthy();
        });

        it('não deve mostrar hint quando não há nextStop', () => {
            const { queryByText } = render(
                <NavigationMode {...defaultProps} nextStop={undefined} />
            );

            expect(queryByText(/Próxima:/)).toBeNull();
        });

        it('deve mostrar destinatário quando fornecido', () => {
            const props = {
                ...defaultProps,
                currentStop: {
                    ...defaultProps.currentStop,
                    destinatario: 'João Silva',
                },
            };

            const { getByText } = render(<NavigationMode {...props} />);

            expect(getByText('João Silva')).toBeTruthy();
        });

        it('deve mostrar observações quando fornecidas', () => {
            const props = {
                ...defaultProps,
                currentStop: {
                    ...defaultProps.currentStop,
                    observacoes: 'Tocar interfone 123',
                },
            };

            const { getByText } = render(<NavigationMode {...props} />);

            expect(getByText('Tocar interfone 123')).toBeTruthy();
        });
    });

    describe('Map properties', () => {
        it('deve usar PROVIDER_GOOGLE', () => {
            const { getByTestId } = render(<NavigationMode {...defaultProps} />);

            const mapView = getByTestId('map-view');
            expect(mapView.props.provider).toBe('google');
        });

        it('deve mostrar user location', () => {
            const { getByTestId } = render(<NavigationMode {...defaultProps} />);

            const mapView = getByTestId('map-view');
            expect(mapView.props.showsUserLocation).toBe(true);
        });
    });

    describe('Region calculation', () => {
        it('deve usar currentStop como centro quando não há userLocation', () => {
            const { getByTestId } = render(<NavigationMode {...defaultProps} />);

            const mapView = getByTestId('map-view');
            expect(mapView.props.region.latitude).toBe(-23.5600);
            expect(mapView.props.region.longitude).toBe(-46.6400);
        });
    });
});
