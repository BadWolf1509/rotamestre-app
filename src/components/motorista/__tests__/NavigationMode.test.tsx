import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { NavigationMode } from '../NavigationMode';

// Access global useAlert mock
declare global {
  var mockUseAlert: {
    showAlert: jest.Mock;
    showSuccess: jest.Mock;
    showWarning: jest.Mock;
    showError: jest.Mock;
    showConfirm: jest.Mock;
    showDestructive: jest.Mock;
    hideAlert: jest.Mock;
    isVisible: boolean;
    AlertDialog: null;
  };
}

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
        getNavigationPreferences: jest.fn().mockResolvedValue({
            internalNavigation: false,
            autoAdvance: true,
            proximityRadius: 50,
        }),
    },
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn().mockResolvedValue(undefined),
    notificationAsync: jest.fn().mockResolvedValue(undefined),
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

// Mock expo-av
jest.mock('expo-av', () => ({
    Audio: {
        Sound: {
            createAsync: jest.fn().mockResolvedValue({ sound: { unloadAsync: jest.fn() } }),
        },
        setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
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
            gray50: '#f9fafb',
            gray100: '#f3f4f6',
            gray200: '#e5e7eb',
            gray300: '#d1d5db',
            gray400: '#9ca3af',
            gray500: '#6b7280',
            gray600: '#4b5563',
            gray700: '#374151',
            gray900: '#111827',
            success: '#10b981',
            warning: '#f59e0b',
            warningBg: '#fef3c7',
            secondaryDark: '#92400e',
            error: '#ef4444',
            info: '#3b82f6',
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

// Mock NavigationSettings
jest.mock('../NavigationSettings', () => ({
    NavigationSettings: () => null,
}));

// Mock TurnByTurnNavigation
jest.mock('../TurnByTurnNavigation', () => ({
    TurnByTurnNavigation: () => null,
}));

describe('NavigationMode', () => {
    const defaultProps = {
        currentStop: {
            id: 'stop-1',
            endereco: 'Rua Destino, 456',
            latitude: -23.5600,
            longitude: -46.6400,
            ordem: 1,
            status: 'pendente',
            tipo: 'entrega',
        },
        nextStop: {
            id: 'stop-2',
            endereco: 'Próxima Rua, 789',
            latitude: -23.5700,
            longitude: -46.6500,
            ordem: 2,
            status: 'pendente',
            tipo: 'entrega',
        },
        paradas: [
            { id: 'stop-1', endereco: 'Rua Destino, 456', latitude: -23.5600, longitude: -46.6400, ordem: 1, status: 'pendente', tipo: 'entrega' },
            { id: 'stop-2', endereco: 'Próxima Rua, 789', latitude: -23.5700, longitude: -46.6500, ordem: 2, status: 'pendente', tipo: 'entrega' },
        ],
        rotaId: 'rota-1',
        onComplete: jest.fn(),
        onSkip: jest.fn(),
        onExit: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('deve mostrar loading inicialmente', () => {
            const { getByText } = render(<NavigationMode {...defaultProps} />);

            expect(getByText('Preparando navegação...')).toBeTruthy();
        });

        it('deve renderizar o mapa quando currentStop existe', async () => {
            const { getByTestId } = render(<NavigationMode {...defaultProps} />);

            await waitFor(() => {
                expect(getByTestId('map-view')).toBeTruthy();
            });
        });

        it('deve renderizar marker de destino', async () => {
            const { getAllByTestId } = render(<NavigationMode {...defaultProps} />);

            await waitFor(() => {
                const markers = getAllByTestId('marker');
                expect(markers.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Complete stop', () => {
        it('deve mostrar confirmação ao completar', async () => {
            const { getByText } = render(<NavigationMode {...defaultProps} />);

            await waitFor(() => {
                expect(getByText('Concluir')).toBeTruthy();
            });

            const completeButton = getByText('Concluir');
            fireEvent.press(completeButton);

            // Wait for async handler to complete
            await waitFor(() => {
                expect(global.mockUseAlert.showConfirm).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Confirmar Entrega',
                        message: expect.stringContaining('Rua Destino, 456'),
                    })
                );
            });
        });

        it('deve chamar onComplete quando confirmado', async () => {
            // Mock showConfirm to return true (user confirms)
            global.mockUseAlert.showConfirm.mockResolvedValue(true);

            const { getByText } = render(<NavigationMode {...defaultProps} />);

            await waitFor(() => {
                expect(getByText('Concluir')).toBeTruthy();
            });

            const completeButton = getByText('Concluir');
            fireEvent.press(completeButton);

            // Wait for onComplete to be called after confirmation
            await waitFor(() => {
                expect(defaultProps.onComplete).toHaveBeenCalled();
            });
        });
    });

    describe('Skip stop', () => {
        it('deve mostrar confirmação ao pular', async () => {
            const { getByText } = render(<NavigationMode {...defaultProps} />);

            await waitFor(() => {
                expect(getByText('Pular')).toBeTruthy();
            });

            const skipButton = getByText('Pular');
            fireEvent.press(skipButton);

            // Wait for async handler to complete
            await waitFor(() => {
                expect(global.mockUseAlert.showConfirm).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Pular Parada',
                        message: expect.stringContaining('Rua Destino, 456'),
                    })
                );
            });
        });

        it('deve chamar onSkip quando confirmado', async () => {
            // Mock showConfirm to return true (user confirms)
            global.mockUseAlert.showConfirm.mockResolvedValue(true);

            const { getByText } = render(<NavigationMode {...defaultProps} />);

            await waitFor(() => {
                expect(getByText('Pular')).toBeTruthy();
            });

            const skipButton = getByText('Pular');
            fireEvent.press(skipButton);

            // Wait for onSkip to be called after confirmation
            await waitFor(() => {
                expect(defaultProps.onSkip).toHaveBeenCalled();
            });
        });
    });

    describe('Open in maps', () => {
        it('deve abrir navegação externa quando botão pressionado', async () => {
            const { abrirNavegacao } = require('@/lib/navigation');

            const { getByText } = render(<NavigationMode {...defaultProps} />);

            await waitFor(() => {
                expect(getByText('Abrir no Maps')).toBeTruthy();
            });

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
        it('deve mostrar parada atual', async () => {
            const { getByText } = render(<NavigationMode {...defaultProps} />);

            await waitFor(() => {
                expect(getByText('Rua Destino, 456')).toBeTruthy();
            });
        });

        it('deve mostrar número da parada', async () => {
            const { getByText } = render(<NavigationMode {...defaultProps} />);

            await waitFor(() => {
                // Component renders "• Parada {currentStopIndex}/{realParadas.length}"
                expect(getByText(/Parada 1\/2/)).toBeTruthy();
            });
        });

        it('deve mostrar hint da próxima parada', async () => {
            const { getByText } = render(<NavigationMode {...defaultProps} />);

            await waitFor(() => {
                expect(getByText(/Próxima:/)).toBeTruthy();
            });
        });

        it('não deve mostrar hint quando não há nextStop', async () => {
            const { queryByText, getByText } = render(
                <NavigationMode {...defaultProps} nextStop={undefined} />
            );

            await waitFor(() => {
                expect(getByText('Rua Destino, 456')).toBeTruthy();
            });

            expect(queryByText(/Próxima:/)).toBeNull();
        });

        it('deve mostrar destinatário quando fornecido', async () => {
            const props = {
                ...defaultProps,
                currentStop: {
                    ...defaultProps.currentStop,
                    destinatario: 'João Silva',
                },
            };

            const { getByText } = render(<NavigationMode {...props} />);

            await waitFor(() => {
                expect(getByText('João Silva')).toBeTruthy();
            });
        });

        it('deve mostrar observações quando fornecidas', async () => {
            const props = {
                ...defaultProps,
                currentStop: {
                    ...defaultProps.currentStop,
                    observacoes: 'Tocar interfone 123',
                },
            };

            const { getByText } = render(<NavigationMode {...props} />);

            await waitFor(() => {
                expect(getByText('Tocar interfone 123')).toBeTruthy();
            });
        });
    });

    describe('Map properties', () => {
        it('deve configurar estilo MapLibre', async () => {
            const { getByTestId } = render(<NavigationMode {...defaultProps} />);

            await waitFor(() => {
                const mapView = getByTestId('map-view');
                expect(mapView.props.mapStyle).toBeTruthy();
            });
        });
    });

    describe('Region calculation', () => {
        it('deve usar currentStop como centro quando não há userLocation', async () => {
            const { getByTestId } = render(<NavigationMode {...defaultProps} />);

            await waitFor(() => {
                const camera = getByTestId('map-camera');
                expect(camera.props.centerCoordinate).toEqual([-46.6400, -23.5600]);
            });
        });
    });
});
