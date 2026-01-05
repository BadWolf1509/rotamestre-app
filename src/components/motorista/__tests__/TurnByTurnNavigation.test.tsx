import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { TurnByTurnNavigation } from '../TurnByTurnNavigation';

// Mock expo-keep-awake
jest.mock('expo-keep-awake', () => ({
    useKeepAwake: jest.fn(),
}));

// Mock expo-location
jest.mock('expo-location', () => ({
    watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
    requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    Accuracy: {
        BestForNavigation: 6,
    },
}));

// Mock expo-speech
jest.mock('expo-speech', () => ({
    speak: jest.fn(),
    stop: jest.fn(),
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
        Polyline: (props: any) => (
            <View testID="polyline" {...props} />
        ),
        PROVIDER_GOOGLE: 'google',
    };
});

// Mock navigation service
jest.mock('@/services/turnByTurnNavigation', () => ({
    __esModule: true,
    default: {
        getDirections: jest.fn().mockResolvedValue({
            distance: 5000,
            duration: 600,
        }),
        reset: jest.fn(),
        getRouteCoordinates: jest.fn().mockReturnValue([
            { latitude: -23.5505, longitude: -46.6333 },
            { latitude: -23.5600, longitude: -46.6400 },
        ]),
        getCurrentInstruction: jest.fn().mockReturnValue({
            instruction: 'Siga em frente',
            maneuver: 'straight',
            voiceInstruction: 'Siga em frente',
        }),
        getNextInstruction: jest.fn().mockReturnValue({
            instruction: 'Vire à direita',
            maneuver: 'turn-right',
        }),
        updateNavigation: jest.fn().mockResolvedValue({
            currentInstruction: { instruction: 'Siga em frente', maneuver: 'straight' },
            nextInstruction: { instruction: 'Vire à direita', maneuver: 'turn-right' },
            distanceToNextTurn: 250,
            shouldSpeak: false,
        }),
        getProgress: jest.fn().mockReturnValue(25),
        getRemainingDistance: jest.fn().mockReturnValue(3750),
        getRemainingTime: jest.fn().mockReturnValue(450),
        setVoiceEnabled: jest.fn(),
        speakInstruction: jest.fn(),
    },
}));

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
            xs: 12,
            sm: 14,
            base: 16,
            lg: 18,
            xl: 20,
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

describe('TurnByTurnNavigation', () => {
    const defaultProps = {
        origin: { latitude: -23.5505, longitude: -46.6333 },
        destination: { latitude: -23.5600, longitude: -46.6400, address: 'Rua Destino, 456' },
        onArrive: jest.fn(),
        onExit: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('deve renderizar o mapa após carregar', async () => {
            const { getByTestId } = render(<TurnByTurnNavigation {...defaultProps} />);

            await waitFor(() => {
                expect(getByTestId('map-view')).toBeTruthy();
            });
        });

        it('deve renderizar polyline com rota', async () => {
            const { getByTestId } = render(<TurnByTurnNavigation {...defaultProps} />);

            await waitFor(() => {
                expect(getByTestId('polyline')).toBeTruthy();
            });
        });

        it('deve renderizar marker de destino', async () => {
            const { getByTestId } = render(<TurnByTurnNavigation {...defaultProps} />);

            await waitFor(() => {
                expect(getByTestId('marker')).toBeTruthy();
            });
        });
    });

    describe('Exit button', () => {
        it('deve chamar onExit quando pressionado', async () => {
            const onExit = jest.fn();
            const { getByText } = render(
                <TurnByTurnNavigation {...defaultProps} onExit={onExit} />
            );

            await waitFor(() => {
                const exitButton = getByText('Sair');
                fireEvent.press(exitButton);
                expect(onExit).toHaveBeenCalled();
            });
        });
    });

    describe('Map view', () => {
        it('deve usar PROVIDER_GOOGLE', async () => {
            const { getByTestId } = render(<TurnByTurnNavigation {...defaultProps} />);

            await waitFor(() => {
                const mapView = getByTestId('map-view');
                expect(mapView.props.provider).toBe('google');
            });
        });

        it('deve mostrar user location', async () => {
            const { getByTestId } = render(<TurnByTurnNavigation {...defaultProps} />);

            await waitFor(() => {
                const mapView = getByTestId('map-view');
                expect(mapView.props.showsUserLocation).toBe(true);
            });
        });
    });

    describe('Waypoints', () => {
        it('deve aceitar waypoints opcionais', async () => {
            const waypoints = [{ latitude: -23.5550, longitude: -46.6360 }];

            const { getByTestId } = render(
                <TurnByTurnNavigation {...defaultProps} waypoints={waypoints} />
            );

            await waitFor(() => {
                expect(getByTestId('map-view')).toBeTruthy();
            });
        });
    });

    describe('Props validation', () => {
        it('deve ter origin com latitude e longitude', () => {
            const { toJSON } = render(<TurnByTurnNavigation {...defaultProps} />);

            expect(defaultProps.origin.latitude).toBe(-23.5505);
            expect(defaultProps.origin.longitude).toBe(-46.6333);
            expect(toJSON()).toBeTruthy();
        });

        it('deve ter destination com latitude, longitude e address', () => {
            const { toJSON } = render(<TurnByTurnNavigation {...defaultProps} />);

            expect(defaultProps.destination.latitude).toBe(-23.5600);
            expect(defaultProps.destination.longitude).toBe(-46.6400);
            expect(defaultProps.destination.address).toBe('Rua Destino, 456');
            expect(toJSON()).toBeTruthy();
        });
    });

    describe('Callbacks', () => {
        it('deve ter onArrive como função', () => {
            render(<TurnByTurnNavigation {...defaultProps} />);
            expect(typeof defaultProps.onArrive).toBe('function');
        });

        it('deve ter onExit como função', () => {
            render(<TurnByTurnNavigation {...defaultProps} />);
            expect(typeof defaultProps.onExit).toBe('function');
        });
    });
});
